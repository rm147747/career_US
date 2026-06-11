// app/api/attachments/extract/route.js
// POST multipart/form-data { file: File }
// Retorna: { text: string, pages?: number, kind: 'pdf' | 'docx' | 'pptx' | 'image' }

import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import mammoth from 'mammoth';
import JSZip from 'jszip';

// Node runtime (edge não suporta pdf-parse / mammoth)
export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const MAX_EXTRACTED_CHARS = 120_000; // ~30k tokens

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return json({ error: 'Nenhum arquivo enviado (campo "file" ausente)' }, 400);
    }

    if (file.size > MAX_BYTES) {
      return json({ error: `Arquivo grande demais (${(file.size / 1e6).toFixed(1)} MB). Máximo: 20 MB.` }, 413);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const name = (file.name || 'arquivo').toLowerCase();
    const mime = file.type || '';

    let text = '';
    let pages;
    let kind;

    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      kind = 'pdf';
      const result = await pdfParse(buffer);
      text = result.text || '';
      pages = result.numpages;
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      name.endsWith('.docx')
    ) {
      kind = 'docx';
      const result = await mammoth.extractRawText({ buffer });
      text = result.value || '';
    } else if (
      mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' ||
      name.endsWith('.pptx')
    ) {
      kind = 'pptx';
      text = await extractPptxText(buffer);
    } else if (mime.startsWith('image/') || /\.(png|jpe?g|webp|gif)$/.test(name)) {
      kind = 'image';
      // Imagens: Claude vision via OpenRouter extrai o conteúdo visível
      text = await extractImageText({ buffer, mime, name });
    } else if (name.endsWith('.doc')) {
      return json({ error: 'Formato .doc legado não suportado — converta para .docx' }, 415);
    } else if (name.endsWith('.ppt')) {
      return json({ error: 'Formato .ppt legado não suportado — converta para .pptx' }, 415);
    } else {
      return json({ error: `Formato não suportado para extração server-side: ${name}` }, 415);
    }

    text = (text || '').trim();
    if (text.length > MAX_EXTRACTED_CHARS) {
      text = text.slice(0, MAX_EXTRACTED_CHARS) + `\n\n[...truncado em ${MAX_EXTRACTED_CHARS} caracteres]`;
    }

    return json({ text, pages, kind });
  } catch (err) {
    console.error('[extract]', err);
    return json({ error: String(err.message || err) }, 500);
  }
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Extrai texto de PPTX usando JSZip — lê slides/slide*.xml e agrega os <a:t>.
 */
async function extractPptxText(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.keys(zip.files)
    .filter((n) => n.startsWith('ppt/slides/slide') && n.endsWith('.xml'))
    .sort((a, b) => {
      const na = parseInt(a.match(/slide(\d+)/)?.[1] || '0', 10);
      const nb = parseInt(b.match(/slide(\d+)/)?.[1] || '0', 10);
      return na - nb;
    });

  const slides = [];
  for (const path of slideFiles) {
    const xml = await zip.files[path].async('string');
    // extrai conteúdo de <a:t>...</a:t> (texto dentro dos runs)
    const matches = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)];
    const texts = matches.map((m) =>
      m[1]
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim()
    ).filter(Boolean);
    if (texts.length) {
      const num = path.match(/slide(\d+)/)?.[1];
      slides.push(`--- Slide ${num} ---\n${texts.join('\n')}`);
    }
  }
  return slides.join('\n\n');
}

/**
 * Envia imagem pro Claude via OpenRouter (visão multimodal) e pega uma
 * extração textual do que está visível (OCR + descrição).
 */
async function extractImageText({ buffer, mime, name }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return `[Imagem "${name}" anexada — OPENROUTER_API_KEY não configurada, sem OCR disponível]`;
  }

  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mime || 'image/png'};base64,${base64}`;

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://career-us.vercel.app',
      'X-Title': 'Life Board',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-opus-4.5',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extraia TODO o texto visível nesta imagem (OCR) e em seguida descreva brevemente o que a imagem mostra (gráficos, esquemas, fotos). Formate assim:\n\n**Texto extraído:**\n[...]\n\n**Descrição:**\n[...]\n\nResponda em português.',
            },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    return `[Erro ao processar imagem "${name}": ${res.status} ${t.slice(0, 200)}]`;
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || `[Imagem "${name}" — sem texto retornado pelo modelo]`;
}
