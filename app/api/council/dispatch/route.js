// Dispatcher: DeepSeek lê a pergunta e decide COMO o board delibera
// (modo + perguntas de esclarecimento + formato sugerido). Não responde
// à pergunta — só roteia. Resposta única em JSON (sem streaming).
import { completeFromOpenRouter, buildDispatcherSystemPrompt } from '../../../lib/openrouter'
import { getLLM } from '../../../config/council'

export const runtime = 'edge'

const VALID_MODES = ['parallel', 'sequential', 'hybrid']
const VALID_FORMATS = ['executive', 'complete', 'premium']

// Fallback seguro quando o DeepSeek falha ou devolve JSON inválido:
// paralelo (mais rápido), sem esclarecimento, formato completo.
const SAFE_DEFAULT = {
  mode: 'parallel',
  reasoning: 'Roteamento automático indisponível — usando paralelo por padrão.',
  needsClarification: false,
  clarifyingQuestions: [],
  suggestedFormat: 'complete',
}

function extractJson(text) {
  if (!text) return null
  // Remove cercas de código se o modelo desobedecer.
  const cleaned = text.replace(/```json\s*|\s*```/g, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return null
  try {
    return JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return null
  }
}

function sanitize(parsed) {
  if (!parsed || typeof parsed !== 'object') return SAFE_DEFAULT
  const mode = VALID_MODES.includes(parsed.mode) ? parsed.mode : SAFE_DEFAULT.mode
  const suggestedFormat = VALID_FORMATS.includes(parsed.suggestedFormat) ? parsed.suggestedFormat : SAFE_DEFAULT.suggestedFormat
  const needsClarification = parsed.needsClarification === true
  const clarifyingQuestions = needsClarification && Array.isArray(parsed.clarifyingQuestions)
    ? parsed.clarifyingQuestions.filter((q) => typeof q === 'string' && q.trim()).slice(0, 3)
    : []
  const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning.slice(0, 280) : SAFE_DEFAULT.reasoning
  return { mode, reasoning, needsClarification: clarifyingQuestions.length > 0, clarifyingQuestions, suggestedFormat }
}

export async function POST(req) {
  let userQuestion = ''
  try {
    const body = await req.json()
    userQuestion = (body.userQuestion || '').toString().trim()
  } catch {
    return Response.json({ error: 'corpo inválido' }, { status: 400 })
  }

  if (!userQuestion) {
    return Response.json({ error: 'userQuestion vazio' }, { status: 400 })
  }

  const deepseek = getLLM('deepseek')

  try {
    const raw = await completeFromOpenRouter({
      model: deepseek?.model || 'deepseek/deepseek-v3.2-exp',
      fallbackModel: deepseek?.fallbackModel || 'deepseek/deepseek-chat',
      messages: [
        { role: 'system', content: buildDispatcherSystemPrompt() },
        { role: 'user', content: userQuestion },
      ],
      temperature: 0.2,
      maxTokens: 500,
    })
    return Response.json(sanitize(extractJson(raw)))
  } catch (err) {
    // Nunca derruba o fluxo — devolve default seguro com o motivo.
    return Response.json({ ...SAFE_DEFAULT, reasoning: `Fallback: ${String(err.message || err).slice(0, 120)}` })
  }
}
