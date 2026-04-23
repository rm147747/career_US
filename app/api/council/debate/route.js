// app/api/council/debate/route.js
// POST /api/council/debate
// Body: {
//   councilId,
//   counselorId,
//   originalResponse,                                  // a resposta original dele
//   chatHistory: Array<{ role: 'user'|'assistant', content }>,
//   userMessage
// }

import { getCouncil, getLLM } from '../../../config/council';
import { streamFromOpenRouter, buildDebateSystemPrompt } from '../../../lib/openrouter';

export const runtime = 'edge';

export async function POST(req) {
  try {
    const { councilId, counselorId, originalResponse, chatHistory = [], userMessage } = await req.json();
    const council = getCouncil(councilId);
    const counselor = getLLM(counselorId);
    if (!council || !counselor) {
      return new Response(JSON.stringify({ error: 'IDs inválidos' }), { status: 400 });
    }
    const persona = council.personas[counselorId];

    const systemPrompt = buildDebateSystemPrompt({
      counselorName: counselor.name,
      role: persona.role,
      brief: persona.brief,
      originalResponse: originalResponse || '(sem resposta original registrada)',
    });

    const messages = [{ role: 'system', content: systemPrompt }, ...chatHistory, { role: 'user', content: userMessage }];

    const stream = await streamFromOpenRouter({
      model: counselor.model,
      messages,
      temperature: 0.75,
      maxTokens: 1000,
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
