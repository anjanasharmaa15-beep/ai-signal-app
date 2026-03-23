require('dotenv').config();
const { supabase } = require('./supabase');
const { crawl } = require('./crawler');

/**
 * Expected tables (typical shape):
 * - articles: id (pk), title, link (unique), summary, pub_date, source, content_type
 * - role_scores: article_id (fk), role, score
 * - industry_scores: article_id (fk), industry, score
 */

async function insertArticle(article) {
  const payload = {
    title: article.title,
    link: article.link,
    summary: article.summary,
    pub_date: article.pubDate,
    source: article.source,
    content_type: article.contentType,
  };

  // Upsert by link so reseeding updates the same row.
  const { data, error } = await supabase
    .from('articles')
    .upsert(payload, { onConflict: 'link' })
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

  const { error } = await supabase.from('role_scores').upsert(rows, {
    onConflict: 'article_id,role',
  });
  if (error) throw error;
}

async function insertIndustryScores(articleId, industryScores) {
  const rows = Object.entries(industryScores).map(([industry, score]) => ({
    article_id: articleId,
    industry,
    score,
  }));

  const { error } = await supabase.from('industry_scores').upsert(rows, {
    onConflict: 'article_id,industry',
  });
  if (error) throw error;
}

async function seed({ apiKey } = {}) {
  const articles = await crawl({ apiKey });

  const results = [];
  for (const a of articles) {
    const inserted = await insertArticle(a);
    await insertRoleScores(inserted.id, a.roleScores);
    await insertIndustryScores(inserted.id, a.industryScores);
    results.push({ articleId: inserted.id, link: inserted.link });
  }

  return { insertedCount: results.length, results };
}

module.exports = { seed };

// Allow running directly: `node src/lib/seed.js`
if (require.main === module) {
  // eslint-disable-next-line no-console
  console.log('🚀 Starting seed...');
  seed()
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log('🎉 Done! Result:');
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error('❌ Seed failed:', err);
      process.exitCode = 1;
    });
}

