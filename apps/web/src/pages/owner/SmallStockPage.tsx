import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

interface HealthEvent {
  id: string
  eventDate: string
  eventType: string
  conditionName: string | null
  symptoms: string | null
  drugName: string | null
  costKes: number | null
  notes: string | null
}

interface Animal {
  id: string
  name: string | null
  species: string
  sex: string
  tagNumber: string | null
  dateOfBirth: string | null
  status: string
  notes: string | null
  healthEvents: HealthEvent[]
}

const EVENT_TYPES = ['illness', 'vaccination', 'deworming', 'routine', 'injury', 'breeding']

const SPECIES_ICON: Record<string, string> = {
  bull: '🐂',
  sheep: '🐑',
  goat: '🐐',
  other: '🐾',
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ─── Inline edit form ────────────────────────────────────────────────────

function AnimalEditForm({ animal, onSaved, onCancel }: {
  animal: Animal; onSaved: (updated: Animal) => void; onCancel: () => void
}) {
  const { t } = useLang()
  const [name,        setName]    = useState(animal.name ?? '')
  const [tagNumber,   setTag]     = useState(animal.tagNumber ?? '')
  const [status,      setStatus]  = useState(animal.status)
  const [dateOfBirth, setDob]     = useState(animal.dateOfBirth ? animal.dateOfBirth.split('T')[0] : '')
  const [notes,       setNotes]   = useState(animal.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/dairy/small-stock/${animal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: name.trim() || null,
          tagNumber: tagNumber.trim() || null,
          status,
          dateOfBirth: dateOfBirth || null,
          notes: notes.trim() || null,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved({ ...animal, ...(await r.json()) })
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2 mt-2">
      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
        {t('Edit Details', 'Hariri Maelezo')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Name', 'Jina')}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Tag #', 'Nambari')}</label>
          <input type="text" value={tagNumber} onChange={e => setTag(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Status', 'Hali')}</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
            <option value="active">{t('Active', 'Hai')}</option>
            <option value="sold">{t('Sold', 'Imeuzwa')}</option>
            <option value="dead">{t('Dead', 'Imekufa')}</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Date of birth', 'Tarehe ya kuzaliwa')}</label>
          <input type="date" value={dateOfBirth} onChange={e => setDob(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        placeholder={t('Notes…', 'Maelezo…')}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-green-700 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-40">
          {saving ? '…' : t('Save', 'Hifadhi')}
        </button>
        <button onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-xl text-sm">
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </div>
  )
}

// ─── Health event add form ────────────────────────────────────────────────

function AddHealthEventForm({ animalId, onSaved, onCancel }: {
  animalId: string; onSaved: (ev: HealthEvent) => void; onCancel: () => void
}) {
  const { t } = useLang()
  const today = new Date().toISOString().split('T')[0]
  const [eventDate,     setDate]      = useState(today)
  const [eventType,     setType]      = useState('routine')
  const [conditionName, setCondition] = useState('')
  const [symptoms,      setSymptoms]  = useState('')
  const [drugName,      setDrug]      = useState('')
  const [costKes,       setCost]      = useState('')
  const [notes,         setNotes]     = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/dairy/small-stock/${animalId}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          eventDate, eventType,
          conditionName: conditionName.trim() || undefined,
          symptoms:      symptoms.trim()      || undefined,
          drugName:      drugName.trim()      || undefined,
          costKes:       costKes              ? Number(costKes) : undefined,
          notes:         notes.trim()         || undefined,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved(await r.json())
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-2 mt-2">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
        {t('Add Health Event', 'Ongeza Tukio la Afya')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Date', 'Tarehe')}</label>
          <input type="date" value={eventDate} onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Type', 'Aina')}</label>
          <select value={eventType} onChange={e => setType(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
            {EVENT_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
          </select>
        </div>
      </div>
      <input type="text" value={conditionName} onChange={e => setCondition(e.target.value)}
        placeholder={t('Condition / diagnosis', 'Hali / utambuzi')}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      <input type="text" value={symptoms} onChange={e => setSymptoms(e.target.value)}
        placeholder={t('Symptoms (optional)', 'Dalili (si lazima)')}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Drug (if any)', 'Dawa (kama ipo)')}</label>
          <input type="text" value={drugName} onChange={e => setDrug(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Cost (KES)', 'Gharama')}</label>
          <input type="number" min={0} value={costKes} onChange={e => setCost(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        placeholder={t('Notes…', 'Maelezo…')}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-green-700 text-white font-bold py-2 rounded-xl text-sm disabled:opacity-40">
          {saving ? '…' : t('Save', 'Hifadhi')}
        </button>
        <button onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-xl text-sm">
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </div>
  )
}

// ─── Animal card ──────────────────────────────────────────────────────────

function AnimalCard({ animal: initialAnimal, t }: {
  animal: Animal
  t: (en: string, sw: string) => string
}) {
  const [animal, setAnimal]       = useState(initialAnimal)
  const [expanded, setExpanded]   = useState(false)
  const [editing, setEditing]     = useState(false)
  const [addingEvent, setAddEvent] = useState(false)
  const [events, setEvents]       = useState<HealthEvent[]>(initialAnimal.healthEvents)

  const icon = SPECIES_ICON[animal.species] ?? '🐾'
  const label = animal.name ?? `${animal.species} (${animal.sex})`

  return (
    <div className={`bg-white rounded-2xl border p-4 ${animal.status !== 'active' ? 'border-gray-300 opacity-70' : 'border-gray-200'}`}>
      {/* Header row */}
      <div className="flex justify-between items-start">
        <div>
          <p className="font-bold text-gray-800 text-base">
            {icon} {label}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {animal.species} · {animal.sex}
            {animal.tagNumber ? ` · #${animal.tagNumber}` : ''}
            {animal.status !== 'active' && ` · ${animal.status}`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setEditing(s => !s); setExpanded(true) }}
            className="text-xs text-blue-600 font-semibold"
          >
            {editing ? t('Cancel', 'Ghairi') : t('Edit', 'Hariri')}
          </button>
          <button onClick={() => setExpanded(s => !s)}
            className="text-xs text-gray-500 font-medium">
            {expanded ? '▲' : '▼'}
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <AnimalEditForm
          animal={animal}
          onSaved={updated => { setAnimal(updated); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      )}

      {/* Expanded: health history */}
      {expanded && !editing && (
        <div className="mt-3 border-t border-gray-100 pt-3 space-y-2">
          {events.length === 0 ? (
            <p className="text-xs text-gray-400">{t('No health events.', 'Hakuna tukio.')}</p>
          ) : (
            events.map(ev => (
              <div key={ev.id} className="bg-gray-50 rounded-xl p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full capitalize font-medium">
                      {ev.eventType}
                    </span>
                    {ev.conditionName && (
                      <span className="text-sm font-semibold text-gray-800 ml-2">{ev.conditionName}</span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{fmtDate(ev.eventDate)}</span>
                </div>
                {ev.symptoms  && <p className="text-xs text-gray-500 mt-1">{ev.symptoms}</p>}
                {ev.drugName  && <p className="text-xs text-orange-700 mt-1">💊 {ev.drugName}</p>}
                {ev.costKes   && <p className="text-xs text-gray-400 mt-1">KES {Number(ev.costKes).toLocaleString()}</p>}
                {ev.notes     && <p className="text-xs text-gray-400 mt-1 italic">{ev.notes}</p>}
              </div>
            ))
          )}

          {/* Add event */}
          {addingEvent ? (
            <AddHealthEventForm
              animalId={animal.id}
              onSaved={ev => { setEvents(prev => [ev, ...prev]); setAddEvent(false) }}
              onCancel={() => setAddEvent(false)}
            />
          ) : (
            <button
              onClick={() => setAddEvent(true)}
              className="w-full border border-dashed border-gray-300 text-gray-500 text-sm font-medium rounded-xl py-2 mt-1"
            >
              + {t('Add Health Event', 'Ongeza Tukio la Afya')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export function SmallStockPage() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/dairy/small-stock`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.json()).then(setAnimals).catch(() => {}).finally(() => setLoading(false))
  }, [])

  // Group by species
  const bulls  = animals.filter(a => a.species === 'bull')
  const sheep  = animals.filter(a => a.species === 'sheep')
  const others = animals.filter(a => a.species !== 'bull' && a.species !== 'sheep')

  function Section({ title, list }: { title: string; list: Animal[] }) {
    if (list.length === 0) return null
    return (
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>
        <div className="space-y-3">
          {list.map(a => <AnimalCard key={a.id} animal={a} t={t} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5 pb-8">
      <div className="flex items-center gap-3 pt-1">
        <button onClick={() => navigate(-1)} className="text-green-700 text-2xl">←</button>
        <h1 className="text-xl font-bold text-green-800">{t('Small Stock', 'Mifugo Midogo')}</h1>
      </div>

      {loading && <p className="text-center text-gray-400 py-12">{t('Loading…', 'Inapakia…')}</p>}

      {!loading && animals.length === 0 && (
        <p className="text-center text-gray-400 py-12">{t('No animals recorded.', 'Hakuna mifugo iliyorekodiwa.')}</p>
      )}

      {!loading && (
        <div className="space-y-5">
          <Section title={t('Bull', 'Fahali')} list={bulls} />
          <Section title={t('Sheep', 'Kondoo')} list={sheep} />
          <Section title={t('Other', 'Wengine')} list={others} />
        </div>
      )}
    </div>
  )
}
