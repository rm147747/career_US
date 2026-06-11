import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const PROTECTED = ['/session', '/dashboard', '/history']

export async function middleware(request) {
  let response = NextResponse.next({ request })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Without Supabase config, auth cannot work — fail open so the site stays up
  // instead of crashing every request with MIDDLEWARE_INVOCATION_FAILED.
  if (!supabaseUrl || !supabaseAnonKey) {
    return response
  }

  let user = null
  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    })
    const { data } = await supabase.auth.getUser()
    user = data?.user ?? null
  } catch {
    // Supabase unreachable or misconfigured — treat as signed out rather than 500.
    return response
  }

  const path = request.nextUrl.pathname

  const isProtected = PROTECTED.some((p) => path.startsWith(p))
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/signin'
    url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }

  if (user && path.startsWith('/auth/')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  // exclude: static assets + Stripe webhook (called by Stripe, not browser)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/billing/webhook).*)'],
}
