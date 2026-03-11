'use client';

import { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const defaultAgents = [
  { displayName: 'Conselheiro 1 — Claude', model: 'anthropic/claude-sonnet-4.6' },
  { displayName: 'Conselheiro 2 — Perplexity', model: 'perplexity/sonar-pro' },
  { displayName: 'Conselheiro 3 — Gemini', model: 'google/gemini-3-pro-preview' },
  { displayName: 'Conselheiro 4 — DeepSeek', model: 'deepseek/deepseek-v3.2' },
  { displayName: 'Conselheiro 5 — Grok', model: 'x-ai/grok-4.1-fast' },
  { displayName: 'Conselheiro 6 — GPT', model: 'openai/gpt-5.1' }
];

export default function HomePage() {
  const [baseUrl, setBaseUrl] = useState('https://openrouter.ai/api/v1');
  const [apiKey, setApiKey] = useState('');
  const [question, setQuestion] = useState('');
  const [temperature, setTemperature] = useState(0.4);
  const [maxTokens, setMaxTokens] = useState(700);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [agents, setAgents] = useState(defaultAgents);
  const [history, setHistory] = useState([]);
  const [roundResponses, setRoundResponses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const orderedNames = useMemo(() => agents.map((a) => a.displayName).join(' \u2192 '), [agents]);

  const updateAgentModel = (index, model) => {
    setAgents((prev) => prev.map((agent, i) => (i === index ? { ...agent, model } : agent)));
  };

  const runRound = async () => {
    setError('');
    if (!question.trim()) {
      setError('Digite uma pergunta antes de iniciar.');
      return;
    }
    if (!apiKey.trim()) {
      setError('Informe sua API key.');
      return;
    }

    setIsLoading(true);
    const nextHistory = [...history, { role: 'user', content: question.trim() }];

    try {
      const response = await fetch('/api/mentoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          baseUrl,
          apiKey,
          temperature,
          maxTokens,
          systemPrompt,
          agents,
          history: nextHistory
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Falha na rodada.');
      }

      const assistantMessages = data.responses.map((item) => ({
        role: 'assistant',
        content: `[${item.displayName}] ${item.answer}`
      }));

      setHistory([...nextHistory, ...assistantMessages]);
      setRoundResponses(data.responses);
      setQuestion('');
    } catch (err) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setHistory([]);
    setRoundResponses([]);
    setQuestion('');
    setError('');
  };

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1>Board of Life</h1>
      <p style={{ color: '#444' }}>Seus 6 conselheiros, em ordem: {orderedNames}</p>

      <section style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3>Configura\u00e7\u00e3o</h3>
        <label>API Key</label>
        <input value={apiKey} onChange={(e) => setApiKey(e.target.value)} type="password" style={inputStyle} />

        <label>Base URL</label>
        <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} style={inputStyle} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label>Temperatura</label>
            <input type="number" min="0" max="1" step="0.1" value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} style={inputStyle} />
          </div>
          <div>
            <label>M\u00e1x. tokens</label>
            <input type="number" min="200" max="2000" step="50" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>

        <label>Prompt Global (instru\u00e7\u00f5es para todos os agentes)</label>
        <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Ex.: Voc\u00ea \u00e9 um mentor especializado em apoiar m\u00e9dicos em transi\u00e7\u00e3o para carreira nos EUA..." />

        <h4>Modelos (ordem fixa)</h4>
        {agents.map((agent, index) => (
          <div key={agent.displayName} style={{ marginBottom: 8 }}>
            <label>{agent.displayName}</label>
            <input value={agent.model} onChange={(e) => updateAgentModel(index, e.target.value)} style={inputStyle} />
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3>Sua quest\u00e3o para o Board</h3>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Fa\u00e7a sua pergunta aos 6 conselheiros..." />

        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button disabled={isLoading} onClick={runRound} style={buttonStyle}>
            {isLoading ? 'Consultando o Board...' : 'Consultar o Board'}
          </button>
          <button disabled={isLoading} onClick={clearConversation} style={secondaryButtonStyle}>Limpar conversa</button>
        </div>

        {error && <p style={{ color: '#b00020', marginTop: 8 }}>{error}</p>}
      </section>

      {roundResponses.length > 0 && (
        <section style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <h3>Pareceres do Board</h3>
          {roundResponses.map((item) => (
            <article key={item.displayName} style={cardStyle}>
              <h4 style={cardTitleStyle}>{item.displayName}</h4>
              <div className="markdown-body">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.answer}</ReactMarkdown>
              </div>
            </article>
          ))}
          <p><strong>Todos os conselheiros se pronunciaram.</strong> A palavra \u00e9 sua.</p>
        </section>
      )}

      {history.length > 0 && (
        <section style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h3>Hist\u00f3rico</h3>
          {history.map((msg, idx) => (
            <div key={`${msg.role}-${idx}`} style={{ marginBottom: 12 }}>
              {msg.role === 'user' ? (
                <p style={{ fontWeight: 600, color: '#111827' }}>Voc\u00ea: {msg.content}</p>
              ) : (
                <div className="markdown-body">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      <style>{`
        .markdown-body h1, .markdown-body h2, .markdown-body h3, .markdown-body h4 {
          margin-top: 1em;
          margin-bottom: 0.5em;
          font-weight: 600;
          line-height: 1.3;
          color: #111827;
        }
        .markdown-body h1 { font-size: 1.4em; }
        .markdown-body h2 { font-size: 1.25em; }
        .markdown-body h3 { font-size: 1.1em; }
        .markdown-body h4 { font-size: 1em; }
        .markdown-body p {
          margin: 0.5em 0;
          line-height: 1.65;
        }
        .markdown-body ul, .markdown-body ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        .markdown-body li {
          margin: 0.3em 0;
          line-height: 1.6;
        }
        .markdown-body strong {
          font-weight: 600;
          color: #111827;
        }
        .markdown-body hr {
          border: none;
          border-top: 1px solid #e5e7eb;
          margin: 1em 0;
        }
        .markdown-body blockquote {
          border-left: 3px solid #6366f1;
          margin: 0.8em 0;
          padding: 0.4em 1em;
          background: #f8f9ff;
          border-radius: 0 6px 6px 0;
          color: #374151;
        }
        .markdown-body code {
          background: #f3f4f6;
          padding: 0.15em 0.4em;
          border-radius: 4px;
          font-size: 0.9em;
          font-family: 'Geist Mono', 'SF Mono', Consolas, monospace;
        }
        .markdown-body pre {
          background: #1f2937;
          color: #e5e7eb;
          padding: 1em;
          border-radius: 8px;
          overflow-x: auto;
          margin: 0.8em 0;
        }
        .markdown-body pre code {
          background: none;
          padding: 0;
          color: inherit;
        }
        .markdown-body table {
          border-collapse: collapse;
          width: 100%;
          margin: 0.8em 0;
          font-size: 0.92em;
        }
        .markdown-body thead {
          background: #f3f4f6;
        }
        .markdown-body th, .markdown-body td {
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          text-align: left;
        }
        .markdown-body th {
          font-weight: 600;
          color: #111827;
        }
        .markdown-body tr:nth-child(even) {
          background: #fafafa;
        }
        .markdown-body a {
          color: #6366f1;
          text-decoration: none;
        }
        .markdown-body a:hover {
          text-decoration: underline;
        }
      `}</style>
    </main>
  );
}

const inputStyle = {
  width: '100%',
  padding: 10,
  borderRadius: 8,
  border: '1px solid #ccc',
  marginTop: 4,
  marginBottom: 10,
  boxSizing: 'border-box'
};

const buttonStyle = {
  background: '#111827',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '10px 14px',
  cursor: 'pointer'
};

const secondaryButtonStyle = {
  background: '#e5e7eb',
  color: '#111827',
  border: 'none',
  borderRadius: 8,
  padding: '10px 14px',
  cursor: 'pointer'
};

const cardStyle = {
  marginBottom: 20,
  padding: 16,
  background: '#fafbfc',
  borderRadius: 10,
  border: '1px solid #e5e7eb'
};

const cardTitleStyle = {
  margin: '0 0 8px 0',
  fontSize: '1.05em',
  color: '#6366f1',
  fontWeight: 600,
  borderBottom: '2px solid #e5e7eb',
  paddingBottom: 8
};
