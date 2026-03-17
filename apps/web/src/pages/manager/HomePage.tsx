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

export function HomePage() {
  const { t, lang } = useLang()
  const navigate    = useNavigate()
  const [pending, setPending] = useState(0)
  const [summary, setSummary] = useState<DailySummary | null>(null)
  const [loading, setLoading] = useState(true)

  const today = new Date().toLocaleDateString(lang === 'en' ? 'en-KE' : 'sw-KE', {
    weekday: 'long', day: 'numeric', month: 'long',
  })

  useEffect(() => {
    pendingSyncCount().then(setPending)
    fetch(`${API}/api/summary/today`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json())
      .then(setSummary)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 pb-8 space-y-4">
      {/* Header */}
      <div className="pt-1">
        <h1 className="text-xl font-bold text-green-800">{t('Daily Summary', 'Muhtasari wa Leo')}</h1>
        <p className="text-xs text-gray-400 capitalize">{today}</p>
      </div>

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
            {/* Compact cow rows */}
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
