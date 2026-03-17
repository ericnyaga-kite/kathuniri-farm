import { useState, useEffect } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function token() { return localStorage.getItem('kf_token') ?? '' }

function PinSection({ t }: { t: (en: string, sw: string) => string }) {
  const [newPin, setNewPin]   = useState('')
  const [saving, setSaving]   = useState(false)
  const [status, setStatus]   = useState<string | null>(null)

  async function save() {
    if (!/^\d{4,8}$/.test(newPin)) { setStatus(t('PIN must be 4–8 digits', 'PIN lazima iwe tarakimu 4–8')); return }
    setSaving(true); setStatus(null)
    try {
      const r = await fetch(`${API}/api/auth/manager-pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ pin: newPin }),
      })
      if (!r.ok) throw new Error('Failed')
      setStatus(t('✓ PIN updated', '✓ PIN imebadilishwa'))
      setNewPin('')
    } catch { setStatus(t('Failed to update', 'Imeshindwa kubadilisha')) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h2 className="font-bold text-gray-800 mb-3">{t('Manager PIN', 'PIN ya Msimamizi')}</h2>
      <p className="text-xs text-gray-400 mb-3">
        {t('The 4–8 digit PIN the manager uses to log in.', 'Tarakimu 4–8 ambazo msimamizi hutumia kuingia.')}
      </p>
      <div className="flex gap-2">
        <input
          type="password"
          inputMode="numeric"
          placeholder={t('New PIN', 'PIN Mpya')}
          value={newPin}
          onChange={e => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-center tracking-widest"
        />
        <button
          onClick={save}
          disabled={saving || newPin.length < 4}
          className="bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40"
        >
          {saving ? '...' : t('Update', 'Sasisha')}
        </button>
      </div>
      {status && <p className="text-xs mt-2 text-green-700">{status}</p>}
    </div>
  )
}

interface Viewer { id: string; email: string; name: string | null; addedAt: string }

function ViewersSection({ t }: { t: (en: string, sw: string) => string }) {
  const [viewers, setViewers] = useState<Viewer[]>([])
  const [email, setEmail]     = useState('')
  const [name, setName]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function load() {
    fetch(`${API}/api/auth/viewers`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setViewers).catch(() => {})
  }

  useEffect(() => { load() }, [])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setSaving(true); setError(null)
    try {
      const r = await fetch(`${API}/api/auth/viewers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), name: name.trim() || undefined }),
      })
      if (!r.ok) throw new Error('Failed')
      setEmail(''); setName(''); load()
    } catch { setError(t('Failed to add', 'Imeshindwa kuongeza')) }
    finally { setSaving(false) }
  }

  async function remove(email: string) {
    try {
      await fetch(`${API}/api/auth/viewers/${encodeURIComponent(email)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token()}` },
      })
      load()
    } catch {}
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4">
      <h2 className="font-bold text-gray-800 mb-3">{t('Viewer Access', 'Ruhusa ya Kutazama')}</h2>
      <p className="text-xs text-gray-400 mb-3">
        {t('These Google accounts can sign in and view the dashboard (read-only).', 'Akaunti hizi za Google zinaweza kuingia na kutazama dashibodi (kusoma tu).')}
      </p>

      <form onSubmit={add} className="space-y-2 mb-4">
        <input type="email" placeholder="email@gmail.com" value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        <div className="flex gap-2">
          <input type="text" placeholder={t('Name (optional)', 'Jina (si lazima)')} value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          <button type="submit" disabled={saving || !email.trim()}
            className="bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-40">
            + {t('Add', 'Ongeza')}
          </button>
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </form>

      {viewers.length === 0
        ? <p className="text-xs text-gray-400">{t('No viewers added yet.', 'Hakuna watazamaji bado.')}</p>
        : <div className="space-y-2">
            {viewers.map(v => (
              <div key={v.id} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-gray-800">{v.name ?? v.email}</p>
                  {v.name && <p className="text-xs text-gray-400">{v.email}</p>}
                </div>
                <button onClick={() => remove(v.email)}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1">
                  {t('Remove', 'Ondoa')}
                </button>
              </div>
            ))}
          </div>
      }
    </div>
  )
}

export function SettingsPage() {
  const { t } = useLang()

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-bold text-green-800 mb-1">{t('Settings', 'Mipangilio')}</h1>
      <PinSection t={t} />
      <ViewersSection t={t} />
    </div>
  )
}
