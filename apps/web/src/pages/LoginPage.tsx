import { useState } from 'react'
import { GoogleLogin } from '@react-oauth/google'
import { useAuthStore } from '../store/authStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const FALLBACK_PIN = '5678'

export function LoginPage() {
  const [pin, setPin]           = useState('')
  const [error, setError]       = useState('')
  const [mode, setMode]         = useState<'pin' | 'google'>('pin')
  const [managerPin, setManagerPin] = useState(FALLBACK_PIN)
  const { setUser }             = useAuthStore()

  // Fetch current manager PIN from server; fall back to hardcoded if offline
  useState(() => {
    fetch(`${API}/api/auth/manager-pin`)
      .then(r => r.json())
      .then(d => { if (d.pin) setManagerPin(d.pin) })
      .catch(() => {}) // offline — use fallback
  })

  function handleDigit(d: string) {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) verifyPin(next)
  }

  function verifyPin(entered: string) {
    if (entered === managerPin) {
      setUser({ id: 'manager-1', name: 'Msimamizi', role: 'manager' })
    } else {
      setError('PIN si sahihi')
      setTimeout(() => { setPin(''); setError('') }, 1000)
    }
  }

  async function handleGoogleSuccess(credentialResponse: any) {
    setError('')
    try {
      const res = await fetch(`${API}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: credentialResponse.credential }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        return
      }
      localStorage.setItem('kf_token', data.token)
      setUser(data.user)
    } catch {
      setError('Connection error — try again')
    }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center px-6">
      <h1 className="text-white text-3xl font-bold mb-1">Kathuniri Farm</h1>
      <p className="text-green-300 text-sm mb-8">
        {mode === 'pin' ? 'Weka PIN yako' : 'Ingia na Google'}
      </p>

      {mode === 'pin' ? (
        <>
          <div className="flex gap-4 mb-6">
            {[0,1,2,3].map(i => (
              <div key={i} className={`w-5 h-5 rounded-full border-2 border-white transition-all ${i < pin.length ? 'bg-white' : 'bg-transparent'}`} />
            ))}
          </div>

          {error && <p className="text-red-300 text-sm mb-4">{error}</p>}

          <div className="grid grid-cols-3 gap-4 w-full max-w-xs mb-8">
            {digits.map((d, i) => (
              d === '' ? <div key={i} /> :
              d === '⌫' ? (
                <button key={i} onClick={() => setPin(p => p.slice(0,-1))}
                  className="h-16 rounded-2xl bg-green-800 text-white text-2xl font-bold active:bg-green-700">⌫</button>
              ) : (
                <button key={i} onClick={() => handleDigit(d)}
                  className="h-16 rounded-2xl bg-green-800 text-white text-2xl font-bold active:bg-green-700">{d}</button>
              )
            ))}
          </div>

          <button onClick={() => setMode('google')} className="text-green-300 text-sm underline">
            Ingia kama Mmiliki / Mtazamaji
          </button>
        </>
      ) : (
        <>
          {error && <p className="text-red-300 text-sm mb-4 text-center max-w-xs">{error}</p>}

          <div className="mb-6">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in failed')}
              theme="filled_black"
              shape="pill"
              text="signin_with"
            />
          </div>

          <button onClick={() => { setMode('pin'); setError('') }} className="text-green-300 text-sm underline">
            ← Rudi kwa PIN
          </button>
        </>
      )}
    </div>
  )
}
