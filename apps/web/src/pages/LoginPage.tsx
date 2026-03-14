import { useState } from 'react'
import { useAuthStore } from '../store/authStore'

const PINS = ['·', '·', '·', '·']

export function LoginPage() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const { setUser } = useAuthStore()

  function handleDigit(d: string) {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    if (next.length === 4) verify(next)
  }

  function handleDelete() {
    setPin(p => p.slice(0, -1))
    setError('')
  }

  function verify(entered: string) {
    // TODO: verify against bcrypt hash stored in IndexedDB
    // For now, hardcoded for development — replace before deploy
    if (entered === '1234') {
      setUser({ id: 'manager-1', name: 'Msimamizi', role: 'manager' })
    } else {
      setError('PIN si sahihi')
      setPin('')
    }
  }

  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  return (
    <div className="min-h-screen bg-green-900 flex flex-col items-center justify-center px-6">
      <h1 className="text-white text-3xl font-bold mb-2">Kathuniri Farm</h1>
      <p className="text-green-200 text-sm mb-10">Weka PIN yako</p>

      {/* PIN dots */}
      <div className="flex gap-4 mb-8">
        {PINS.map((_, i) => (
          <div
            key={i}
            className={`w-5 h-5 rounded-full border-2 border-white transition-all ${
              i < pin.length ? 'bg-white' : 'bg-transparent'
            }`}
          />
        ))}
      </div>

      {error && <p className="text-red-300 text-sm mb-4">{error}</p>}

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {digits.map((d, i) => (
          d === '' ? <div key={i} /> :
          d === '⌫' ? (
            <button
              key={i}
              onClick={handleDelete}
              className="h-16 rounded-2xl bg-green-800 text-white text-2xl font-bold active:bg-green-700"
            >
              ⌫
            </button>
          ) : (
            <button
              key={i}
              onClick={() => handleDigit(d)}
              className="h-16 rounded-2xl bg-green-800 text-white text-2xl font-bold active:bg-green-700"
            >
              {d}
            </button>
          )
        ))}
      </div>

      <button
        className="mt-10 text-green-300 text-sm underline"
        onClick={() => setUser({ id: 'owner-1', name: 'Mmiliki', role: 'owner' })}
      >
        Ingia kama Mmiliki
      </button>
    </div>
  )
}
