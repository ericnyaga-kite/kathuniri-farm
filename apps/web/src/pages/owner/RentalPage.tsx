import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const MONTHS_EN = ['','January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SW = ['','Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']
function token() { return localStorage.getItem('kf_token') ?? '' }

// ─── Interfaces (matching exact API response shapes) ──────────────────────

interface ElectricityReading {
  id: string
  readingDate: string
  meterReading: number
  previousReading: number | null
  unitsConsumed: number | null
  amountKes: number | null
  source: string
}

interface RentPayment {
  id: string
  paymentDate: string
  periodMonth: number
  periodYear: number
  rentAmountKes: number
  electricityAmountKes: number
  totalAmountKes: number
  paymentMethod: string
  mpesaRef: string | null
}

interface Room {
  id: string
  roomNumber: number
  tenantName: string | null
  tenantPhone: string | null
  monthlyRentKes: number | null
  electricityRatePerUnit: number
  occupancyStatus: string
  rentDueDay: number | null
  notes: string | null
  latestElectricityReading: ElectricityReading | null
  currentMonthPayments: RentPayment[]   // ALL payments for selected month (supports partial)
  currentMonthRentPaid: number          // sum of rent paid this month
  currentMonthElecPaid: number          // sum of electricity paid this month
  currentMonthTotalPaid: number         // total paid this month
  outstandingMonths: number
}

interface OutstandingRoom {
  id: string
  roomNumber: number
  tenantName: string | null
  monthlyRentKes: number | null
}

interface RoomSummaryItem {
  id: string                    // API returns "id" not "roomId"
  roomNumber: number
  tenantName: string | null
  occupancyStatus: string
  monthlyRentKes: number | null
  paid: boolean
  payments: {                   // API returns payments array, not totalPaidKes
    id: string
    paymentDate: string
    rentAmountKes: number
    electricityAmountKes: number
    totalAmountKes: number
    paymentMethod: string
    mpesaRef: string | null
  }[]
}

interface RentalSummary {
  totalRooms: number
  occupiedRooms: number
  expectedRentKes: number
  collectedRentKes: number
  collectedElectricityKes: number
  outstandingRooms: OutstandingRoom[]  // array of objects, not a number
  rooms: RoomSummaryItem[]
}

// ─── Payment form ─────────────────────────────────────────────────────────

function PaymentForm({ room, year, month, onSaved, onCancel, t }: {
  room: Room; year: number; month: number
  onSaved: () => void; onCancel: () => void
  t: (en: string, sw: string) => string
}) {
  const today = new Date().toISOString().split('T')[0]
  // Pre-fill remaining balance for top-ups, full rent for first payment
  const rentBalance = room.monthlyRentKes != null
    ? Math.max(0, room.monthlyRentKes - room.currentMonthRentPaid)
    : room.monthlyRentKes
  const [paymentDate,          setPaymentDate]   = useState(today)
  const [rentAmountKes,        setRentAmount]    = useState(String(rentBalance ?? ''))
  const [electricityAmountKes, setElecAmount]    = useState('0')
  const [paymentMethod,        setMethod]        = useState('mpesa')
  const [mpesaRef,             setMpesaRef]      = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const r = await fetch(`${API}/api/rental/rooms/${room.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          paymentDate, periodMonth: month, periodYear: year,
          rentAmountKes:        parseFloat(rentAmountKes)        || 0,
          electricityAmountKes: parseFloat(electricityAmountKes) || 0,
          paymentMethod, mpesaRef: mpesaRef || undefined,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved()
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="bg-green-50 rounded-2xl p-4 space-y-3 mt-3">
      <p className="font-semibold text-green-800 text-sm">
        {t('Record Payment', 'Rekodi Malipo')} — {MONTHS_EN[month]} {year}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Rent (KES)', 'Kodi (KES)')}</label>
          <input type="number" value={rentAmountKes} onChange={e => setRentAmount(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Electricity (KES)', 'Umeme (KES)')}</label>
          <input type="number" value={electricityAmountKes} onChange={e => setElecAmount(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">{t('Date', 'Tarehe')}</label>
        <input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Method', 'Njia')}</label>
          <select value={paymentMethod} onChange={e => setMethod(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
            <option value="mpesa">M-Pesa</option>
            <option value="cash">{t('Cash', 'Taslimu')}</option>
          </select>
        </div>
        {paymentMethod === 'mpesa' && (
          <div>
            <label className="text-xs text-gray-500">M-Pesa Ref</label>
            <input type="text" placeholder="QHG4..." value={mpesaRef} onChange={e => setMpesaRef(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          </div>
        )}
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex-1 bg-green-700 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? t('Saving...', 'Inahifadhi...') : t('Save', 'Hifadhi')}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 rounded-xl py-2 text-sm text-gray-600">
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </form>
  )
}

// ─── Electricity reading form ─────────────────────────────────────────────

function ElectricityForm({ room, onSaved, onCancel, t }: {
  room: Room; onSaved: () => void; onCancel: () => void
  t: (en: string, sw: string) => string
}) {
  const today = new Date().toISOString().split('T')[0]
  const prevReading = room.latestElectricityReading?.meterReading ?? null
  const rate = room.electricityRatePerUnit

  const [readingDate,  setReadingDate]  = useState(today)
  const [meterReading, setMeterReading] = useState('')
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  const units = meterReading && prevReading != null
    ? Math.max(0, parseFloat(meterReading) - prevReading)
    : null
  const amount = units != null ? units * rate : null

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!meterReading) return
    setSaving(true); setError(null)
    try {
      const r = await fetch(`${API}/api/rental/rooms/${room.id}/electricity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          readingDate,
          meterReading: parseFloat(meterReading),
          previousReading: prevReading ?? undefined,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved()
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="bg-amber-50 rounded-2xl p-4 space-y-3 mt-3">
      <p className="font-semibold text-amber-800 text-sm">
        ⚡ {t('Meter Reading', 'Usomaji wa Mita')}
      </p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Date', 'Tarehe')}</label>
          <input type="date" value={readingDate} onChange={e => setReadingDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Current reading', 'Usomaji wa sasa')}</label>
          <input type="number" step="0.1" placeholder={prevReading != null ? `prev: ${prevReading}` : '0'}
            value={meterReading} onChange={e => setMeterReading(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
      {units != null && (
        <div className="bg-white rounded-xl p-3 text-sm flex justify-between">
          <span className="text-gray-600">{units.toFixed(1)} {t('units', 'vitengo')} × KES {rate}/unit</span>
          <span className="font-bold text-amber-800">= KES {amount?.toLocaleString()}</span>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving || !meterReading}
          className="flex-1 bg-amber-600 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? t('Saving...', 'Inahifadhi...') : t('Save', 'Hifadhi')}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 rounded-xl py-2 text-sm text-gray-600">
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </form>
  )
}

// ─── Tenant edit form ─────────────────────────────────────────────────────

function TenantEditForm({ room, onSaved, onCancel, t }: {
  room: Room; onSaved: () => void; onCancel: () => void
  t: (en: string, sw: string) => string
}) {
  const [tenantName,     setName]    = useState(room.tenantName ?? '')
  const [tenantPhone,    setPhone]   = useState(room.tenantPhone ?? '')
  const [monthlyRentKes, setRent]    = useState(String(room.monthlyRentKes ?? ''))
  const [occupancyStatus, setStatus] = useState(room.occupancyStatus)
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const r = await fetch(`${API}/api/rental/rooms/${room.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          tenantName:     tenantName  || null,
          tenantPhone:    tenantPhone || null,
          monthlyRentKes: parseFloat(monthlyRentKes) || null,
          occupancyStatus,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved()
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <form onSubmit={submit} className="bg-blue-50 rounded-2xl p-4 space-y-3 mt-3">
      <p className="font-semibold text-blue-800 text-sm">{t('Edit Tenant', 'Hariri Mpangaji')}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <label className="text-xs text-gray-500">{t('Tenant Name', 'Jina la Mpangaji')}</label>
        <input type="text" value={tenantName} onChange={e => setName(e.target.value)}
          placeholder={t('e.g. John Kamau', 'mfano: John Kamau')}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Phone', 'Simu')}</label>
          <input type="tel" value={tenantPhone} onChange={e => setPhone(e.target.value)}
            placeholder="07xx..."
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Rent (KES/mo)', 'Kodi (KES/mwezi)')}</label>
          <input type="number" value={monthlyRentKes} onChange={e => setRent(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500">{t('Status', 'Hali')}</label>
        <select value={occupancyStatus} onChange={e => setStatus(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
          <option value="occupied">{t('Occupied', 'Imekaliwa')}</option>
          <option value="vacant">{t('Vacant', 'Wazi')}</option>
        </select>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving}
          className="flex-1 bg-blue-700 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50">
          {saving ? t('Saving...', 'Inahifadhi...') : t('Save', 'Hifadhi')}
        </button>
        <button type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 rounded-xl py-2 text-sm text-gray-600">
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </form>
  )
}

// ─── Room card ────────────────────────────────────────────────────────────

type ActiveForm = 'payment' | 'electricity' | 'edit' | null

function RoomCard({ room, year, month, onRefresh, t }: {
  room: Room; year: number; month: number
  onRefresh: () => void
  t: (en: string, sw: string) => string
}) {
  const [activeForm, setActiveForm] = useState<ActiveForm>(null)

  const elec         = room.latestElectricityReading
  const pmts         = room.currentMonthPayments      // all payments this month
  const anyPaid      = pmts.length > 0
  const totalPaid    = room.currentMonthTotalPaid
  const expected     = room.monthlyRentKes ?? 0
  const balance      = expected > 0 ? expected - room.currentMonthRentPaid : 0
  const isPartial    = anyPaid && balance > 0
  const isFullyPaid  = anyPaid && balance <= 0

  function open(form: ActiveForm) {
    setActiveForm(f => f === form ? null : form)
  }

  // Status badge
  let badge: React.ReactNode
  if (room.occupancyStatus !== 'occupied') {
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">{t('Vacant', 'Wazi')}</span>
  } else if (isFullyPaid) {
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">{t('Paid', 'Imelipwa')} ✓</span>
  } else if (isPartial) {
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold">{t('Partial', 'Sehemu')}</span>
  } else {
    badge = <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">{t('Unpaid', 'Halijalipiwa')}</span>
  }

  return (
    <div className={`bg-white rounded-2xl border p-4 ${isPartial ? 'border-amber-200' : room.outstandingMonths > 0 && room.occupancyStatus === 'occupied' && !isFullyPaid ? 'border-red-200' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-bold text-gray-800">
            {t('Room', 'Chumba')} {room.roomNumber}
            {room.tenantName && <span className="font-normal text-gray-500 text-sm ml-2">— {room.tenantName}</span>}
          </p>
          {room.monthlyRentKes != null && (
            <p className="text-xs text-gray-400">KES {Number(room.monthlyRentKes).toLocaleString()}/{t('mo', 'mwezi')}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => open('edit')} className="text-xs text-blue-600 font-medium">
            {t('Edit', 'Hariri')}
          </button>
          {badge}
        </div>
      </div>

      {/* Electricity reading */}
      {elec && (
        <div className="text-xs text-gray-500 mb-2">
          ⚡ {t('Meter', 'Mita')}: {Number(elec.meterReading).toLocaleString()}
          {elec.unitsConsumed != null && (
            <span> · {Number(elec.unitsConsumed).toFixed(1)} {t('units', 'vitengo')} · KES {Number(elec.amountKes).toLocaleString()}</span>
          )}
          <span className="text-gray-400 ml-1">
            ({new Date(elec.readingDate).toLocaleDateString(undefined, { day:'numeric', month:'short' })})
          </span>
        </div>
      )}

      {/* Outstanding months (only show if nothing paid at all this month) */}
      {room.outstandingMonths > 1 && room.occupancyStatus === 'occupied' && !anyPaid && (
        <p className="text-xs text-red-600 mb-2">
          {room.outstandingMonths} {t('months outstanding', 'miezi inadaiwa')}
        </p>
      )}

      {/* Payment summary */}
      {anyPaid && (
        <div className="mt-2 bg-gray-50 rounded-xl p-3 space-y-1">
          {pmts.map(p => (
            <div key={p.id} className="flex justify-between text-xs text-gray-600">
              <span>
                {new Date(p.paymentDate).toLocaleDateString(undefined, { day:'numeric', month:'short' })}
                {' · '}{p.paymentMethod}{p.mpesaRef ? ` · ${p.mpesaRef}` : ''}
              </span>
              <span className="font-medium">KES {Number(p.totalAmountKes).toLocaleString()}</span>
            </div>
          ))}
          {pmts.length > 1 && (
            <div className="flex justify-between text-xs font-semibold text-gray-800 border-t border-gray-200 pt-1 mt-1">
              <span>{t('Total paid', 'Jumla iliyolipwa')}</span>
              <span>KES {totalPaid.toLocaleString()}</span>
            </div>
          )}
          {isPartial && (
            <div className="flex justify-between text-xs font-semibold text-amber-700 pt-1">
              <span>{t('Balance due', 'Inayobaki')}</span>
              <span>KES {balance.toLocaleString()}</span>
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      {room.occupancyStatus === 'occupied' && (
        <div className="flex gap-2 mt-3">
          {/* Show "Record Payment" if unpaid, or "+ Top up" if partial */}
          {!isFullyPaid && (
            <button onClick={() => open('payment')}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold ${isPartial ? 'border border-amber-300 bg-amber-50 text-amber-700' : 'border-2 border-dashed border-green-300 text-green-700'}`}>
              {isPartial ? `+ ${t('Top-up', 'Ongeza Malipo')}` : `+ ${t('Record Payment', 'Rekodi Malipo')}`}
            </button>
          )}
          <button onClick={() => open('electricity')}
            className="flex-1 border border-amber-200 bg-amber-50 text-amber-700 rounded-xl py-2 text-xs font-semibold">
            ⚡ {t('Meter Reading', 'Usomaji Mita')}
          </button>
        </div>
      )}

      {/* Inline forms */}
      {activeForm === 'payment' && (
        <PaymentForm room={room} year={year} month={month}
          onSaved={() => { setActiveForm(null); onRefresh() }}
          onCancel={() => setActiveForm(null)} t={t} />
      )}
      {activeForm === 'electricity' && (
        <ElectricityForm room={room}
          onSaved={() => { setActiveForm(null); onRefresh() }}
          onCancel={() => setActiveForm(null)} t={t} />
      )}
      {activeForm === 'edit' && (
        <TenantEditForm room={room}
          onSaved={() => { setActiveForm(null); onRefresh() }}
          onCancel={() => setActiveForm(null)} t={t} />
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

export function RentalPage() {
  const { t, lang } = useLang()
  const now = new Date()
  const [year,    setYear]    = useState(now.getFullYear())
  const [month,   setMonth]   = useState(now.getMonth() + 1)
  const [tab,     setTab]     = useState<'rooms' | 'summary'>('rooms')
  const [rooms,   setRooms]   = useState<Room[]>([])
  const [summary, setSummary] = useState<RentalSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const monthName = (lang === 'en' ? MONTHS_EN : MONTHS_SW)[month]

  // Pass year+month so API returns the right currentMonthPayment
  const fetchRooms = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/rental/rooms?year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json()).then(setRooms).catch(() => {}).finally(() => setLoading(false))
  }, [year, month])

  const fetchSummary = useCallback(() => {
    fetch(`${API}/api/rental/summary?year=${year}&month=${month}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json()).then(setSummary).catch(() => {})
  }, [year, month])

  useEffect(() => { fetchRooms() }, [fetchRooms])
  useEffect(() => { if (tab === 'summary') fetchSummary() }, [tab, fetchSummary])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (isCurrentMonth) return
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  return (
    <div>
      <div className="flex bg-white border-b border-gray-200">
        {([
          { key: 'rooms',   label: t('Rooms', 'Vyumba') },
          { key: 'summary', label: t('Summary', 'Muhtasari') },
        ] as const).map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${tab === key ? 'border-green-700 text-green-700' : 'border-transparent text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* Month nav */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-3 mb-5">
          <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center text-xl text-green-700">‹</button>
          <span className="font-semibold text-gray-800">{monthName} {year}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth}
            className="w-10 h-10 flex items-center justify-center text-xl text-green-700 disabled:opacity-30">›</button>
        </div>

        {/* ── Rooms tab ── */}
        {tab === 'rooms' && (
          <>
            <h1 className="text-xl font-bold text-green-800 mb-4">{t('Rental Rooms', 'Vyumba vya Kupangisha')}</h1>
            {loading
              ? <div className="text-center py-8 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
              : <div className="space-y-3">
                  {rooms.map(room => (
                    <RoomCard key={room.id} room={room} year={year} month={month}
                      onRefresh={fetchRooms} t={t} />
                  ))}
                </div>
            }
          </>
        )}

        {/* ── Summary tab ── */}
        {tab === 'summary' && summary && (
          <>
            {/* Income banner */}
            <div className="bg-green-700 text-white rounded-2xl p-4 text-center mb-4">
              <p className="text-sm opacity-80">{monthName} {year}</p>
              <p className="text-4xl font-bold">
                KES {(summary.collectedRentKes + summary.collectedElectricityKes).toLocaleString()}
              </p>
              <p className="text-xs opacity-70 mt-1">
                {t('Rent', 'Kodi')}: KES {summary.collectedRentKes.toLocaleString()} ·{' '}
                {t('Electricity', 'Umeme')}: KES {summary.collectedElectricityKes.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4 space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('Expected rent', 'Kodi inayotarajiwa')}</span>
                <span className="font-semibold">KES {summary.expectedRentKes.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">{t('Rooms occupied', 'Vyumba vilivyokaliwa')}</span>
                <span className="font-semibold">{summary.occupiedRooms} / {summary.totalRooms}</span>
              </div>
              {summary.outstandingRooms.length > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">{t('Rooms unpaid', 'Vyumba visivyolipwa')}</span>
                  <span className="font-semibold text-red-600">{summary.outstandingRooms.length}</span>
                </div>
              )}
            </div>

            {/* Per-room status */}
            <div className="space-y-2">
              {summary.rooms.map(r => {
                const totalPaid = r.payments.reduce((s, p) => s + p.totalAmountKes, 0)
                return (
                  <div key={r.id} className="flex justify-between items-center bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm">
                    <div>
                      <span className="font-semibold text-gray-800">{t('Room', 'Chumba')} {r.roomNumber}</span>
                      {r.tenantName && <span className="text-gray-400 ml-2 text-xs">{r.tenantName}</span>}
                    </div>
                    {r.paid
                      ? <span className="text-green-700 font-semibold text-xs">KES {totalPaid.toLocaleString()} ✓</span>
                      : r.occupancyStatus === 'occupied'
                        ? <span className="text-red-600 text-xs font-semibold">{t('Unpaid', 'Halijalipiwa')}</span>
                        : <span className="text-gray-400 text-xs">{t('Vacant', 'Wazi')}</span>
                    }
                  </div>
                )
              })}
            </div>
          </>
        )}

        {tab === 'summary' && !summary && (
          <div className="text-center py-8 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
        )}
      </div>
    </div>
  )
}
