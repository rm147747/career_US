'use client';

import { useMemo, useState } from 'react';

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

  const orderedNames = useMemo(() => agents.map((a) => a.displayName).join(' → '), [agents]);

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
        <h3>Configuração</h3>
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
            <label>Máx. tokens</label>
            <input type="number" min="200" max="2000" step="50" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>

        <label>Prompt Global (instruções para todos os agentes)</label>
        <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Ex.: Você é um mentor especializado em apoiar médicos em transição para carreira nos EUA..." />

        <h4>Modelos (ordem fixa)</h4>
        {agents.map((agent, index) => (
          <div key={agent.displayName} style={{ marginBottom: 8 }}>
            <label>{agent.displayName}</label>
            <input value={agent.model} onChange={(e) => updateAgentModel(index, e.target.value)} style={inputStyle} />
          </div>
        ))}
      </section>

      <section style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3>Sua questão para o Board</h3>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Faça sua pergunta aos 6 conselheiros..." />

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
            <article key={item.displayName} style={{ marginBottom: 14 }}>
              <h4 style={{ marginBottom: 4 }}>{item.displayName}</h4>
              <p style={{ marginTop: 0, whiteSpace: 'pre-wrap' }}>{item.answer}</p>
            </article>
          ))}
          <p><strong>Todos os conselheiros se pronunciaram.</strong> A palavra é sua.</p>
        </section>
      )}

      {history.length > 0 && (
        <section style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <h3>Histórico</h3>
          {history.map((msg, idx) => (
            <p key={`${msg.role}-${idx}`} style={{ whiteSpace: 'pre-wrap' }}>
              {msg.role === 'user' ? <strong>Você:</strong> : null} {msg.content}
            </p>
          ))}
        </section>
      )}
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
