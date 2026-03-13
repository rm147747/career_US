import { NextResponse } from 'next/server';

/**
 * Fetches raw content from a GitHub URL.
 * Supports: file URLs, raw URLs, gist URLs, and repository README.
 */
export async function POST(request) {
  try {
    const { url } = await request.json();
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL não fornecida.' }, { status: 400 });
    }

    const rawUrl = toRawUrl(url.trim());
    const res = await fetch(rawUrl, {
      headers: { 'User-Agent': 'BoardOfLife/1.0' },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      throw new Error(`GitHub retornou ${res.status} para ${rawUrl}`);
    }

    const text = await res.text();
    const truncated = text.length > 50000 ? text.slice(0, 50000) + '\n\n[... conteúdo truncado em 50.000 caracteres]' : text;

    return NextResponse.json({ content: truncated, url: rawUrl, chars: text.length });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erro ao acessar GitHub.' }, { status: 500 });
  }
}

function toRawUrl(url) {
  // Already raw
  if (url.includes('raw.githubusercontent.com') || url.includes('/raw/')) {
    return url;
  }
  // Gist
  if (url.includes('gist.github.com')) {
    return url.replace('gist.github.com', 'gist.githubusercontent.com') + '/raw';
  }
  // Regular file: github.com/user/repo/blob/branch/path → raw.githubusercontent.com/user/repo/branch/path
  const blobMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)/);
  if (blobMatch) {
    return `https://raw.githubusercontent.com/${blobMatch[1]}/${blobMatch[2]}/${blobMatch[3]}`;
  }
  // Repository root → README
  const repoMatch = url.match(/github\.com\/([^/]+)\/([^/]+)\/?$/);
  if (repoMatch) {
    return `https://raw.githubusercontent.com/${repoMatch[1]}/${repoMatch[2]}/main/README.md`;
  }
  return url;
}
