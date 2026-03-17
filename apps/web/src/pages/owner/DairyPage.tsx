import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const MONTHS_EN = ['','January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SW = ['','Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']

interface Receipt {
  id: string
  receiptNo: string | null
  supplierNo: string | null
  supplierName: string | null
  shift: string | null
  quantityKg: number | null
  cumulativeKg: number | null
  station: string | null
  receiptDate: string | null
  status: string
  notes: string | null
  createdAt: string
}

interface Cow {
  id: string
  name: string
  tagNumber: string | null
  breed: string | null
  status: string
  dateLastCalved: string | null
  expectedCalvingDate: string | null
  last7DaysLitres: number
  withdrawalActive: boolean
  withdrawalEndsDate: string | null
  latestHealthEvent: { eventType: string; conditionName: string | null; eventDate: string } | null
}

interface MilkSummary {
  year: number
  month: number
  totalLitres: number
  saleableLitres: number
  withdrawalLitres: number
  perCow: { cowId: string; cowName: string; totalLitres: number; morningLitres: number; eveningLitres: number }[]
  perBuyer: { buyerId: string; buyerName: string; litresDelivered: number; totalValueKes: number; unpaidLitres: number; unpaidValueKes: number }[]
}

function StatusPill({ status, withdrawalActive, withdrawalEndsDate, t }: {
  status: string
  withdrawalActive: boolean
  withdrawalEndsDate: string | null
  t: (en: string, sw: string) => string
}) {
  if (withdrawalActive && withdrawalEndsDate) {
    const ends = new Date(withdrawalEndsDate)
    const today = new Date(); today.setHours(0,0,0,0)
    const daysLeft = Math.ceil((ends.getTime() - today.getTime()) / 86400000)
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
        ⚠️ {t('Withdrawal', 'Karantini')} {daysLeft}d
      </span>
    )
  }
  if (status === 'milking')
    return <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">{t('Milking', 'Inakamuliwa')}</span>
  if (status === 'dry')
    return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">{t('Dry', 'Kavu')}</span>
  return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-semibold">{status}</span>
}

