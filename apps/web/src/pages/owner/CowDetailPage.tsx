import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

interface Treatment {
  id: string
  drugName: string
  dosageRoute: string | null
  durationDays: number | null
  withdrawalPeriodDays: number
  withdrawalEndsDate: string | null
  costKes: number | null
}

interface HealthEvent {
  id: string
  eventDate: string
  eventType: string
  conditionName: string | null
  symptoms: string | null
  notes: string | null
  treatments: Treatment[]
}

interface CowDetail {
  id: string; name: string; tagNumber: string | null; breed: string | null
  status: string; dateLastCalved: string | null
  expectedDryOffDate: string | null; expectedCalvingDate: string | null
}

interface CowHealthResponse { cow: CowDetail; healthEvents: HealthEvent[] }

const EVENT_TYPES = ['illness', 'vaccination', 'deworming', 'routine', 'injury']

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

function WithdrawalBadge({ endsDate }: { endsDate: string }) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const ends  = new Date(endsDate)
  const days  = Math.ceil((ends.getTime() - today.getTime()) / 86400000)
  if (days < 0) return <span className="text-xs text-gray-400">ended {fmtDate(endsDate)}</span>
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
      ⚠️ withdrawal ends {fmtDate(endsDate)} ({days}d)
    </span>
  )
}

// ─── Treatment edit form ───────────────────────────────────────────────────

