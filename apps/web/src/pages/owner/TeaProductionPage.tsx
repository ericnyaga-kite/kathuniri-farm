import { useState, useEffect } from 'react'
import { useLang } from '../../store/langStore'

interface AccountSummary {
  accountCode: string
  holderName: string
  bushesRegistered: number | null
  totalKg: number
  centres: string[]
  lastDeliveryDate: string
  kgPerBush: number | null
  source: {
    deliveryId: string
    type: 'sms' | 'manual' | 'corrected'
    rawSms: string | null
    receivedAt: string | null
    senderPhone: string | null
    corrected: boolean
  }
}

interface AreaTotal {
  centreName: string
  totalKg: number
  deliveryCount: number
}

interface ProductionSummary {
  year: number
  month: number
  accounts: AccountSummary[]
  areaTotals: AreaTotal[]
  grandTotalKg: number
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const MONTHS_EN = ['','January','February','March','April','May','June','July','August','September','October','November','December']
const MONTHS_SW = ['','Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba']

function SourceBadge({
  source,
  t,
}: {
  source: AccountSummary['source']
  t: (en: string, sw: string) => string
}) {
  const [expanded, setExpanded] = useState(false)

  const label =
    source.type === 'manual'    ? t('Manual entry', 'Ingizo la mkono') :
    source.type === 'corrected' ? t('Corrected SMS', 'SMS iliyorekebishwa') :
                                  t('From SMS', 'Kutoka SMS')

  const icon =
    source.type === 'manual'    ? '✏️' :
    source.type === 'corrected' ? '✅' : '📱'

  const time = source.receivedAt
    ? new Date(source.receivedAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="mt-2 border-t border-gray-100 pt-2">
      <button
        onClick={() => setExpanded(e => !e)}
        className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 w-full text-left"
      >
        <span>{icon}</span>
        <span>{label}{time ? ` · ${time}` : ''}</span>
        <span className="ml-auto">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && source.rawSms && (
        <p className="mt-2 text-xs font-mono bg-gray-50 rounded-lg p-2 text-gray-600 break-all">
          {source.rawSms}
        </p>
      )}
    </div>
  )
}

export function TeaProductionPage() {
  const { t, lang } = useLang()
  const now = new Date()
  const [year, setYear]   = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [data, setData]   = useState<ProductionSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthName = (lang === 'en' ? MONTHS_EN : MONTHS_SW)[month]

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`${API}/api/tea/production/summary?year=${year}&month=${month}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => setError(t('Network error', 'Hitilafu ya mtandao')))
      .finally(() => setLoading(false))
  }, [year, month])

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1
    if (isCurrentMonth) return
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-green-800 mb-1">
        {t('Tea Production', 'Uzalishaji wa Chai')}
      </h1>
      <p className="text-sm text-gray-500 mb-4">
        {t('By area & account — KTDA F064 Kathangariri', 'Kwa eneo na akaunti — KTDA F064 Kathangariri')}
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

      {loading && (
        <div className="text-center py-12 text-gray-400">{t('Loading...', 'Inapakia...')}</div>
      )}

      {error && (
        <div className="bg-red-50 text-red-600 rounded-2xl p-4 text-center">{error}</div>
      )}

      {data && !loading && (
        <>
          {/* Grand total banner */}
          <div className="bg-green-700 text-white rounded-2xl p-4 mb-5 text-center">
            <p className="text-sm opacity-80 mb-1">
              {t('Total', 'Jumla')} — {monthName} {year}
            </p>
            <p className="text-4xl font-bold">
              {data.grandTotalKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
            </p>
          </div>

          {data.accounts.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-3xl mb-2">🍃</p>
              <p>{t('No SMS data for this month yet.', 'Hakuna data ya SMS kwa mwezi huu bado.')}</p>
            </div>
          ) : (
            <>
              {/* Per-account breakdown */}
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                {t('By Account', 'Kwa Akaunti')}
              </h2>
              <div className="space-y-3 mb-6">
                {data.accounts.map(acct => (
                  <div key={acct.accountCode} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-800">{acct.holderName}</p>
                        <p className="text-xs text-gray-400">{acct.accountCode} · {acct.centres.join(', ')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-700">
                          {acct.totalKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                          <span className="text-sm font-normal text-gray-500 ml-1">kg</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm text-gray-500 border-t border-gray-100 pt-2">
                      {acct.bushesRegistered && (
                        <span>🌿 {acct.bushesRegistered.toLocaleString()} {t('bushes', 'vichaka')}</span>
                      )}
                      {acct.kgPerBush !== null && (
                        <span className="font-medium text-green-700">
                          {acct.kgPerBush.toFixed(3)} kg/{t('bush', 'kichaka')}
                        </span>
                      )}
                      <span className="ml-auto text-xs">
                        {t('Last', 'Mwisho')}: {acct.lastDeliveryDate}
                      </span>
                    </div>

                    {acct.source && <SourceBadge source={acct.source} t={t} />}
                  </div>
                ))}
              </div>

              {/* Area totals */}
              {data.areaTotals.length > 0 && (
                <>
                  <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    {t('By Area', 'Kwa Eneo')}
                  </h2>
                  <div className="space-y-2">
                    {data.areaTotals.map(area => (
                      <div key={area.centreName} className="bg-green-50 rounded-xl p-3 flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-green-900">{area.centreName}</p>
                          <p className="text-xs text-green-600">
                            {area.deliveryCount} {t('deliveries', 'usafirishaji')}
                          </p>
                        </div>
                        <p className="text-xl font-bold text-green-700">
                          {area.totalKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                        </p>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}
