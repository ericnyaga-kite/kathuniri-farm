import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

const CATEGORIES = [
  { key: 'tea',       icon: '🍃', en: 'Tea',       sw: 'Chai' },
  { key: 'dairy',     icon: '🥛', en: 'Dairy',     sw: 'Maziwa' },
  { key: 'crops',     icon: '🌾', en: 'Crops',     sw: 'Mazao' },
  { key: 'rental',    icon: '🏠', en: 'Rental',    sw: 'Nyumba' },
  { key: 'staff',     icon: '👷', en: 'Staff',     sw: 'Wafanyakazi' },
  { key: 'machinery', icon: '⚙️', en: 'Machinery', sw: 'Mashine' },
  { key: 'general',   icon: '📋', en: 'General',   sw: 'Jumla' },
]

export function DailyLogPage() {
  const { t, lang } = useLang()
  const navigate    = useNavigate()

  const [category, setCategory] = useState('')
  const [title, setTitle]       = useState('')
  const [body, setBody]         = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  const today = new Date().toISOString().split('T')[0]

  async function save() {
    if (!category || !body.trim()) {
      setError(t('Choose a category and write something.', 'Chagua kitengo na andika kitu.'))
      return
    }
    setSaving(true)
    setError('')
    try {
      const r = await fetch(`${API}/api/logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          logDate:   today,
          category,
          title:     title.trim() || undefined,
          body:      body.trim(),
          createdBy: 'manager',
        }),
      })
      if (!r.ok) throw new Error('Failed')
      navigate('/manager', { replace: true })
    } catch {
      setError(t('Failed to save — try again.', 'Imeshindwa kuhifadhi — jaribu tena.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4 space-y-5 max-w-md mx-auto">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={() => navigate(-1)} className="text-green-700 text-2xl">←</button>
        <h1 className="text-lg font-bold text-green-800">{t('Daily Log Entry', 'Kumbukumbu ya Leo')}</h1>
      </div>

      {/* Category selector */}
      <div>
        <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">{t('Category', 'Kitengo')}</p>
        <div className="grid grid-cols-4 gap-2">
          {CATEGORIES.map(c => (
            <button
              key={c.key}
              onClick={() => setCategory(c.key)}
              className={`flex flex-col items-center gap-1 py-3 rounded-2xl border-2 transition-colors text-xs font-semibold ${
                category === c.key
                  ? 'border-purple-600 bg-purple-50 text-purple-700'
                  : 'border-gray-200 bg-white text-gray-600'
              }`}
            >
              <span className="text-2xl">{c.icon}</span>
              {lang === 'en' ? c.en : c.sw}
            </button>
          ))}
        </div>
      </div>

      {/* Optional title */}
      <div>
        <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">{t('Title (optional)', 'Kichwa (si lazima)')}</p>
        <input
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={t('e.g. Spraying completed', 'mfano: Kupulizia kumekamilika')}
          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm"
        />
      </div>

      {/* Body */}
      <div>
        <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">{t('Details', 'Maelezo')}</p>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder={t(
            'Write what happened — as much or as little as you like.',
            'Andika kilichotokea — kadri unavyotaka.'
          )}
          rows={5}
          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button
        onClick={save}
        disabled={saving || !category || !body.trim()}
        className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40 active:scale-95 transition-transform"
      >
        {saving ? '…' : t('Save Log', 'Hifadhi')}
      </button>
    </div>
  )
}
