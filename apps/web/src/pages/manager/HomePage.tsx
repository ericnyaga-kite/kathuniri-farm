import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../store/langStore'
import { pendingSyncCount } from '../../services/syncService'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

interface CowSummary { id: string; name: string; tagNumber: string | null; status: string; litresToday: number }
interface WithdrawalAlert { drugName: string; withdrawalEndsDate: string; cowName: string }
interface DailySummary {
  date: string
  tea: { totalKgToday: number | null; lastDeliveryDate: string | null; lastDeliverySource: string | null }
  milk: { totalLitresToday: number; cows: CowSummary[] }
  healthAlerts: { activeWithdrawals: WithdrawalAlert[]; recentEvents: { id: string; eventDate: string; eventType: string; conditionName: string | null; cowName: string }[] }
  rental: { totalOccupied: number; paidCount: number; unpaidCount: number; needingReading: { roomNumber: number; tenantName: string | null }[] }
  logs: { id: string; category: string; title: string | null; body: string }[]
}

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) }
function daysLeft(dateStr: string) { return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000) }
function toDateStr(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`
}

// ─── Mini Calendar ────────────────────────────────────────────────────────

const DAY_LABELS_EN = ['Su','Mo','Tu','We','Th','Fr','Sa']
const DAY_LABELS_SW = ['Ji','Ju','Tz','Ar','Al','Ij','Sa']
const MONTH_NAMES_EN = ['January','February','March','April','May','June','July','August','September','October','November','December']
const MONTH_NAMES_SW = ['Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']

interface CalendarProps {
  selectedDate: string
  onSelect: (date: string) => void
  lang: string
}

function MiniCalendar({ selectedDate, onSelect, lang }: CalendarProps) {
  const todayStr = new Date().toISOString().split('T')[0]
  const selParts = selectedDate.split('-').map(Number)
  const [viewYear,  setViewYear]  = useState(selParts[0])
  const [viewMonth, setViewMonth] = useState(selParts[1]) // 1-based
  const [activeDays, setActiveDays] = useState<Set<number>>(new Set())

  useEffect(() => {
    fetch(`${API}/api/summary/active-days?year=${viewYear}&month=${viewMonth}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(d => setActiveDays(new Set(d.activeDays ?? [])))
      .catch(() => {})
  }, [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    const now = new Date()
    if (viewYear > now.getFullYear() || (viewYear === now.getFullYear() && viewMonth >= now.getMonth() + 1)) return
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1) }
    else setViewMonth(m => m + 1)
  }

  const firstDow  = new Date(viewYear, viewMonth - 1, 1).getDay() // 0=Sun
  const daysInMon = new Date(viewYear, viewMonth, 0).getDate()
  const today     = new Date()
  const isCurrentOrPast = viewYear < today.getFullYear() ||
    (viewYear === today.getFullYear() && viewMonth <= today.getMonth() + 1)

  // Build grid: leading blanks + day cells
  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => i + 1),
  ]

  const dayLabels = lang === 'en' ? DAY_LABELS_EN : DAY_LABELS_SW

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Month header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={prevMonth} className="text-green-700 font-bold text-xl px-2 py-1 active:opacity-60">‹</button>
        <span className="font-semibold text-gray-800 text-sm">
          {lang === 'en' ? MONTH_NAMES_EN[viewMonth - 1] : MONTH_NAMES_SW[viewMonth - 1]} {viewYear}
        </span>
        <button onClick={nextMonth} disabled={!isCurrentOrPast || (viewYear === today.getFullYear() && viewMonth >= today.getMonth() + 1)}
          className="text-green-700 font-bold text-xl px-2 py-1 active:opacity-60 disabled:opacity-30">›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 border-b border-gray-100">
        {dayLabels.map(d => (
          <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 p-2 gap-1">
        {cells.map((day, i) => {
          if (day === null) return <div key={`blank-${i}`} />

          const dateStr    = toDateStr(viewYear, viewMonth, day)
          const isToday    = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const isFuture   = dateStr > todayStr
          const hasData    = activeDays.has(day)

          return (
            <button
              key={day}
              disabled={isFuture}
              onClick={() => onSelect(dateStr)}
              className={`relative flex flex-col items-center justify-center rounded-xl py-1.5 text-sm font-semibold transition-colors
                ${isSelected ? 'bg-green-700 text-white' :
                  isToday    ? 'bg-green-100 text-green-800' :
                  isFuture   ? 'text-gray-200 cursor-default' :
                               'text-gray-700 active:bg-gray-100'}
              `}
            >
              {day}
              {/* Data dot */}
              {hasData && !isSelected && (
                <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isToday ? 'bg-green-600' : 'bg-green-500'}`} />
              )}
              {hasData && isSelected && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-white opacity-80" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Home Page ────────────────────────────────────────────────────────────

export function HomePage() {
  const { t, lang } = useLang()
  const navigate    = useNavigate()
  const todayStr    = new Date().toISOString().split('T')[0]
  const [selectedDate,  setSelectedDate]  = useState(todayStr)
  const [showCalendar,  setShowCalendar]  = useState(false)
  const [pending,  setPending]  = useState(0)
  const [summary,  setSummary]  = useState<DailySummary | null>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => { pendingSyncCount().then(setPending) }, [])

  useEffect(() => {
    setLoading(true); setSummary(null)
    fetch(`${API}/api/summary/today?date=${selectedDate}`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selectedDate])

  function fmtSelected() {
    if (selectedDate === todayStr) return lang === 'en' ? 'Today' : 'Leo'
    const yest = new Date(todayStr); yest.setDate(yest.getDate() - 1)
    if (selectedDate === yest.toISOString().split('T')[0]) return lang === 'en' ? 'Yesterday' : 'Jana'
    return new Date(selectedDate).toLocaleDateString(
      lang === 'en' ? 'en-KE' : 'sw-KE',
      { weekday: 'short', day: 'numeric', month: 'short' }
    )
  }

  function handleSelect(date: string) {
    setSelectedDate(date)
    setShowCalendar(false)
  }

  return (
    <div className="p-4 pb-8 space-y-4">
      {/* Header */}
      <div className="pt-1">
        <h1 className="text-xl font-bold text-green-800">{t('Daily Summary', 'Muhtasari wa Leo')}</h1>

        {/* Date bar — tap to open calendar */}
        <button
          onClick={() => setShowCalendar(c => !c)}
          className="mt-2 w-full flex items-center justify-between bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 active:bg-gray-100"
        >
          <span className="text-sm font-semibold text-gray-800">{fmtSelected()}</span>
          <div className="flex items-center gap-1 text-green-700">
            <span className="text-base">📅</span>
            <span className="text-xs font-semibold">{showCalendar ? t('Close','Funga') : t('Calendar','Kalenda')}</span>
          </div>
        </button>
      </div>

      {/* Inline calendar */}
      {showCalendar && (
        <MiniCalendar selectedDate={selectedDate} onSelect={handleSelect} lang={lang} />
      )}

      {/* Pending sync */}
      {pending > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-3 py-2">
          <span className="text-lg">⏳</span>
          <p className="text-xs text-amber-700 font-medium">
            {pending} {t('record(s) pending sync', 'rekodi zinasubiri kusawazishwa')}
          </p>
        </div>
      )}

      {loading && <p className="text-sm text-gray-400 text-center py-4">{t('Loading…', 'Inapakia…')}</p>}

      {summary && (
        <>
          {/* ── Withdrawal alert ──────────────────────────────────────────── */}
          {summary.healthAlerts.activeWithdrawals.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-3">
              <p className="text-xs font-bold text-red-700 mb-1">⚠️ {t('Milk Withdrawal Active', 'Maziwa Haifai')}</p>
              {summary.healthAlerts.activeWithdrawals.map((w, i) => (
                <p key={i} className="text-xs text-red-600">
                  {w.cowName} — {w.drugName} ({t('ends', 'inaisha')} {fmtDate(w.withdrawalEndsDate)}, {daysLeft(w.withdrawalEndsDate)}d)
                </p>
              ))}
            </div>
          )}

          {/* ── Tea ─────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🍃</span>
                <span className="font-semibold text-gray-800">{t('Tea', 'Chai')}</span>
              </div>
              <button onClick={() => navigate('/manager/chai')}
                className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-xl font-semibold">
                + {t('Entry', 'Ingiza')}
              </button>
            </div>
            {summary.tea.totalKgToday !== null ? (
              <div className="text-center">
                <p className="text-3xl font-bold text-green-700">{summary.tea.totalKgToday} kg</p>
                <p className="text-xs text-gray-400 mt-1">{t('today', 'leo')}</p>
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-gray-400">{t('No SMS today', 'Hakuna SMS leo')}</p>
                {summary.tea.lastDeliveryDate && (
                  <p className="text-xs text-gray-300 mt-1">
                    {t('Last', 'Mwisho')}: {fmtDate(summary.tea.lastDeliveryDate)}
                    {summary.tea.lastDeliverySource && summary.tea.lastDeliverySource !== 'live' && (
                      <span className="ml-1 text-amber-500">({summary.tea.lastDeliverySource})</span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Milk ─────────────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🥛</span>
                <span className="font-semibold text-gray-800">{t('Milk Today', 'Maziwa Leo')}</span>
              </div>
              <button onClick={() => navigate('/manager/maziwa')}
                className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-xl font-semibold">
                + {t('Enter', 'Ingiza')}
              </button>
            </div>
            <div className="text-center mb-3">
              <p className="text-3xl font-bold text-blue-700">{summary.milk.totalLitresToday} L</p>
            </div>
            <div className="space-y-1">
              {summary.milk.cows.map(cow => (
                <div key={cow.id} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">🐄 {cow.name}</span>
                  <span className={`text-sm font-bold ${cow.litresToday > 0 ? 'text-blue-700' : 'text-gray-300'}`}>
                    {cow.litresToday > 0 ? `${cow.litresToday} L` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Rental — compact summary only ───────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🏠</span>
                <span className="font-semibold text-gray-800">{t('Rent', 'Kodi')}</span>
              </div>
              <button onClick={() => navigate('/manager/kodi')}
                className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-xl font-semibold">
                + {t('Collect', 'Kusanya')}
              </button>
            </div>
            <div className="flex gap-3">
              <div className="flex-1 text-center bg-green-50 rounded-xl py-3">
                <p className="text-2xl font-bold text-green-700">{summary.rental.paidCount}</p>
                <p className="text-xs text-gray-500">{t('Paid', 'Amelipa')}</p>
              </div>
              <div className="flex-1 text-center bg-red-50 rounded-xl py-3">
                <p className="text-2xl font-bold text-red-600">{summary.rental.unpaidCount}</p>
                <p className="text-xs text-gray-500">{t('Unpaid', 'Hajalipa')}</p>
              </div>
              <div className="flex-1 text-center bg-gray-50 rounded-xl py-3">
                <p className="text-2xl font-bold text-gray-600">{summary.rental.totalOccupied}</p>
                <p className="text-xs text-gray-500">{t('Total', 'Jumla')}</p>
              </div>
            </div>
            {summary.rental.needingReading.length > 0 && (
              <p className="text-xs text-amber-600 mt-2">
                ⚡ {summary.rental.needingReading.map(r => `${t('Rm','Chumba')} ${r.roomNumber}`).join(', ')} — {t('no meter reading', 'hakuna usomaji wa mita')}
              </p>
            )}
          </div>

          {/* ── Recent health events ──────────────────────────────────────── */}
          {summary.healthAlerts.recentEvents.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🐄</span>
                <span className="font-semibold text-gray-800">{t('Animal Health (7 days)', 'Afya ya Wanyama (siku 7)')}</span>
              </div>
              <div className="space-y-1">
                {summary.healthAlerts.recentEvents.map(e => (
                  <div key={e.id} className="flex justify-between items-center bg-orange-50 rounded-xl px-3 py-2">
                    <div>
                      <p className="text-xs font-medium text-gray-800">{e.cowName}</p>
                      <p className="text-xs text-gray-500">{e.conditionName ?? e.eventType}</p>
                    </div>
                    <p className="text-xs text-gray-400">{fmtDate(e.eventDate)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Today's log ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">📝</span>
                <span className="font-semibold text-gray-800">{t("Today's Log", 'Kumbukumbu ya Leo')}</span>
              </div>
              <button onClick={() => navigate('/manager/log')}
                className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-xl font-semibold">
                + {t('Add', 'Ongeza')}
              </button>
            </div>
            {summary.logs.length === 0 ? (
              <p className="text-xs text-gray-400">{t('Nothing recorded yet today.', 'Hakuna kumbukumbu leo.')}</p>
            ) : (
              <div className="space-y-2">
                {summary.logs.map(l => (
                  <div key={l.id} className="bg-gray-50 rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium capitalize">{l.category}</span>
                      {l.title && <span className="text-xs font-semibold text-gray-700">{l.title}</span>}
                    </div>
                    <p className="text-xs text-gray-600">{l.body}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
