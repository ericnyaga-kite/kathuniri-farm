import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

interface MediaMeta { id: string; logId: string; mimeType: string; note: string | null }
interface ReportEntry {
  id: string
  logDate: string
  category: string
  title: string | null
  body: string
  createdBy: string | null
  plot: { id: string; canonicalName: string; plotType: string } | null
  media: MediaMeta[]
}
interface DailyReport { date: string; entries: ReportEntry[] }

const CAT_ICON: Record<string, string> = {
  tea: '🍃', dairy: '🥛', crops: '🌾', rental: '🏠', staff: '👷', machinery: '⚙️', general: '📝',
}

function PhotoThumb({ plotId, mediaId }: { plotId: string; mediaId: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/plots/${plotId}/media/${mediaId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    }).then(r => r.json()).then(d => setSrc(d.dataUrl)).catch(() => {})
  }, [plotId, mediaId])

  if (!src) return <div className="w-20 h-20 rounded-xl bg-gray-100 animate-pulse" />
  return (
    <>
      <img src={src} alt="" onClick={() => setOpen(true)}
        className="w-20 h-20 object-cover rounded-xl cursor-pointer active:opacity-80" />
      {open && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}>
          <img src={src} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </>
  )
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export function DailyReportPage() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()

  const today = new Date().toISOString().split('T')[0]
  const date = params.get('date') ?? today

  const [report, setReport] = useState<DailyReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`${API}/api/reports/daily?date=${date}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json()).then(setReport).catch(() => {}).finally(() => setLoading(false))
  }, [date])

  function changeDate(delta: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setParams({ date: d.toISOString().split('T')[0] })
  }

  // Group entries by category
  const byCategory = (report?.entries ?? []).reduce<Record<string, ReportEntry[]>>((acc, e) => {
    (acc[e.category] ??= []).push(e); return acc
  }, {})
  const cats = Object.keys(byCategory).sort()

  const totalMedia = (report?.entries ?? []).reduce((s, e) => s + e.media.length, 0)

  return (
    <div className="p-4 max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1 mb-4">
        <button onClick={() => navigate(-1)} className="text-green-700 text-2xl">←</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-green-800">{t('Daily Report', 'Ripoti ya Siku')}</h1>
          {report && <p className="text-xs text-gray-400">{fmtDate(report.date)}</p>}
        </div>
      </div>

      {/* Date navigation */}
      <div className="flex items-center gap-2 mb-5">
        <button onClick={() => changeDate(-1)}
          className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 font-bold text-lg flex items-center justify-center active:bg-gray-200">
          ‹
        </button>
        <input type="date" value={date}
          onChange={e => setParams({ date: e.target.value })}
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm text-center" />
        <button onClick={() => changeDate(1)} disabled={date >= today}
          className="w-10 h-10 rounded-xl bg-gray-100 text-gray-600 font-bold text-lg flex items-center justify-center active:bg-gray-200 disabled:opacity-30">
          ›
        </button>
      </div>

      {loading && <p className="text-center text-gray-400 py-12">{t('Loading…', 'Inapakia…')}</p>}

      {!loading && report?.entries.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-semibold">{t('No entries for this date.', 'Hakuna maelezo kwa tarehe hii.')}</p>
          <p className="text-xs mt-1">{t('Use the arrows to navigate to another day.', 'Tumia mishale kwenda siku nyingine.')}</p>
        </div>
      )}

      {!loading && report && report.entries.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex gap-3 mb-5 text-center">
            <div className="flex-1 bg-green-50 rounded-2xl py-3">
              <p className="text-2xl font-bold text-green-800">{report.entries.length}</p>
              <p className="text-xs text-green-700">{t('entries', 'maelezo')}</p>
            </div>
            {totalMedia > 0 && (
              <div className="flex-1 bg-amber-50 rounded-2xl py-3">
                <p className="text-2xl font-bold text-amber-800">{totalMedia}</p>
                <p className="text-xs text-amber-700">{t('photos', 'picha')}</p>
              </div>
            )}
            <div className="flex-1 bg-gray-50 rounded-2xl py-3">
              <p className="text-2xl font-bold text-gray-700">{cats.length}</p>
              <p className="text-xs text-gray-500">{t('categories', 'vitengo')}</p>
            </div>
          </div>

          {/* Entries grouped by category */}
          <div className="space-y-5">
            {cats.map(cat => (
              <div key={cat}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {CAT_ICON[cat] ?? '📝'} {cat}
                </p>
                <div className="space-y-3">
                  {byCategory[cat].map(entry => (
                    <div key={entry.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                      {/* Plot + title row */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex flex-wrap gap-2 items-center">
                          {entry.plot && (
                            <button
                              onClick={() => navigate(`/owner/shamba/${entry.plot!.id}`)}
                              className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium"
                            >
                              {entry.plot.canonicalName}
                            </button>
                          )}
                          {entry.title && (
                            <span className="text-sm font-semibold text-gray-800">{entry.title}</span>
                          )}
                        </div>
                        <div className="shrink-0 text-right">
                          {entry.createdBy && (
                            <p className="text-xs text-gray-400">{entry.createdBy}</p>
                          )}
                        </div>
                      </div>

                      <p className="text-sm text-gray-700 leading-relaxed">{entry.body}</p>

                      {/* Photos */}
                      {entry.media.length > 0 && entry.plot && (
                        <div className="flex flex-wrap gap-2 mt-3">
                          {entry.media.map(m => (
                            <PhotoThumb key={m.id} plotId={entry.plot!.id} mediaId={m.id} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
