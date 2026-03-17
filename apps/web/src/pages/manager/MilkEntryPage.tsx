import { useState, useEffect, useRef } from 'react'
import { db, queueSync } from '../../db/localDb'
import { useLang } from '../../store/langStore'
import type { MilkProductionRecord } from '@kathuniri/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

type Session  = 'dawn' | 'morning' | 'afternoon' | 'evening'
type PageTab  = 'milk' | 'sales' | 'feed' | 'history'

const SESSIONS: { key: Session; icon: string; en: string; sw: string }[] = [
  { key: 'dawn',      icon: '🌑', en: 'Dawn',      sw: 'Alfajiri' },
  { key: 'morning',   icon: '☀️',  en: 'Morning',   sw: 'Asubuhi'  },
  { key: 'afternoon', icon: '🌤',  en: 'Afternoon', sw: 'Mchana'   },
  { key: 'evening',   icon: '🌆',  en: 'Evening',   sw: 'Jioni'    },
]

const FEED_TYPES = [
  { en: 'Napier',       sw: 'Napier'    },
  { en: 'Hay',          sw: 'Majani'    },
  { en: 'Concentrate',  sw: 'Mkate'     },
  { en: 'Silage',       sw: 'Silage'    },
  { en: 'Other',        sw: 'Nyingine'  },
]

interface Cow   { id: string; name: string }
interface Buyer { id: string; canonicalName: string; pricePerLitre: number }

// ─── Scan Receipt ─────────────────────────────────────────────────────────

