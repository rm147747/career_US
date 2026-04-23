// app/api/council/deliberate/route.js
// POST /api/council/deliberate
// Body: {
//   councilId: string,
//   counselorId: string,       // 'claude' | 'perplexity' | 'gemini' | 'deepseek' | 'grok' | 'gpt'
//   userQuestion: string,
//   priorResponses: Array<{ name, role, text }>  // ordem de quem já respondeu
// }
// Retorna: stream SSE com eventos delta/citations/done/error

import { getCouncil, getLLM, LLMS } from '../../../config/council';
import {
  streamFromOpenRouter,
  buildCounselorSystemPrompt,
  buildPresidentSystemPrompt,
} from '../../../lib/openrouter';

export const runtime = 'edge'; // streaming é bem mais simples no edge runtime

export async function POST(req) {
  try {
    const { councilId, counselorId, userQuestion, priorResponses = [] } = await req.json();

    const council = getCouncil(councilId);
    const counselor = getLLM(counselorId);

    if (!council || !counselor) {
      return new Response(JSON.stringify({ error: 'councilId ou counselorId inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const persona = council.personas[counselorId];
    if (!persona) {
      return new Response(JSON.stringify({ error: 'Persona não encontrada' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const isPresident = counselor.isPresident;
    const systemPrompt = isPresident
      ? buildPresidentSystemPrompt({ councilTitle: council.title })
      : buildCounselorSystemPrompt({
          councilTitle: council.title,
          counselorName: counselor.name,
          role: persona.role,
          brief: persona.brief,
        });

    // Monta histórico: user question → respostas anteriores (cada uma como assistant)
    const messages = [{ role: 'system', content: systemPrompt }];
    messages.push({
      role: 'user',
      content: `**Pergunta do usuário (decisor):**\n\n${userQuestion}`,
    });

    // Injeta as respostas anteriores como contexto
    if (priorResponses.length > 0) {
      const priorBlock = priorResponses
        .map((r) => `### ${r.name} — ${r.role}\n${r.text}`)
        .join('\n\n---\n\n');
      messages.push({
        role: 'user',
        content: `Conselheiros anteriores já responderam. Leia e construa/contraponha a partir deles:\n\n${priorBlock}\n\n---\n\n**Agora é sua vez (${counselor.name} — ${persona.role}).** Responda de acordo com sua persona, trazendo o ângulo único que ninguém antes abordou.`,
      });
    }

    const stream = await streamFromOpenRouter({
      model: counselor.model,
      fallbackModel: counselor.fallbackModel,
      messages,
      temperature: isPresident ? 0.4 : 0.75,
      maxTokens: isPresident ? 2500 : 1500,
      reasoningEffort: counselor.reasoningEffort,
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
