import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../store/langStore'
import { FarmMap } from '../../components/FarmMap'
import 'leaflet/dist/leaflet.css'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

interface Plot {
  id: string
  canonicalName: string
  plotType: string
  currentCrop: string | null
  areaHa: number | null
  notes: string | null
  lat: number | null
  lng: number | null
  latestLogDate: string | null
  latestLogBody: string | null
  mediaCount: number
}

const TYPE_CONFIG: Record<string, { color: string; bg: string; icon: string }> = {
  tea:     { color: 'text-green-800',  bg: 'bg-green-50  border-green-200',  icon: '🍃' },
  crop:    { color: 'text-amber-800',  bg: 'bg-amber-50  border-amber-200',  icon: '🌾' },
  pasture: { color: 'text-lime-800',   bg: 'bg-lime-50   border-lime-200',   icon: '🐄' },
  other:   { color: 'text-gray-700',   bg: 'bg-gray-50   border-gray-200',   icon: '📍' },
}

function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  return `${d}d ago`
}

export function FarmMapPage() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [plots, setPlots]   = useState<Plot[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'list' | 'map'>('list')

  useEffect(() => {
    fetch(`${API}/api/plots`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setPlots).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const groups = plots.reduce<Record<string, Plot[]>>((acc, p) => {
    const key = p.plotType ?? 'other';
    (acc[key] ??= []).push(p)
    return acc
  }, {})

  const typeOrder = ['tea', 'crop', 'pasture', 'other']
  const sortedGroups = typeOrder.filter(k => groups[k])

  const groupLabel: Record<string, [string, string]> = {
    tea:     ['Tea Zone', 'Eneo la Chai'],
    crop:    ['Crop Plots', 'Mashamba ya Mazao'],
    pasture: ['Pasture', 'Malisho'],
    other:   ['Other Areas', 'Maeneo Mengine'],
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200 bg-white">
        <button onClick={() => setTab('list')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'list' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500'}`}>
          ☰ {t('List', 'Orodha')}
        </button>
        <button onClick={() => setTab('map')}
          className={`flex-1 py-3 text-sm font-semibold transition-colors ${tab === 'map' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-500'}`}>
          🗺️ {t('Map', 'Ramani')}
        </button>
      </div>

      {/* Map view */}
      {tab === 'map' && (
        <div className="flex-1 p-3">
          <div className="h-full min-h-[60vh]">
            {!loading && (
              <FarmMap
                plots={plots}
                onPlotClick={id => navigate(`/manager/shamba/${id}`)}
              />
            )}
          </div>
          {plots.filter(p => !p.lat).length > 0 && (
            <p className="text-xs text-gray-400 text-center mt-2">
              {t('Some sections have no GPS pin yet — ask the owner to set them.', 'Baadhi ya sehemu hazina GPS — mwambie mwenye shamba aziweke.')}
            </p>
          )}
        </div>
      )}

      {/* List view */}
      {tab === 'list' && (
        <div className="flex-1 overflow-y-auto p-4 pb-8 space-y-5">
          <p className="text-xs text-gray-400 pt-1">{t('Tap a section to add notes or photos', 'Gusa sehemu kuongeza maelezo au picha')}</p>

          {loading && <p className="text-sm text-gray-400 text-center py-8">{t('Loading…', 'Inapakia…')}</p>}

          {sortedGroups.map(type => {
            const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.other
            return (
              <div key={type}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  {cfg.icon} {t(groupLabel[type][0], groupLabel[type][1])}
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {groups[type].map(plot => (
                    <button key={plot.id}
                      onClick={() => navigate(`/manager/shamba/${plot.id}`)}
                      className={`rounded-2xl border p-4 text-left active:scale-95 transition-transform ${cfg.bg}`}
                    >
                      <p className={`font-bold text-sm mb-1 ${cfg.color}`}>{plot.canonicalName}</p>
                      {plot.currentCrop && <p className="text-xs text-gray-600 mb-1">🌱 {plot.currentCrop}</p>}
                      {plot.areaHa && <p className="text-xs text-gray-500">{plot.areaHa} ha</p>}
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        {plot.lat && <span className="text-xs text-blue-400">📍</span>}
                        {plot.latestLogDate && <span className="text-xs text-gray-400">{daysAgo(plot.latestLogDate)}</span>}
                        {plot.mediaCount > 0 && <span className="text-xs text-gray-400">📷 {plot.mediaCount}</span>}
                        {!plot.latestLogDate && <span className="text-xs text-gray-300">{t('No entries', 'Hakuna')}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )
          })}

          {!loading && plots.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">{t('No farm sections found.', 'Hakuna sehemu za shamba.')}</p>
          )}
        </div>
      )}
    </div>
  )
}
