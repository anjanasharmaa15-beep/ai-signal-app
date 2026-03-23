import { useMemo, useState } from 'react';

async function callClaude({ apiKey, prompt }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'anthropic-version': '2023-06-01',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-latest',
      max_tokens: 700,
      temperature: 0.2,
      system:
        'You are AI Signal Digest. Summarize clearly, cite key claims as bullet points, and end with 3 suggested next reads.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Claude request failed (${res.status}). ${txt}`);
  }

  const data = await res.json();
  const parts = data?.content || [];
  const text = parts
    .filter((p) => p && p.type === 'text')
    .map((p) => p.text)
    .join('\n');
  return text || '(No text returned)';
}

export default function Search({ role, industry }) {
  const defaultPrompt = useMemo(() => {
    if (role && industry) {
      return `Create a short digest of the most important AI developments for an ${role} in ${industry}. Focus on what changed this week, what to do next, and what risks to watch.`;
    }
    return 'Create a short digest of the most important AI developments this week. Focus on what changed, what to do next, and what risks to watch.';
  }, [role, industry]);

  const [apiKey] = useState(process.env.REACT_APP_ANTHROPIC_API_KEY || '');
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [error, setError] = useState('');

  const run = async () => {
    setError('');
    setAnswer('');
    const key = apiKey.trim();
    if (!key) {
      setError('Add an Anthropic API key to run this search.');
      return;
    }
    setLoading(true);
    try {
      const text = await callClaude({ apiKey: key, prompt: prompt.trim() || defaultPrompt });
      setAnswer(text);
    } catch (e) {
      setError(e?.message || 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page">
      <div className="pageHeader">
        <div className="pageTitle">Digest</div>
        <div className="pageSubtle">
          Generate a personalised AI briefing for your role and industry.
        </div>
      </div>

      <div className="searchPanel">
        <label className="fieldLabel" htmlFor="prompt">
          Prompt
        </label>
        <textarea
          id="prompt"
          className="textarea"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder={defaultPrompt}
          rows={6}
        />

        <div className="searchActions">
          <button type="button" className="btnPrimary" onClick={run} disabled={loading}>
            {loading ? 'Running…' : 'Generate digest'}
          </button>
          {error ? <div className="error">{error}</div> : null}
        </div>
      </div>

      {answer ? (
        <section className="section">
          <h2 className="sectionTitle">Output</h2>
          <pre className="answer">{answer}</pre>
        </section>
      ) : null}
    </div>
  );
}

