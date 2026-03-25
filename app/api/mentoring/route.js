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

  const rawText = await response.text();
  let data;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`Modelo ${model} retornou resposta inválida (status ${response.status}): ${rawText.slice(0, 200)}`);
  }
  if (!response.ok) {
    throw new Error(data?.error?.message || `Erro ${response.status} na chamada do modelo ${model}.`);
  }

  return data?.choices?.[0]?.message?.content?.trim() || 'Sem conteúdo retornado.';
}

export async function POST(request) {
  try {
    const { baseUrl, apiKey, agents, history, images } = await request.json();

    if (!apiKey || !baseUrl || !Array.isArray(agents) || agents.length !== 6) {
      return NextResponse.json({ error: 'Payload inválido. Verifique API key, base URL e 6 agentes.' }, { status: 400 });
    }

    // Build messages, converting the last user message to multimodal if images are attached
    let processedHistory = [...(history || [])];
    if (Array.isArray(images) && images.length > 0 && processedHistory.length > 0) {
      const lastIdx = processedHistory.length - 1;
      const lastMsg = processedHistory[lastIdx];
      if (lastMsg.role === 'user') {
        const contentParts = [{ type: 'text', text: lastMsg.content }];
        for (const img of images) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: `data:${img.mimeType};base64,${img.base64}` },
          });
        }
        processedHistory[lastIdx] = { role: 'user', content: contentParts };
      }
    }

    // Shared conversation (without system prompt — each agent gets its own)
    const sharedMessages = [...processedHistory];
    const responses = [];

    for (const agent of agents) {
      const agentPrompt = agent.systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
      const messages = [{ role: 'system', content: agentPrompt }, ...sharedMessages];

      const answer = await callLLM({
        baseUrl,
        apiKey,
        model: agent.model,
        messages,
        temperature: agent.temperature ?? 0.4,
        maxTokens: agent.maxTokens ?? 1500
      });

      responses.push({ displayName: agent.displayName, model: agent.model, answer });
      sharedMessages.push({ role: 'assistant', content: `[${agent.displayName}] ${answer}` });
    }

    return NextResponse.json({ responses });
  } catch (error) {
    return NextResponse.json({ error: error.message || 'Erro inesperado no servidor.' }, { status: 500 });
  }
}
