// app/lib/sse-client.js
'use client';

/**
 * Consome stream SSE de um endpoint. Chama callbacks conforme eventos chegam.
 *
 * @param {string} url
 * @param {object} body
 * @param {object} handlers { onDelta, onCitations, onDone, onError }
 * @returns {Promise<string>} texto completo acumulado
 */
export async function streamPost(url, body, handlers = {}) {
  const { onDelta, onCitations, onDone, onError } = handlers;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    const err = new Error(`HTTP ${res.status}: ${text || 'stream vazio'}`);
    onError?.(err);
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';
  let currentEvent = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        const raw = line.slice(5).trim();
        if (!raw) continue;
        try {
          const payload = JSON.parse(raw);
          if (currentEvent === 'delta' && payload.text) {
            fullText += payload.text;
            onDelta?.(payload.text, fullText);
          } else if (currentEvent === 'citations' && payload.citations) {
            onCitations?.(payload.citations);
          } else if (currentEvent === 'error') {
            const err = new Error(payload.error || 'stream error');
            onError?.(err);
            throw err;
          } else if (currentEvent === 'done') {
            onDone?.(fullText);
          }
        } catch (e) {
          // ignore malformed chunks
        }
      }
    }
  }

  return fullText;
}
