/**
 * Standalone CommonJS seeder — safe to run directly with Node.js.
 * Skips articles that are already in the DB so daily runs only score new content.
 *
 * Usage:
 *   node scripts/seed.js
 *
 * Required env vars (set in .env locally, or as GitHub Actions secrets):
 *   ANTHROPIC_API_KEY  — Anthropic API key for Claude scoring
 *
 * Optional env vars (fall back to hardcoded Supabase public credentials):
 *   SUPABASE_URL       — Supabase project URL
 *   SUPABASE_ANON_KEY  — Supabase anon/public key
 */
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');
const { fetchRssFeeds, parseRssXml, scoreArticleWithClaude, FEEDS } = require('../src/lib/crawler');

// Supabase anon key is intentionally public-safe (read-only for anon role).
const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://biihykqyxrdykxhwgbvz.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJpaWh5a3F5eHJkeWt4aHdnYnZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NjY5NDEsImV4cCI6MjA4OTM0Mjk0MX0.2obnVhe5KgDYXoAqLscWQmxAzlXLw20hNMBx-BMLrWw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

async function getExistingLinks() {
  const { data, error } = await supabase.from('articles').select('link');
  if (error) throw error;
  return new Set((data || []).map((r) => r.link));
}

async function insertArticle(article) {
  const { data, error } = await supabase
    .from('articles')
    .upsert(
      {
        title: article.title,
        link: article.link,
        summary: article.summary,
        pub_date: article.pubDate,
        source: article.source,
        content_type: article.contentType,
      },
      { onConflict: 'link' }
    )
    .select('id, link')
    .single();
  if (error) throw error;
  return data;
}

async function insertRoleScores(articleId, roleScores) {
  const rows = Object.entries(roleScores).map(([role, score]) => ({
    article_id: articleId,
    role,
    score,
  }));
  const { error } = await supabase
    .from('role_scores')
    .upsert(rows, { onConflict: 'article_id,role' });
  if (error) throw error;
}

async function insertIndustryScores(articleId, industryScores) {
  const rows = Object.entries(industryScores).map(([industry, score]) => ({
    article_id: articleId,
    industry,
    score,
  }));
  const { error } = await supabase
    .from('industry_scores')
    .upsert(rows, { onConflict: 'article_id,industry' });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const CLAUDE_CALL_DELAY_MS = 5000;
const MAX_ARTICLES_PER_FEED = 20;

async function run() {
  const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY is not set.');
    process.exitCode = 1;
    return;
  }

  console.log('📡 Fetching RSS feeds...');
  const fetched = await fetchRssFeeds(FEEDS);

  const rawArticles = fetched.flatMap((f) =>
    parseRssXml({ xml: f.xml, name: f.name }).slice(0, MAX_ARTICLES_PER_FEED)
  );
  console.log(`   ${rawArticles.length} articles fetched across ${fetched.length} feeds.`);

  // Deduplicate within this batch by link.
  const seen = new Set();
  const deduped = rawArticles.filter((a) => {
    if (seen.has(a.link)) return false;
    seen.add(a.link);
    return true;
  });
  console.log(`   ${deduped.length} unique after in-batch dedup.`);

  // Skip articles already in the DB — no need to re-score them.
  console.log('🔍 Checking DB for existing articles...');
  const existingLinks = await getExistingLinks();
  const newArticles = deduped.filter((a) => !existingLinks.has(a.link));
  console.log(
    `   ${existingLinks.size} already in DB. ${newArticles.length} new articles to score.`
  );

  if (newArticles.length === 0) {
    console.log('✅ Nothing new to process. Done.');
    return;
  }

  // Score each new article with Claude, then insert.
  let inserted = 0;
  let failed = 0;

  for (let i = 0; i < newArticles.length; i++) {
    const a = newArticles[i];
    if (i > 0) await new Promise((r) => setTimeout(r, CLAUDE_CALL_DELAY_MS));

    console.log(`\n  [${i + 1}/${newArticles.length}] ${a.source}: ${a.title.slice(0, 70)}`);

    try {
      const scored = await scoreArticleWithClaude(a, apiKey);
      const row = await insertArticle({ ...a, ...scored });
      await insertRoleScores(row.id, scored.roleScores);
      await insertIndustryScores(row.id, scored.industryScores);
      inserted++;
      console.log(`    ✅ Inserted (id: ${row.id})`);
    } catch (err) {
      failed++;
      console.error(`    ❌ Failed: ${err.message}`);
    }
  }

  console.log(`\n🎉 Done. Inserted: ${inserted}, Failed: ${failed}`);
}

run().catch((err) => {
  console.error('❌ Fatal error:', err);
  process.exitCode = 1;
});
