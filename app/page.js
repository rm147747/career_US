'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { listSessions, loadSession, saveSession, deleteSession, renameSession } from './memory';

const defaultAgents = [
  { displayName: 'Conselheiro 1 — Claude', model: 'anthropic/claude-sonnet-4.6' },
  { displayName: 'Conselheiro 2 — Perplexity', model: 'perplexity/sonar-pro' },
  { displayName: 'Conselheiro 3 — Gemini', model: 'google/gemini-3-pro-preview' },
  { displayName: 'Conselheiro 4 — DeepSeek', model: 'deepseek/deepseek-v3.2' },
  { displayName: 'Conselheiro 5 — Grok', model: 'x-ai/grok-4.1-fast' },
  { displayName: 'Conselheiro 6 — GPT', model: 'openai/gpt-5.1' }
];

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

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

  // --- Attachments ---
  const [attachments, setAttachments] = useState([]); // { name, type, data, preview? }
  const [isProcessing, setIsProcessing] = useState(false);

  const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const ACCEPTED_EXTENSIONS = '.txt,.csv,.md,.json,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp';

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setIsProcessing(true);
    setError('');

    const newAttachments = [];
    for (const file of files) {
      try {
        if (IMAGE_TYPES.includes(file.type)) {
          // Images: convert to base64 for multimodal API
          const base64 = await fileToBase64(file);
          newAttachments.push({
            name: file.name,
            type: 'image',
            mimeType: file.type,
            data: base64,
            preview: URL.createObjectURL(file),
          });
        } else {
          // Documents: extract text via server
          const formData = new FormData();
          formData.append('file', file);
          const res = await fetch('/api/extract', { method: 'POST', body: formData });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error);
          newAttachments.push({
            name: file.name,
            type: 'document',
            data: result.text,
            warning: result.warning,
          });
        }
      } catch (err) {
        setError(`Erro ao processar ${file.name}: ${err.message}`);
      }
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    setIsProcessing(false);
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  // --- Tools ---
  const [showTools, setShowTools] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [codeInput, setCodeInput] = useState('');
  const [codeLang, setCodeLang] = useState('python');
  const [databankQuery, setDatabankQuery] = useState('');
  const [databankSource, setDatabankSource] = useState('pubmed');
  const [toolResults, setToolResults] = useState([]); // { label, content }
  const [toolLoading, setToolLoading] = useState('');

  const fetchGitHub = async () => {
    if (!githubUrl.trim()) return;
    setToolLoading('github');
    try {
      const res = await fetch('/api/tools/github', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: githubUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setToolResults((prev) => [...prev, { label: `GitHub: ${githubUrl.trim().split('/').slice(-2).join('/')}`, content: data.content }]);
      setGithubUrl('');
    } catch (err) {
      setError(`GitHub: ${err.message}`);
    }
    setToolLoading('');
  };

  const executeCode = async () => {
    if (!codeInput.trim()) return;
    setToolLoading('execute');
    try {
      const res = await fetch('/api/tools/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeInput, language: codeLang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const output = data.success
        ? `Saída:\n${data.stdout}${data.stderr ? `\nStderr:\n${data.stderr}` : ''}`
        : `Erro:\n${data.stderr || data.error}`;
      setToolResults((prev) => [...prev, { label: `Código ${codeLang}`, content: `\`\`\`${codeLang}\n${codeInput}\n\`\`\`\n\n${output}` }]);
      setCodeInput('');
    } catch (err) {
      setError(`Execução: ${err.message}`);
    }
    setToolLoading('');
  };

  const queryDatabank = async () => {
    if (!databankQuery.trim()) return;
    setToolLoading('databank');
    try {
      const res = await fetch('/api/tools/databank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: databankQuery.trim(), source: databankSource }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      let formatted = `Fonte: ${data.source} | Query: "${data.query}"`;
      if (data.total) formatted += ` | Total: ${data.total}`;
      formatted += '\n\n';
      for (const r of data.results) {
        if (data.source === 'pubmed') {
          formatted += `- **${r.title}** (${r.date})\n  ${r.authors}\n  ${r.journal} | ${r.url}\n\n`;
        } else if (data.source === 'clinicaltrials') {
          formatted += `- **${r.title}** [${r.nctId}] — ${r.status} (${r.phase})\n  ${r.summary}\n  ${r.url}\n\n`;
        } else {
          formatted += `- **${r.title}**\n  ${r.extract || r.snippet || ''}\n  ${r.url}\n\n`;
        }
      }
      setToolResults((prev) => [...prev, { label: `${databankSource}: ${databankQuery.trim().slice(0, 30)}`, content: formatted }]);
      setDatabankQuery('');
    } catch (err) {
      setError(`Databank: ${err.message}`);
    }
    setToolLoading('');
  };

  const removeToolResult = (index) => {
    setToolResults((prev) => prev.filter((_, i) => i !== index));
  };

  // --- Export ---
  const buildExportText = useCallback(() => {
    let text = `Board of Life — ${sessionName || 'Sessão'}\n${'='.repeat(50)}\n\n`;
    for (const msg of history) {
      if (msg.role === 'user') {
        text += `VOCÊ:\n${msg.content}\n\n`;
      } else {
        text += `${msg.content}\n\n`;
      }
      text += `${'-'.repeat(50)}\n\n`;
    }
    return text;
  }, [history, sessionName]);

  const copyToClipboard = useCallback(() => {
    navigator.clipboard.writeText(buildExportText());
  }, [buildExportText]);

  const exportAsText = useCallback(() => {
    const blob = new Blob([buildExportText()], { type: 'text/plain;charset=utf-8' });
    downloadBlob(blob, `${sessionName || 'board-of-life'}.txt`);
  }, [buildExportText, sessionName]);

  const exportAsHtml = useCallback(() => {
    let html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Board of Life — ${sessionName || 'Sessão'}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111827}
.user{font-weight:600;background:#f0f4ff;padding:12px;border-radius:8px;margin:12px 0}
.agent{padding:12px;border-left:3px solid #6366f1;margin:12px 0;background:#fafbfc;border-radius:0 8px 8px 0}
h1{color:#6366f1}hr{border:none;border-top:1px solid #e5e7eb;margin:20px 0}</style></head><body>
<h1>Board of Life</h1><p>${sessionName || 'Sessão exportada'}</p><hr>\n`;
    for (const msg of history) {
      if (msg.role === 'user') {
        html += `<div class="user"><strong>Você:</strong><br>${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>\n`;
      } else {
        html += `<div class="agent">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>\n`;
      }
    }
    html += '</body></html>';
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    downloadBlob(blob, `${sessionName || 'board-of-life'}.html`);
  }, [history, sessionName]);

  const printConversation = useCallback(() => {
    const w = window.open('', '_blank');
    if (!w) return;
    let html = `<html><head><title>Board of Life</title>
<style>body{font-family:system-ui,sans-serif;max-width:700px;margin:20px auto;color:#111827;font-size:12pt}
.user{font-weight:600;background:#f0f4ff;padding:10px;border-radius:6px;margin:10px 0}
.agent{padding:10px;border-left:3px solid #6366f1;margin:10px 0;background:#fafbfc}
h1{font-size:16pt;color:#6366f1}hr{border:none;border-top:1px solid #ccc;margin:15px 0}
@media print{body{margin:0;font-size:10pt}}</style></head><body>
<h1>Board of Life</h1><p>${sessionName || 'Sessão'} — ${new Date().toLocaleDateString('pt-BR')}</p><hr>\n`;
    for (const msg of history) {
      if (msg.role === 'user') {
        html += `<div class="user"><strong>Você:</strong><br>${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>\n`;
      } else {
        html += `<div class="agent">${escapeHtml(msg.content).replace(/\n/g, '<br>')}</div>\n`;
      }
    }
    html += '</body></html>';
    w.document.write(html);
    w.document.close();
    w.print();
  }, [history, sessionName]);

  // --- Memory / Sessions ---
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [showSessions, setShowSessions] = useState(false);
  const [sessionName, setSessionName] = useState('');

  // Load session list on mount
  useEffect(() => {
    setSessions(listSessions());
  }, []);

  // Auto-save history to current session whenever history changes
  useEffect(() => {
    if (history.length === 0) return;
    const id = saveSession({
      id: currentSessionId,
      name: sessionName || undefined,
      history,
      systemPrompt,
    });
    if (!currentSessionId) setCurrentSessionId(id);
    setSessions(listSessions());
  }, [history]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadSession = useCallback((id) => {
    const session = loadSession(id);
    if (!session) return;
    setCurrentSessionId(id);
    setSessionName(session.name);
    setHistory(session.history);
    setSystemPrompt(session.systemPrompt || '');
    setRoundResponses([]);
    setShowSessions(false);
  }, []);

  const handleDeleteSession = useCallback((id) => {
    deleteSession(id);
    setSessions(listSessions());
    if (id === currentSessionId) {
      setCurrentSessionId(null);
      setSessionName('');
      setHistory([]);
      setRoundResponses([]);
    }
  }, [currentSessionId]);

  const handleRenameSession = useCallback((id, newName) => {
    renameSession(id, newName);
    setSessions(listSessions());
    if (id === currentSessionId) setSessionName(newName);
  }, [currentSessionId]);

  const handleNewSession = useCallback(() => {
    setCurrentSessionId(null);
    setSessionName('');
    setHistory([]);
    setRoundResponses([]);
    setQuestion('');
    setError('');
  }, []);

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

    // Build user message with attachments
    let userContent = question.trim();
    const imageAttachments = [];
    const docTexts = [];

    for (const att of attachments) {
      if (att.type === 'image') {
        imageAttachments.push({ mimeType: att.mimeType, base64: att.data, name: att.name });
      } else {
        docTexts.push(`\n\n--- Documento anexado: ${att.name} ---\n${att.data}\n--- Fim do documento ---`);
      }
    }

    if (docTexts.length > 0) {
      userContent += docTexts.join('');
    }

    // Append tool results as context
    for (const tr of toolResults) {
      userContent += `\n\n--- ${tr.label} ---\n${tr.content}\n--- Fim ---`;
    }

    const userMessage = { role: 'user', content: userContent };
    const nextHistory = [...history, userMessage];

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
          history: nextHistory,
          images: imageAttachments,
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
      setAttachments([]);
      setToolResults([]);
    } catch (err) {
      setError(err.message || 'Erro inesperado.');
    } finally {
      setIsLoading(false);
    }
  };

  const clearConversation = () => {
    setCurrentSessionId(null);
    setSessionName('');
    setHistory([]);
    setRoundResponses([]);
    setQuestion('');
    setError('');
  };

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <h1>Board of Life</h1>
      <p style={{ color: '#444' }}>Seus 6 conselheiros, em ordem: {orderedNames}</p>

      {/* --- Session / Memory Panel --- */}
      <section style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <h3 style={{ margin: 0 }}>Memória</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowSessions((v) => !v)} style={secondaryButtonStyle}>
              {showSessions ? 'Fechar sessões' : `Sessões salvas (${sessions.length})`}
            </button>
            <button onClick={handleNewSession} style={secondaryButtonStyle}>Nova sessão</button>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <label>Nome da sessão atual</label>
          <input
            value={sessionName}
            onChange={(e) => {
              setSessionName(e.target.value);
              if (currentSessionId) renameSession(currentSessionId, e.target.value);
            }}
            placeholder="Ex.: Planejamento Q1, Carreira EUA..."
            style={inputStyle}
          />
        </div>

        {currentSessionId && (
          <p style={{ fontSize: '0.85em', color: '#6b7280', margin: 0 }}>
            Sessão ativa: <strong>{sessionName || currentSessionId}</strong> — {history.length} mensagens (salvamento automático)
          </p>
        )}

        {showSessions && (
          <div style={{ marginTop: 12 }}>
            {sessions.length === 0 && <p style={{ color: '#9ca3af' }}>Nenhuma sessão salva ainda.</p>}
            {sessions.map((s) => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #f3f4f6' }}>
                <span style={{ flex: 1, fontWeight: s.id === currentSessionId ? 600 : 400 }}>
                  {s.name} <span style={{ color: '#9ca3af', fontSize: '0.85em' }}>({s.messageCount} msgs — {new Date(s.updatedAt).toLocaleDateString('pt-BR')})</span>
                </span>
                <button onClick={() => handleLoadSession(s.id)} style={{ ...secondaryButtonStyle, padding: '4px 10px', fontSize: '0.85em' }}>Carregar</button>
                <button onClick={() => handleDeleteSession(s.id)} style={{ ...secondaryButtonStyle, padding: '4px 10px', fontSize: '0.85em', color: '#b00020' }}>Excluir</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3>{'Configuração'}</h3>
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
            <label>{'Máx. tokens'}</label>
            <input type="number" min="200" max="2000" step="50" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} style={inputStyle} />
          </div>
        </div>

        <label>{'Prompt Global (instruções para todos os agentes)'}</label>
        <textarea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Defina o contexto para seus conselheiros..." />

        <h4>Modelos (ordem fixa)</h4>
        {agents.map((agent, index) => (
          <div key={agent.displayName} style={{ marginBottom: 8 }}>
            <label>{agent.displayName}</label>
            <input value={agent.model} onChange={(e) => updateAgentModel(index, e.target.value)} style={inputStyle} />
          </div>
        ))}
      </section>

      {/* --- Tools Panel --- */}
      <section style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Ferramentas</h3>
          <button onClick={() => setShowTools((v) => !v)} style={secondaryButtonStyle}>
            {showTools ? 'Fechar' : 'Abrir ferramentas'}
          </button>
        </div>

        {showTools && (
          <div style={{ marginTop: 12 }}>
            {/* GitHub */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafbfc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', color: '#6366f1' }}>GitHub — Buscar arquivo</h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/user/repo/blob/main/file.py" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                <button onClick={fetchGitHub} disabled={toolLoading === 'github'} style={{ ...buttonStyle, whiteSpace: 'nowrap' }}>
                  {toolLoading === 'github' ? 'Buscando...' : 'Buscar'}
                </button>
              </div>
            </div>

            {/* Code execution */}
            <div style={{ marginBottom: 16, padding: 12, background: '#fafbfc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', color: '#6366f1' }}>Executar código</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={codeLang} onChange={(e) => setCodeLang(e.target.value)} style={{ ...inputStyle, width: 'auto', marginBottom: 0 }}>
                  <option value="python">Python</option>
                  <option value="r">R</option>
                </select>
                <button onClick={executeCode} disabled={toolLoading === 'execute'} style={buttonStyle}>
                  {toolLoading === 'execute' ? 'Executando...' : 'Executar'}
                </button>
              </div>
              <textarea value={codeInput} onChange={(e) => setCodeInput(e.target.value)} rows={5} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9em', marginBottom: 0 }} placeholder="print('Hello World')" />
            </div>

            {/* Databank */}
            <div style={{ padding: 12, background: '#fafbfc', borderRadius: 8 }}>
              <h4 style={{ margin: '0 0 8px', color: '#6366f1' }}>Bancos de dados públicos</h4>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <select value={databankSource} onChange={(e) => setDatabankSource(e.target.value)} style={{ ...inputStyle, width: 'auto', marginBottom: 0 }}>
                  <option value="pubmed">PubMed</option>
                  <option value="clinicaltrials">ClinicalTrials.gov</option>
                  <option value="wikipedia">Wikipedia</option>
                </select>
                <input value={databankQuery} onChange={(e) => setDatabankQuery(e.target.value)} placeholder="Ex.: oncology immunotherapy" style={{ ...inputStyle, flex: 1, marginBottom: 0 }} />
                <button onClick={queryDatabank} disabled={toolLoading === 'databank'} style={buttonStyle}>
                  {toolLoading === 'databank' ? 'Buscando...' : 'Pesquisar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tool results chips */}
        {toolResults.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: '0.85em', color: '#6b7280', margin: '0 0 6px' }}>Contexto coletado (será incluído na próxima consulta):</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {toolResults.map((tr, idx) => (
                <div key={`tr-${idx}`} style={{ ...attachmentChipStyle, background: '#eef2ff' }}>
                  <span style={{ fontSize: '0.82em' }}>{tr.label}</span>
                  <button onClick={() => removeToolResult(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b00020', fontWeight: 700, padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <h3>{'Sua questão para o Board'}</h3>
        <textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Pergunte aos seus 6 conselheiros..." />

        {/* File attachments */}
        <div style={{ marginTop: 4, marginBottom: 8 }}>
          <label htmlFor="file-upload" style={{ ...secondaryButtonStyle, display: 'inline-block', cursor: 'pointer', fontSize: '0.9em', padding: '6px 12px' }}>
            {isProcessing ? 'Processando...' : 'Anexar arquivos'}
          </label>
          <input
            id="file-upload"
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileSelect}
            disabled={isProcessing || isLoading}
            style={{ display: 'none' }}
          />
          <span style={{ marginLeft: 8, fontSize: '0.8em', color: '#9ca3af' }}>
            PDF, DOCX, TXT, CSV, MD, JPG, PNG, GIF, WEBP
          </span>
        </div>

        {attachments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
            {attachments.map((att, idx) => (
              <div key={`${att.name}-${idx}`} style={attachmentChipStyle}>
                {att.type === 'image' && att.preview && (
                  <img src={att.preview} alt={att.name} style={{ width: 28, height: 28, objectFit: 'cover', borderRadius: 4 }} />
                )}
                <span style={{ fontSize: '0.85em', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {att.name}
                </span>
                <button onClick={() => removeAttachment(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#b00020', fontWeight: 700, fontSize: '1em', padding: '0 2px' }}>
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button disabled={isLoading || isProcessing} onClick={runRound} style={buttonStyle}>
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
          <p><strong>Todos os conselheiros se pronunciaram.</strong> A palavra é sua.</p>
        </section>
      )}

      {history.length > 0 && (
        <section style={{ background: '#fff', borderRadius: 12, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{'Histórico'}</h3>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={copyToClipboard} style={{ ...secondaryButtonStyle, padding: '6px 10px', fontSize: '0.85em' }}>Copiar tudo</button>
              <button onClick={exportAsText} style={{ ...secondaryButtonStyle, padding: '6px 10px', fontSize: '0.85em' }}>Exportar TXT</button>
              <button onClick={exportAsHtml} style={{ ...secondaryButtonStyle, padding: '6px 10px', fontSize: '0.85em' }}>Exportar HTML</button>
              <button onClick={printConversation} style={{ ...secondaryButtonStyle, padding: '6px 10px', fontSize: '0.85em' }}>Imprimir / PDF</button>
            </div>
          </div>
          {history.map((msg, idx) => (
            <div key={`${msg.role}-${idx}`} style={{ marginBottom: 12 }}>
              {msg.role === 'user' ? (
                <p style={{ fontWeight: 600, color: '#111827' }}>{'Você: '}{msg.content}</p>
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

const attachmentChipStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  background: '#f3f4f6',
  borderRadius: 8,
  border: '1px solid #e5e7eb',
};

const cardTitleStyle = {
  margin: '0 0 8px 0',
  fontSize: '1.05em',
  color: '#6366f1',
  fontWeight: 600,
  borderBottom: '2px solid #e5e7eb',
  paddingBottom: 8
};
