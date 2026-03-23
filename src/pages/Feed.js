import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

function decodeHtml(str) {
  if (!str) return '';
  const textarea = document.createElement('textarea');
  textarea.innerHTML = str;
  return textarea.value;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

function ArticleCard({ article }) {
  return (
    <a
      href={article.link}
      target="_blank"
      rel="noopener noreferrer"
      className="card"
    >
      <div className="cardTop">
        <div className="tag">{article.content_type}</div>
        <div className="meta">
          <span className="metaItem">{article.source}</span>
          <span className="metaDot" aria-hidden="true">
            ·
          </span>
          <span className="metaItem">{formatDate(article.pub_date)}</span>
        </div>
      </div>
      <h3 className="cardTitle">{decodeHtml(article.title)}</h3>
      <p className="cardSummary">{decodeHtml(article.summary)}</p>
    </a>
  );
}

const DATE_RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: 'All time', days: null },
];

export default function Feed({ role, industry, onOpenOnboarding }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [articles, setArticles] = useState([]);
  const [sortBy, setSortBy] = useState('recent');         // 'recent' | 'relevance'
  const [dateRange, setDateRange] = useState(30);         // days, null = all time

  useEffect(() => {
    if (!role || !industry) return;

    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError('');
      try {
        let query = supabase
          .from('articles')
          .select(
            `
            id,
            title,
            link,
            summary,
            content_type,
            source,
            pub_date,
            role_scores ( role, score ),
            industry_scores ( industry, score )
          `
          )
          .order('pub_date', { ascending: false });

        // Apply date filter when a range is selected
        if (dateRange !== null) {
          const since = new Date();
          since.setDate(since.getDate() - dateRange);
          query = query.gte('pub_date', since.toISOString());
        }

        const { data, error: err } = await query;
        if (err) throw err;
        if (cancelled) return;

        // Deduplicate by link in case the same URL slipped through upsert
        const seen = new Set();
        const deduped = (data || []).filter((a) => {
          if (seen.has(a.link)) return false;
          seen.add(a.link);
          return true;
        });

        setArticles(deduped);
      } catch (e) {
        if (cancelled) return;
        setError(e.message || 'Failed to load articles.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [role, industry, dateRange]);

  const { industryFocused, general } = useMemo(() => {
    if (!role || !industry) return { industryFocused: [], general: [] };

    const withScores = (articles || []).map((a) => {
      const roleScore =
        (a.role_scores || []).find((r) => r.role === role)?.score ?? 0;
      const industryScore =
        (a.industry_scores || []).find((i) => i.industry === industry)?.score ?? 0;
      return { ...a, _roleScore: roleScore, _industryScore: industryScore };
    });

    // Only keep articles strongly relevant to the role.
    const roleFiltered = withScores.filter((a) => a._roleScore > 7);

    const sortFn = sortBy === 'recent'
      ? (a, b) => new Date(b.pub_date) - new Date(a.pub_date)
      : (a, b) => b._industryScore - a._industryScore;

    const sortFnGeneral = sortBy === 'recent'
      ? (a, b) => new Date(b.pub_date) - new Date(a.pub_date)
      : (a, b) => b._roleScore - a._roleScore;

    const industrySection = roleFiltered
      .filter((a) => a._industryScore > 7)
      .sort(sortFn)
      .slice(0, 24);

    const generalSection = roleFiltered
      .filter((a) => a._roleScore > 7 && a._industryScore <= 7)
      .sort(sortFnGeneral)
      .slice(0, 24);

    return { industryFocused: industrySection, general: generalSection };
  }, [articles, role, industry, sortBy]);

  if (!role || !industry) {
    return (
      <div className="page">
        <div className="feedWelcome">
          <div className="feedWelcomeLabel">AI Signal</div>
          <h1 className="feedWelcomeTitle">The AI news feed<br />built for your role.</h1>
          <p className="feedWelcomeSubtitle">
            Not generic AI news. Articles, papers, and launches scored and ranked
            specifically for your role and industry — updated daily.
          </p>
          <button className="feedWelcomeCta" onClick={onOpenOnboarding}>
            Personalise my feed →
          </button>
          <p className="feedWelcomeHint">Takes 10 seconds. No sign-up.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageTitle">Feed</div>
        <div className="pageSubtle">
          Showing the most relevant reads for <strong>{role}</strong> in{' '}
          <strong>{industry}</strong>.
        </div>
        <div className="feedControls">
          <div className="feedControlGroup">
            <span className="feedControlLabel">Sort by</span>
            <button
              className={`feedControlBtn${sortBy === 'recent' ? ' active' : ''}`}
              onClick={() => setSortBy('recent')}
            >
              Recent
            </button>
            <button
              className={`feedControlBtn${sortBy === 'relevance' ? ' active' : ''}`}
              onClick={() => setSortBy('relevance')}
            >
              Relevance
            </button>
          </div>
          <div className="feedControlGroup">
            <span className="feedControlLabel">From</span>
            {DATE_RANGES.map((r) => (
              <button
                key={r.label}
                className={`feedControlBtn${dateRange === r.days ? ' active' : ''}`}
                onClick={() => setDateRange(r.days)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="section">
          <div className="emptyState">Loading articles…</div>
        </div>
      ) : null}

      {error ? (
        <div className="section">
          <div className="emptyState">Error loading articles: {error}</div>
        </div>
      ) : null}

      <section className="section">
        <h2 className="sectionTitle">
          {industry} AI for {role}s
        </h2>
        <div className="grid">
          {industryFocused.length ? (
            industryFocused.map((article) => <ArticleCard key={article.id} article={article} />)
          ) : (
            <div className="emptyState">
              No articles found. Try expanding the date range or switching to "All time".
            </div>
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="sectionTitle">General AI for {role}s</h2>
        <div className="grid">
          {general.length ? (
            general.map((article) => <ArticleCard key={article.id} article={article} />)
          ) : (
            <div className="emptyState">
              No articles found. Try expanding the date range or switching to "All time".
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