function ScanReceiptPane({ t, onDone }: { t: (en: string, sw: string) => string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle')
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)

  async function handleFile(file: File) {
    setStatus('scanning')
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const r = await fetch(`${API}/api/dairy/receipts/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ imageData: reader.result }),
        })
        if (!r.ok) throw new Error('Failed')
        setParsed(await r.json())
        setStatus('done')
      } catch { setStatus('error') }
    }
    reader.readAsDataURL(file)
  }

  if (status === 'done' && parsed) return (
    <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
      <p className="text-3xl text-center">✅</p>
      <p className="font-bold text-green-800 text-center">{t('Receipt saved!', 'Risiti imehifadhiwa!')}</p>
      <div className="bg-white rounded-xl p-3 text-sm space-y-1">
        {parsed.receiptDate  != null && <p className="text-gray-600">{t('Date','Tarehe')}: <span className="font-medium">{String(parsed.receiptDate).split('T')[0]}</span></p>}
        {parsed.shift        != null && <p className="text-gray-600">{t('Shift','Zamu')}: <span className="font-medium">{String(parsed.shift)}</span></p>}
        {typeof parsed.quantityKg === 'number' && <p className="text-gray-600">{t('Qty','Kiwango')}: <span className="font-bold text-green-700">{parsed.quantityKg.toFixed(1)} kg</span></p>}
      </div>
      <button onClick={onDone} className="w-full bg-green-700 text-white font-bold py-3 rounded-2xl">{t('Done','Maliza')}</button>
    </div>
  )

  if (status === 'error') return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center space-y-3">
      <p className="text-3xl">❌</p>
      <p className="text-red-700 font-semibold">{t('Failed. Try again.','Imeshindwa. Jaribu tena.')}</p>
      <button onClick={() => setStatus('idle')} className="w-full border border-gray-300 text-gray-600 font-semibold py-3 rounded-2xl">{t('Retry','Jaribu Tena')}</button>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
      <p className="font-bold text-gray-800">{t('Scan Mborugu Receipt','Scan Risiti ya Mborugu')}</p>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      {status === 'scanning' ? (
        <div className="text-center py-6"><p className="text-4xl animate-pulse">📷</p><p className="text-sm text-gray-500 mt-2">{t('Reading…','Inasoma…')}</p></div>
      ) : (
        <button onClick={() => fileRef.current?.click()} className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl text-lg">
          📷 {t('Take Photo','Piga Picha')}
        </button>
      )}
      <button onClick={onDone} className="w-full text-gray-500 text-sm py-2">{t('Cancel','Ghairi')}</button>
    </div>
  )
}

// ─── Milk Tab ─────────────────────────────────────────────────────────────

function MilkTab({ t, cows, cowsLoading }: { t: (en: string, sw: string) => string; cows: Cow[]; cowsLoading: boolean }) {
  const [session, setSession] = useState<Session>('morning')
  const [litres,  setLitres]  = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  const today = new Date().toISOString().split('T')[0]

  function handleLitres(cowId: string, val: string) {
    if (/^\d*\.?\d*$/.test(val)) setLitres(prev => ({ ...prev, [cowId]: val }))
  }

  async function handleSave() {
    setSaving(true)
    try {
      for (const cow of cows) {
        const raw = litres[cow.id]
        if (!raw) continue
        const record: MilkProductionRecord = {
          id: crypto.randomUUID(),
          productionDate: today,
          cowId: cow.id,
          session,
          litres: parseFloat(raw),
          withdrawalActive: false,
          saleable: true,
          source: 'manual',
        }
        await db.milkProduction.put(record)
        await queueSync({
          tableName: 'milk_production', recordId: record.id, operation: 'INSERT',
          payload: record as unknown as Record<string, unknown>, createdAt: new Date().toISOString(), attemptCount: 0,
        })
        fetch(`${API}/api/dairy/milk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ ...record }),
        }).catch(() => {})
      }
      setSaved(true)
      setLitres({})
    } finally { setSaving(false) }
  }

  const total = cows.reduce((s, c) => s + (parseFloat(litres[c.id] || '0') || 0), 0)
  const hasAny = cows.some(c => !!litres[c.id])

  if (saved) return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <p className="text-5xl">✅</p>
      <p className="text-xl font-bold text-green-700">{t('Saved!','Imehifadhiwa!')}</p>
      <button className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl" onClick={() => setSaved(false)}>
        {t('Enter Another Session','Zamu Nyingine')}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Session selector — 2×2 grid */}
      <div className="grid grid-cols-2 gap-2">
        {SESSIONS.map(s => (
          <button key={s.key} onClick={() => setSession(s.key)}
            className={`py-3 rounded-2xl text-sm font-bold transition-all flex items-center justify-center gap-1 ${
              session === s.key ? 'bg-green-700 text-white shadow' : 'bg-gray-100 text-gray-600'
            }`}>
            {s.icon} {t(s.en, s.sw)}
          </button>
        ))}
      </div>

      {/* Cow inputs — compact rows */}
      {cowsLoading ? (
        <p className="text-sm text-gray-400 text-center py-4">{t('Loading…','Inapakia…')}</p>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {cows.map((cow, i) => (
            <div key={cow.id} className={`flex items-center gap-3 px-4 py-3 ${i < cows.length - 1 ? 'border-b border-gray-100' : ''}`}>
              <span className="text-base font-semibold text-gray-700 flex-1">🐄 {cow.name}</span>
              <input
                type="number" inputMode="decimal" placeholder="0.0"
                value={litres[cow.id] ?? ''}
                onChange={e => handleLitres(cow.id, e.target.value)}
                className="w-24 text-2xl font-bold text-center border-b-2 border-green-400 focus:outline-none py-1 bg-transparent"
              />
              <span className="text-gray-400 font-medium w-4">L</span>
            </div>
          ))}
        </div>
      )}

      {/* Total */}
      {hasAny && (
        <div className="flex justify-between items-center px-1">
          <span className="text-sm text-gray-500">{t('Total','Jumla')}</span>
          <span className="text-xl font-bold text-green-700">{total.toFixed(1)} L</span>
        </div>
      )}

      <button onClick={handleSave} disabled={saving || !hasAny}
        className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-40">
        {saving ? t('Saving…','Inahifadhi…') : `✓ ${t('Confirm','Thibitisha')}`}
      </button>
    </div>
  )
}

