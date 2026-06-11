// GET  — current balance for authenticated user
// POST — deduct N credits (atomic check + insert)
import { createServerSupabaseClient } from '../../../lib/supabase'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await adminClient()
    .from('user_credits')
    .select('balance')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) return Response.json({ error: 'Failed to fetch balance' }, { status: 500 })
  return Response.json({ balance: data?.balance ?? 0 })
}

export async function POST(req) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const amount = typeof body.amount === 'number' && body.amount > 0 ? body.amount : 1
  const reason = body.reason || 'deliberation'

  const admin = adminClient()

  const { data: creditRow } = await admin
    .from('user_credits').select('balance').eq('user_id', user.id).maybeSingle()

  const balance = creditRow?.balance ?? 0
  if (balance < amount) {
    return Response.json({ error: 'Insufficient credits', balance }, { status: 402 })
  }

  const { error: insertErr } = await admin
    .from('credits_ledger')
    .insert({ user_id: user.id, delta: -amount, reason })

  if (insertErr) return Response.json({ error: 'Failed to deduct credits' }, { status: 500 })
  return Response.json({ balance: balance - amount })
}
