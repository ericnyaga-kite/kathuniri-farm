import { useState, useEffect } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

type EventType = 'illness' | 'heat' | 'insemination' | 'calving' | 'dry_off' | 'recovery'
type PageTab = 'hali' | 'historia'

interface Cow { id: string; name: string; tagNumber: string | null; status: string }

interface HealthEvent {
  id: string
  eventDate: string
  eventType: string
  notes: string | null
  conditionName: string | null
}

interface CowWithEvents extends Cow {
  healthEvents?: HealthEvent[]
}

const EVENT_TYPES: { key: EventType; icon: string; en: string; sw: string; color: string }[] = [
  { key: 'illness',      icon: '🤒', en: 'Sick',      sw: 'Mgonjwa',  color: 'bg-red-100 text-red-700 border-red-300' },
  { key: 'heat',         icon: '❤️',  en: 'In Heat',   sw: 'Joto',     color: 'bg-pink-100 text-pink-700 border-pink-300' },
  { key: 'insemination', icon: '🐂', en: 'Served/AI', sw: 'Kupandwa', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'calving',      icon: '🐄', en: 'Calved',    sw: 'Kuzaa',    color: 'bg-green-100 text-green-700 border-green-300' },
  { key: 'dry_off',      icon: '💤', en: 'Dry Off',   sw: 'Kuacha',   color: 'bg-amber-100 text-amber-700 border-amber-300' },
  { key: 'recovery',     icon: '✅', en: 'Recovered', sw: 'Kupona',   color: 'bg-teal-100 text-teal-700 border-teal-300' },
]

const EVENT_LABEL: Record<EventType, { en: string; sw: string }> = {
  illness:      { en: 'Sick',      sw: 'Mgonjwa'  },
  heat:         { en: 'In Heat',   sw: 'Joto'     },
  insemination: { en: 'Served/AI', sw: 'Kupandwa' },
  calving:      { en: 'Calved',    sw: 'Kuzaa'    },
  dry_off:      { en: 'Dry Off',   sw: 'Kuacha'   },
  recovery:     { en: 'Recovered', sw: 'Kupona'   },
}

// ─── Hali Tab ────────────────────────────────────────────────────────────────

