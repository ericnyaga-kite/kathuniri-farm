import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const MONTHS_EN = ['','January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SW = ['','Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']

interface ElectricityReading {
  id: string
  readingDate: string
  meterReading: number
  unitsConsumed: number | null
  amountKes: number | null
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
  notes: string | null
  electricityReadings: ElectricityReading[]
  rentPayments: RentPayment[]
  outstandingMonths: number
}

interface RentalSummary {
  totalRooms: number
  occupiedRooms: number
  expectedRentKes: number
  collectedRentKes: number
  collectedElectricityKes: number
  outstandingRooms: number
  rooms: { roomId: string; roomNumber: number; tenantName: string | null; paid: boolean; totalPaidKes: number }[]
}

function PaymentForm({ room, year, month, onSaved, onCancel, t }: {
  room: Room; year: number; month: number
  onSaved: () => void; onCancel: () => void
  t: (en: string, sw: string) => string
}) {
  const today = new Date().toISOString().split('T')[0]
  const [paymentDate, setPaymentDate] = useState(today)
  const [rentAmountKes, setRentAmountKes] = useState(String(room.monthlyRentKes ?? ''))
  const [electricityAmountKes, setElectricityAmountKes] = useState('0')
  const [paymentMethod, setPaymentMethod] = useState('mpesa')
  const [mpesaRef, setMpesaRef] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    try {
      const r = await fetch(`${API}/api/rental/rooms/${room.id}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentDate, periodMonth: month, periodYear: year,
          rentAmountKes: parseFloat(rentAmountKes) || 0,
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
      <p className="font-semibold text-green-800 text-sm">{t('Record Payment', 'Rekodi Malipo')} — {MONTHS_EN[month]} {year}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500">{t('Rent (KES)', 'Kodi (KES)')}</label>
          <input type="number" value={rentAmountKes} onChange={e => setRentAmountKes(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Electricity (KES)', 'Umeme (KES)')}</label>
          <input type="number" value={electricityAmountKes} onChange={e => setElectricityAmountKes(e.target.value)}
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
          <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
            <option value="mpesa">M-Pesa</option>
            <option value="cash">{t('Cash', 'Taslimu')}</option>
          </select>
        </div>
        {paymentMethod === 'mpesa' && (
          <div>
            <label className="text-xs text-gray-500">M-Pesa Ref</label>
            <input type="text" placeholder="e.g. QHG4..." value={mpesaRef} onChange={e => setMpesaRef(e.target.value)}
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

function RoomCard({ room, year, month, onRefresh, t }: {
  room: Room; year: number; month: number
  onRefresh: () => void
  t: (en: string, sw: string) => string
}) {
  const [showPaymentForm, setShowPaymentForm] = useState(false)

  const latestElec = room.electricityReadings[0]
  const thisMonthPmt = room.rentPayments.find(p => p.periodMonth === month && p.periodYear === year)

  return (
    <div className={`bg-white rounded-2xl border p-4 ${room.outstandingMonths > 0 ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-bold text-gray-800">
            {t('Room', 'Chumba')} {room.roomNumber}
            {room.tenantName && <span className="font-normal text-gray-500 text-sm ml-2">— {room.tenantName}</span>}
          </p>
          {room.monthlyRentKes && (
            <p className="text-xs text-gray-400">KES {Number(room.monthlyRentKes).toLocaleString()}/{t('mo', 'mwezi')}</p>
          )}
        </div>
        {thisMonthPmt
          ? <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">{t('Paid', 'Imelipwa')} ✓</span>
          : room.occupancyStatus === 'occupied'
            ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">{t('Unpaid', 'Halijalipiwa')}</span>
            : <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 font-semibold">{t('Vacant', 'Wazi')}</span>
        }
      </div>

      {latestElec && (
        <div className="text-xs text-gray-500 mb-2">
          ⚡ {t('Reading', 'Mita')}: {Number(latestElec.meterReading).toLocaleString()} units
          {latestElec.unitsConsumed != null && <span> · {Number(latestElec.unitsConsumed)} {t('used', 'zilitumika')} · KES {Number(latestElec.amountKes).toLocaleString()}</span>}
          <span className="text-gray-400 ml-1">({new Date(latestElec.readingDate).toLocaleDateString(undefined, { day:'numeric', month:'short' })})</span>
        </div>
      )}

      {room.outstandingMonths > 1 && (
        <p className="text-xs text-red-600 mb-2">{room.outstandingMonths} {t('months outstanding', 'miezi inadaiwa')}</p>
      )}

      {thisMonthPmt && (
        <div className="text-xs text-gray-500 mt-1">
          {t('Paid', 'Imelipwa')} KES {Number(thisMonthPmt.totalAmountKes).toLocaleString()}
          {thisMonthPmt.mpesaRef && <span className="ml-1 text-gray-400">{thisMonthPmt.mpesaRef}</span>}
        </div>
      )}

      {!thisMonthPmt && room.occupancyStatus === 'occupied' && !showPaymentForm && (
        <button onClick={() => setShowPaymentForm(true)}
          className="mt-2 w-full border-2 border-dashed border-green-300 text-green-700 rounded-xl py-2 text-xs font-semibold">
          + {t('Record Payment', 'Rekodi Malipo')}
        </button>
      )}

      {showPaymentForm && (
        <PaymentForm
          room={room} year={year} month={month}
          onSaved={() => { setShowPaymentForm(false); onRefresh() }}
          onCancel={() => setShowPaymentForm(false)}
          t={t}
        />
      )}
    </div>
  )
}

export function RentalPage() {
  const { t, lang } = useLang()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tab, setTab]     = useState<'rooms' | 'summary'>('rooms')
  const [rooms, setRooms] = useState<Room[]>([])
  const [summary, setSummary] = useState<RentalSummary | null>(null)
  const [loading, setLoading] = useState(false)

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
  const monthName = (lang === 'en' ? MONTHS_EN : MONTHS_SW)[month]

  const fetchRooms = useCallback(() => {
    setLoading(true)
    fetch(`${API}/api/rental/rooms`)
      .then(r => r.json()).then(setRooms).finally(() => setLoading(false))
  }, [])

  const fetchSummary = useCallback(() => {
    fetch(`${API}/api/rental/summary?year=${year}&month=${month}`)
      .then(r => r.json()).then(setSummary)
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
        {/* Month nav (shared) */}
        <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-3 mb-5">
          <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center text-xl text-green-700">‹</button>
          <span className="font-semibold text-gray-800">{monthName} {year}</span>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="w-10 h-10 flex items-center justify-center text-xl text-green-700 disabled:opacity-30">›</button>
        </div>

        {tab === 'rooms' && (
          <>
            <h1 className="text-xl font-bold text-green-800 mb-4">{t('Rental Rooms', 'Vyumba vya Kupangisha')}</h1>
            {loading
              ? <div className="text-center py-8 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
              : <div className="space-y-3">
                  {rooms.map(room => (
                    <RoomCard key={room.id} room={room} year={year} month={month} onRefresh={fetchRooms} t={t} />
                  ))}
                </div>
            }
          </>
        )}

        {tab === 'summary' && summary && (
          <>
            {/* Income banner */}
            <div className="bg-green-700 text-white rounded-2xl p-4 text-center mb-4">
              <p className="text-sm opacity-80">{monthName} {year}</p>
              <p className="text-4xl font-bold">KES {(summary.collectedRentKes + summary.collectedElectricityKes).toLocaleString()}</p>
              <p className="text-xs opacity-70 mt-1">
                {t('Rent', 'Kodi')}: KES {summary.collectedRentKes.toLocaleString()} · {t('Electricity', 'Umeme')}: KES {summary.collectedElectricityKes.toLocaleString()}
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
              {summary.outstandingRooms > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-red-600">{t('Rooms unpaid', 'Vyumba visivyolipwa')}</span>
                  <span className="font-semibold text-red-600">{summary.outstandingRooms}</span>
                </div>
              )}
            </div>

            {/* Room status list */}
            <div className="space-y-2">
              {summary.rooms.map(r => (
                <div key={r.roomId} className="flex justify-between items-center bg-white rounded-xl border border-gray-200 px-4 py-3 text-sm">
                  <div>
                    <span className="font-semibold text-gray-800">{t('Room', 'Chumba')} {r.roomNumber}</span>
                    {r.tenantName && <span className="text-gray-400 ml-2 text-xs">{r.tenantName}</span>}
                  </div>
                  {r.paid
                    ? <span className="text-green-700 font-semibold text-xs">KES {r.totalPaidKes.toLocaleString()} ✓</span>
                    : <span className="text-red-600 text-xs font-semibold">{t('Unpaid', 'Halijalipiwa')}</span>
                  }
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
