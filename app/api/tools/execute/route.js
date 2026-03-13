import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { tmpdir } from 'os';

const TIMEOUT_MS = 30000;
const MAX_OUTPUT = 20000;

/**
 * Executes Python or R code in a sandboxed child process.
 */
export async function POST(request) {
  try {
    const { code, language } = await request.json();

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Código não fornecido.' }, { status: 400 });
    }

    const lang = (language || 'python').toLowerCase();
    if (!['python', 'r'].includes(lang)) {
      return NextResponse.json({ error: 'Linguagem deve ser "python" ou "r".' }, { status: 400 });
    }

    const dir = join(tmpdir(), 'board-exec');
    mkdirSync(dir, { recursive: true });

    const ext = lang === 'python' ? '.py' : '.R';
    const filename = join(dir, `exec-${randomUUID()}${ext}`);
    writeFileSync(filename, code);

    const interpreter = lang === 'python' ? 'python3' : 'Rscript';
    const args = lang === 'python' ? ['-u', filename] : [filename];

    const result = await new Promise((resolve) => {
      const child = execFile(interpreter, args, {
        timeout: TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      }, (error, stdout, stderr) => {
        resolve({ error, stdout, stderr });
      });
    });

    // Clean up temp file
    try { unlinkSync(filename); } catch {}

    const stdout = (result.stdout || '').slice(0, MAX_OUTPUT);
    const stderr = (result.stderr || '').slice(0, MAX_OUTPUT);
    const success = !result.error;

    return NextResponse.json({
      success,
      stdout,
      stderr,
      error: result.error?.killed ? `Timeout: execução excedeu ${TIMEOUT_MS / 1000}s.` : (result.error?.message || null),
      language: lang,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erro ao executar código.' }, { status: 500 });
  }
}
