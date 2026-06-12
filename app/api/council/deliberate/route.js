// app/api/council/deliberate/route.js
// POST /api/council/deliberate
// Body: {
//   councilId: string,
//   counselorId: string,       // 'claude' | 'perplexity' | 'gemini' | 'deepseek' | 'grok' | 'gpt'
//   userQuestion: string,
//   priorResponses: Array<{ name, role, text }>  // ordem de quem já respondeu
// }
// Retorna: stream SSE com eventos delta/citations/done/error

import { getCouncil, getLLM } from '../../../config/council'
import {
  streamFromOpenRouter,
  buildCounselorSystemPrompt,
  buildPresidentSystemPrompt,
  buildPromptAdvisorSystemPrompt,
  buildPromptAdvisorPresidentSystemPrompt,
  buildPersonaBoardSystemPrompt,
  buildPersonaBoardPresidentSystemPrompt,
} from '../../../lib/openrouter'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export async function POST(req) {
  try {
    // Gate de auth + créditos só quando o Supabase está configurado.
    // Sem as env vars, roda em modo livre (comportamento pré-comercial)
    // em vez de derrubar a deliberação com 500.
    const authConfigured =
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
      Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
      Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

    if (authConfigured) {
      // Auth
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
      )
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      // Credit check + deduct (service role bypasses RLS)
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
      const { data: creditRow } = await admin.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle()
      if ((creditRow?.balance ?? 0) < 1) {
        return new Response(JSON.stringify({ error: 'Insufficient credits' }), {
          status: 402,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      await admin.from('credits_ledger').insert({ user_id: user.id, delta: -1, reason: 'deliberation' })
    }

    const { councilId, counselorId, userQuestion, priorResponses = [] } = await req.json()

    const council   = getCouncil(councilId)
    const counselor = getLLM(counselorId)

    if (!council || !counselor) {
      return new Response(JSON.stringify({ error: 'councilId ou counselorId inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const persona = council.personas[counselorId]
    if (!persona) {
      return new Response(JSON.stringify({ error: 'Persona não encontrada' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const isPresident     = counselor.isPresident
    const isPromptAdvisor = council.isPromptAdvisor || false
    const isPersonaBoard  = council.isPersonaBoard  || false

    let systemPrompt
    if (isPresident) {
      if (isPromptAdvisor)     systemPrompt = buildPromptAdvisorPresidentSystemPrompt()
      else if (isPersonaBoard) systemPrompt = buildPersonaBoardPresidentSystemPrompt()
      else                     systemPrompt = buildPresidentSystemPrompt({ councilTitle: council.title, boardPrinciples: council.boardPrinciples, knowledgeBase: council.knowledgeBase })
    } else {
      if (isPromptAdvisor)     systemPrompt = buildPromptAdvisorSystemPrompt({ counselorName: counselor.name, role: persona.role, brief: persona.brief })
      else if (isPersonaBoard) systemPrompt = buildPersonaBoardSystemPrompt({ role: persona.role, brief: persona.brief })
      else                     systemPrompt = buildCounselorSystemPrompt({ councilTitle: council.title, counselorName: counselor.name, role: persona.role, brief: persona.brief, boardPrinciples: council.boardPrinciples, knowledgeBase: council.knowledgeBase })
    }

    const messages = [{ role: 'system', content: systemPrompt }]
    messages.push({
      role: 'user',
      content: `**Situação descrita pelo usuário:**\n\n${userQuestion}`,
    })

    if (priorResponses.length > 0) {
      const priorBlock = priorResponses
        .map((r) => `### ${r.name} — ${r.role}\n${r.text}`)
        .join('\n\n---\n\n')

      let turnInstruction
      if (isPromptAdvisor) {
        turnInstruction = `As IAs anteriores já entregaram os prompts ideais delas:\n\n${priorBlock}\n\n---\n\n**Agora é sua vez (${counselor.name}).** Entregue o prompt ideal para usar COM VOCÊ — específico para sua arquitetura e para a situação acima. Seja distinto das outras IAs: mostre o que faz seu prompt único.`
      } else if (isPersonaBoard) {
        turnInstruction = `Seus colegas do conselho já deram seus conselhos:\n\n${priorBlock}\n\n---\n\n**Agora é sua vez (${persona.role}).** Fale exclusivamente como ${persona.role} — construa sobre, contraponha ou aprofunde o que foi dito, mas mantenha APENAS a sua perspectiva e os seus conceitos.`
      } else {
        turnInstruction = `Conselheiros anteriores já responderam. Leia e construa/contraponha a partir deles:\n\n${priorBlock}\n\n---\n\n**Agora é sua vez (${counselor.name} — ${persona.role}).** Responda de acordo com sua persona, trazendo o ângulo único que ninguém antes abordou.`
      }

      messages.push({ role: 'user', content: turnInstruction })
    }

    const stream = await streamFromOpenRouter({
      model: counselor.model,
      fallbackModel: counselor.fallbackModel,
      messages,
      temperature: isPresident ? 0.4 : 0.75,
      maxTokens: isPresident ? 2500 : 1500,
      reasoningEffort: counselor.reasoningEffort,
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err.message || err) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
