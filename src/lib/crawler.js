require('dotenv').config();
const { XMLParser } = require('fast-xml-parser');
const { INDUSTRIES, ROLES } = require('../data/articles');

const FEEDS = [
  // Tech news
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'MIT Technology Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'The Verge - AI', url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml' },
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab' },
  { name: 'WIRED AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss' },
  // Lab & company blogs
  { name: 'Anthropic News', url: 'https://raw.githubusercontent.com/taobojlen/anthropic-rss-feed/main/anthropic_news_rss.xml' },
  { name: 'OpenAI Blog', url: 'https://openai.com/news/rss.xml' },
  { name: 'Microsoft AI', url: 'https://blogs.microsoft.com/ai/feed/' },
  { name: 'Hugging Face', url: 'https://huggingface.co/blog/feed.xml' },
  // Research
  { name: 'arXiv - AI', url: 'https://arxiv.org/rss/cs.AI' },
  { name: 'arXiv - ML', url: 'https://arxiv.org/rss/cs.LG' },
  { name: 'arXiv - NLP', url: 'http://arxiv.org/rss/cs.CL' },
  // Practitioners & blogs
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/' },
  { name: 'DEV.to - AI', url: 'https://dev.to/feed/tag/ai' },
  { name: 'DEV.to - Machine Learning', url: 'https://dev.to/feed/tag/machinelearning' },
  // Publications
  { name: 'Towards Data Science', url: 'https://towardsdatascience.com/feed' },
  // GitHub trending
  { name: 'GitHub Trending - Python', url: 'https://mshibanami.github.io/GitHubTrendingRSS/daily/python.xml' },
  { name: 'GitHub Trending - JavaScript', url: 'https://mshibanami.github.io/GitHubTrendingRSS/daily/javascript.xml' },
  // Newsletters
  { name: 'Import AI', url: 'https://importai.substack.com/feed' },
  { name: 'Latent Space', url: 'https://latentspace.substack.com/feed' },
  { name: 'Last Week in AI', url: 'https://lastweekin.ai/feed' },
];

function textOrEmpty(x) {
  if (x == null) return '';
  if (typeof x === 'string') return x;
  if (typeof x === 'number') return String(x);
  if (typeof x === 'object') {
    // fast-xml-parser often uses "#text" for nodes.
    if (typeof x['#text'] === 'string') return x['#text'];
    if (typeof x.cdata === 'string') return x.cdata;
  }
  return '';
}

// Extract the best available link from an RSS/Atom item.
// Atom feeds use <link href="..." rel="alternate"/> rather than <link>text</link>.
function extractLink(item) {
  // Plain RSS text link
  const plain = textOrEmpty(item.link).trim();
  if (plain) return plain;

  // Atom: <link href="..." /> parsed as object with @_href
  if (item.link && typeof item.link === 'object') {
    const href = item.link['@_href'];
    if (typeof href === 'string' && href.trim()) return href.trim();
    // Array of link elements (Atom may have multiple)
    if (Array.isArray(item.link)) {
      const alt = item.link.find((l) => !l['@_rel'] || l['@_rel'] === 'alternate');
      if (alt && typeof alt['@_href'] === 'string') return alt['@_href'].trim();
    }
  }

  // Atom: <id> is often the permalink when <link> is absent
  const id = textOrEmpty(item.id).trim();
  if (id.startsWith('http')) return id;

  // RSS: <guid isPermaLink="true"> or just a URL guid
  const guid = textOrEmpty(item.guid).trim();
  if (guid.startsWith('http')) return guid;

  return '';
}

function normalizeItem(item) {
  const title = textOrEmpty(item.title).trim();
  const link = extractLink(item);

  // RSS often has <description> and/or <content:encoded>
  const summary =
    textOrEmpty(item.description).trim() ||
    textOrEmpty(item['content:encoded']).trim() ||
    '';

  const pubDateRaw = textOrEmpty(item.pubDate).trim() || textOrEmpty(item.published).trim() || '';
  const pubDate = pubDateRaw ? new Date(pubDateRaw).toISOString() : null;

  return {
    title,
    link,
    summary,
    pubDate,
  };
}

async function fetchRssFeeds(feedOverrides = FEEDS) {
  const results = [];

  await Promise.all(
    feedOverrides.map(async (f) => {
      try {
        const res = await fetch(f.url);
        if (!res.ok) {
          // eslint-disable-next-line no-console
          console.error(`RSS fetch failed (${res.status}) for ${f.url}`);
          return;
        }
        const xml = await res.text();
        results.push({ ...f, xml });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`RSS fetch error for ${f.url}:`, err);
      }
    })
  );

  return results;
}

