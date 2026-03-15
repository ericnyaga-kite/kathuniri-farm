import { useState, useEffect } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const MONTHS_EN = ['','January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SW = ['','Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']

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

function CowCard({ cow, t }: { cow: Cow; t: (en: string, sw: string) => string }) {
  return (
    <div className={`bg-white rounded-2xl border p-4 ${cow.withdrawalActive ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex justify-between items-start mb-2">
        <div>
          <p className="font-bold text-gray-800 text-lg">{cow.name}</p>
          {cow.breed && <p className="text-xs text-gray-400">{cow.breed}</p>}
        </div>
        <StatusPill status={cow.status} withdrawalActive={cow.withdrawalActive} withdrawalEndsDate={cow.withdrawalEndsDate} t={t} />
      </div>

      <div className="flex gap-4 text-sm">
        <div>
          <p className="text-xs text-gray-400">{t('Last 7 days', 'Siku 7 zilizopita')}</p>
          <p className="text-2xl font-bold text-green-700">{cow.last7DaysLitres}<span className="text-sm font-normal text-gray-500 ml-1">L</span></p>
        </div>
        {cow.dateLastCalved && (
          <div>
            <p className="text-xs text-gray-400">{t('Last calved', 'Aliyezaa mwisho')}</p>
            <p className="text-sm font-medium text-gray-700">{new Date(cow.dateLastCalved).toLocaleDateString(undefined, { day:'numeric', month:'short' })}</p>
          </div>
        )}
      </div>

      {cow.withdrawalActive && cow.withdrawalEndsDate && (
        <div className="mt-3 bg-red-50 rounded-xl p-2 text-xs text-red-700">
          ⚠️ {t('Milk not saleable until', 'Maziwa hayauziwe hadi')} {new Date(cow.withdrawalEndsDate).toLocaleDateString(undefined, { day:'numeric', month:'short', year:'numeric' })}
        </div>
      )}

      {cow.latestHealthEvent && !cow.withdrawalActive && (
        <div className="mt-3 text-xs text-gray-400">
          {t('Last event', 'Tukio la mwisho')}: {cow.latestHealthEvent.conditionName ?? cow.latestHealthEvent.eventType}
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
            <div key={c.cowId} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex justify-between items-center mb-2">
                <p className="font-semibold text-gray-800">{c.cowName}</p>
                <p className="text-2xl font-bold text-green-700">{c.totalLitres.toFixed(1)} L</p>
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span>🌅 {t('Morning', 'Asubuhi')}: {c.morningLitres.toFixed(1)} L</span>
                <span>🌆 {t('Evening', 'Jioni')}: {c.eveningLitres.toFixed(1)} L</span>
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
            <div key={b.buyerId} className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex justify-between items-center mb-1">
                <p className="font-semibold text-gray-800">{b.buyerName}</p>
                <p className="font-bold text-gray-800">{b.litresDelivered.toFixed(1)} L</p>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">KES {b.totalValueKes.toLocaleString()}</span>
                {b.unpaidValueKes > 0 && (
                  <span className="text-red-600 font-medium">
                    {t('Owed', 'Deni')}: KES {b.unpaidValueKes.toLocaleString()}
                  </span>
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

export function DairyPage() {
  const { t, lang } = useLang()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [tab, setTab]     = useState<'cows' | 'summary'>('cows')
  const [cows, setCows]   = useState<Cow[]>([])
  const [cowsLoading, setCowsLoading] = useState(false)

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
          { key: 'cows',    label: t('Cows', 'Ng\'ombe') },
          { key: 'summary', label: t('Milk Summary', 'Muhtasari wa Maziwa') },
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
            <h1 className="text-xl font-bold text-green-800 mb-4">{t('Dairy Cows', 'Ng\'ombe wa Maziwa')}</h1>
            {cowsLoading
              ? <div className="text-center py-8 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
              : <div className="space-y-3">{cows.map(c => <CowCard key={c.id} cow={c} t={t} />)}</div>
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
      </div>
    </div>
  )
}
