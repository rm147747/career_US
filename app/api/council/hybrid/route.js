// Hybrid deliberation: round 1 parallel (independent) → round 2 cross-critique
// (each counselor reads the others and refines) → president decisive synthesis.
import { getCouncil, LLMS } from '../../../config/council'
import {
  streamFromOpenRouter,
  buildCounselorSystemPrompt,
  buildCritiqueSystemPrompt,
  buildPresidentSystemPrompt,
} from '../../../lib/openrouter'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

// streamFromOpenRouter emite pares `event: <nome>` + `data: {...}`.
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
          if (e instanceof SyntaxError) continue
          throw e
        }
      }
    }
  }
  return text
}

export async function POST(req) {
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

  const { councilId, userQuestion, format = null } = await req.json()
  const council = getCouncil(councilId)
  if (!council) return Response.json({ error: 'councilId inválido' }, { status: 400 })

  const counselors = LLMS.filter((llm) => !llm.isPresident && council.personas?.[llm.id])
  const president = LLMS.find((llm) => llm.isPresident)

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()
  const emit = (data) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  ;(async () => {
    try {
      // Híbrido custa o dobro dos conselheiros (2 rodadas) + presidente.
      if (authConfigured && user) {
        const totalCost = counselors.length * 2 + (president ? 1 : 0)
        const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
        const { data: creditRow } = await admin.from('user_credits').select('balance').eq('user_id', user.id).maybeSingle()
        if ((creditRow?.balance ?? 0) < totalCost) {
          await emit({ type: 'error', message: 'Insufficient credits' })
          return
        }
        await admin.from('credits_ledger').insert({ user_id: user.id, delta: -totalCost, reason: 'deliberation_hybrid' })
      }

      // ── Rodada 1: paralelo, independente ──
      const round1 = await Promise.all(
        counselors.map(async (llm) => {
          const persona = council.personas[llm.id]
          const systemPrompt = buildCounselorSystemPrompt({
            councilTitle: council.title, counselorName: llm.name, role: persona.role, brief: persona.brief,
            boardPrinciples: council.boardPrinciples, knowledgeBase: council.knowledgeBase, parallelMode: true,
          })
          const stream = await streamFromOpenRouter({
            model: llm.model, fallbackModel: llm.fallbackModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `**Situação descrita pelo usuário:**\n\n${userQuestion}` },
            ],
            temperature: 0.75, maxTokens: 1400, reasoningEffort: llm.reasoningEffort,
          })
          const text = await readStreamText(stream)
          return { id: llm.id, name: llm.name, role: persona.role, text }
        })
      )
      for (const r of round1) await emit({ type: 'counselor', counselorId: r.id, name: r.name, role: r.role, text: r.text })

      // ── Rodada 2: crítica cruzada — cada um lê os demais e refina ──
      const round2 = await Promise.all(
        counselors.map(async (llm) => {
          const persona = council.personas[llm.id]
          const others = round1
            .filter((r) => r.id !== llm.id)
            .map((r) => `### ${r.name} — ${r.role}\n${r.text}`)
            .join('\n\n---\n\n')
          const systemPrompt = buildCritiqueSystemPrompt({
            councilTitle: council.title, counselorName: llm.name, role: persona.role, brief: persona.brief,
            boardPrinciples: council.boardPrinciples, knowledgeBase: council.knowledgeBase,
          })
          const stream = await streamFromOpenRouter({
            model: llm.model, fallbackModel: llm.fallbackModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `**Situação:**\n\n${userQuestion}\n\n**Opiniões dos outros conselheiros (rodada 1):**\n\n${others}` },
            ],
            temperature: 0.7, maxTokens: 900, reasoningEffort: llm.reasoningEffort,
          })
          const text = await readStreamText(stream)
          return { id: llm.id, name: llm.name, role: persona.role, text }
        })
      )
      for (const r of round2) await emit({ type: 'critique', counselorId: r.id, name: r.name, role: r.role, text: r.text })

      // ── Presidente: síntese decisiva sobre as duas rodadas ──
      if (president && council.personas?.[president.id]) {
        const block1 = round1.map((r) => `### ${r.name} — ${r.role}\n${r.text}`).join('\n\n---\n\n')
        const block2 = round2.map((r) => `### ${r.name} (crítica)\n${r.text}`).join('\n\n---\n\n')
        const presidentSystem = buildPresidentSystemPrompt({
          councilTitle: council.title, boardPrinciples: council.boardPrinciples, knowledgeBase: council.knowledgeBase,
          parallelMode: true, decisive: council.decisive || false, format,
        })
        const presStream = await streamFromOpenRouter({
          model: president.model, fallbackModel: president.fallbackModel,
          messages: [
            { role: 'system', content: presidentSystem },
            { role: 'user', content: `**Situação:**\n\n${userQuestion}` },
            { role: 'user', content: `Modo HÍBRIDO. Rodada 1 — opiniões independentes:\n\n${block1}\n\n---\n\nRodada 2 — cada conselheiro criticou os pares e refinou:\n\n${block2}\n\n---\n\nSintetize considerando a evolução das posições após o confronto. Convergência que sobreviveu à crítica é sinal forte.` },
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
    },
  })
}
