'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '../../lib/supabase'

export default function SignUpPage() {
  const router = useRouter()
  const [name, setName]           = useState('')
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [confirm, setConfirm]     = useState('')
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(false)
  const [done, setDone]           = useState(false)
  async function submit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8)  { setError('Password must be at least 8 characters'); return }
    setError('')
    setLoading(true)
    const supabase = createBrowserSupabaseClient()
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    })
    if (err) { setError(err.message); setLoading(false); return }
    setDone(true)
  }

  if (done) return (
    <div style={page}>
      <div style={card}>
        <h1 style={title}>Check your email</h1>
        <p style={subtitle}>We sent a confirmation link to <strong style={{ color: '#aaa' }}>{email}</strong>. Click it to activate your account and get 10 free credits.</p>
        <a href="/auth/signin" style={{ ...btn, display: 'block', textAlign: 'center', textDecoration: 'none', marginTop: 20 }}>Back to sign in</a>
      </div>
    </div>
  )

  return (
    <div style={page}>
      <div style={card}>
        <h1 style={title}>Create account</h1>
        <p style={subtitle}>Get 10 free credits on signup</p>
        <form onSubmit={submit} style={form}>
          <label style={label}>Full name <input type="text" value={name} onChange={e => setName(e.target.value)} required style={input} /></label>
          <label style={label}>Email     <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="email" style={input} /></label>
          <label style={label}>Password  <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={input} /></label>
          <label style={label}>Confirm   <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={input} /></label>
          {error && <p style={errStyle}>{error}</p>}
          <button type="submit" disabled={loading} style={btn}>{loading ? 'Creating…' : 'Create account'}</button>
        </form>
        <p style={footer}>Already have one? <a href="/auth/signin" style={link}>Sign in</a></p>
      </div>
    </div>
  )
}

const page     = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", system-ui, sans-serif' }
const card     = { width: '100%', maxWidth: 380, padding: '40px 32px', background: '#111', border: '1px solid #222', borderRadius: 8 }
const title    = { margin: '0 0 4px', fontSize: 20, fontWeight: 600, color: '#f5f5f5', letterSpacing: '-0.02em' }
const subtitle = { margin: '0 0 28px', fontSize: 14, color: '#555' }
const form     = { display: 'flex', flexDirection: 'column', gap: 16 }
const label    = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: '#888' }
const input    = { padding: '9px 12px', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 6, color: '#f5f5f5', fontSize: 14, outline: 'none' }
const errStyle = { margin: 0, fontSize: 13, color: '#ef4444' }
const btn      = { marginTop: 4, padding: '10px 16px', background: '#f5f5f5', color: '#0a0a0a', border: 'none', borderRadius: 6, fontSize: 14, fontWeight: 500, cursor: 'pointer' }
const footer   = { marginTop: 20, fontSize: 13, color: '#444', textAlign: 'center' }
const link     = { color: '#888', textDecoration: 'none' }