// ─── Sales Tab ────────────────────────────────────────────────────────────

function SalesTab({ t }: { t: (en: string, sw: string) => string }) {
  const [buyers,   setBuyers]  = useState<Buyer[]>([])
  const [buyerId,  setBuyerId] = useState('')
  const [litres,   setLitres]  = useState('')
  const [price,    setPrice]   = useState('')
  const [saving,   setSaving]  = useState(false)
  const [saved,    setSaved]   = useState(false)
  const [error,    setError]   = useState('')

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetch(`${API}/api/dairy/buyers`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then((data: Buyer[]) => {
        if (Array.isArray(data)) {
          setBuyers(data)
          if (data.length > 0) {
            setBuyerId(data[0].id)
            setPrice(String(data[0].pricePerLitre || ''))
          }
        }
      })
      .catch(() => {})
  }, [])

  function selectBuyer(id: string) {
    setBuyerId(id)
    const b = buyers.find(x => x.id === id)
    if (b?.pricePerLitre) setPrice(String(b.pricePerLitre))
  }

  async function handleSave() {
    if (!buyerId || !litres || !price) { setError(t('Fill all fields','Jaza sehemu zote')); return }
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/dairy/deliveries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ deliveryDate: today, buyerId, litres: parseFloat(litres), pricePerLitre: parseFloat(price) }),
      })
      if (!r.ok) throw new Error()
      setSaved(true); setLitres(''); setPrice(buyers.find(b => b.id === buyerId)?.pricePerLitre?.toString() || '')
    } catch { setError(t('Failed. Try again.','Imeshindwa. Jaribu tena.')) }
    finally   { setSaving(false) }
  }

  if (saved) return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <p className="text-5xl">✅</p>
      <p className="text-xl font-bold text-green-700">{t('Delivery recorded!','Imeandikwa!')}</p>
      <button className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl" onClick={() => setSaved(false)}>
        {t('Record Another','Ingiza Nyingine')}
      </button>
    </div>
  )

  const totalKes = (parseFloat(litres)||0) * (parseFloat(price)||0)

  return (
    <div className="space-y-4">
      {/* Buyer */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Buyer','Mnunuzi')}</p>
        <div className="flex flex-wrap gap-2">
          {buyers.map(b => (
            <button key={b.id} onClick={() => selectBuyer(b.id)}
              className={`px-4 py-3 rounded-2xl font-bold text-sm ${buyerId === b.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {b.canonicalName}
            </button>
          ))}
          {buyers.length === 0 && <p className="text-sm text-gray-400">{t('No buyers configured','Hakuna wanunuzi')}</p>}
        </div>
      </div>

      {/* Litres */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Litres','Lita')}</p>
        <div className="flex items-center gap-3">
          <input type="number" inputMode="decimal" placeholder="0.0" value={litres}
            onChange={e => setLitres(e.target.value)}
            className="flex-1 text-3xl font-bold text-center border-b-2 border-blue-400 focus:outline-none py-2 bg-transparent" />
          <span className="text-gray-500 font-medium">L</span>
        </div>
      </div>

      {/* Price */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Price / Litre','Bei / Lita')}</p>
        <div className="flex items-center gap-3">
          <span className="text-gray-500 font-medium">KES</span>
          <input type="number" inputMode="decimal" placeholder="0" value={price}
            onChange={e => setPrice(e.target.value)}
            className="flex-1 text-3xl font-bold text-center border-b-2 border-blue-400 focus:outline-none py-2 bg-transparent" />
        </div>
      </div>

      {totalKes > 0 && (
        <div className="flex justify-between items-center px-1">
          <span className="text-sm text-gray-500">{t('Total','Jumla')}</span>
          <span className="text-xl font-bold text-blue-700">KES {Math.round(totalKes).toLocaleString()}</span>
        </div>
      )}

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button onClick={handleSave} disabled={saving || !litres || !buyerId}
        className="w-full bg-blue-600 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-40">
        {saving ? t('Saving…','Inahifadhi…') : `✓ ${t('Record Sale','Hifadhi Uuzaji')}`}
      </button>
    </div>
  )
}

// ─── Feed Tab ─────────────────────────────────────────────────────────────

function FeedTab({ t, cows }: { t: (en: string, sw: string) => string; cows: Cow[] }) {
  const [feedType,   setFeedType]  = useState(FEED_TYPES[0].en)
  const [cowId,      setCowId]     = useState<string>('all')
  const [quantityKg, setQuantity]  = useState('')
  const [saving,     setSaving]    = useState(false)
  const [saved,      setSaved]     = useState(false)
  const [error,      setError]     = useState('')

  const today = new Date().toISOString().split('T')[0]

  async function handleSave() {
    if (!quantityKg) { setError(t('Enter quantity','Weka kiasi')); return }
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/dairy/feed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          feedDate: today,
          cowId: cowId === 'all' ? null : cowId,
          feedType,
          quantityKg: parseFloat(quantityKg),
        }),
      })
      if (!r.ok) throw new Error()
      setSaved(true); setQuantity('')
    } catch { setError(t('Failed. Try again.','Imeshindwa. Jaribu tena.')) }
    finally  { setSaving(false) }
  }

  if (saved) return (
    <div className="flex flex-col items-center justify-center py-12 space-y-4">
      <p className="text-5xl">✅</p>
      <p className="text-xl font-bold text-green-700">{t('Feed recorded!','Chakula kimeandikwa!')}</p>
      <button className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl" onClick={() => setSaved(false)}>
        {t('Record Another','Ingiza Nyingine')}
      </button>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Feed type */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Feed Type','Aina ya Chakula')}</p>
        <div className="flex flex-wrap gap-2">
          {FEED_TYPES.map(f => (
            <button key={f.en} onClick={() => setFeedType(f.en)}
              className={`px-4 py-3 rounded-2xl font-bold text-sm ${feedType === f.en ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {t(f.en, f.sw)}
            </button>
          ))}
        </div>
      </div>

      {/* Cow selector */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('For','Kwa')}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setCowId('all')}
            className={`px-4 py-3 rounded-2xl font-bold text-sm ${cowId === 'all' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
            🐄 {t('All Cows','Ng\'ombe Wote')}
          </button>
          {cows.map(c => (
            <button key={c.id} onClick={() => setCowId(c.id)}
              className={`px-4 py-3 rounded-2xl font-bold text-sm ${cowId === c.id ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Quantity */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('Quantity (kg)','Kiasi (kg)')}</p>
        <div className="flex items-center gap-3">
          <input type="number" inputMode="decimal" placeholder="0.0" value={quantityKg}
            onChange={e => setQuantity(e.target.value)}
            className="flex-1 text-3xl font-bold text-center border-b-2 border-amber-400 focus:outline-none py-2 bg-transparent" />
          <span className="text-gray-500 font-medium">kg</span>
        </div>
      </div>

      {error && <p className="text-red-600 text-sm text-center">{error}</p>}

      <button onClick={handleSave} disabled={saving || !quantityKg}
        className="w-full bg-amber-600 text-white font-bold py-4 rounded-2xl text-lg disabled:opacity-40">
        {saving ? t('Saving…','Inahifadhi…') : `✓ ${t('Save Feed','Hifadhi Chakula')}`}
      </button>
    </div>
  )
}

// ─── History Tab ─────────────────────────────────────────────────────────

interface MilkRecord { id: string; productionDate: string; session: string; litres: number; cow?: { name: string } | null }

function MilkHistoryTab({ t }: { t: (en: string, sw: string) => string }) {
  const [records,  setRecords]  = useState<MilkRecord[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const to   = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0]
    fetch(`${API}/api/dairy/milk/daily?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then((data: MilkRecord[]) => setRecords(Array.isArray(data) ? data : []))
      .catch(() => setRecords([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-gray-400 text-center py-8">{t('Loading…','Inapakia…')}</p>
  if (records.length === 0) return (
    <div className="text-center py-12">
      <p className="text-4xl mb-2">🥛</p>
      <p className="text-gray-400 text-sm">{t('No records in the last 7 days','Hakuna rekodi siku 7 zilizopita')}</p>
    </div>
  )

  // Group by date
  const byDate = new Map<string, MilkRecord[]>()
  for (const r of records) {
    const d = r.productionDate.split('T')[0]
    const arr = byDate.get(d) ?? []
    arr.push(r); byDate.set(d, arr)
  }

  const SESSION_ICONS: Record<string, string> = { dawn: '🌑', morning: '☀️', afternoon: '🌤', evening: '🌆' }

  return (
    <div className="space-y-4">
      {Array.from(byDate.entries()).map(([date, recs]) => {
        const total = recs.reduce((s, r) => s + r.litres, 0)
        return (
          <div key={date} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">
                {new Date(date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
              <span className="text-sm font-bold text-blue-700">{total.toFixed(1)} L</span>
            </div>
            {recs.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span>{SESSION_ICONS[r.session] ?? '🥛'}</span>
                  <span className="text-sm text-gray-700">{r.cow?.name ?? '—'}</span>
                  <span className="text-xs text-gray-400 capitalize">{r.session}</span>
                </div>
                <span className="text-sm font-semibold text-blue-700">{r.litres} L</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export function MilkEntryPage() {
  const { t } = useLang()
  const [cows,       setCows]       = useState<Cow[]>([])
  const [cowsLoading,setCowsLoading]= useState(true)
  const [tab,        setTab]        = useState<PageTab>('milk')
  const [scanMode,   setScanMode]   = useState(false)

  useEffect(() => {
    fetch(`${API}/api/dairy/cows`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then((data: (Cow & { status?: string })[]) => {
        if (Array.isArray(data)) setCows(data.filter(c => c.status === 'milking').map(c => ({ id: c.id, name: c.name })))
      })
      .catch(() => setCows([{ id: 'cow-ndama-1', name: 'Ndama I' }, { id: 'cow-ndama-2', name: 'Ndama II' }]))
      .finally(() => setCowsLoading(false))
  }, [])

  if (scanMode) return (
    <div className="p-4"><ScanReceiptPane t={t} onDone={() => setScanMode(false)} /></div>
  )

  const TABS: { key: PageTab; icon: string; en: string; sw: string }[] = [
    { key: 'milk',    icon: '🥛', en: 'Milk',    sw: 'Maziwa'  },
    { key: 'sales',   icon: '💵', en: 'Sales',   sw: 'Uuzaji'  },
    { key: 'feed',    icon: '🌿', en: 'Feed',    sw: 'Chakula' },
    { key: 'history', icon: '📖', en: 'History', sw: 'Historia' },
  ]

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-green-800">{t('Dairy','Maziwa')}</h1>
          <p className="text-xs text-gray-400">
            {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button onClick={() => setScanMode(true)}
          className="text-xs bg-gray-100 text-gray-600 px-3 py-2 rounded-xl font-semibold border border-gray-200">
          📷 {t('Receipt','Risiti')}
        </button>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 mb-4">
        {TABS.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`flex-1 py-3 rounded-2xl text-sm font-bold transition-all ${
              tab === tb.key ? 'bg-green-700 text-white shadow' : 'bg-gray-100 text-gray-600'
            }`}>
            {tb.icon} {t(tb.en, tb.sw)}
          </button>
        ))}
      </div>

      {tab === 'milk'    && <MilkTab        t={t} cows={cows} cowsLoading={cowsLoading} />}
      {tab === 'sales'   && <SalesTab       t={t} />}
      {tab === 'feed'    && <FeedTab        t={t} cows={cows} />}
      {tab === 'history' && <MilkHistoryTab t={t} />}
    </div>
  )
}
