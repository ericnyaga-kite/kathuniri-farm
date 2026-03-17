import { useState, useEffect, useRef } from 'react'
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
  { key: 'machinery', icon: '⚙️',  en: 'Machinery', sw: 'Mashine' },
  { key: 'general',   icon: '📋', en: 'General',   sw: 'Jumla' },
]

const CAT_MAP = Object.fromEntries(CATEGORIES.map(c => [c.key, c]))

interface LogEntry { id: string; logDate: string; category: string; title: string | null; body: string; createdAt: string; photoId?: string | null }

// ─── Client-side image compression ───────────────────────────────────────────

async function compressImage(file: File, maxWidth = 800, quality = 0.7): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale  = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = img.width  * scale
      canvas.height = img.height * scale
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.src = url
  })
}

function offsetDate(base: string, days: number) {
  const d = new Date(base); d.setDate(d.getDate() + days); return d.toISOString().split('T')[0]
}

// ─── History tab ─────────────────────────────────────────────────────────

function HistoryTab({ t, lang }: { t: (en: string, sw: string) => string; lang: string }) {
  const todayStr = new Date().toISOString().split('T')[0]
  const [date,   setDate]   = useState(todayStr)
  const [logs,   setLogs]   = useState<LogEntry[]>([])
  const [loading,setLoading]= useState(false)

  function fmtLabel(d: string) {
    if (d === todayStr)               return lang === 'en' ? 'Today'     : 'Leo'
    if (d === offsetDate(todayStr,-1))return lang === 'en' ? 'Yesterday' : 'Jana'
    return new Date(d).toLocaleDateString(lang === 'en' ? 'en-KE' : 'sw-KE', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/logs?date=${date}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then((data: LogEntry[]) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [date])

  // Build last 7 days chips
  const chips = Array.from({ length: 7 }, (_, i) => offsetDate(todayStr, -i))

  return (
    <div className="space-y-4">
      {/* Day chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {chips.map(d => (
          <button key={d} onClick={() => setDate(d)}
            className={`flex-shrink-0 px-4 py-2 rounded-2xl text-sm font-semibold ${
              date === d ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}>
            {fmtLabel(d)}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-gray-400 text-center py-6">{t('Loading…','Inapakia…')}</p>}

      {!loading && logs.length === 0 && (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">📋</p>
          <p className="text-gray-400 text-sm">{t('No logs for this day','Hakuna kumbukumbu siku hii')}</p>
        </div>
      )}

      {!loading && logs.map(l => (
        <div key={l.id} className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{CAT_MAP[l.category]?.icon ?? '📋'}</span>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium capitalize">
                  {lang === 'en' ? (CAT_MAP[l.category]?.en ?? l.category) : (CAT_MAP[l.category]?.sw ?? l.category)}
                </span>
                {l.title && <span className="text-sm font-semibold text-gray-700">{l.title}</span>}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{l.body}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(l.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            {l.photoId && (
              <img
                src={`${API}/api/uploads/${l.photoId}`}
                alt="log photo"
                className="w-16 h-16 object-cover rounded-xl border border-gray-200 flex-shrink-0"
              />
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Write tab ────────────────────────────────────────────────────────────

function WriteTab({ t, lang }: { t: (en: string, sw: string) => string; lang: string }) {
  const navigate     = useNavigate()
  const [category,   setCategory]   = useState('')
  const [title,      setTitle]      = useState('')
  const [body,       setBody]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null)
  const [savedLogId,   setSavedLogId]   = useState<string | null>(null)
  const [photoSaved,   setPhotoSaved]   = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const today = new Date().toISOString().split('T')[0]

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setPhotoDataUrl(compressed)
    if (photoInputRef.current) photoInputRef.current.value = ''
  }

  async function save() {
    if (!category || !body.trim()) {
      setError(t('Choose a category and write something.', 'Chagua kitengo na andika kitu.'))
      return
    }
    setSaving(true); setError('')
    try {
      // 1. Save the log
      const r = await fetch(`${API}/api/logs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body:    JSON.stringify({ logDate: today, category, title: title.trim() || undefined, body: body.trim(), createdBy: 'manager' }),
      })
      if (!r.ok) throw new Error()
      const log = await r.json() as { id: string }

      // 2. If we have a photo, upload it now
      if (photoDataUrl) {
        setSavedLogId(log.id)
        const pr = await fetch(`${API}/api/logs/${log.id}/photo`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body:    JSON.stringify({ dataUrl: photoDataUrl, mimeType: 'image/jpeg' }),
        })
        if (pr.ok) setPhotoSaved(true)
      }

      navigate('/manager', { replace: true })
    } catch {
      setError(t('Failed to save — try again.', 'Imeshindwa kuhifadhi — jaribu tena.'))
    } finally { setSaving(false) }
  }

  // Suppress unused-variable warning for savedLogId (used only as state flag)
  void savedLogId
  void photoSaved

  return (
    <div className="space-y-3">
      {/* Note about expenses */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2 flex items-start gap-2">
        <span className="text-lg">💡</span>
        <p className="text-xs text-amber-800 leading-relaxed">
          {t(
            'To record expenses (purchases, payments), use the Work tab (👷 Kazi) instead.',
            'Kuingiza gharama (manunuzi, malipo), tumia kichupo cha Kazi (👷 Kazi).'
          )}
        </p>
      </div>

      {/* Category — horizontal scroll */}
      <div>
        <p className="text-xs text-gray-500 mb-1.5 font-semibold uppercase tracking-wide">{t('Category', 'Kitengo')}</p>
        <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
          {CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-2xl border-2 transition-colors text-xs font-semibold ${
                category === c.key ? 'border-purple-600 bg-purple-50 text-purple-700' : 'border-gray-200 bg-white text-gray-600'
              }`}>
              <span className="text-base">{c.icon}</span>
              {lang === 'en' ? c.en : c.sw}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div>
        <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">{t('Title (optional)', 'Kichwa (si lazima)')}</p>
        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
          placeholder={t('e.g. Spraying completed', 'mfano: Kupulizia kumekamilika')}
          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm" />
      </div>

      {/* Body */}
      <div>
        <p className="text-xs text-gray-500 mb-1 font-semibold uppercase tracking-wide">{t('Details', 'Maelezo')}</p>
        <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
          placeholder={t('Write what happened…', 'Andika kilichotokea…')}
          className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm resize-none" />
      </div>

      {/* Photo section */}
      <div>
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhotoSelect}
        />
        {photoDataUrl ? (
          <div className="flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-2xl p-3">
            <img src={photoDataUrl} alt="preview" className="w-16 h-16 object-cover rounded-xl border border-purple-300" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-purple-700">{t('Photo ready', 'Picha iko tayari')}</p>
              <p className="text-xs text-gray-500">{t('Will be saved with the log', 'Itahifadhiwa na kumbukumbu')}</p>
            </div>
            <button onClick={() => setPhotoDataUrl(null)}
              className="text-red-400 font-bold text-lg px-2">✕</button>
          </div>
        ) : (
          <button
            onClick={() => photoInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-semibold text-sm">
            <span className="text-lg">📷</span>
            {t('Add Photo', 'Ongeza Picha')}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <button onClick={save} disabled={saving || !category || !body.trim()}
        className="w-full bg-purple-600 text-white font-bold py-4 rounded-2xl text-base disabled:opacity-40">
        {saving ? t('Saving…', 'Inahifadhi…') : t('Save Log', 'Hifadhi')}
      </button>
    </div>
  )
}

// ─── Page shell ───────────────────────────────────────────────────────────

export function DailyLogPage() {
  const { t, lang } = useLang()
  const [tab, setTab] = useState<'write' | 'history'>('write')

  return (
    <div className="p-3 max-w-md mx-auto">
      <h1 className="text-xl font-bold text-green-800 mb-3">{t('Daily Log', 'Kumbukumbu')}</h1>

      <div className="flex gap-2 mb-3">
        <button onClick={() => setTab('write')}
          className={`flex-1 py-2 rounded-2xl text-sm font-bold ${tab === 'write' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          ✏️ {t('Write', 'Andika')}
        </button>
        <button onClick={() => setTab('history')}
          className={`flex-1 py-2 rounded-2xl text-sm font-bold ${tab === 'history' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
          📖 {t('History', 'Historia')}
        </button>
      </div>

      {tab === 'write'   && <WriteTab   t={t} lang={lang} />}
      {tab === 'history' && <HistoryTab t={t} lang={lang} />}
    </div>
  )
}
