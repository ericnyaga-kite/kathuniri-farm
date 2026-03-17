import { useState, useRef, useEffect } from 'react'
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

// ─── Picking History ─────────────────────────────────────────────────────

interface SessionSummary {
  id: string; sessionDate: string; centreId: string
  pickerTotalKg: number | null; reconciliationStatus: string
  pickerRecords: { staffId: string; kgPicked: number; ratePerKg: number; grossPay: number }[]
}

function PickingHistoryTab({ t }: { t: (en: string, sw: string) => string }) {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const to   = new Date().toISOString().split('T')[0]
    const from = new Date(Date.now() - 13 * 86400000).toISOString().split('T')[0]
    fetch(`${API}/api/tea/sessions?from=${from}&to=${to}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then((data: SessionSummary[]) => setSessions(Array.isArray(data) ? data : []))
      .catch(() => setSessions([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-sm text-gray-400 text-center py-8">{t('Loading…','Inapakia…')}</p>
  if (sessions.length === 0) return (
    <div className="text-center py-12">
      <p className="text-4xl mb-2">🍃</p>
      <p className="text-gray-400 text-sm">{t('No picking sessions in the last 14 days','Hakuna rekodi siku 14 zilizopita')}</p>
    </div>
  )

  return (
    <div className="space-y-3">
      {sessions.map(s => {
        const totalKg  = s.pickerTotalKg ?? s.pickerRecords.reduce((sum, p) => sum + p.kgPicked, 0)
        const casualPay = s.pickerRecords.filter(p => p.ratePerKg > 0).reduce((sum, p) => sum + p.grossPay, 0)
        return (
          <div key={s.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-800">{s.centreId}</p>
                <p className="text-xs text-gray-400">
                  {new Date(s.sessionDate).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-bold text-green-700">{Number(totalKg).toFixed(1)} kg</p>
                {casualPay > 0 && <p className="text-xs text-gray-500">KES {Math.round(casualPay).toLocaleString()}</p>}
              </div>
            </div>
            {s.pickerRecords.length > 0 && (
              <div className="px-4 py-2 space-y-1">
                {s.pickerRecords.map((p, i) => (
                  <div key={i} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      {p.ratePerKg === 0 && <span className="w-2 h-2 rounded-full bg-orange-300 inline-block" />}
                      <span className="text-gray-700">{p.staffId}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500">{p.kgPicked} kg</span>
                      {p.ratePerKg > 0
                        ? <span className="text-green-700 font-semibold w-16 text-right">KES {p.grossPay.toLocaleString()}</span>
                        : <span className="text-orange-400 text-xs w-16 text-right">{t('salary','mshahara')}</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export function PickingEntryPage() {
  const { t } = useLang()
  const today = new Date().toISOString().split('T')[0]

  const [tab,      setTab]     = useState<'entry' | 'history'>('entry')
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

  if (tab === 'history') return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setTab('entry')} className="text-green-700 text-2xl">←</button>
        <h1 className="text-xl font-bold text-green-800">{t('Picking History','Historia ya Kuokota')}</h1>
      </div>
      <PickingHistoryTab t={t} />
    </div>
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
    <div className="p-3">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-bold text-green-800">{t('Tea — Picking', 'Chai — Kuokota')}</h1>
          {scanned && <p className="text-xs text-green-600 font-medium">✓ {t('Scanned from photo','Imesomwa kutoka picha')}</p>}
        </div>
        <div className="flex gap-2">
          <button onClick={() => setScanMode(true)}
            className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl font-semibold border border-gray-200">
            📷 {t('Scan', 'Scan')}
          </button>
          <button onClick={() => setTab('history')}
            className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-xl font-semibold border border-gray-200">
            📖 {t('History', 'Historia')}
          </button>
        </div>
      </div>

      {/* Date + Sector — compact 2-col */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1 block">{t('Date', 'Tarehe')}</label>
          <input type="date" value={date} max={today} onChange={e => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1 block">{t('Sector', 'Sekta')}</label>
          <select value={sector} onChange={e => setSector(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm bg-white">
            <option value="">{t('— Select —', '— Chagua —')}</option>
            {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      {/* Pickers */}
      <div className="mb-2">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold">{t('Pickers', 'Wavunaji')}</label>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-300 inline-block" /> {t('Staff', 'Mfanyakazi')}
          </div>
        </div>

        <div className="space-y-1.5">
          {pickers.map((row, i) => (
            <div key={i} className={`flex items-center gap-1.5 rounded-xl border px-2 ${row.isStaff ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200'}`} style={{height:'40px'}}>
              <button onClick={() => updateRow(i, 'isStaff', !row.isStaff)}
                title={t('Toggle staff/casual', 'Badilisha aina')}
                className={`w-5 h-5 rounded-full border-2 flex-shrink-0 ${row.isStaff ? 'bg-orange-300 border-orange-400' : 'border-gray-300'}`} />
              <input type="text" placeholder={t('Name', 'Jina')} value={row.name}
                onChange={e => updateRow(i, 'name', e.target.value)}
                className="flex-1 text-sm focus:outline-none bg-transparent min-w-0" />
              <input type="number" inputMode="decimal" placeholder="kg" value={row.kg}
                onChange={e => updateRow(i, 'kg', e.target.value)}
                className="w-14 text-sm text-right focus:outline-none bg-transparent" />
              <span className="text-gray-400 text-xs w-4">kg</span>
              {!row.isStaff && row.kg && parseFloat(row.kg) > 0 && (
                <span className="text-xs text-green-700 font-semibold w-12 text-right flex-shrink-0">
                  {(parseFloat(row.kg) * CASUAL_RATE).toLocaleString()}
                </span>
              )}
              {row.isStaff && (
                <span className="text-xs text-orange-400 w-12 text-right flex-shrink-0">{t('salary', 'mshahara')}</span>
              )}
              {pickers.length > 1 && (
                <button onClick={() => removeRow(i)} className="text-red-400 text-lg w-6 flex-shrink-0 leading-none">×</button>
              )}
            </div>
          ))}
        </div>

        <button onClick={addRow}
          className="mt-2 w-full py-2 border-2 border-dashed border-green-400 rounded-xl text-green-700 font-semibold text-sm">
          + {t('Add Picker', 'Ongeza Mvunaji')}
        </button>
      </div>

      {/* Totals */}
      {totalKg > 0 && (
        <div className="my-2 bg-green-50 rounded-2xl px-3 py-2 space-y-1">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-600">{t('Total kg', 'Jumla kg')}</span>
            <span className="text-xl font-bold text-green-800">{totalKg.toFixed(1)} kg</span>
          </div>
          {casualRows.length > 0 && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">{casualRows.length} {t('casual','vibarua')} × KES {CASUAL_RATE}/kg</span>
              <span className="text-base font-bold text-green-700">KES {casualPay.toLocaleString()}</span>
            </div>
          )}
          {staffRows.length > 0 && (
            <div className="flex justify-between items-center text-gray-400 text-xs">
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
