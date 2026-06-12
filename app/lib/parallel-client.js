// app/lib/parallel-client.js
'use client';

/**
 * Consome o stream SSE de /api/council/parallel. Ao contrário do
 * /api/council/deliberate (que usa pares `event:` + `data:`), o modo
 * paralelo emite apenas linhas `data: {type: ...}`.
 *
 * Eventos: counselor { counselorId, name, role, text }
 *          president_delta { text } · president_done · complete
 *          error { message }
 *
 * @param {object} body { councilId, userQuestion }
 * @param {object} handlers { onCounselor, onPresidentDelta, onPresidentDone, onComplete, onError }
 */
export async function streamParallel(body, handlers = {}) {
  const { onCounselor, onPresidentDelta, onPresidentDone, onComplete, onError } = handlers;

  const res = await fetch('/api/council/parallel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const err = new Error('Você precisa estar logado para usar o modo paralelo.');
    onError?.(err);
    throw err;
  }
  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    let message = text || 'stream vazio';
    try {
      message = JSON.parse(text).error || message;
    } catch { /* corpo não-JSON — usa texto cru */ }
    const err = new Error(message);
    onError?.(err);
    throw err;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data:')) continue;
      const raw = line.slice(5).trim();
      if (!raw) continue;

      let payload;
      try {
        payload = JSON.parse(raw);
      } catch {
        continue; // chunk malformado — ignora
      }

      switch (payload.type) {
        case 'counselor':
          onCounselor?.(payload);
          break;
        case 'president_delta':
          onPresidentDelta?.(payload.text || '');
          break;
        case 'president_done':
          onPresidentDone?.();
          break;
        case 'complete':
          onComplete?.();
          break;
        case 'error': {
          const err = new Error(payload.message || 'stream error');
          onError?.(err);
          throw err;
        }
        default:
          break;
      }
    }
  }
}
