// app/api/council/targeted/route.js
// POST /api/council/targeted
// Body: {
//   councilId,
//   counselorId,
//   followUpQuestion,
//   fullHistory: Array<{ name, role, text }>   // sessão inteira até aqui
// }

import { getCouncil, getLLM } from '../../../config/council';
import { streamFromOpenRouter, buildTargetedSystemPrompt } from '../../../lib/openrouter';

export const runtime = 'edge';

export async function POST(req) {
  try {
    const { councilId, counselorId, followUpQuestion, fullHistory = [] } = await req.json();
    const council = getCouncil(councilId);
    const counselor = getLLM(counselorId);
    if (!council || !counselor) {
      return new Response(JSON.stringify({ error: 'IDs inválidos' }), { status: 400 });
    }
    const persona = council.personas[counselorId];

    const systemPrompt = buildTargetedSystemPrompt({
      councilTitle: council.title,
      counselorName: counselor.name,
      role: persona.role,
      brief: persona.brief,
    });

    const contextBlock = fullHistory
      .map((r) => `### ${r.name} — ${r.role}\n${r.text}`)
      .join('\n\n---\n\n');

    const messages = [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Contexto da deliberação até aqui:\n\n${contextBlock}\n\n---\n\n**Pergunta direcionada a você (${counselor.name}):** ${followUpQuestion}`,
      },
    ];

    const stream = await streamFromOpenRouter({
      model: counselor.model,
      fallbackModel: counselor.fallbackModel,
      messages,
      temperature: 0.7,
      maxTokens: 1200,
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
    return new Response(JSON.stringify({ error: String(err.message || err) }), { status: 500 });
  }
}