function HaliTab({ t, cows, loading }: { t: (en: string, sw: string) => string; cows: Cow[]; loading: boolean }) {
  const today = new Date().toISOString().split('T')[0]
  const [cowId,       setCowId]       = useState('')
  const [eventType,   setEventType]   = useState<EventType | ''>('')
  const [notes,       setNotes]       = useState('')
  const [drugName,    setDrugName]    = useState('')
  const [withdrawal,  setWithdrawal]  = useState('')
  const [semenCode,   setSemenCode]   = useState('')
  const [calfSex,     setCalfSex]     = useState<'M' | 'F' | ''>('')
  const [date,        setDate]        = useState(today)
  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [error,       setError]       = useState('')

  function reset() {
    setEventType(''); setNotes(''); setDrugName(''); setWithdrawal('')
    setSemenCode(''); setCalfSex(''); setDate(today); setSaved(false); setError('')
  }

  async function handleSave() {
    if (!cowId)      { setError(t('Select a cow', 'Chagua ng\'ombe')); return }
    if (!eventType)  { setError(t('Select an event type', 'Chagua aina ya tukio')); return }
    setSaving(true); setError('')
    try {
      // Build health event body
      const body: Record<string, unknown> = { eventDate: date, eventType, notes: notes || undefined }

      if (eventType === 'illness') {
        body.conditionName = 'sick'
        if (drugName.trim()) {
          body.drugName = drugName.trim()
          if (withdrawal) body.withdrawalPeriodDays = Number(withdrawal)
        }
      }
      if (eventType === 'insemination' && semenCode.trim()) {
        body.semenCode = semenCode.trim()
      }
      if (eventType === 'calving' && calfSex) {
        body.notes = [calfSex === 'M' ? t('Calf: Male', 'Ndama: Dume') : t('Calf: Female', 'Ndama: Jike'), notes].filter(Boolean).join(' — ')
      }

      const r = await fetch(`${API}/api/dairy/cows/${cowId}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify(body),
      })
      if (!r.ok) throw new Error()

      // Additional PATCH for status changes
      if (eventType === 'calving') {
        await fetch(`${API}/api/dairy/cows/${cowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ status: 'milking' }),
        }).catch(() => {})
      }
      if (eventType === 'dry_off') {
        await fetch(`${API}/api/dairy/cows/${cowId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ status: 'dry' }),
        }).catch(() => {})
      }

      setSaved(true)
    } catch {
      setError(t('Failed. Try again.', 'Imeshindwa. Jaribu tena.'))
    } finally {
      setSaving(false)
    }
  }

  if (saved) return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <p className="text-5xl">✅</p>
      <p className="text-xl font-bold text-green-700">{t('Saved!', 'Imehifadhiwa!')}</p>
      <button className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl" onClick={reset}>
        {t('Record Another', 'Ingiza Nyingine')}
      </button>
    </div>
  )

  return (
    <div className="space-y-3">
      {/* Cow selector */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          {t('Cow', 'Ng\'ombe')}
        </p>
        {loading ? (
          <p className="text-sm text-gray-400">{t('Loading…', 'Inapakia…')}</p>
        ) : (
          <div className="flex overflow-x-auto gap-2 pb-1 scrollbar-hide">
            {cows.map(c => (
              <button key={c.id} onClick={() => setCowId(c.id)}
                className={`flex-shrink-0 px-3 py-2 rounded-2xl font-bold text-sm border-2 transition-all ${
                  cowId === c.id ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-700 border-gray-200'
                }`}>
                🐄 {c.name}{c.tagNumber ? ` (${c.tagNumber})` : ''}
              </button>
            ))}
            {cows.length === 0 && <p className="text-sm text-gray-400 flex-shrink-0">{t('No cows found', 'Hakuna ng\'ombe')}</p>}
          </div>
        )}
      </div>

      {/* Event type grid */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
          {t('Event Type', 'Aina ya Tukio')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_TYPES.map(ev => (
            <button key={ev.key} onClick={() => setEventType(ev.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-2xl border-2 font-bold text-sm transition-all ${
                eventType === ev.key ? ev.color + ' border-current shadow-sm' : 'bg-gray-50 text-gray-600 border-gray-200'
              }`}>
              <span className="text-xl">{ev.icon}</span>
              <span className="text-left leading-tight">
                {t(ev.en, ev.sw)}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Conditional fields */}
      {eventType === 'illness' && (
        <div className="bg-red-50 rounded-2xl p-4 space-y-3 border border-red-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              {t('Drug Name', 'Jina la Dawa')} <span className="text-gray-400 normal-case">({t('optional', 'si lazima')})</span>
            </p>
            <input type="text" value={drugName} onChange={e => setDrugName(e.target.value)}
              placeholder={t('e.g. Oxytetracycline', 'mfano: Oxytetracycline')}
              className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm bg-white" />
          </div>
          {drugName.trim() && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                {t('Withdrawal Days', 'Siku za Kuacha')}
              </p>
              <input type="number" inputMode="numeric" value={withdrawal} onChange={e => setWithdrawal(e.target.value)}
                placeholder="0"
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm bg-white" />
            </div>
          )}
        </div>
      )}

      {eventType === 'insemination' && (
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {t('Semen Code', 'Nambari ya Mbegu')} <span className="text-gray-400 normal-case">({t('optional', 'si lazima')})</span>
          </p>
          <input type="text" value={semenCode} onChange={e => setSemenCode(e.target.value)}
            placeholder={t('e.g. FRI-001', 'mfano: FRI-001')}
            className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm bg-white" />
        </div>
      )}

      {eventType === 'calving' && (
        <div className="bg-green-50 rounded-2xl p-4 border border-green-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {t('Calf Sex', 'Jinsia ya Ndama')}
          </p>
          <div className="flex gap-3">
            <button onClick={() => setCalfSex('M')}
              className={`flex-1 py-2.5 rounded-2xl font-bold text-base border-2 transition-all ${
                calfSex === 'M' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200'
              }`}>
              ♂ {t('Male', 'Dume')}
            </button>
            <button onClick={() => setCalfSex('F')}
              className={`flex-1 py-2.5 rounded-2xl font-bold text-base border-2 transition-all ${
                calfSex === 'F' ? 'bg-pink-500 text-white border-pink-500' : 'bg-white text-gray-700 border-gray-200'
              }`}>
              ♀ {t('Female', 'Jike')}
            </button>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {t('Notes', 'Maelezo')} <span className="text-gray-400 normal-case">({t('optional', 'si lazima')})</span>
        </p>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
          placeholder={t('Any observations…', 'Maelezo yoyote…')}
          className="w-full border border-gray-300 rounded-2xl px-3 py-2 text-sm resize-none" />
      </div>

      {/* Date */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {t('Date', 'Tarehe')}
        </p>
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm" />
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button onClick={handleSave} disabled={saving || !cowId || !eventType}
        className="w-full bg-green-700 text-white font-bold py-3 rounded-2xl text-base disabled:opacity-40">
        {saving ? t('Saving…', 'Inahifadhi…') : `✓ ${t('Save', 'Hifadhi')}`}
      </button>
    </div>
  )
}

// ─── Historia Tab ─────────────────────────────────────────────────────────────

function HistoriaTab({ t, cows, lang }: { t: (en: string, sw: string) => string; cows: Cow[]; lang: string }) {
  const [entries, setEntries] = useState<Array<{ cow: Cow; event: HealthEvent }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (cows.length === 0) return
    let cancelled = false
    setLoading(true)

    Promise.all(
      cows.map(cow =>
        fetch(`${API}/api/dairy/cows/${cow.id}/health?limit=5`, {
          headers: { Authorization: `Bearer ${token()}` },
        })
          .then(r => r.json())
          .then((data: CowWithEvents) => {
            const events: HealthEvent[] = Array.isArray(data?.healthEvents) ? data.healthEvents : []
            return events.map(ev => ({ cow, event: ev }))
          })
          .catch(() => [] as Array<{ cow: Cow; event: HealthEvent }>)
      )
    ).then(results => {
      if (cancelled) return
      const all = results.flat()
      all.sort((a, b) => new Date(b.event.eventDate).getTime() - new Date(a.event.eventDate).getTime())
      // Keep last 14 days
      const cutoff = Date.now() - 14 * 86400000
      setEntries(all.filter(e => new Date(e.event.eventDate).getTime() >= cutoff))
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [cows])

  if (loading) return <p className="text-sm text-gray-400 text-center py-8">{t('Loading…', 'Inapakia…')}</p>

  if (entries.length === 0) return (
    <div className="text-center py-12">
      <p className="text-4xl mb-2">🐄</p>
      <p className="text-gray-400 text-sm">{t('No events in the last 14 days', 'Hakuna matukio siku 14 zilizopita')}</p>
    </div>
  )

  const EVENT_ICONS: Record<string, string> = {
    illness: '🤒', heat: '❤️', insemination: '🐂', calving: '🐄', dry_off: '💤', recovery: '✅',
  }

  return (
    <div className="space-y-3">
      {entries.map(({ cow, event }) => {
        const label = EVENT_LABEL[event.eventType as EventType]
        return (
          <div key={event.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{EVENT_ICONS[event.eventType] ?? '📋'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-gray-800">{cow.name}</span>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {label ? (lang === 'en' ? label.en : label.sw) : event.eventType}
                  </span>
                </div>
                {event.notes && <p className="text-sm text-gray-600 mt-1">{event.notes}</p>}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(event.eventDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function AnimalEntryPage() {
  const { t, lang } = useLang()
  const [cows,    setCows]    = useState<Cow[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<PageTab>('hali')

  useEffect(() => {
    fetch(`${API}/api/dairy/cows`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then((data: Cow[]) => { if (Array.isArray(data)) setCows(data) })
      .catch(() => setCows([]))
      .finally(() => setLoading(false))
  }, [])

  const TABS = [
    { key: 'hali' as PageTab,     icon: '🤒', en: 'Condition', sw: 'Hali'    },
    { key: 'historia' as PageTab, icon: '📖', en: 'History',   sw: 'Historia' },
  ]

  return (
    <div className="p-3 max-w-md mx-auto">
      <div className="mb-3">
        <h1 className="text-xl font-bold text-green-800">{t('Animals', 'Wanyama')}</h1>
        <p className="text-xs text-gray-400">
          {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-3">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex-1 py-2 rounded-2xl text-sm font-bold transition-all ${
              tab === tb.key ? 'bg-green-700 text-white shadow' : 'bg-gray-100 text-gray-600'
            }`}>
            {tb.icon} {t(tb.en, tb.sw)}
          </button>
        ))}
      </div>

      {tab === 'hali'     && <HaliTab     t={t} cows={cows} loading={loading} />}
      {tab === 'historia' && <HistoriaTab t={t} cows={cows} lang={lang} />}
    </div>
  )
}