function parseRssXml({ xml, name }) {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      // Keep CDATA; we'll coerce to text later.
      cdataPropName: 'cdata',
      // Disable entity expansion to avoid hitting the 1000-entity limit on
      // content-heavy feeds (arXiv, Medium). Entities stay as literal text.
      processEntities: false,
    });

    const parsed = parser.parse(xml);

    const channel =
      parsed?.rss?.channel ||
      parsed?.feed || // Atom-ish
      null;

    const items = channel?.item || channel?.entry || [];
    const arr = Array.isArray(items) ? items : [items].filter(Boolean);

    return arr
      .map((it) => normalizeItem(it))
      .filter((x) => x.title && x.link)
      .map((x) => ({
        ...x,
        source: name,
      }));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`XML parse error for feed "${name}":`, err.message);
    return [];
  }
}

const ROLE_DESCRIPTIONS = {
  'AI Product Manager': 'Builds AI-powered products. Cares about: AI capabilities & limitations, UX patterns for AI, product launches, roadmaps, competitive landscape, enterprise AI adoption, prompting strategies, eval frameworks, model selection.',
  'ML/AI Engineer': 'Builds and deploys models. Cares about: model architectures, open-source repos/tools, fine-tuning, RAG, inference optimization, MLOps, benchmarks, frameworks (PyTorch, JAX, LangChain, etc.), deployment, GitHub projects.',
  'AI Researcher': 'Does original AI research. Cares about: papers (arxiv), model scaling, novel architectures, training techniques, evals methodology, safety research, interpretability, datasets, theoretical advances.',
  'AI Designer/UX': 'Designs AI-powered interfaces. Cares about: human-AI interaction patterns, prompt UX, conversational design, AI onboarding, ethics in design, cognitive load, trust and transparency, design tools with AI.',
  'Consultant': 'Advises organizations on AI strategy. Cares about: ROI of AI, implementation case studies, vendor landscape, enterprise use cases, risk management, AI maturity models, organizational readiness.',
  'Strategist': 'Sets AI direction at exec/org level. Cares about: market trends, competitive intelligence, policy & regulation, investment landscape, long-horizon AI impact, industry transformation, business model shifts.',
  'Talent Acquisition': 'Hires AI talent and uses AI in recruiting. Cares about: AI tools for sourcing/screening, skills in demand, AI roles & salaries, workforce trends, AI-assisted interviews, candidate experience.',
  'L&D Training Lead': 'Designs AI learning programs. Cares about: upskilling content, course design for AI, prompt engineering training, adoption case studies, adult learning + AI, workshop facilitation, AI literacy.',
  'Org AI Enablement Lead': 'Drives AI adoption across an organization. Cares about: change management, internal AI tools rollout, employee adoption, governance, responsible AI policies, measuring ROI, champions programs, AI Center of Excellence.',
  'BizOps/Ops Manager': 'Optimizes business operations with AI. Cares about: workflow automation, AI tools for productivity (writing, analysis, scheduling), process improvement, no-code/low-code AI, cost reduction, team efficiency.',
};

function claudePrompt({ title, link, summary, pubDate, source }) {
  const roles = ROLES.map((r) => `- ${r}: ${ROLE_DESCRIPTIONS[r] || ''}`).join('\n');
  const industries = INDUSTRIES.map((i) => `- ${i}`).join('\n');

  return `You are an expert editor for an AI knowledge library used by professionals across different roles.

Score this article's relevance for each role and industry on a 0-10 scale.
Scoring guide: 0 = irrelevant, 5 = tangentially relevant, 8 = clearly useful, 10 = must-read for that role.
Be precise: most articles are highly relevant to only 1-3 roles. Do not assign 8+ to a role unless the article directly addresses that role's day-to-day work.

Roles (with descriptions of what they care about):
${roles}

Industries:
${industries}

Also produce:
- a 2-sentence summary (plain, concrete, no hype)
- a contentType chosen from exactly: News, Tutorial, Research, Launch, GitHub, Practitioner

Return ONLY valid JSON and nothing else (no markdown, no backticks).
All 10 roles must be present in roleScores.
All 9 industries must be present in industryScores.

Article:
title: ${title}
source: ${source}
link: ${link}
pubDate: ${pubDate || ''}
summary_or_excerpt: ${summary || ''}`.trim();
}

