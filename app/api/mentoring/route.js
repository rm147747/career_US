import { NextResponse } from 'next/server';

const DEFAULT_SYSTEM_PROMPT =
  'Você é um conselheiro experiente e ponderado do Board of Life. ' +
  'Responda de forma prática, objetiva e organizada. ' +
  'Ofereça perspectivas únicas, considere riscos e oportunidades, e seja direto nas recomendações. ' +
  'Quando houver incerteza, destaque o que precisa ser verificado.';

async function callLLM({ baseUrl, apiKey, model, messages, temperature, maxTokens }) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vercel.app',
      'X-Title': 'Board of Life'
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || `Erro ${response.status} na chamada do modelo ${model}.`);
  }

  return data?.choices?.[0]?.message?.content?.trim() || 'Sem conteúdo retornado.';
}

export async function POST(request) {
  try {
    const { baseUrl, apiKey, agents, history, temperature, maxTokens, systemPrompt } = await request.json();

    if (!apiKey || !baseUrl || !Array.isArray(agents) || agents.length !== 6) {
      return NextResponse.json({ error: 'Payload inválido. Verifique API key, base URL e 6 agentes.' }, { status: 400 });
    }

    const finalPrompt = systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
    const runningMessages = [{ role: 'system', content: finalPrompt }, ...(history || [])];
    const responses = [];

    for (const agent of agents) {
      const answer = await callLLM({
        baseUrl,
        apiKey,
        model: agent.model,
        messages: runningMessages,
        temperature,
        maxTokens
      });

      responses.push({ displayName: agent.displayName, model: agent.model, answer });
      runningMessages.push({ role: 'assistant', content: `[${agent.displayName}] ${answer}` });
    }

    return NextResponse.json({ responses });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erro inesperado no servidor.' }, { status: 500 });
  }
}
