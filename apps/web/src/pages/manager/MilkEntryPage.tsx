import { useState, useEffect, useRef } from 'react'
import { db, queueSync } from '../../db/localDb'
import { useLang } from '../../store/langStore'
import type { MilkProductionRecord } from '@kathuniri/shared'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

type Session = 'AM' | 'PM'

interface Cow { id: string; name: string }

// ─── Scan Receipt ─────────────────────────────────────────────────────────

function ScanReceiptPane({ t, onDone }: { t: (en: string, sw: string) => string; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle')
  const [parsed, setParsed] = useState<Record<string, unknown> | null>(null)

  async function handleFile(file: File) {
    setStatus('scanning')
    const reader = new FileReader()
    reader.onload = async () => {
      const imageData = reader.result as string
      try {
        const r = await fetch(`${API}/api/dairy/receipts/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ imageData }),
        })
        if (!r.ok) throw new Error('Failed')
        const data = await r.json()
        setParsed(data)
        setStatus('done')
      } catch {
        setStatus('error')
      }
    }
    reader.readAsDataURL(file)
  }

  if (status === 'done' && parsed) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 space-y-3">
        <div className="text-center">
          <p className="text-3xl">✅</p>
          <p className="font-bold text-green-800 mt-1">{t('Receipt saved!', 'Risiti imehifadhiwa!')}</p>
          <p className="text-xs text-green-700 mt-1">{t('Owner will review and confirm.', 'Mwenye shamba ataangalia na kuthibitisha.')}</p>
        </div>
        <div className="bg-white rounded-xl p-3 text-sm space-y-1">
          {parsed.receiptDate != null && <p className="text-gray-600">{t('Date', 'Tarehe')}: <span className="font-medium">{String(parsed.receiptDate).split('T')[0]}</span></p>}
          {parsed.shift       != null && <p className="text-gray-600">{t('Shift', 'Zamu')}: <span className="font-medium">{String(parsed.shift)}</span></p>}
          {typeof parsed.quantityKg === 'number' && <p className="text-gray-600">{t('Quantity', 'Kiwango')}: <span className="font-bold text-green-700">{parsed.quantityKg.toFixed(1)} kg</span></p>}
          {typeof parsed.cumulativeKg === 'number' && <p className="text-gray-600">{t('Cumulative', 'Jumla')}: <span className="font-medium">{parsed.cumulativeKg.toFixed(1)} kg</span></p>}
          {parsed.station     != null && <p className="text-gray-600">{t('Station', 'Kituo')}: <span className="font-medium">{String(parsed.station)}</span></p>}
        </div>
        <button onClick={onDone} className="w-full bg-green-700 text-white font-bold py-3 rounded-2xl">
          {t('Done', 'Maliza')}
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-center space-y-3">
        <p className="text-3xl">❌</p>
        <p className="text-red-700 font-semibold">{t('Failed to scan. Try again.', 'Imeshindwa. Jaribu tena.')}</p>
        <button onClick={() => setStatus('idle')} className="w-full border border-gray-300 text-gray-600 font-semibold py-3 rounded-2xl">
          {t('Retry', 'Jaribu Tena')}
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-4">
      <p className="font-bold text-gray-800">{t('Scan Mborugu Receipt', 'Scan Risiti ya Mborugu')}</p>
      <p className="text-sm text-gray-500">{t('Take a photo of the Mborugu Dairy FCS receipt.', 'Piga picha ya risiti ya Mborugu Dairy FCS.')}</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
      />

      {status === 'scanning' ? (
        <div className="text-center py-6">
          <p className="text-4xl animate-pulse">📷</p>
          <p className="text-sm text-gray-500 mt-2">{t('Reading receipt…', 'Inasoma risiti…')}</p>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full bg-green-700 text-white font-bold py-4 rounded-2xl text-lg"
        >
          📷 {t('Take Photo', 'Piga Picha')}
        </button>
      )}

      <button onClick={onDone} className="w-full text-gray-500 text-sm py-2">
        {t('Cancel', 'Ghairi')}
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export function MilkEntryPage() {
  const { t } = useLang()
  const [session, setSession] = useState<Session>('AM')
  const [litres, setLitres]   = useState<Record<string, string>>({})
  const [saved, setSaved]     = useState(false)
  const [saving, setSaving]   = useState(false)
  const [cows, setCows]       = useState<Cow[]>([
    { id: 'cow-ndama-1', name: 'Ndama I' },
    { id: 'cow-ndama-2', name: 'Ndama II' },
  ])
  const [scanMode, setScanMode] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  // Fetch cows from API (falls back to hardcoded if offline)
  useEffect(() => {
    fetch(`${API}/api/dairy/cows`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then((data: Cow[]) => {
        if (Array.isArray(data) && data.length > 0) {
          setCows(data.filter((c: Cow & { status?: string }) => c.status === 'milking' || c.status === undefined).map(c => ({ id: c.id, name: c.name })))
        }
      })
      .catch(() => {}) // stay with defaults if offline
  }, [])

  function handleLitres(cowId: string, val: string) {
    if (/^\d*\.?\d*$/.test(val)) {
      setLitres(prev => ({ ...prev, [cowId]: val }))
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      for (const cow of cows) {
        const raw = litres[cow.id]
        if (!raw || raw === '') continue
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
          tableName: 'milk_production',
          recordId: record.id,
          operation: 'INSERT',
          payload: record as unknown as Record<string, unknown>,
          createdAt: new Date().toISOString(),
          attemptCount: 0,
        })
        // Also post directly to API if online
        fetch(`${API}/api/dairy/milk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ ...record, session: session === 'AM' ? 'morning' : 'evening' }),
        }).catch(() => {}) // silent fail — sync queue will retry
      }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (scanMode) {
    return (
      <div className="p-4">
        <ScanReceiptPane t={t} onDone={() => setScanMode(false)} />
      </div>
    )
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-700 mb-2">{t('Saved!', 'Imehifadhiwa!')}</h2>
        <p className="text-gray-500 text-center mb-8">
          {t('Milk records saved.', 'Rekodi za maziwa zimehifadhiwa.')}
        </p>
        <button
          className="manager-btn bg-green-700 text-white max-w-xs mb-3"
          onClick={() => { setSaved(false); setLitres({}) }}
        >
          {t('Enter Another', 'Rekodi Nyingine')}
        </button>
        <button
          className="manager-btn bg-white border border-gray-300 text-gray-700 max-w-xs"
          onClick={() => setScanMode(true)}
        >
          📷 {t('Scan Mborugu Receipt', 'Scan Risiti ya Mborugu')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-xl font-bold text-green-800">{t("Today's Milk", 'Maziwa Leo')}</h1>
        <button onClick={() => setScanMode(true)}
          className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl font-semibold border border-gray-200">
          📷 {t('Receipt', 'Risiti')}
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* Session toggle */}
      <div className="flex gap-3 mb-6">
        {(['AM', 'PM'] as Session[]).map(s => (
          <button
            key={s}
            onClick={() => setSession(s)}
            className={`flex-1 py-4 rounded-2xl text-lg font-bold transition-all ${
              session === s
                ? 'bg-green-700 text-white shadow-md'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s === 'AM' ? `🌅 ${t('Morning', 'Asubuhi')}` : `🌇 ${t('Evening', 'Jioni')}`}
          </button>
        ))}
      </div>

      {/* Cow entries */}
      <div className="space-y-4 mb-8">
        {cows.map(cow => (
          <div key={cow.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            <label className="block text-base font-semibold text-gray-700 mb-2">
              🐄 {cow.name}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.0"
                value={litres[cow.id] ?? ''}
                onChange={e => handleLitres(cow.id, e.target.value)}
                className="flex-1 text-3xl font-bold text-center border-b-2 border-green-500 focus:outline-none py-2 bg-transparent"
              />
              <span className="text-gray-500 text-lg font-medium">L</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || Object.values(litres).every(v => !v)}
        className="manager-btn bg-green-700 text-white disabled:opacity-40"
      >
        {saving ? t('Saving...', 'Inahifadhi...') : `✓ ${t('Confirm', 'Thibitisha')}`}
      </button>
    </div>
  )
}
