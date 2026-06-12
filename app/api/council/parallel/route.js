// Parallel deliberation: all counselors fire simultaneously (no priorResponses),
// then president synthesizes with all 6 as independent inputs.
import { getCouncil, LLMS } from '../../../config/council'
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

// streamFromOpenRouter emite pares `event: <nome>` + `data: {...}` —
// o buffer carrega linhas partidas entre chunks.
async function readStreamText(stream) {
  const reader = stream.getReader()
  const dec = new TextDecoder()
  let text = ''
  let buffer = ''
  let currentEvent = null
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += dec.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim()
      } else if (line.startsWith('data:')) {
        const raw = line.slice(5).trim()
        if (!raw) continue
        try {
          const d = JSON.parse(raw)
          if (currentEvent === 'delta' && d.text) text += d.text
          else if (currentEvent === 'error') throw new Error(d.error || 'stream error')
        } catch (e) {
          if (e instanceof SyntaxError) continue // chunk malformado
          throw e
        }
      }
    }
  }
  return text
}

export async function POST(req) {
  // Gate de auth + créditos só quando o Supabase está configurado.
  // Sem as env vars, roda em modo livre (mesma política do /deliberate).
  const authConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
    Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

  let user = null
  if (authConfigured) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      { cookies: { getAll: () => req.cookies.getAll(), setAll: () => {} } },
    )
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { councilId, userQuestion } = await req.json()
  const council = getCouncil(councilId)
  if (!council) return Response.json({ error: 'councilId inválido' }, { status: 400 })

  const isPromptAdvisor = council.isPromptAdvisor || false
  const isPersonaBoard  = council.isPersonaBoard  || false

  const counselors = LLMS.filter(llm => !llm.isPresident && council.personas?.[llm.id])
  const president  = LLMS.find(llm => llm.isPresident)

  const { readable, writable } = new TransformStream()
  const writer  = writable.getWriter()
  const encoder = new TextEncoder()
  const emit    = (data) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  ;(async () => {
    try {
      if (authConfigured && user) {
        const totalCost = counselors.length + (president ? 1 : 0)
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
        const { data: creditRow } = await admin.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle()
        if ((creditRow?.balance ?? 0) < totalCost) {
          await emit({ type: 'error', message: 'Insufficient credits' })
          return
        }
        await admin.from('credits_ledger').insert({ user_id: user.id, delta: -totalCost, reason: 'deliberation' })
      }

      // All counselors fire simultaneously — no priorResponses
      const results = await Promise.all(
        counselors.map(async (llm) => {
          const persona = council.personas[llm.id]
          let systemPrompt
          if (isPromptAdvisor)     systemPrompt = buildPromptAdvisorSystemPrompt({ counselorName: llm.name, role: persona.role, brief: persona.brief })
          else if (isPersonaBoard) systemPrompt = buildPersonaBoardSystemPrompt({ role: persona.role, brief: persona.brief })
          else                     systemPrompt = buildCounselorSystemPrompt({ councilTitle: council.title, counselorName: llm.name, role: persona.role, brief: persona.brief, boardPrinciples: council.boardPrinciples, knowledgeBase: council.knowledgeBase, parallelMode: true })

          const stream = await streamFromOpenRouter({
            model: llm.model, fallbackModel: llm.fallbackModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `**Situação descrita pelo usuário:**\n\n${userQuestion}` },
            ],
            temperature: 0.75, maxTokens: 1500, reasoningEffort: llm.reasoningEffort,
          })
          const text = await readStreamText(stream)
          return { id: llm.id, name: llm.name, role: persona.role, text }
        })
      )

      for (const r of results) await emit({ type: 'counselor', counselorId: r.id, name: r.name, role: r.role, text: r.text })

      // President synthesizes all 6 independent perspectives
      if (president && council.personas?.[president.id]) {
        const priorBlock = results.map(r => `### ${r.name} — ${r.role}\n${r.text}`).join('\n\n---\n\n')

        let presidentSystem
        if (isPromptAdvisor)     presidentSystem = buildPromptAdvisorPresidentSystemPrompt()
        else if (isPersonaBoard) presidentSystem = buildPersonaBoardPresidentSystemPrompt()
        else                     presidentSystem = buildPresidentSystemPrompt({ councilTitle: council.title, boardPrinciples: council.boardPrinciples, knowledgeBase: council.knowledgeBase, parallelMode: true })

        const presStream = await streamFromOpenRouter({
          model: president.model, fallbackModel: president.fallbackModel,
          messages: [
            { role: 'system', content: presidentSystem },
            { role: 'user',   content: `**Situação:**\n\n${userQuestion}` },
            { role: 'user',   content: `Modo paralelo — cada conselheiro respondeu de forma independente, sem ler os outros:\n\n${priorBlock}\n\n---\n\nSintetize as perspectivas independentes.` },
          ],
          temperature: 0.4, maxTokens: 2500, reasoningEffort: president.reasoningEffort,
        })

        const reader = presStream.getReader()
        const dec = new TextDecoder()
        let presBuffer = ''
        let presEvent = null
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          presBuffer += dec.decode(value, { stream: true })
          const lines = presBuffer.split('\n')
          presBuffer = lines.pop() || ''
          for (const line of lines) {
            if (line.startsWith('event:')) {
              presEvent = line.slice(6).trim()
            } else if (line.startsWith('data:')) {
              const raw = line.slice(5).trim()
              if (!raw) continue
              try {
                const d = JSON.parse(raw)
                if (presEvent === 'delta' && d.text) await emit({ type: 'president_delta', text: d.text })
                else if (presEvent === 'done') await emit({ type: 'president_done' })
              } catch { /* chunk malformado */ }
            }
          }
        }
      }

      await emit({ type: 'complete' })
    } catch (err) {
      await emit({ type: 'error', message: String(err.message || err) })
    } finally {
      writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
