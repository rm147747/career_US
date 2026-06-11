import Stripe from 'stripe'
import { createServerSupabaseClient } from '../../../lib/supabase.server'

const PACKAGES = {
  credits_10:  { credits: 10,  priceEnv: 'STRIPE_PRICE_10'  },
  credits_50:  { credits: 50,  priceEnv: 'STRIPE_PRICE_50'  },
  credits_200: { credits: 200, priceEnv: 'STRIPE_PRICE_200' },
}

export async function POST(req) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { packageId } = await req.json().catch(() => ({}))
  const pkg = PACKAGES[packageId]
  if (!pkg) return Response.json({ error: 'Invalid package' }, { status: 400 })

  const priceId = process.env[pkg.priceEnv]
  if (!priceId) return Response.json({ error: 'Price not configured' }, { status: 500 })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { user_id: user.id, credits: String(pkg.credits) },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/billing`,
    customer_email: user.email,
  })

  return Response.json({ url: session.url })
}