function CowCard({ cow, t, onClick }: { cow: Cow; t: (en: string, sw: string) => string; onClick: () => void }) {
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl border cursor-pointer active:scale-95 transition-transform ${cow.withdrawalActive ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-gray-800">{cow.name}</p>
            {cow.breed && <span className="text-xs text-gray-400">{cow.breed}</span>}
          </div>
          {cow.dateLastCalved && (
            <p className="text-xs text-gray-400">{t('Calved', 'Alizaa')}: {new Date(cow.dateLastCalved).toLocaleDateString(undefined, { day:'numeric', month:'short' })}</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold text-green-700">{cow.last7DaysLitres}<span className="text-xs font-normal text-gray-500 ml-0.5">L/7d</span></p>
          <StatusPill status={cow.status} withdrawalActive={cow.withdrawalActive} withdrawalEndsDate={cow.withdrawalEndsDate} t={t} />
        </div>
      </div>
      {cow.withdrawalActive && cow.withdrawalEndsDate && (
        <div className="border-t border-red-100 px-3 py-1.5 bg-red-50 text-xs text-red-700 rounded-b-2xl">
          ⚠️ {t('Withdrawal until', 'Karantini hadi')} {new Date(cow.withdrawalEndsDate).toLocaleDateString(undefined, { day:'numeric', month:'short' })}
        </div>
      )}
    </div>
  )
}

function SummaryTab({ year, month, t, lang }: { year: number; month: number; t: (en: string, sw: string) => string; lang: string }) {
  const [data, setData] = useState<MilkSummary | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/dairy/milk/summary?year=${year}&month=${month}`)
      .then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [year, month])

  const monthName = (lang === 'en' ? MONTHS_EN : MONTHS_SW)[month]

  if (loading) return <div className="text-center py-8 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
  if (!data) return null

  return (
    <div className="space-y-4">
      {/* Grand total */}
      <div className="bg-green-700 text-white rounded-2xl p-4 text-center">
        <p className="text-sm opacity-80">{monthName} {year}</p>
        <p className="text-4xl font-bold">{data.totalLitres.toFixed(1)} L</p>
        {data.withdrawalLitres > 0 && (
          <p className="text-xs opacity-70 mt-1">
            {t('Saleable', 'Inayouzwa')}: {data.saleableLitres.toFixed(1)} L · {t('Withdrawal', 'Karantini')}: {data.withdrawalLitres.toFixed(1)} L
          </p>
        )}
      </div>

      {/* Per-cow */}
      {data.perCow.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{t('By Cow', 'Kwa Ng\'ombe')}</h3>
          {data.perCow.map(c => (
            <div key={c.cowId} className="bg-white rounded-2xl border border-gray-200 px-3 py-2.5">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-gray-800">{c.cowName}</p>
                <p className="text-xl font-bold text-green-700">{c.totalLitres.toFixed(1)} L</p>
              </div>
              <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                <span>🌅 {c.morningLitres.toFixed(1)} L</span>
                <span>🌆 {c.eveningLitres.toFixed(1)} L</span>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Per-buyer */}
      {data.perBuyer.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mt-2">{t('By Buyer', 'Kwa Mnunuzi')}</h3>
          {data.perBuyer.map(b => (
            <div key={b.buyerId} className="bg-white rounded-2xl border border-gray-200 px-3 py-2.5">
              <div className="flex justify-between items-center">
                <p className="font-semibold text-gray-800">{b.buyerName}</p>
                <p className="font-bold text-gray-800">{b.litresDelivered.toFixed(1)} L</p>
              </div>
              <div className="flex justify-between text-xs mt-0.5">
                <span className="text-gray-500">KES {b.totalValueKes.toLocaleString()}</span>
                {b.unpaidValueKes > 0 && (
                  <span className="text-red-600 font-medium">{t('Owed', 'Deni')}: KES {b.unpaidValueKes.toLocaleString()}</span>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {data.totalLitres === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-3xl mb-2">🥛</p>
          <p>{t('No milk records for this month.', 'Hakuna rekodi ya maziwa kwa mwezi huu.')}</p>
        </div>
      )}
    </div>
  )
}

function token() { return localStorage.getItem('kf_token') ?? '' }

// ─── Receipts tab ─────────────────────────────────────────────────────────

function ReceiptsTab({ t }: { t: (en: string, sw: string) => string }) {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<'pending' | 'confirmed'>('pending')

  function load(status: 'pending' | 'confirmed') {
    setLoading(true)
    fetch(`${API}/api/dairy/receipts?status=${status}`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.json()).then(setReceipts).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => { load(tab) }, [tab])

  async function confirm(r: Receipt, edits: Partial<Receipt>) {
    const res = await fetch(`${API}/api/dairy/receipts/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ ...edits, status: 'confirmed' }),
    })
    if (res.ok) load('pending')
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {(['pending', 'confirmed'] as const).map(s => (
          <button key={s} onClick={() => setTab(s)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${tab === s ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-200'}`}>
            {s === 'pending' ? t('Pending', 'Zinasubiri') : t('Confirmed', 'Zilizothibitishwa')}
          </button>
        ))}
      </div>

      {loading && <p className="text-center text-gray-400 py-8">{t('Loading…', 'Inapakia…')}</p>}

      {!loading && receipts.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-3xl mb-2">🧾</p>
          <p className="text-sm">{t('No receipts.', 'Hakuna risiti.')}</p>
        </div>
      )}

      {!loading && receipts.map(r => (
        <ReceiptCard key={r.id} receipt={r} t={t} onConfirm={edits => confirm(r, edits)} showConfirm={tab === 'pending'} />
      ))}
    </div>
  )
}

