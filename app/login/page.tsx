'use client'

import { useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'

const ALLOWED_DOMAIN = 'stepscale.ai'

export default function LoginPage() {
  const router = useRouter()

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showResend, setShowResend] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  function validateDomain(e: string) {
    if (!e.endsWith('@' + ALLOWED_DOMAIN)) {
      setError(`Only @${ALLOWED_DOMAIN} accounts are allowed.`)
      return false
    }
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setMessage('')
    setShowResend(false)

    if (!validateDomain(email)) return

    setLoading(true)
    try {
      const supabase = createClient()
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) {
          setError(error.message)
          if (error.message.toLowerCase().includes('email not confirmed') ||
              error.message.toLowerCase().includes('not verified')) {
            setShowResend(true)
          }
          return
        }
        router.push('/')
        router.refresh()
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) { setError(error.message); return }
        setMessage('Check your email to confirm your account.')
        setShowResend(true)
        setMode('login')
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (!email || !validateDomain(email)) return
    setResendLoading(true)
    setMessage('')
    setError('')
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) { setError(error.message); return }
      setMessage(`Verification email resent to ${email}.`)
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0A0E1A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40, justifyContent: 'center' }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg, #00D4FF, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M3 18L9 12L13 16L21 6" stroke="#0A0E1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="21" cy="6" r="2" fill="#0A0E1A" />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, letterSpacing: -0.4, color: '#fff' }}>Stepscale Sales</div>
            <div style={{ fontSize: 11, color: '#5A6685', fontFamily: 'JetBrains Mono, monospace' }}>KPI Dashboard</div>
          </div>
        </div>

        {/* Card */}
        <div style={{
          background: 'linear-gradient(180deg, #161B2C, #131826)',
          border: '1px solid #1E2538',
          borderRadius: 16,
          padding: 32,
        }}>
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </h1>
            <p style={{ fontSize: 13, color: '#5A6685', margin: '6px 0 0' }}>
              {mode === 'login' ? 'Welcome back to your dashboard.' : `Only @${ALLOWED_DOMAIN} accounts are allowed.`}
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, color: '#8B95B2', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); setShowResend(false) }}
                placeholder={`you@${ALLOWED_DOMAIN}`}
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0F1422',
                  border: '1px solid #262E45',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: 11, color: '#8B95B2', textTransform: 'uppercase', letterSpacing: 0.6, fontWeight: 600, display: 'block', marginBottom: 6 }}>
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError('') }}
                placeholder="••••••••"
                required
                minLength={6}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#0F1422',
                  border: '1px solid #262E45',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 14,
                  outline: 'none',
                }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 12px', background: '#FF546822', border: '1px solid #FF546844', borderRadius: 8, fontSize: 12.5, color: '#FF5468' }}>
                {error}
              </div>
            )}

            {message && (
              <div style={{ padding: '10px 12px', background: '#00E5A022', border: '1px solid #00E5A044', borderRadius: 8, fontSize: 12.5, color: '#00E5A0' }}>
                {message}
              </div>
            )}

            {showResend && (
              <button
                type="button"
                onClick={handleResend}
                disabled={resendLoading}
                style={{
                  padding: '10px 16px',
                  background: '#FFB80022',
                  border: '1px solid #FFB80044',
                  borderRadius: 8,
                  color: resendLoading ? '#5A6685' : '#FFB800',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: resendLoading ? 'not-allowed' : 'pointer',
                  textAlign: 'left' as const,
                }}
              >
                {resendLoading ? 'Sending...' : '↻  Resend verification email'}
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4,
                padding: '12px 20px',
                background: loading ? '#1E2538' : '#00D4FF',
                color: loading ? '#5A6685' : '#0A0E1A',
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'background 150ms',
              }}
            >
              {loading ? 'Loading...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div style={{ marginTop: 20, textAlign: 'center', fontSize: 13, color: '#5A6685' }}>
            {mode === 'login' ? (
              <>Don&apos;t have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); setMessage(''); setShowResend(false) }} style={{ color: '#00D4FF', fontWeight: 600, textDecoration: 'underline' }}>
                  Sign up
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button onClick={() => { setMode('login'); setError(''); setMessage(''); setShowResend(false) }} style={{ color: '#00D4FF', fontWeight: 600, textDecoration: 'underline' }}>
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
