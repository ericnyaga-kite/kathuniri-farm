import { useState, useRef } from 'react'
import { db, queueSync } from '../../db/localDb'
import { useLang } from '../../store/langStore'
import type { PickingSession, PickerRecord } from '@kathuniri/shared'

const API          = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const CASUAL_RATE  = 14   // KES per kg for casual pickers
function token()   { return localStorage.getItem('kf_token') ?? '' }

const SECTORS = [
  'Mucucari A', 'Mucucari B',
  'Kathuniri A', 'Kathuniri B', 'Kathuniri C',
  'Shule', 'New Tea',
  'Mukinduriri A', 'Mukinduriri B',
  'Mutarakwe A', 'Mutarakwe B',
  'Kamwangi A', 'Kamwangi B',
]

interface PickerRow { name: string; kg: string; isStaff: boolean }
function emptyRow(): PickerRow { return { name: '', kg: '', isStaff: false } }

// ─── Scan pane ────────────────────────────────────────────────────────────

function ScanPane({
  t,
  onResult,
  onCancel,
}: {
  t: (en: string, sw: string) => string
  onResult: (pickers: { name: string; kg: number }[], date: string | null, sector: string | null) => void
  onCancel: () => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle')

  async function handleFile(file: File) {
    setStatus('scanning')
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const r = await fetch(`${API}/api/tea/picking/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
          body: JSON.stringify({ imageData: reader.result }),
        })
        if (!r.ok) throw new Error()
        const data = await r.json()
        onResult(data.pickers ?? [], data.date ?? null, data.sector ?? null)
      } catch { setStatus('error') }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-green-800 mb-1">{t('Scan Register', 'Scan Rejista')}</h1>
      <p className="text-sm text-gray-500 mb-6">{t('Take a photo of the handwritten picking register.', 'Piga picha ya rejista ya kuandika.')}</p>

      <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

      {status === 'scanning' ? (
        <div className="text-center py-16 space-y-3">
          <p className="text-5xl animate-pulse">📋</p>
          <p className="text-gray-500">{t('Reading register…', 'Inasoma rejista…')}</p>
        </div>
      ) : status === 'error' ? (
        <div className="text-center py-10 space-y-3">
          <p className="text-4xl">❌</p>
          <p className="text-red-600 font-semibold">{t('Could not read. Try again.', 'Imeshindwa. Jaribu tena.')}</p>
          <button onClick={() => setStatus('idle')} className="w-full bg-gray-100 text-gray-700 font-bold py-4 rounded-2xl">
            {t('Retry', 'Jaribu Tena')}
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()}
          className="w-full bg-green-700 text-white font-bold py-5 rounded-2xl text-xl">
          📷 {t('Take Photo', 'Piga Picha')}
        </button>
      )}

      <button onClick={onCancel} className="w-full text-gray-500 text-sm py-4 mt-2">
        {t('Cancel', 'Ghairi')}
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export function PickingEntryPage() {
  const { t } = useLang()
  const today = new Date().toISOString().split('T')[0]

  const [date,     setDate]    = useState(today)
  const [sector,   setSector]  = useState('')
  const [pickers,  setPickers] = useState<PickerRow[]>([emptyRow(), emptyRow()])
  const [saving,   setSaving]  = useState(false)
  const [saved,    setSaved]   = useState(false)
  const [scanMode, setScanMode]= useState(false)
  const [scanned,  setScanned] = useState(false)

  function updateRow(i: number, field: keyof PickerRow, val: string | boolean) {
    setPickers(rows => rows.map((r, idx) =>
      idx === i
        ? { ...r, [field]: field === 'kg' ? String(val).replace(/[^0-9.]/g, '') : val }
        : r
    ))
  }

  function addRow()        { setPickers(rows => [...rows, emptyRow()]) }
  function removeRow(i: number) { setPickers(rows => rows.filter((_, idx) => idx !== i)) }

  function handleScanResult(
    results: { name: string; kg: number }[],
    scannedDate: string | null,
    scannedSector: string | null,
  ) {
    const rows: PickerRow[] = results.map(r => ({
      name: r.name, kg: String(r.kg), isStaff: false,
    }))
    if (rows.length === 0) rows.push(emptyRow())
    setPickers(rows)
    if (scannedDate)   setDate(scannedDate)
    if (scannedSector) {
      const match = SECTORS.find(s => s.toLowerCase().includes(scannedSector.toLowerCase()))
      if (match) setSector(match)
    }
    setScanned(true)
    setScanMode(false)
  }

  const validRows   = pickers.filter(r => r.name.trim() && parseFloat(r.kg) > 0)
  const casualRows  = validRows.filter(r => !r.isStaff)
  const staffRows   = validRows.filter(r =>  r.isStaff)
  const totalKg     = validRows.reduce((s, r) => s + parseFloat(r.kg), 0)
  const casualPay   = casualRows.reduce((s, r) => s + parseFloat(r.kg) * CASUAL_RATE, 0)

  async function handleSave() {
    if (validRows.length === 0 || !sector) return
    setSaving(true)
    try {
      const sessionId = crypto.randomUUID()
      const session: PickingSession = {
        id: sessionId, sessionDate: date, centreId: sector,
        pickerTotalKg: totalKg, reconciliationStatus: 'pending',
      }
      await db.pickingSessions.put(session)
      await queueSync({
        tableName: 'picking_sessions', recordId: sessionId, operation: 'INSERT',
        payload: session as unknown as Record<string, unknown>,
        createdAt: new Date().toISOString(), attemptCount: 0,
      })

      for (const row of validRows) {
        const rate   = row.isStaff ? 0 : CASUAL_RATE
        const record: PickerRecord = {
          id: crypto.randomUUID(), sessionId,
          staffId:  row.name.trim(),
          kgPicked: parseFloat(row.kg),
          ratePerKg: rate,
          grossPay: parseFloat(row.kg) * rate,
        }
        await db.pickerRecords.put(record)
        await queueSync({
          tableName: 'picker_records', recordId: record.id, operation: 'INSERT',
          payload: { ...record, staffName: row.name.trim(), isStaff: row.isStaff } as unknown as Record<string, unknown>,
          createdAt: new Date().toISOString(), attemptCount: 0,
        })
      }
      setSaved(true)
    } finally { setSaving(false) }
  }

  if (scanMode) return (
    <ScanPane t={t} onResult={handleScanResult} onCancel={() => setScanMode(false)} />
  )

  if (saved) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
      <div className="text-6xl mb-4">✅</div>
      <h2 className="text-2xl font-bold text-green-700 mb-2">{t('Saved!', 'Imehifadhiwa!')}</h2>
      <div className="bg-green-50 rounded-2xl p-4 mb-6 w-full max-w-xs text-center">
        <p className="text-gray-400 text-xs mb-2">{sector}</p>
        <p className="text-3xl font-bold text-green-800">{totalKg.toFixed(1)} kg</p>
        <div className="mt-3 text-sm space-y-1">
          {casualRows.length > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>{t('Casual pay','Malipo ya vibarua')}</span>
              <span className="font-bold text-green-700">KES {casualPay.toLocaleString()}</span>
            </div>
          )}
          {staffRows.length > 0 && (
            <div className="flex justify-between text-gray-400">
              <span>{t('Staff pickers','Wafanyakazi')} ({staffRows.length})</span>
              <span>{t('salary only','mshahara tu')}</span>
            </div>
          )}
        </div>
      </div>
      <button className="manager-btn bg-green-700 text-white max-w-xs"
        onClick={() => { setSaved(false); setSector(''); setPickers([emptyRow(), emptyRow()]); setScanned(false) }}>
        {t('Enter Another', 'Rekodi Nyingine')}
      </button>
    </div>
  )

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-green-800">{t('Tea — Picking', 'Chai — Kuokota')}</h1>
          {scanned && <p className="text-xs text-green-600 font-medium">✓ {t('Scanned from photo','Imesomwa kutoka picha')}</p>}
        </div>
        <button onClick={() => setScanMode(true)}
          className="text-xs bg-gray-100 text-gray-600 px-3 py-2 rounded-xl font-semibold border border-gray-200">
          📷 {t('Scan', 'Scan')}
        </button>
      </div>

      {/* Date */}
      <div className="mb-4">
        <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1 block">{t('Date', 'Tarehe')}</label>
        <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base" />
      </div>

      {/* Sector */}
      <div className="mb-5">
        <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1 block">{t('Sector', 'Sekta')}</label>
        <select value={sector} onChange={e => setSector(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base bg-white">
          <option value="">{t('— Select sector —', '— Chagua sekta —')}</option>
          {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Pickers */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{t('Pickers', 'Wavunaji')}</label>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="w-3 h-3 rounded-full bg-orange-300 inline-block" /> {t('Staff (no casual pay)', 'Mfanyakazi (mshahara)')}
          </div>
        </div>

        <div className="space-y-2">
          {pickers.map((row, i) => (
            <div key={i} className={`flex items-center gap-2 rounded-xl border px-2 py-2 ${row.isStaff ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`}>
              <button onClick={() => updateRow(i, 'isStaff', !row.isStaff)}
                title={t('Toggle staff/casual', 'Badilisha aina')}
                className={`w-6 h-6 rounded-full border-2 flex-shrink-0 ${row.isStaff ? 'bg-orange-300 border-orange-400' : 'border-gray-300'}`} />
              <input type="text" placeholder={t('Name', 'Jina')} value={row.name}
                onChange={e => updateRow(i, 'name', e.target.value)}
                className="flex-1 text-base focus:outline-none bg-transparent min-w-0" />
              <input type="number" inputMode="decimal" placeholder="kg" value={row.kg}
                onChange={e => updateRow(i, 'kg', e.target.value)}
                className="w-16 text-base text-right focus:outline-none bg-transparent" />
              <span className="text-gray-400 text-sm w-5">kg</span>
              {!row.isStaff && row.kg && parseFloat(row.kg) > 0 && (
                <span className="text-xs text-green-700 font-semibold w-14 text-right flex-shrink-0">
                  {(parseFloat(row.kg) * CASUAL_RATE).toLocaleString()}
                </span>
              )}
              {row.isStaff && (
                <span className="text-xs text-orange-400 w-14 text-right flex-shrink-0">{t('salary', 'mshahara')}</span>
              )}
              {pickers.length > 1 && (
                <button onClick={() => removeRow(i)} className="text-red-400 text-xl w-7 flex-shrink-0">×</button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addRow}
          className="mt-3 w-full py-3 border-2 border-dashed border-green-400 rounded-xl text-green-700 font-semibold text-base">
          + {t('Add Picker', 'Ongeza Mvunaji')}
        </button>
      </div>

      {/* Totals */}
      {totalKg > 0 && (
        <div className="my-4 bg-green-50 rounded-2xl p-4 space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t('Total kg', 'Jumla kg')}</span>
            <span className="text-2xl font-bold text-green-800">{totalKg.toFixed(1)} kg</span>
          </div>
          {casualRows.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">{casualRows.length} {t('casual pickers','vibarua')} × KES {CASUAL_RATE}/kg</span>
              <span className="text-xl font-bold text-green-700">KES {casualPay.toLocaleString()}</span>
            </div>
          )}
          {staffRows.length > 0 && (
            <div className="flex justify-between items-center text-gray-400 text-sm">
              <span>{staffRows.length} {t('staff (salary only)', 'wafanyakazi (mshahara tu)')}</span>
              <span>{staffRows.reduce((s,r) => s + parseFloat(r.kg), 0).toFixed(1)} kg</span>
            </div>
          )}
        </div>
      )}

      <button onClick={handleSave} disabled={saving || validRows.length === 0 || !sector}
        className="manager-btn bg-green-700 text-white disabled:opacity-40 mt-2">
        {saving ? t('Saving...', 'Inahifadhi...') : `✓ ${t('Confirm', 'Thibitisha')}`}
      </button>
    </div>
  )
}