function TreatmentEditForm({ tx, onSaved, onCancel }: {
  tx: Treatment; onSaved: (updated: Treatment) => void; onCancel: () => void
}) {
  const { t } = useLang()
  const [drugName,        setDrug]     = useState(tx.drugName)
  const [dosageRoute,     setRoute]    = useState(tx.dosageRoute ?? '')
  const [durationDays,    setDuration] = useState(tx.durationDays?.toString() ?? '')
  const [withdrawalDays,  setWd]       = useState(tx.withdrawalPeriodDays.toString())
  const [withdrawalEnds,  setWdDate]   = useState(tx.withdrawalEndsDate ? tx.withdrawalEndsDate.split('T')[0] : '')
  const [costKes,         setCost]     = useState(tx.costKes?.toString() ?? '')
  const [saving, setSaving]           = useState(false)
  const [error,  setError]            = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/dairy/treatments/${tx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          drugName:             drugName.trim(),
          dosageRoute:          dosageRoute.trim() || null,
          durationDays:         durationDays ? Number(durationDays) : null,
          withdrawalPeriodDays: Number(withdrawalDays),
          withdrawalEndsDate:   withdrawalEnds || null,
          costKes:              costKes ? Number(costKes) : null,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved(await r.json())
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2 mt-2">
      <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
        {t('Edit Treatment', 'Hariri Matibabu')}
      </p>
      <input type="text" value={drugName} onChange={e => setDrug(e.target.value)}
        placeholder={t('Drug name', 'Jina la dawa')}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Route', 'Njia')}</label>
          <input type="text" value={dosageRoute} onChange={e => setRoute(e.target.value)}
            placeholder="IM / IV / oral"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Duration (days)', 'Muda (siku)')}</label>
          <input type="number" min={0} value={durationDays} onChange={e => setDuration(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Withdrawal (days)', 'Karantini (siku)')}</label>
          <input type="number" min={0} value={withdrawalDays} onChange={e => setWd(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Withdrawal ends', 'Karantini inaisha')}</label>
          <input type="date" value={withdrawalEnds} onChange={e => setWdDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">{t('Cost (KES)', 'Gharama (KES)')}</label>
        <input type="number" min={0} value={costKes} onChange={e => setCost(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
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

// ─── Health event edit form ───────────────────────────────────────────────

function HealthEventEditForm({ ev, onSaved, onCancel }: {
  ev: HealthEvent; onSaved: (updated: HealthEvent) => void; onCancel: () => void
}) {
  const { t } = useLang()
  const [eventDate,      setDate]      = useState(ev.eventDate.split('T')[0])
  const [eventType,      setType]      = useState(ev.eventType)
  const [conditionName,  setCondition] = useState(ev.conditionName ?? '')
  const [symptoms,       setSymptoms]  = useState(ev.symptoms ?? '')
  const [notes,          setNotes]     = useState(ev.notes ?? '')
  const [saving, setSaving]           = useState(false)
  const [error,  setError]            = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/dairy/health-events/${ev.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          eventDate, eventType,
          conditionName: conditionName.trim() || null,
          symptoms:      symptoms.trim()      || null,
          notes:         notes.trim()         || null,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved(await r.json())
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <div className="border border-blue-200 bg-blue-50 rounded-xl p-3 space-y-2 mb-2">
      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
        {t('Edit Event', 'Hariri Tukio')}
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
      <textarea value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={2}
        placeholder={t('Symptoms', 'Dalili')}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />
      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        placeholder={t('Notes', 'Maelezo')}
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

// ─── Cow edit form ────────────────────────────────────────────────────────

const COW_STATUSES = ['milking', 'dry', 'heifer', 'calf', 'sold', 'dead']

function CowEditForm({ cow, onSaved, onCancel }: {
  cow: CowDetail; onSaved: (updated: CowDetail) => void; onCancel: () => void
}) {
  const { t } = useLang()
  const [name,                setName]      = useState(cow.name)
  const [tagNumber,           setTag]       = useState(cow.tagNumber ?? '')
  const [breed,               setBreed]     = useState(cow.breed ?? '')
  const [status,              setStatus]    = useState(cow.status)
  const [dateLastCalved,      setCalved]    = useState(cow.dateLastCalved ? cow.dateLastCalved.split('T')[0] : '')
  const [expectedDryOffDate,  setDryOff]    = useState(cow.expectedDryOffDate ? cow.expectedDryOffDate.split('T')[0] : '')
  const [expectedCalvingDate, setCalving]   = useState(cow.expectedCalvingDate ? cow.expectedCalvingDate.split('T')[0] : '')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/dairy/cows/${cow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: name.trim(),
          tagNumber: tagNumber.trim() || null,
          breed: breed.trim() || null,
          status,
          dateLastCalved: dateLastCalved || null,
          expectedDryOffDate: expectedDryOffDate || null,
          expectedCalvingDate: expectedCalvingDate || null,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved(await r.json())
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide">
        {t('Edit Cow Details', 'Hariri Maelezo ya Ng\'ombe')}
      </p>
      <div className="grid grid-cols-2 gap-3">
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
        <div>
          <label className="text-xs text-gray-500">{t('Breed', 'Aina')}</label>
          <input type="text" placeholder="Ayrshire…" value={breed} onChange={e => setBreed(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Status', 'Hali')}</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
            {COW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">{t('Last calved', 'Alizaa mwisho')}</label>
        <input type="date" value={dateLastCalved} onChange={e => setCalved(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">{t('Expected dry-off', 'Kukausha')}</label>
          <input type="date" value={expectedDryOffDate} onChange={e => setDryOff(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Expected calving', 'Kuzaa')}</label>
          <input type="date" value={expectedCalvingDate} onChange={e => setCalving(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
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

// ─── Main page ────────────────────────────────────────────────────────────

export function CowDetailPage() {
  const { cowId } = useParams<{ cowId: string }>()
  const navigate = useNavigate()
  const { t } = useLang()

  const [data, setData]           = useState<CowHealthResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [showEditCow, setShowEditCow] = useState(false)

  // Track which event/treatment is being edited
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [editingTxId,    setEditingTxId]    = useState<string | null>(null)

  // Add event form state
  const today = new Date().toISOString().split('T')[0]
  const [eventDate,      setEventDate]      = useState(today)
  const [eventType,      setEventType]      = useState('illness')
  const [conditionName,  setConditionName]  = useState('')
  const [symptoms,       setSymptoms]       = useState('')
  const [notes,          setNotes]          = useState('')
  const [drugName,       setDrugName]       = useState('')
  const [dosageRoute,    setDosageRoute]    = useState('')
  const [durationDays,   setDurationDays]   = useState('')
  const [withdrawalDays, setWithdrawalDays] = useState('0')
  const [costKes,        setCostKes]        = useState('')
  const [saving,  setSaving]  = useState(false)
  const [saveErr, setSaveErr] = useState('')

  function load() {
    setLoading(true)
    fetch(`${API}/api/dairy/cows/${cowId}/health`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { if (cowId) load() }, [cowId])

  async function saveEvent() {
    setSaving(true); setSaveErr('')
    try {
      const r = await fetch(`${API}/api/dairy/cows/${cowId}/health`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          eventDate, eventType,
          conditionName:        conditionName.trim()  || undefined,
          symptoms:             symptoms.trim()       || undefined,
          notes:                notes.trim()          || undefined,
          drugName:             drugName.trim()       || undefined,
          dosageRoute:          dosageRoute.trim()    || undefined,
          durationDays:         durationDays          ? Number(durationDays) : undefined,
          withdrawalPeriodDays: Number(withdrawalDays),
          costKes:              costKes               ? Number(costKes)      : undefined,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      setShowForm(false)
      setConditionName(''); setSymptoms(''); setNotes('')
      setDrugName(''); setDosageRoute(''); setDurationDays('')
      setWithdrawalDays('0'); setCostKes('')
      load()
    } catch { setSaveErr(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  // Update a treatment in local state after edit
  function onTreatmentSaved(eventId: string, updated: Treatment) {
    setData(d => {
      if (!d) return d
      return {
        ...d,
        healthEvents: d.healthEvents.map(ev =>
          ev.id === eventId
            ? { ...ev, treatments: ev.treatments.map(tx => tx.id === updated.id ? updated : tx) }
            : ev
        ),
      }
    })
    setEditingTxId(null)
  }

  // Update a health event in local state after edit
  function onEventSaved(updated: HealthEvent) {
    setData(d => {
      if (!d) return d
      return {
        ...d,
        healthEvents: d.healthEvents.map(ev =>
          ev.id === updated.id ? { ...ev, ...updated } : ev
        ),
      }
    })
    setEditingEventId(null)
  }

  if (loading) return <div className="p-6 text-center text-gray-400">{t('Loading…', 'Inapakia…')}</div>
  if (!data)   return <div className="p-6 text-center text-gray-400">{t('Not found', 'Haikupatikana')}</div>

  const { cow, healthEvents } = data

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Back + header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={() => navigate(-1)} className="text-green-700 text-2xl">←</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-green-800">{cow.name}</h1>
          <p className="text-xs text-gray-400">
            {cow.breed ?? ''}{cow.tagNumber ? ` · #${cow.tagNumber}` : ''} · {cow.status}
          </p>
        </div>
        <button
          onClick={() => setShowEditCow(s => !s)}
          className="text-xs text-blue-600 font-semibold border border-blue-200 px-3 py-1.5 rounded-xl"
        >
          {showEditCow ? t('Cancel', 'Ghairi') : t('Edit', 'Hariri')}
        </button>
      </div>

      {/* Cow edit form */}
      {showEditCow && (
        <CowEditForm
          cow={cow}
          onSaved={updated => {
            setData(d => d ? { ...d, cow: { ...d.cow, ...updated } } : d)
            setShowEditCow(false)
          }}
          onCancel={() => setShowEditCow(false)}
        />
      )}

      {/* Key dates */}
      {!showEditCow && (cow.dateLastCalved || cow.expectedCalvingDate || cow.expectedDryOffDate) && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 grid grid-cols-2 gap-3 text-sm">
          {cow.dateLastCalved && (
            <div>
              <p className="text-xs text-gray-400">{t('Last calved', 'Alizaa mwisho')}</p>
              <p className="font-medium text-gray-800">{fmtDate(cow.dateLastCalved)}</p>
            </div>
          )}
          {cow.expectedDryOffDate && (
            <div>
              <p className="text-xs text-gray-400">{t('Expected dry-off', 'Kukausha')}</p>
              <p className="font-medium text-gray-800">{fmtDate(cow.expectedDryOffDate)}</p>
            </div>
          )}
          {cow.expectedCalvingDate && (
            <div>
              <p className="text-xs text-gray-400">{t('Expected calving', 'Kuzaa')}</p>
              <p className="font-medium text-gray-800">{fmtDate(cow.expectedCalvingDate)}</p>
            </div>
          )}
        </div>
      )}

      {/* Add event button */}
      <button onClick={() => setShowForm(s => !s)}
        className="w-full bg-green-700 text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform">
        {showForm ? t('Cancel', 'Ghairi') : `+ ${t('Add Health Event', 'Ongeza Tukio la Afya')}`}
      </button>

      {/* Add event form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <h2 className="font-bold text-gray-800">{t('New Health Event', 'Tukio Jipya la Afya')}</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">{t('Date', 'Tarehe')}</label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('Type', 'Aina')}</label>
              <select value={eventType} onChange={e => setEventType(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                {EVENT_TYPES.map(et => <option key={et} value={et}>{et}</option>)}
              </select>
            </div>
          </div>
          <input type="text" placeholder={t('Condition / diagnosis', 'Hali / utambuzi')}
            value={conditionName} onChange={e => setConditionName(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          <textarea placeholder={t('Symptoms (optional)', 'Dalili (si lazima)')}
            value={symptoms} onChange={e => setSymptoms(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />
          <textarea placeholder={t('Notes (optional)', 'Maelezo (si lazima)')}
            value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
              {t('Drug / Treatment (if any)', 'Dawa (kama ipo)')}
            </p>
            <input type="text" placeholder={t('Drug name', 'Jina la dawa')}
              value={drugName} onChange={e => setDrugName(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mb-2" />
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-gray-400">{t('Route', 'Njia')}</label>
                <input type="text" placeholder="IM / IV / oral"
                  value={dosageRoute} onChange={e => setDosageRoute(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400">{t('Days', 'Siku')}</label>
                <input type="number" placeholder="2" min={0}
                  value={durationDays} onChange={e => setDurationDays(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400">{t('Withdrawal d', 'Karantini d')}</label>
                <input type="number" placeholder="0" min={0}
                  value={withdrawalDays} onChange={e => setWithdrawalDays(e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="mt-2">
              <label className="text-xs text-gray-400">{t('Cost (KES)', 'Gharama (KES)')}</label>
              <input type="number" placeholder="0" min={0}
                value={costKes} onChange={e => setCostKes(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          {saveErr && <p className="text-xs text-red-600">{saveErr}</p>}
          <button onClick={saveEvent} disabled={saving}
            className="w-full bg-green-700 text-white font-bold py-3 rounded-2xl disabled:opacity-40">
            {saving ? '…' : t('Save', 'Hifadhi')}
          </button>
        </div>
      )}

      {/* Health history */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
        {t('Health History', 'Historia ya Afya')}
      </h2>

      {healthEvents.length === 0 ? (
        <p className="text-sm text-gray-400">{t('No health events recorded.', 'Hakuna tukio la afya lililorekodiwa.')}</p>
      ) : (
        <div className="space-y-3">
          {healthEvents.map(ev => (
            <div key={ev.id} className="bg-white rounded-2xl border border-gray-200 p-4">

              {/* Event header */}
              {editingEventId === ev.id ? (
                <HealthEventEditForm
                  ev={ev}
                  onSaved={onEventSaved}
                  onCancel={() => setEditingEventId(null)}
                />
              ) : (
                <>
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize font-medium">
                        {ev.eventType}
                      </span>
                      {ev.conditionName && (
                        <span className="text-sm font-semibold text-gray-800 ml-2">{ev.conditionName}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-gray-400">{fmtDate(ev.eventDate)}</span>
                      <button
                        onClick={() => { setEditingEventId(ev.id); setEditingTxId(null) }}
                        className="text-xs text-blue-600 font-semibold hover:text-blue-800"
                      >
                        {t('Edit', 'Hariri')}
                      </button>
                    </div>
                  </div>
                  {ev.symptoms && <p className="text-xs text-gray-500 mt-1">{ev.symptoms}</p>}
                  {ev.notes    && <p className="text-xs text-gray-400 mt-1 italic">{ev.notes}</p>}
                </>
              )}

              {/* Treatments */}
              {ev.treatments.map(tx => (
                <div key={tx.id}>
                  {editingTxId === tx.id ? (
                    <TreatmentEditForm
                      tx={tx}
                      onSaved={updated => onTreatmentSaved(ev.id, updated)}
                      onCancel={() => setEditingTxId(null)}
                    />
                  ) : (
                    <div className="mt-3 bg-orange-50 rounded-xl p-3 space-y-1">
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-semibold text-orange-800">💊 {tx.drugName}</p>
                        <button
                          onClick={() => { setEditingTxId(tx.id); setEditingEventId(null) }}
                          className="text-xs text-blue-600 font-semibold hover:text-blue-800"
                        >
                          {t('Edit', 'Hariri')}
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-3 text-xs text-orange-700">
                        {tx.dosageRoute  && <span>{tx.dosageRoute}</span>}
                        {tx.durationDays && <span>{tx.durationDays} {t('days', 'siku')}</span>}
                        {tx.costKes      && <span>KES {Number(tx.costKes).toLocaleString()}</span>}
                      </div>
                      {tx.withdrawalEndsDate && <WithdrawalBadge endsDate={tx.withdrawalEndsDate} />}
                    </div>
                  )}
                </div>
              ))}

            </div>
          ))}
        </div>
      )}
    </div>
  )
}