function ReceiptCard({ receipt: r, t, onConfirm, showConfirm }: {
  receipt: Receipt
  t: (en: string, sw: string) => string
  onConfirm: (edits: Partial<Receipt>) => void
  showConfirm: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [quantityKg,   setQty]     = useState(r.quantityKg?.toString()   ?? '')
  const [cumulativeKg, setCum]     = useState(r.cumulativeKg?.toString() ?? '')
  const [receiptDate,  setDate]    = useState(r.receiptDate ? r.receiptDate.split('T')[0] : '')
  const [shift,        setShift]   = useState(r.shift ?? '')
  const [supplierNo,   setSupNo]   = useState(r.supplierNo ?? '')
  const [station,      setStation] = useState(r.station ?? '')
  const [notes,        setNotes]   = useState(r.notes ?? '')

  const parsedDate = r.receiptDate ? new Date(r.receiptDate).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

  return (
    <div className={`bg-white rounded-2xl border p-4 ${r.status === 'pending' ? 'border-amber-200' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-bold text-gray-800">
            {r.receiptNo ? `#${r.receiptNo}` : t('Receipt', 'Risiti')}
            {r.shift ? ` · ${r.shift}` : ''}
          </p>
          <p className="text-xs text-gray-400">{parsedDate} · {r.station ?? '—'}</p>
        </div>
        <div className="text-right">
          {r.quantityKg != null && (
            <p className="text-2xl font-bold text-green-700">{Number(r.quantityKg).toFixed(1)} <span className="text-sm font-normal text-gray-500">kg</span></p>
          )}
          {r.cumulativeKg != null && (
            <p className="text-xs text-gray-400">{t('MTD', 'Jumla')}: {Number(r.cumulativeKg).toFixed(1)} kg</p>
          )}
        </div>
      </div>

      {r.supplierName && <p className="text-xs text-gray-500 mb-2">{r.supplierName}{r.supplierNo ? ` · #${r.supplierNo}` : ''}</p>}

      {showConfirm && !editing && (
        <div className="flex gap-2 mt-2">
          <button onClick={() => setEditing(true)}
            className="flex-1 border border-gray-300 text-gray-600 text-sm font-semibold py-2 rounded-xl">
            {t('Edit & Confirm', 'Hariri & Thibitisha')}
          </button>
          <button onClick={() => onConfirm({})}
            className="flex-1 bg-green-700 text-white text-sm font-bold py-2 rounded-xl">
            ✓ {t('Confirm', 'Thibitisha')}
          </button>
        </div>
      )}

      {editing && (
        <div className="border-t border-gray-100 pt-3 mt-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500">{t('Date', 'Tarehe')}</label>
              <input type="date" value={receiptDate} onChange={e => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('Shift', 'Zamu')}</label>
              <select value={shift} onChange={e => setShift(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('Qty (kg)', 'Kiwango (kg)')}</label>
              <input type="number" step="0.1" value={quantityKg} onChange={e => setQty(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('Cumulative (kg)', 'Jumla (kg)')}</label>
              <input type="number" step="0.1" value={cumulativeKg} onChange={e => setCum(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('Supplier #', 'Nambari ya Muuzaji')}</label>
              <input type="text" value={supplierNo} onChange={e => setSupNo(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('Station', 'Kituo')}</label>
              <input type="text" value={station} onChange={e => setStation(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            </div>
          </div>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            placeholder={t('Notes…', 'Maelezo…')}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />
          <div className="flex gap-2">
            <button onClick={() => onConfirm({ quantityKg: quantityKg ? Number(quantityKg) : null, cumulativeKg: cumulativeKg ? Number(cumulativeKg) : null, receiptDate: receiptDate || null, shift: shift || null, supplierNo: supplierNo || null, station: station || null, notes: notes || null })}
              className="flex-1 bg-green-700 text-white font-bold py-2 rounded-xl text-sm">
              ✓ {t('Confirm', 'Thibitisha')}
            </button>
            <button onClick={() => setEditing(false)}
              className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-xl text-sm">
              {t('Cancel', 'Ghairi')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AddCowForm({ t, onSaved, onCancel }: {
  t: (en: string, sw: string) => string
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName]           = useState('')
  const [tagNumber, setTagNumber] = useState('')
  const [breed, setBreed]         = useState('')
  const [status, setStatus]       = useState('milking')
  const [dateLastCalved, setDateLastCalved] = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function save() {
    if (!name.trim()) { setError(t('Name is required', 'Jina linahitajika')); return }
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/dairy/cows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          name: name.trim(),
          tagNumber: tagNumber.trim() || undefined,
          breed: breed.trim() || undefined,
          status,
          dateLastCalved: dateLastCalved || undefined,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved()
    } catch {
      setError(t('Failed to save', 'Imeshindwa kuhifadhi'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <h2 className="font-bold text-gray-800">{t('Add Cow', 'Ongeza Ng\'ombe')}</h2>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">{t('Name *', 'Jina *')}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Tag #', 'Nambari')}</label>
          <input type="text" value={tagNumber} onChange={e => setTagNumber(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Breed', 'Aina')}</label>
          <input type="text" placeholder="Friesian…" value={breed} onChange={e => setBreed(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Status', 'Hali')}</label>
          <select value={status} onChange={e => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
            <option value="milking">{t('Milking', 'Inakamuliwa')}</option>
            <option value="dry">{t('Dry', 'Kavu')}</option>
            <option value="heifer">{t('Heifer', 'Ndama wa kike')}</option>
            <option value="calf">{t('Calf', 'Ndama')}</option>
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">{t('Last calved', 'Alizaa mwisho')}</label>
        <input type="date" value={dateLastCalved} onChange={e => setDateLastCalved(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-green-700 text-white font-bold py-2 rounded-xl disabled:opacity-40">
          {saving ? '…' : t('Save', 'Hifadhi')}
        </button>
        <button onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2 rounded-xl">
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </div>
  )
}

export function DairyPage() {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tab, setTab]     = useState<'cows' | 'summary' | 'receipts'>('cows')
  const [cows, setCows]   = useState<Cow[]>([])
  const [cowsLoading, setCowsLoading] = useState(false)
  const [showAddCow, setShowAddCow]   = useState(false)

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  useEffect(() => {
    setCowsLoading(true)
    fetch(`${API}/api/dairy/cows`)
      .then(r => r.json()).then(setCows).finally(() => setCowsLoading(false))
  }, [])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (isCurrentMonth) return
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const monthName = (lang === 'en' ? MONTHS_EN : MONTHS_SW)[month]

  return (
    <div>
      {/* Tabs */}
      <div className="flex bg-white border-b border-gray-200">
        {([
          { key: 'cows',     label: t('Cows', 'Ng\'ombe') },
          { key: 'summary',  label: t('Milk', 'Maziwa') },
          { key: 'receipts', label: t('Receipts', 'Risiti') },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === key ? 'border-green-700 text-green-700' : 'border-transparent text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {tab === 'cows' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold text-green-800">{t('Dairy Cows', 'Ng\'ombe wa Maziwa')}</h1>
              <button onClick={() => setShowAddCow(s => !s)}
                className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-xl font-semibold">
                {showAddCow ? t('Cancel', 'Ghairi') : `+ ${t('Add', 'Ongeza')}`}
              </button>
            </div>
            {showAddCow && (
              <AddCowForm t={t}
                onSaved={() => { setShowAddCow(false); fetch(`${API}/api/dairy/cows`).then(r => r.json()).then(setCows) }}
                onCancel={() => setShowAddCow(false)}
              />
            )}
            {cowsLoading
              ? <div className="text-center py-8 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
              : <div className="space-y-3">{cows.map(c => (
                  <CowCard key={c.id} cow={c} t={t} onClick={() => navigate(`/owner/maziwa/${c.id}`)} />
                ))}</div>
            }
          </>
        )}

        {tab === 'summary' && (
          <>
            <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-3 mb-5">
              <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center text-xl text-green-700">‹</button>
              <span className="font-semibold text-gray-800">{monthName} {year}</span>
              <button onClick={nextMonth} disabled={isCurrentMonth} className="w-10 h-10 flex items-center justify-center text-xl text-green-700 disabled:opacity-30">›</button>
            </div>
            <SummaryTab year={year} month={month} t={t} lang={lang} />
          </>
        )}

        {tab === 'receipts' && (
          <>
            <h1 className="text-xl font-bold text-green-800 mb-4">{t('Mborugu Dairy FCS Receipts', 'Risiti za Mborugu Dairy FCS')}</h1>
            <ReceiptsTab t={t} />
          </>
        )}
      </div>
    </div>
  )
}
