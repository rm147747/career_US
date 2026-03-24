import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const name = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Plain text files
    if (name.endsWith('.txt') || name.endsWith('.csv') || name.endsWith('.md') || name.endsWith('.json')) {
      return NextResponse.json({ text: buffer.toString('utf-8'), type: 'text' });
    }

    // PDF
    if (name.endsWith('.pdf')) {
      // pdf-parse needs DOM polyfills in serverless
      if (typeof globalThis.DOMMatrix === 'undefined') {
        globalThis.DOMMatrix = class DOMMatrix {
          constructor() { this.a = 1; this.b = 0; this.c = 0; this.d = 1; this.e = 0; this.f = 0; }
          isIdentity = true;
          translate() { return new DOMMatrix(); }
          scale() { return new DOMMatrix(); }
          inverse() { return new DOMMatrix(); }
          multiply() { return new DOMMatrix(); }
        };
      }
      let pdfParse;
      try {
        const pdfModule = await import('pdf-parse');
        pdfParse = typeof pdfModule.default === 'function' ? pdfModule.default : pdfModule;
      } catch (importErr) {
        return NextResponse.json({ error: 'Biblioteca pdf-parse não disponível. Verifique a instalação.' }, { status: 500 });
      }
      if (typeof pdfParse !== 'function') {
        return NextResponse.json({ error: 'Falha ao carregar pdf-parse. Reinstale o pacote.' }, { status: 500 });
      }
      const data = await pdfParse(buffer);
      return NextResponse.json({ text: data.text, type: 'pdf', pages: data.numpages });
    }

    // DOCX
    if (name.endsWith('.docx')) {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ buffer });
      return NextResponse.json({ text: result.value, type: 'docx' });
    }

    // DOC (older format) — limited support, try as text
    if (name.endsWith('.doc')) {
      return NextResponse.json({
        text: buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\tÀ-ÿ]/g, ' ').replace(/ {2,}/g, ' '),
        type: 'doc',
        warning: 'Formato .doc antigo — extração pode ser parcial. Prefira .docx.'
      });
    }

    return NextResponse.json({ error: `Formato não suportado: ${name.split('.').pop()}` }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erro ao processar arquivo.' }, { status: 500 });
  }
}
