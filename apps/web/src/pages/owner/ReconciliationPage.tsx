import { useState, useEffect, useCallback } from 'react'
import { useLang } from '../../store/langStore'

interface TopUp {
  id: string
  topupDate: string
  amountKes: number
  note: string | null
}

interface CentreLetter { letter: string; kg: number }

interface CentreEntry {
  centreName: string
  letters: CentreLetter[]
  centreTotal: number
}

interface AccountEntry {
  accountCode: string
  holderName: string
  todayKg: number
}

interface DayEntry {
  smsRecordId: string
  date: string
  rawSmsSnippet: string
  accounts: AccountEntry[]
  centres: CentreEntry[]
  accountTotal: number
  centreTotal: number
  match: boolean
  casualKg: number | null
  casualPayKes: number | null
  supervisorFloat: number | null
}

interface ReconciliationData {
  year: number
  month: number
  days: DayEntry[]
  totalAccountKg: number
  totalCentreKg: number
  grandMatch: boolean
  totalCasualKg: number
  totalCasualPayKes: number
  currentFloatBalance: number | null
  totalFloatTopups: number
  floatTopups: TopUp[]
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const MONTHS_EN = ['','January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SW = ['','Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']

function MatchBadge({ match, diff, t }: { match: boolean; diff: number; t: (en: string, sw: string) => string }) {
  return match
    ? <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">{t('Match', 'Sawa')} ✓</span>
    : <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">{t('Off by', 'Tofauti')} {diff.toFixed(1)} kg ✗</span>
}

function DayCard({ day, t }: { day: DayEntry; t: (en: string, sw: string) => string }) {
  const [smsExpanded, setSmsExpanded] = useState(false)

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-3">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 flex justify-between items-center">
        <div>
          <p className="font-semibold text-gray-800">
            {new Date(day.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
          </p>
          <button
            onClick={() => setSmsExpanded(e => !e)}
            className="text-xs text-gray-400 hover:text-gray-600 mt-0.5 flex items-center gap-1"
          >
            {smsExpanded ? '▲' : '▼'} {t('SMS', 'SMS')}
          </button>
        </div>
        <MatchBadge match={day.match} diff={Math.abs(day.accountTotal - day.centreTotal)} t={t} />
      </div>

      {smsExpanded && (
        <p className="px-4 py-2 font-mono text-xs bg-amber-50 text-gray-600 break-all border-b border-amber-100">
          {day.rawSmsSnippet}
        </p>
      )}

      {/* Account vs Centre columns */}
      <div className="px-4 py-3 grid grid-cols-2 gap-4 text-sm">
        {/* Accounts */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t('Accounts', 'Akaunti')}
          </p>
          {day.accounts.map(acct => (
            <div key={acct.accountCode} className="flex justify-between py-0.5">
              <span className="text-gray-700 truncate pr-1">{acct.holderName.split(' ')[0]}</span>
              <span className="font-semibold text-green-700 whitespace-nowrap">{acct.todayKg} kg</span>
            </div>
          ))}
          <div className="mt-1 pt-1 border-t border-gray-100 flex justify-between font-bold text-gray-800">
            <span>{t('Total', 'Jumla')}</span>
            <span>{day.accountTotal.toFixed(1)} kg</span>
          </div>
        </div>

        {/* Centres / Sectors */}
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            {t('Sectors', 'Sektа')}
          </p>
          {day.centres.map(ctr => (
            <div key={ctr.centreName} className="mb-2">
              <p className="font-medium text-gray-800 text-xs">{ctr.centreName}</p>
              {ctr.letters.map(l => (
                <div key={l.letter} className="flex justify-between text-xs text-gray-500 pl-2">
                  <span>{l.letter}</span>
                  <span>{l.kg} kg</span>
                </div>
              ))}
            </div>
          ))}
          <div className="mt-1 pt-1 border-t border-gray-100 flex justify-between font-bold text-gray-800">
            <span>{t('Total', 'Jumla')}</span>
            <span>{day.centreTotal.toFixed(1)} kg</span>
          </div>
        </div>
      </div>

      {/* Casual / float footer */}
      {(day.casualKg != null || day.supervisorFloat != null) && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex flex-wrap gap-3 text-xs text-gray-500">
          {day.casualKg != null && (
            <span>
              {t('Casual', 'Casual')}: {day.casualKg} kg · KES {day.casualPayKes?.toLocaleString()}
            </span>
          )}
          {day.supervisorFloat != null && (
            <span className={day.supervisorFloat >= 0 ? 'text-green-600' : 'text-red-600'}>
              {t('Float', 'Float')}: KES {day.supervisorFloat.toLocaleString()}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function AddTopUpForm({
  onSaved, onCancel, t,
}: {
  year?: number; month?: number
  onSaved: () => void
  onCancel: () => void
  t: (en: string, sw: string) => string
}) {
  const today = new Date().toISOString().split('T')[0]
  const [topupDate, setTopupDate] = useState(today)
  const [amountKes, setAmountKes] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(amountKes)
    if (!amount || amount <= 0) { setError(t('Enter a positive amount', 'Weka kiasi sahihi')); return }
    setSaving(true); setError(null)
    try {
      const r = await fetch(`${API}/api/tea/float/topups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topupDate, amountKes: amount, note: note || undefined }),
      })
      if (!r.ok) { const d = await r.json(); throw new Error(d.error ?? 'Failed'); }
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Failed to save', 'Imeshindwa kuhifadhi'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-green-50 rounded-2xl p-4 space-y-3">
      <p className="font-semibold text-green-800 text-sm">{t('Add Float Top-up', 'Ongeza Float')}</p>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('Date', 'Tarehe')}</label>
        <input
          type="date" value={topupDate} onChange={e => setTopupDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('Amount (KES)', 'Kiasi (KES)')}</label>
        <input
          type="number" min="1" step="50" placeholder="e.g. 3000"
          value={amountKes} onChange={e => setAmountKes(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="text-xs text-gray-500 block mb-1">{t('Note (optional)', 'Maelezo (si lazima)')}</label>
        <input
          type="text" placeholder={t('e.g. Mpesa transfer', 'mfano: Uhamisho wa Mpesa')}
          value={note} onChange={e => setNote(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
        />
      </div>
      <div className="flex gap-2">
        <button
          type="submit" disabled={saving}
          className="flex-1 bg-green-700 text-white rounded-xl py-2 text-sm font-semibold disabled:opacity-50"
        >
          {saving ? t('Saving...', 'Inahifadhi...') : t('Save', 'Hifadhi')}
        </button>
        <button
          type="button" onClick={onCancel}
          className="flex-1 border border-gray-300 rounded-xl py-2 text-sm text-gray-600"
        >
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </form>
  )
}

export function ReconciliationPage() {
  const { t, lang } = useLang()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData]   = useState<ReconciliationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTopUpForm, setShowTopUpForm] = useState(false)

  const monthName = (lang === 'en' ? MONTHS_EN : MONTHS_SW)[month]
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  const fetchData = useCallback((y: number, m: number) => {
    setLoading(true); setError(null)
    fetch(`${API}/api/tea/reconciliation?year=${y}&month=${m}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setError(t('Network error', 'Hitilafu ya mtandao')))
      .finally(() => setLoading(false))
  }, [t])

  useEffect(() => { fetchData(year, month) }, [year, month, fetchData])

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
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-green-800 mb-1">
        {t('Reconciliation', 'Usuluhisho')}
      </h1>
      <p className="text-sm text-gray-500 mb-4">
        {t('Accounts vs sectors · Float & casual', 'Akaunti vs sektа · Float na Casual')}
      </p>

      {/* Month navigator */}
      <div className="flex items-center justify-between bg-white rounded-2xl border border-gray-200 p-3 mb-5">
        <button onClick={prevMonth} className="w-10 h-10 flex items-center justify-center text-xl text-green-700">‹</button>
        <span className="font-semibold text-gray-800">{monthName} {year}</span>
        <button
          onClick={nextMonth}
          disabled={isCurrentMonth}
          className="w-10 h-10 flex items-center justify-center text-xl text-green-700 disabled:opacity-30"
        >›</button>
      </div>

      {loading && <div className="text-center py-12 text-gray-400">{t('Loading...', 'Inapakia...')}</div>}
      {error   && <div className="bg-red-50 text-red-600 rounded-2xl p-4 text-center">{error}</div>}

      {data && !loading && (
        <>
          {/* Grand match banner */}
          <div className={`rounded-2xl p-4 mb-5 text-center ${data.grandMatch ? 'bg-green-700 text-white' : 'bg-red-600 text-white'}`}>
            <p className="text-sm opacity-80 mb-1">{monthName} {year} — {t('Total', 'Jumla')}</p>
            <div className="flex justify-center gap-8 mb-2">
              <div>
                <p className="text-xs opacity-70">{t('Accounts', 'Akaunti')}</p>
                <p className="text-2xl font-bold">{data.totalAccountKg.toFixed(1)} kg</p>
              </div>
              <div className="flex items-center text-2xl opacity-50">=</div>
              <div>
                <p className="text-xs opacity-70">{t('Sectors', 'Sektа')}</p>
                <p className="text-2xl font-bold">{data.totalCentreKg.toFixed(1)} kg</p>
              </div>
            </div>
            {data.grandMatch
              ? <p className="text-sm font-semibold">✓ {t('Figures match', 'Takwimu zinafanana')}</p>
              : <p className="text-sm font-semibold">✗ {t('Gap', 'Pengo')}: {Math.abs(data.totalAccountKg - data.totalCentreKg).toFixed(1)} kg</p>
            }
          </div>

          {data.days.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">🍃</p>
              <p>{t('No SMS data for this month yet.', 'Hakuna data ya SMS kwa mwezi huu bado.')}</p>
            </div>
          ) : (
            <>
              {/* Per-day cards */}
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                {t('Daily breakdown', 'Muhtasari wa kila siku')}
              </h2>
              {data.days.map(day => (
                <DayCard key={day.smsRecordId} day={day} t={t} />
              ))}

              {/* Casual & Float section */}
              <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3 mt-6">
                {t('Casual & Float', 'Casual na Float')}
              </h2>
              <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-500">{t('Total casual picked', 'Jumla ya Casual')}</span>
                  <span className="font-semibold">{data.totalCasualKg.toFixed(1)} kg</span>
                </div>
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-gray-500">{t('Total casual pay', 'Jumla Malipo Casual')}</span>
                  <span className="font-semibold">KES {data.totalCasualPayKes.toLocaleString()}</span>
                </div>

                {/* Float balance */}
                <div className={`rounded-xl p-3 mb-4 ${(data.currentFloatBalance ?? 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    {t('Current Float Balance (from SMS)', 'Salio la Float Sasa (kutoka SMS)')}
                  </p>
                  <p className={`text-2xl font-bold ${(data.currentFloatBalance ?? 0) >= 0 ? 'text-green-800' : 'text-red-700'}`}>
                    KES {(data.currentFloatBalance ?? 0).toLocaleString()}
                  </p>
                  {(data.currentFloatBalance ?? 0) < 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      {t('Supervisor overspent — needs top-up', 'Msimamizi amezidi — anahitaji nyongeza')}
                    </p>
                  )}
                </div>

                {/* Top-up total */}
                <div className="flex justify-between text-sm mb-4">
                  <span className="text-gray-500">{t('Top-ups given this month', 'Nyongeza zilizotolewa mwezi huu')}</span>
                  <span className="font-semibold text-green-700">KES {data.totalFloatTopups.toLocaleString()}</span>
                </div>

                {/* Top-up list */}
                {data.floatTopups.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {data.floatTopups.map(tu => (
                      <div key={tu.id} className="flex justify-between items-center text-sm bg-gray-50 rounded-xl px-3 py-2">
                        <div>
                          <p className="font-medium text-gray-800">KES {Number(tu.amountKes).toLocaleString()}</p>
                          {tu.note && <p className="text-xs text-gray-500">{tu.note}</p>}
                        </div>
                        <p className="text-xs text-gray-400">{tu.topupDate}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add top-up */}
                {!showTopUpForm ? (
                  <button
                    onClick={() => setShowTopUpForm(true)}
                    className="w-full border-2 border-dashed border-green-300 text-green-700 rounded-2xl py-3 text-sm font-semibold hover:bg-green-50"
                  >
                    + {t('Record Float Top-up', 'Rekodi Nyongeza ya Float')}
                  </button>
                ) : (
                  <AddTopUpForm
                    year={year} month={month}
                    onSaved={() => { setShowTopUpForm(false); fetchData(year, month) }}
                    onCancel={() => setShowTopUpForm(false)}
                    t={t}
                  />
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
