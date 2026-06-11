import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

export async function POST(req) {
  const body = await req.text()
  const sig  = req.headers.get('stripe-signature')

  let event
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  if (event.type !== 'checkout.session.completed') {
    return new Response('ok', { status: 200 })
  }

  const session = event.data.object
  if (session.payment_status !== 'paid') return new Response('ok', { status: 200 })

  const userId  = session.metadata?.user_id
  const credits = parseInt(session.metadata?.credits, 10)

  if (!userId || !credits || isNaN(credits)) {
    console.error('[billing/webhook] Missing metadata', session.id)
    return new Response('Missing metadata', { status: 400 })
  }

  const { error } = await admin.from('credits_ledger').insert({
    user_id: userId,
    delta: credits,
    reason: 'purchase',
    stripe_payment_id: session.payment_intent,
  })

  if (error) {
    console.error('[billing/webhook] Failed to credit user', { userId, credits, error })
    return new Response('DB error', { status: 500 })
  }

  return new Response('ok', { status: 200 })
}