async function callClaudeForScores({ apiKey, prompt }) {
  const MAX_RETRIES = 5;
  let delay = 5000; // start at 5 s, doubles on each 429

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        temperature: 0.2,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (res.status === 429) {
      if (attempt === MAX_RETRIES) {
        const txt = await res.text();
        throw new Error(`Claude request failed (429) after ${MAX_RETRIES} retries. ${txt}`);
      }
      // eslint-disable-next-line no-console
      console.warn(`    Rate-limited. Waiting ${delay / 1000}s before retry ${attempt}/${MAX_RETRIES - 1}...`);
      await new Promise((r) => setTimeout(r, delay));
      delay *= 2;
      continue;
    }

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Claude request failed (${res.status}). ${txt}`);
    }

    const data = await res.json();
    const parts = data?.content || [];
    return parts
      .filter((p) => p && p.type === 'text')
      .map((p) => p.text)
      .join('\n')
      .trim();
  }
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    // Try to recover if the model wrapped JSON in extra text.
    const first = text.indexOf('{');
    const last = text.lastIndexOf('}');
    if (first >= 0 && last > first) {
      const sliced = text.slice(first, last + 1);
      return JSON.parse(sliced);
    }
    throw new Error('Failed to parse JSON from Claude response.');
  }
}

function clampScore(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(10, Math.round(n)));
}

function normalizeScoreObject(obj, keys) {
  const out = {};
  for (const k of keys) out[k] = clampScore(obj?.[k] ?? 0);
  return out;
}

// Read from .env — never hardcode or commit this value.
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

async function scoreArticleWithClaude(article, apiKey = ANTHROPIC_API_KEY) {
  const key = (apiKey || '').trim();
  if (!key) throw new Error('Missing Anthropic API key.');

  const prompt = claudePrompt(article);
  const raw = await callClaudeForScores({ apiKey: key, prompt });
  const parsed = safeParseJson(raw);

  const roleScores = normalizeScoreObject(parsed?.roleScores, ROLES);
  const industryScores = normalizeScoreObject(parsed?.industryScores, INDUSTRIES);

  const contentType = String(parsed?.contentType || 'News');
  const allowed = new Set(['News', 'Tutorial', 'Research', 'Launch', 'GitHub', 'Practitioner']);
  const normalizedContentType = allowed.has(contentType) ? contentType : 'News';

  return {
    roleScores,
    industryScores,
    summary: String(parsed?.summary || '').trim() || article.summary || '',
    contentType: normalizedContentType,
    _rawClaude: raw,
  };
}

// ~5 s between Claude calls to stay under the 50k input-tokens/min org limit.
const CLAUDE_CALL_DELAY_MS = 5000;
// Cap per feed so a single large feed can't dominate a seed run.
// arXiv and GitHub Trending get a tighter cap; curated sources get more.
const MAX_ARTICLES_PER_FEED = 20;

async function crawl({ feeds = FEEDS, apiKey } = {}) {
  const fetched = await fetchRssFeeds(feeds);

  const rawArticles = fetched.flatMap((f) =>
    parseRssXml({ xml: f.xml, name: f.name }).slice(0, MAX_ARTICLES_PER_FEED)
  );

  // eslint-disable-next-line no-console
  console.log(`Scoring ${rawArticles.length} articles with Claude...`);

  const scored = [];
  for (let i = 0; i < rawArticles.length; i++) {
    const a = rawArticles[i];
    if (i > 0) await new Promise((r) => setTimeout(r, CLAUDE_CALL_DELAY_MS));
    // eslint-disable-next-line no-console
    console.log(`  [${i + 1}/${rawArticles.length}] ${a.source}: ${a.title.slice(0, 60)}`);

    const scoredOne = await scoreArticleWithClaude(a, apiKey);

    scored.push({
      // Base feed fields
      title: a.title,
      link: a.link,
      pubDate: a.pubDate,
      source: a.source,

      // Claude-enriched
      summary: scoredOne.summary,
      contentType: scoredOne.contentType,
      roleScores: scoredOne.roleScores,
      industryScores: scoredOne.industryScores,
    });
  }

  return scored;
}

module.exports = {
  FEEDS,
  fetchRssFeeds,
  parseRssXml,
  scoreArticleWithClaude,
  crawl,
};

