// app/components/AttachmentUploader.js
'use client';

import { useRef, useState } from 'react';

const ACCEPT =
  '.pdf,.docx,.pptx,.txt,.md,.markdown,.csv,.tsv,.json,.png,.jpg,.jpeg,.webp,.gif,' +
  'application/pdf,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'text/plain,text/markdown,text/csv,text/tab-separated-values,application/json,' +
  'image/png,image/jpeg,image/webp,image/gif';

const BROWSER_TEXT_EXT = /\.(txt|md|markdown|csv|tsv|json|log|yml|yaml)$/i;
const BACKEND_EXT = /\.(pdf|docx|pptx|png|jpe?g|webp|gif)$/i;

const MAX_FILES = 5;
const MAX_CLIENT_TEXT = 200_000;

/**
 * Props:
 *   attachments: Array<{ name, kind, text, status, error? }>
 *   setAttachments: setter
 *   compact?: boolean  (modo reduzido pro modal de debate)
 */
export function AttachmentUploader({ attachments, setAttachments, compact = false }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const handleFiles = async (fileList) => {
    const files = Array.from(fileList);
    if (attachments.length + files.length > MAX_FILES) {
      alert(`Máximo de ${MAX_FILES} anexos por ação.`);
      return;
    }

    for (const file of files) {
      const attachment = {
        name: file.name,
        size: file.size,
        kind: 'processing',
        text: '',
        status: 'processing',
      };
      setAttachments((prev) => [...prev, attachment]);

      try {
        const result = await extractFile(file);
        setAttachments((prev) =>
          prev.map((a) =>
            a.name === file.name && a.status === 'processing'
              ? { ...a, ...result, status: 'done' }
              : a
          )
        );
      } catch (err) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.name === file.name && a.status === 'processing'
              ? { ...a, status: 'error', error: String(err.message || err) }
              : a
          )
        );
      }
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const removeAttachment = (name) => {
    setAttachments((prev) => prev.filter((a) => a.name !== name));
  };

  return (
    <div>
      {!compact && (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            padding: 14,
            border: `1px dashed ${dragOver ? 'var(--accent)' : 'var(--line-strong)'}`,
            borderRadius: 10,
            background: dragOver ? 'rgba(0,229,199,0.05)' : 'rgba(255,255,255,0.02)',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-dim)' }}>
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text)' }}>Anexar arquivos</div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
              PDF · DOCX · PPTX · TXT · MD · CSV · PNG · JPG · até 20 MB cada · máx {MAX_FILES}
            </div>
          </div>
        </div>
      )}

      {compact && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="btn-ghost"
          style={{ fontSize: 12, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
          </svg>
          Anexar
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
      />

      {attachments.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {attachments.map((a, i) => (
            <AttachmentChip key={i} attachment={a} onRemove={() => removeAttachment(a.name)} />
          ))}
        </div>
      )}
    </div>
  );
}

function AttachmentChip({ attachment: a, onRemove }) {
  const sizeLabel = formatSize(a.size);
  const statusColor =
    a.status === 'error' ? 'var(--danger)' :
    a.status === 'processing' ? 'var(--warn)' :
    'var(--accent)';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid var(--line)',
        borderRadius: 8,
        fontSize: 12,
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
        {a.name}
      </span>
      <span className="mono" style={{ color: 'var(--text-faint)', fontSize: 10 }}>
        {a.status === 'processing' ? 'extraindo...' :
          a.status === 'error' ? 'erro' :
          (a.kind ? a.kind.toUpperCase() : '') + (a.pages ? ` · ${a.pages}p` : '') + (sizeLabel ? ` · ${sizeLabel}` : '')}
      </span>
      <button onClick={onRemove} style={{ color: 'var(--text-faint)', padding: 2, display: 'flex' }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Extrai conteúdo do arquivo. Texto simples → browser. Binários → backend.
 */
async function extractFile(file) {
  const name = file.name.toLowerCase();

  if (BROWSER_TEXT_EXT.test(name)) {
    const text = await readAsText(file);
    return {
      kind: name.split('.').pop(),
      text: text.slice(0, MAX_CLIENT_TEXT) + (text.length > MAX_CLIENT_TEXT ? '\n\n[...truncado]' : ''),
    };
  }

  if (BACKEND_EXT.test(name) || file.type === 'application/pdf' || file.type.startsWith('image/')) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/attachments/extract', { method: 'POST', body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return { kind: data.kind, text: data.text, pages: data.pages };
  }

  // fallback: tenta ler como texto
  try {
    const text = await readAsText(file);
    return { kind: 'text', text };
  } catch {
    throw new Error(`Formato não suportado: ${name}`);
  }
}

function readAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('falha ao ler arquivo'));
    reader.readAsText(file);
  });
}

/**
 * Monta o bloco de anexos pra injetar no prompt.
 */
export function buildAttachmentsBlock(attachments) {
  const done = (attachments || []).filter((a) => a.status === 'done' && a.text);
  if (done.length === 0) return '';
  const sections = done.map((a) => {
    const header = `### Anexo: ${a.name}${a.kind ? ` (${a.kind.toUpperCase()})` : ''}${a.pages ? ` · ${a.pages} págs` : ''}`;
    return `${header}\n\n${a.text}`;
  });
  return `\n\n---\n\n**Anexos fornecidos pelo usuário:**\n\n${sections.join('\n\n---\n\n')}`;
}
