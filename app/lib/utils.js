// app/lib/utils.js
'use client';

/**
 * Markdown muito simples → HTML. Suporta: **bold**, *italic*, listas, parágrafos, ### headers.
 * Mantido simples de propósito (sem dependência externa).
 */
export function renderMarkdown(text) {
  if (!text) return '';
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // headers ### Foo
  html = html.replace(/^###\s+(.+)$/gm, '<h4 style="font-size:1rem;font-weight:600;margin:12px 0 6px;color:var(--text);">$1</h4>');
  // bold **...**
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  // italic *...*
  html = html.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  // inline code `...`
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // listas: agrupa linhas iniciadas por - ou •
  const lines = html.split('\n');
  const out = [];
  let inList = false;
  let paraBuffer = [];

  const flushPara = () => {
    if (paraBuffer.length) {
      out.push(`<p>${paraBuffer.join(' ')}</p>`);
      paraBuffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-•*]\s+/.test(trimmed)) {
      flushPara();
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li>${trimmed.replace(/^[-•*]\s+/, '')}</li>`);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      flushPara();
      if (!inList) {
        out.push('<ol>');
        inList = 'ol';
      }
      out.push(`<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`);
    } else if (trimmed === '') {
      if (inList) {
        out.push(inList === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      flushPara();
    } else if (trimmed.startsWith('<h4')) {
      if (inList) {
        out.push(inList === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      flushPara();
      out.push(trimmed);
    } else {
      if (inList) {
        out.push(inList === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      paraBuffer.push(trimmed);
    }
  }
  if (inList) out.push(inList === 'ol' ? '</ol>' : '</ul>');
  flushPara();

  return out.join('\n');
}

/**
 * Divergência entre N textos. Retorna 0-100.
 * Baixa divergência = alta sobreposição de vocabulário + comprimentos similares.
 */
export function calculateDivergence(texts) {
  if (!texts || texts.length < 2) return 0;

  const tokenize = (str) =>
    new Set(
      str
        .toLowerCase()
        .replace(/[^\wáéíóúâêîôûãõç\s]/gi, ' ')
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

  const sets = texts.map(tokenize);
  let totalDissim = 0;
  let pairs = 0;

  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = sets[i];
      const b = sets[j];
      if (a.size === 0 && b.size === 0) continue;
      const intersection = [...a].filter((x) => b.has(x)).length;
      const union = new Set([...a, ...b]).size;
      const jaccard = union === 0 ? 1 : intersection / union;
      totalDissim += 1 - jaccard;
      pairs++;
    }
  }

  const avgDissim = pairs === 0 ? 0 : totalDissim / pairs;
  // normaliza: Jaccard típico de respostas diferentes é ~0.1-0.3. Amplificamos pra 0-100.
  let divergence = Math.round(avgDissim * 120);

  // fator de variação de comprimento (até +15 pontos)
  const lengths = texts.map((t) => t.length);
  const maxLen = Math.max(...lengths);
  const minLen = Math.min(...lengths);
  if (maxLen > 0) {
    const lengthVar = (maxLen - minLen) / maxLen;
    divergence += Math.round(lengthVar * 15);
  }

  return Math.max(0, Math.min(100, divergence));
}

export function divergenceLabel(value) {
  if (value < 25) return { label: 'Baixa divergência', desc: 'O board convergiu — respostas em mesma direção' };
  if (value < 55) return { label: 'Divergência moderada', desc: 'Perspectivas complementares, algumas tensões' };
  if (value < 80) return { label: 'Alta divergência', desc: 'Board rachado — trade-offs reais para você decidir' };
  return { label: 'Divergência extrema', desc: 'Visões fortemente opostas — leia com atenção' };
}
