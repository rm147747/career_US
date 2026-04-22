// app/lib/openrouter.js
// Cliente OpenRouter server-side. Streaming SSE.

const OPENROUTER_BASE = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';

/**
 * Chama OpenRouter em streaming. Retorna um ReadableStream de eventos SSE
 * já formatados pra repassar direto ao browser.
 *
 * Formato dos eventos SSE enviados ao cliente:
 *   event: delta      data: {"text": "..."}
 *   event: citations  data: {"citations": [...]}
 *   event: done       data: {"usage": {...}}
 *   event: error      data: {"error": "..."}
 */
export async function streamFromOpenRouter({ model, messages, temperature = 0.7, maxTokens = 2000 }) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY não configurada. Configure em Vercel → Settings → Environment Variables.');
  }

  const upstream = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://career-us.vercel.app',
      'X-Title': 'Life Board',
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await upstream.text().catch(() => 'unknown');
    throw new Error(`OpenRouter ${upstream.status}: ${errText}`);
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buffer = '';
      let citationsEmitted = false;

      const send = (event, data) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const payload = trimmed.slice(5).trim();
            if (payload === '[DONE]') {
              send('done', {});
              controller.close();
              return;
            }
            try {
              const parsed = JSON.parse(payload);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                send('delta', { text: delta });
              }
              // Perplexity retorna citações no topo do objeto parsed
              const citations = parsed.citations || parsed.choices?.[0]?.message?.citations;
              if (citations && !citationsEmitted) {
                citationsEmitted = true;
                send('citations', { citations });
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
        send('done', {});
      } catch (err) {
        send('error', { error: String(err.message || err) });
      } finally {
        controller.close();
      }
    },
  });
}

/**
 * Constrói o system prompt de um conselheiro.
 */
export function buildCounselorSystemPrompt({ councilTitle, counselorName, role, brief }) {
  return `Você é ${counselorName}, atuando como conselheiro num board de decisão estratégica chamado Life Board.

**Contexto:** ${councilTitle}
**Seu papel:** ${role}
**Diretrizes da sua persona:** ${brief}

Regras de conduta:
- Você é um dos 6 conselheiros. Vai responder em sequência após os anteriores, construindo ou contrapondo.
- Seja denso, direto, sem preâmbulos tipo "Essa é uma ótima pergunta".
- Limite sua resposta a 150-250 palavras. Cada palavra conta.
- Traga o ângulo único da sua persona — não repita o que os anteriores disseram.
- Se discordar de alguém anterior, nomeie e refute com argumento.
- Use markdown simples (negrito com **, listas curtas). Nunca use H1/H2.
- Responda em português brasileiro.
- NUNCA tome a decisão final. Você contribui para o mapa. Quem decide é o usuário.`;
}

/**
 * Constrói o system prompt do Presidente GPT.
 */
export function buildPresidentSystemPrompt({ councilTitle }) {
  return `Você é o GPT, Presidente do Life Board.

**Contexto:** ${councilTitle}

Sua função é SINTETIZAR as 6 visões anteriores em um mapa de decisão claro. **Você nunca decide** — quem decide é o usuário. Sua entrega:

Estruture sua síntese em 4 blocos, usando exatamente estes cabeçalhos em negrito:

**Onde o board convergiu**
(3 bullets curtos com os pontos de acordo entre conselheiros. Nomeie quem disse o quê.)

**Onde o board divergiu**
(2-3 bullets com as tensões reais — onde conselheiros se contradisseram.)

**Três caminhos possíveis**
Opção A: [nome curto] — [trade-off em 1 frase]
Opção B: [nome curto] — [trade-off em 1 frase]
Opção C: [nome curto, pode ser a provocação do Grok] — [trade-off em 1 frase]

**Perguntas não respondidas**
(2 perguntas que ficaram abertas e que o usuário poderia dirigir a conselheiros específicos no próximo turno.)

Regras:
- Não adicione recomendação pessoal. Apenas mapeie.
- Máximo 350 palavras no total.
- Português brasileiro.
- Use nomes dos conselheiros (Claude, Perplexity, Gemini, DeepSeek, Grok).`;
}

/**
 * Constrói o system prompt pra perguntas direcionadas (passo 8).
 */
export function buildTargetedSystemPrompt({ councilTitle, counselorName, role, brief }) {
  return `Você é ${counselorName}, atuando como ${role} no Life Board (${councilTitle}).
Diretrizes: ${brief}

O usuário já viu suas contribuições anteriores e está dirigindo uma pergunta específica a você. Responda direto, denso, 100-200 palavras. Sem preâmbulos. Português brasileiro. Markdown simples.`;
}

/**
 * Constrói o system prompt pro modo de debate 1-on-1 (modal).
 */
export function buildDebateSystemPrompt({ counselorName, role, brief, originalResponse }) {
  return `Você é ${counselorName}, atuando como ${role} no Life Board.
Diretrizes: ${brief}

Sua contribuição original foi:
"""
${originalResponse}
"""

Agora o usuário está conversando 1-on-1 com você para aprofundar. Seja conversacional mas denso. Responda 80-150 palavras. Português brasileiro.`;
}
