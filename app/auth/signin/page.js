'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createBrowserSupabaseClient } from '../../lib/supabase'

export default function SignInPage() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const supabase = createBrowserSupabaseClient()

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    if (err) { setError(err.message); setLoading(false); return }
    router.push(next)
    router.refresh()
  }

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={title}>Life Board</h1>
        <p style={subtitle}>Sign in to your account</p>
        <form onSubmit={submit} style={form}>
          <label style={label}>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              required autoComplete="email" style={input} />
          </label>
          <label style={label}>
            Password
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="current-password" style={input} />
          </label>
          {error && <p style={err}>{error}</p>}
          <button type="submit" disabled={loading} style={btn}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p style={footer}>
          No account? <a href="/auth/signup" style={link}>Create one</a>
        </p>
      </div>
    </div>
  )
}

const page   = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif' }
const card   = { width: '100%', maxWidth: 380, padding: '40px 32px', background: '#111', border: '1px solid #222', borderRadius: 8 }
const title  = { margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: '#f5f5f5', letterSpacing: '-0.02em' }
const subtitle = { margin: '0 0 28px', fontSize: 14, color: '#555' }
const form   = { display: 'flex', flexDirection: 'column', gap: 16 }
const label  = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#888' }
const input  = { padding: '9px 12px', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#f5f5f5', fontSize: 14, outline: 'none' }
const err    = { margin: 0, fontSize: 13, color: '#ef4444' }
const btn    = { marginTop: 4, padding: '10px 16px', background: '#f5f5f5', color: '#0a0a0a', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
const footer = { marginTop: 20, fontSize: 13, color: '#444', textAlign: 'center' }
const link   = { color: '#888', textDecoration: 'none' }
