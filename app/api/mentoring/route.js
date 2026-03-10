import { NextResponse } from 'next/server';

const SYSTEM_PROMPT =
  'Você é um mentor especializado em apoiar médicos em transição para carreira nos EUA. ' +
  'Responda de forma prática, ética e organizada. ' +
  'Considere contexto de oncologia, processos seletivos, documentação, comunicação profissional, ' +
  'estratégia de candidatura e preparação de entrevistas. ' +
  'Não invente regras regulatórias; quando houver incerteza, destaque validações necessárias.';

async function callLLM({ baseUrl, apiKey, model, messages, temperature, maxTokens }) {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://vercel.app',
      'X-Title': 'Mentoria Multiagente EUA'
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
    const { baseUrl, apiKey, agents, history, temperature, maxTokens } = await request.json();

    if (!apiKey || !baseUrl || !Array.isArray(agents) || agents.length !== 6) {
      return NextResponse.json({ error: 'Payload inválido. Verifique API key, base URL e 6 agentes.' }, { status: 400 });
    }

    const runningMessages = [{ role: 'system', content: SYSTEM_PROMPT }, ...(history || [])];
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
