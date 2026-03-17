import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../../store/langStore'
import { compressImage } from '../../utils/imageUtils'
import { FarmMap } from '../../components/FarmMap'
import 'leaflet/dist/leaflet.css'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

// ─── Types ────────────────────────────────────────────────────────────────────

interface Plot {
  id: string
  canonicalName: string
  plotType: string
  areaHa: number | null
  currentCrop: string | null
  notes: string | null
  lat: number | null
  lng: number | null
  active: boolean
  latestLogDate: string | null
  latestLogBody: string | null
  mediaCount: number
}

interface LogEntry {
  id: string; logDate: string; category: string; title: string | null; body: string; createdBy: string | null
}
interface MediaItem {
  id: string; logId: string | null; note: string | null; createdAt: string
}
interface ActivityRecord { date: string; daysAgo: number; notes: string | null }
interface CropGroup {
  crop: string
  totalAreaHa: number
  plots: {
    id: string
    canonicalName: string
    areaHa: number | null
    activity: Record<string, ActivityRecord | null>
  }[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLOT_TYPES = [
  { key: 'tea',     label: 'Tea',     sw: 'Chai',    icon: '🍃', color: 'bg-green-50 border-green-300 text-green-800' },
  { key: 'crop',    label: 'Crop',    sw: 'Mazao',   icon: '🌾', color: 'bg-amber-50 border-amber-300 text-amber-800' },
  { key: 'pasture', label: 'Pasture', sw: 'Malisho', icon: '🐄', color: 'bg-lime-50 border-lime-300 text-lime-800' },
  { key: 'other',   label: 'Other',   sw: 'Nyingine', icon: '📍', color: 'bg-gray-50 border-gray-300 text-gray-700' },
]

const TYPE_COLOR: Record<string, string> = {
  tea:     'bg-green-50 border-green-200',
  crop:    'bg-amber-50 border-amber-200',
  pasture: 'bg-lime-50 border-lime-200',
  other:   'bg-gray-50 border-gray-200',
}
const TYPE_ICON: Record<string, string> = { tea: '🍃', crop: '🌾', pasture: '🐄', other: '📍' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}
function daysAgo(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (d === 0) return 'today'; if (d === 1) return 'yesterday'; return `${d}d ago`
}

// ─── Activity types ───────────────────────────────────────────────────────────

const ACTIVITY_TYPES = [
  { key: 'planting',    icon: '🌱', en: 'Planted',    sw: 'Kupanda'   },
  { key: 'weeding',     icon: '🌿', en: 'Weeded',     sw: 'Kupalilia' },
  { key: 'fertilizing', icon: '💧', en: 'Fertilized', sw: 'Mbolea'    },
  { key: 'spraying',    icon: '🧪', en: 'Sprayed',    sw: 'Kupulizia' },
  { key: 'tilling',     icon: '🚜', en: 'Tilled',     sw: 'Kulima'    },
  { key: 'harvesting',  icon: '🌾', en: 'Harvested',  sw: 'Kuvuna'    },
]

function urgencyColor(daysAgo: number, type: string) {
  const thresholds: Record<string, [number, number]> = {
    weeding:     [14, 28],
    fertilizing: [30, 60],
    spraying:    [21, 42],
  }
  const t = thresholds[type]
  if (!t) return 'text-gray-600'
  if (daysAgo <= t[0]) return 'text-green-600'
  if (daysAgo <= t[1]) return 'text-amber-600'
  return 'text-red-600'
}

// ─── ActivityLogForm ──────────────────────────────────────────────────────────

function ActivityLogForm({
  plotId, currentCrop, onSaved, onCancel
}: {
  plotId: string; currentCrop?: string | null
  onSaved: () => void; onCancel: () => void
}) {
  const { t, lang } = useLang()
  const today = new Date().toISOString().split('T')[0]
  const [actType, setActType]   = useState('weeding')
  const [actDate, setActDate]   = useState(today)
  const [crop, setCrop]         = useState(currentCrop ?? '')
  const [notes, setNotes]       = useState('')
  const [labourDays, setLabour] = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState('')

  async function save() {
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/plots/${plotId}/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          activityDate: actDate,
          activityType: actType,
          crop:         crop.trim() || undefined,
          notes:        notes.trim() || undefined,
          labourDays:   labourDays ? Number(labourDays) : undefined,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved()
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  const isPlanting = actType === 'planting'

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <h3 className="font-bold text-gray-800 text-sm">{t('Log Activity', 'Rekodi Shughuli')}</h3>

      {/* Activity type selector */}
      <div className="grid grid-cols-3 gap-2">
        {ACTIVITY_TYPES.map(a => (
          <button key={a.key} type="button" onClick={() => setActType(a.key)}
            className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-xs font-semibold transition-colors ${
              actType === a.key
                ? 'border-green-600 bg-green-50 text-green-700'
                : 'border-gray-200 bg-white text-gray-500'
            }`}
          >
            <span className="text-lg">{a.icon}</span>
            {lang === 'en' ? a.en : a.sw}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500">{t('Date', 'Tarehe')}</label>
          <input type="date" value={actDate} onChange={e => setActDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs text-gray-500">{t('Labour days', 'Siku za kazi')}</label>
          <input type="number" min="0" step="0.5" value={labourDays}
            onChange={e => setLabour(e.target.value)} placeholder="e.g. 2"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-1" />
        </div>
      </div>

      {isPlanting && (
        <div>
          <label className="text-xs text-gray-500">{t('Crop being planted', 'Zao linalopandwa')}</label>
          <input type="text" value={crop} onChange={e => setCrop(e.target.value)}
            placeholder="e.g. Potatoes, Maize, Cabbage"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-1" />
          <p className="text-xs text-gray-400 mt-1">
            {t('This will update the section\'s current crop.', 'Hii itabadilisha zao la sasa la sehemu hii.')}
          </p>
        </div>
      )}

      <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
        placeholder={t('Notes (optional)', 'Maelezo (si lazima)')}
        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-green-700 text-white font-bold py-2.5 rounded-xl disabled:opacity-40">
          {saving ? '…' : t('Save', 'Hifadhi')}
        </button>
        <button onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-600 font-semibold py-2.5 rounded-xl">
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </div>
  )
}

// ─── CropSummaryTab ───────────────────────────────────────────────────────────

function CropSummaryTab() {
  const { t } = useLang()
  const navigate = useNavigate()
  const [groups, setGroups]         = useState<CropGroup[]>([])
  const [loading, setLoading]       = useState(true)
  const [selected, setSelected]     = useState<string | null>(null)

  useEffect(() => {
    fetch(`${API}/api/plots/crops`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setGroups).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const displayed = selected ? groups.filter(g => g.crop === selected) : groups

  if (loading) return <p className="text-center text-gray-400 py-8">{t('Loading…', 'Inapakia…')}</p>

  if (groups.length === 0) return (
    <div className="text-center py-12 text-gray-400">
      <p className="text-3xl mb-2">🌱</p>
      <p>{t('No crops recorded yet.', 'Hakuna mazao bado.')}</p>
      <p className="text-xs mt-1">{t('Set the "Current Crop" on any section to see it here.', 'Weka "Zao la Sasa" kwenye sehemu yoyote.')}</p>
    </div>
  )

  return (
    <div className="space-y-5">
      {/* Crop filter pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelected(null)}
          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
            !selected ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-300'
          }`}
        >
          {t('All crops', 'Mazao yote')}
        </button>
        {groups.map(g => (
          <button key={g.crop}
            onClick={() => setSelected(s => s === g.crop ? null : g.crop)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              selected === g.crop ? 'bg-green-700 text-white border-green-700' : 'bg-white text-gray-600 border-gray-300'
            }`}
          >
            {g.crop} ({g.plots.length})
          </button>
        ))}
      </div>

      {/* Groups */}
      {displayed.map(group => (
        <div key={group.crop} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {/* Crop header */}
          <div className="bg-amber-50 px-4 py-3 border-b border-amber-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="font-bold text-amber-900">🌱 {group.crop}</p>
                <p className="text-xs text-amber-700">
                  {group.plots.length} {t('section(s)', 'sehemu')}
                  {group.totalAreaHa > 0 ? ` · ${group.totalAreaHa} ha` : ''}
                </p>
              </div>
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-5 gap-1 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs text-gray-400 font-semibold">
            <div className="col-span-2">{t('Section', 'Sehemu')}</div>
            <div className="text-center">🌱</div>
            <div className="text-center">🌿</div>
            <div className="text-center">💧</div>
          </div>

          {/* Plot rows */}
          {group.plots.map(plot => {
            const planting    = plot.activity['planting']
            const weeding     = plot.activity['weeding']
            const fertilizing = plot.activity['fertilizing']

            return (
              <button key={plot.id}
                onClick={() => navigate(`/owner/shamba/${plot.id}`)}
                className="grid grid-cols-5 gap-1 px-4 py-3 border-b border-gray-50 last:border-0 w-full text-left hover:bg-gray-50 active:bg-gray-100 transition-colors"
              >
                {/* Name */}
                <div className="col-span-2">
                  <p className="text-sm font-semibold text-gray-800">{plot.canonicalName}</p>
                  {plot.areaHa && <p className="text-xs text-gray-400">{plot.areaHa} ha</p>}
                </div>

                {/* Planted */}
                <div className="text-center">
                  {planting ? (
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{planting.daysAgo}d</p>
                      <p className="text-xs text-gray-400">{t('ago', 'iliyopita')}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-300">—</p>
                  )}
                </div>

                {/* Weeding */}
                <div className="text-center">
                  {weeding ? (
                    <p className={`text-xs font-semibold ${urgencyColor(weeding.daysAgo, 'weeding')}`}>
                      {weeding.daysAgo}d
                    </p>
                  ) : (
                    <p className="text-xs text-gray-300">—</p>
                  )}
                </div>

                {/* Fertilizing */}
                <div className="text-center">
                  {fertilizing ? (
                    <p className={`text-xs font-semibold ${urgencyColor(fertilizing.daysAgo, 'fertilizing')}`}>
                      {fertilizing.daysAgo}d
                    </p>
                  ) : (
                    <p className="text-xs text-gray-300">—</p>
                  )}
                </div>
              </button>
            )
          })}

          {/* Legend */}
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex gap-4 text-xs text-gray-400">
            <span>🌱 {t('Age', 'Umri')}</span>
            <span>🌿 {t('Weeding', 'Palizi')}</span>
            <span>💧 {t('Fertilizer', 'Mbolea')}</span>
            <span className="ml-auto">
              <span className="text-green-600">● </span>{t('ok', 'sawa')}
              <span className="text-amber-600 ml-2">● </span>{t('due', 'imefika')}
              <span className="text-red-600 ml-2">● </span>{t('overdue', 'imechelewa')}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── PlotForm (create + edit) ─────────────────────────────────────────────────

function PlotForm({
  initial, onSaved, onCancel,
}: {
  initial?: Partial<Plot>
  onSaved: (plot: Plot) => void
  onCancel: () => void
}) {
  const { t } = useLang()
  const isEdit = !!initial?.id

  const [name, setName]           = useState(initial?.canonicalName ?? '')
  const [plotType, setPlotType]   = useState(initial?.plotType ?? 'crop')
  const [areaHa, setAreaHa]       = useState(initial?.areaHa?.toString() ?? '')
  const [currentCrop, setCrop]    = useState(initial?.currentCrop ?? '')
  const [notes, setNotes]         = useState(initial?.notes ?? '')
  const [lat, setLat]             = useState(initial?.lat?.toString() ?? '')
  const [lng, setLng]             = useState(initial?.lng?.toString() ?? '')
  const [pickingGps, setPickingGps] = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  async function save() {
    if (!name.trim()) { setError(t('Name is required', 'Jina linahitajika')); return }
    setSaving(true); setError('')
    try {
      const url    = isEdit ? `${API}/api/plots/${initial!.id}` : `${API}/api/plots`
      const method = isEdit ? 'PATCH' : 'POST'
      const r = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          canonicalName: name.trim(),
          plotType,
          areaHa:      areaHa ? Number(areaHa) : null,
          currentCrop: currentCrop.trim() || null,
          notes:       notes.trim() || null,
          lat:         lat ? Number(lat) : null,
          lng:         lng ? Number(lng) : null,
        }),
      })
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Failed')
      onSaved(await r.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Failed to save', 'Imeshindwa kuhifadhi'))
    } finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-4">
      <h2 className="font-bold text-gray-800">
        {isEdit ? t('Edit Plot', 'Hariri Shamba') : t('Add New Plot / Section', 'Ongeza Sehemu Mpya')}
      </h2>

      {/* Name */}
      <div>
        <label className="text-xs text-gray-500 font-semibold">{t('Section Name *', 'Jina la Sehemu *')}</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="e.g. Tea Zone A, I-Plot 3, Demo Farm"
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-1" />
      </div>

      {/* Type */}
      <div>
        <label className="text-xs text-gray-500 font-semibold">{t('Type', 'Aina')}</label>
        <div className="grid grid-cols-4 gap-2 mt-1">
          {PLOT_TYPES.map(pt => (
            <button key={pt.key} type="button"
              onClick={() => setPlotType(pt.key)}
              className={`flex flex-col items-center gap-1 py-2 rounded-xl border-2 text-xs font-semibold transition-colors ${
                plotType === pt.key ? pt.color + ' border-2' : 'border-gray-200 bg-white text-gray-500'
              }`}
            >
              <span className="text-xl">{pt.icon}</span>
              {t(pt.label, pt.sw)}
            </button>
          ))}
        </div>
      </div>

      {/* Area + Crop */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-500 font-semibold">{t('Area (hectares)', 'Eneo (hekta)')}</label>
          <input type="number" step="0.01" min="0" value={areaHa}
            onChange={e => setAreaHa(e.target.value)} placeholder="e.g. 0.5"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-1" />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-semibold">{t('Current Crop', 'Zao la Sasa')}</label>
          <input type="text" value={currentCrop} onChange={e => setCrop(e.target.value)}
            placeholder="e.g. Cabbage"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-1" />
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="text-xs text-gray-500 font-semibold">{t('Notes / Description', 'Maelezo')}</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
          placeholder={t('Location, soil type, any relevant context…', 'Mahali, aina ya udongo, maelezo muhimu…')}
          className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-1 resize-none" />
      </div>

      {/* GPS coordinates */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs text-gray-500 font-semibold">{t('GPS Pin', 'Mahali GPS')}</label>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => {
                navigator.geolocation?.getCurrentPosition(pos => {
                  setLat(pos.coords.latitude.toFixed(6))
                  setLng(pos.coords.longitude.toFixed(6))
                }, () => setError(t('Location unavailable', 'Mahali hapatokani')))
              }}
              className="text-xs text-blue-600 font-semibold"
            >
              📍 {t('Use my location', 'Tumia mahali pangu')}
            </button>
            <button type="button"
              onClick={() => setPickingGps(s => !s)}
              className="text-xs text-green-700 font-semibold"
            >
              🗺️ {pickingGps ? t('Done picking', 'Imekamilika') : t('Pick on map', 'Chagua kwenye ramani')}
            </button>
          </div>
        </div>

        {pickingGps && (
          <div className="h-48 mb-2 rounded-xl overflow-hidden border border-gray-200">
            <FarmMap
              plots={lat && lng ? [{ id: 'preview', canonicalName: name || '?', plotType, lat: Number(lat), lng: Number(lng) }] : []}
              editingPlotId="new"
              onLocationPicked={(la, lo) => { setLat(la.toFixed(6)); setLng(lo.toFixed(6)) }}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)}
            placeholder="Latitude (e.g. -0.530)"
            className="border border-gray-300 rounded-xl px-3 py-2 text-xs" />
          <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)}
            placeholder="Longitude (e.g. 37.450)"
            className="border border-gray-300 rounded-xl px-3 py-2 text-xs" />
        </div>
        {lat && lng && (
          <p className="text-xs text-green-600 mt-1">📍 {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}</p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !name.trim()}
          className="flex-1 bg-green-700 text-white font-bold py-3 rounded-xl disabled:opacity-40">
          {saving ? '…' : t('Save', 'Hifadhi')}
        </button>
        <button onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-600 font-semibold py-3 rounded-xl">
          {t('Cancel', 'Ghairi')}
        </button>
      </div>
    </div>
  )
}

// ─── PhotoThumb (lazy load) ───────────────────────────────────────────────────

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
        className="w-20 h-20 object-cover rounded-xl cursor-pointer" />
      {open && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}>
          <img src={src} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </>
  )
}

// ─── OwnerPlotDetailPage ──────────────────────────────────────────────────────

export function OwnerPlotDetailPage() {
  const { plotId } = useParams<{ plotId: string }>()
  const navigate   = useNavigate()
  const { t }      = useLang()
  const fileRef    = useRef<HTMLInputElement>(null)

  const [data, setData]       = useState<{ plot: Plot; logs: LogEntry[]; media: MediaItem[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)

  // Form toggles
  const [showActivity, setShowActivity] = useState(false)
  // Add note form
  const [showAdd, setShowAdd] = useState(false)
  const today = new Date().toISOString().split('T')[0]
  const [logDate, setLogDate] = useState(today)
  const [body, setBody]       = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [formErr, setFormErr] = useState('')

  function load() {
    setLoading(true)
    fetch(`${API}/api/plots/${plotId}/entries`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setData).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { if (plotId) load() }, [plotId])

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    if (file.type.startsWith('video/')) { setFormErr(t('Video upload coming soon', 'Kupakia video kunakuja hivi karibuni')); return }
    try { setPreview(await compressImage(file)) } catch { setFormErr(t('Image error', 'Hitilafu ya picha')) }
  }

  async function saveNote() {
    if (!body.trim()) return
    setSaving(true); setFormErr('')
    try {
      const r = await fetch(`${API}/api/plots/${plotId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ logDate, category: 'general', body: body.trim(), imageDataUrl: preview ?? undefined, createdBy: 'owner' }),
      })
      if (!r.ok) throw new Error('Failed')
      setBody(''); setPreview(null); setShowAdd(false)
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch { setFormErr(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  async function archivePlot() {
    if (!confirm(t('Archive this plot? It will be hidden from the map.', 'Hifadhi sehemu hii? Itafichwa kwenye ramani.'))) return
    setArchiving(true)
    await fetch(`${API}/api/plots/${plotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({ active: false }),
    }).catch(() => {})
    navigate(-1)
  }

  if (loading) return <div className="p-6 text-center text-gray-400">{t('Loading…', 'Inapakia…')}</div>
  if (!data)   return <div className="p-6 text-center text-gray-400">{t('Not found', 'Haikupatikana')}</div>

  const { plot, logs, media } = data
  const mediaByLog = media.reduce<Record<string, MediaItem[]>>((acc, m) => {
    if (m.logId) (acc[m.logId] ??= []).push(m); return acc
  }, {})

  if (editing) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <div className="flex items-center gap-3 pt-1 mb-4">
          <button onClick={() => setEditing(false)} className="text-green-700 text-2xl">←</button>
          <h1 className="text-xl font-bold text-green-800">{t('Edit Plot', 'Hariri Sehemu')}</h1>
        </div>
        <PlotForm
          initial={plot}
          onSaved={updated => { setData(d => d ? { ...d, plot: updated as unknown as Plot } : d); setEditing(false) }}
          onCancel={() => setEditing(false)}
        />
      </div>
    )
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3 pt-1">
        <button onClick={() => navigate(-1)} className="text-green-700 text-2xl mt-0.5">←</button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-green-800">{plot.canonicalName}</h1>
          <p className="text-xs text-gray-400 capitalize">
            {TYPE_ICON[plot.plotType] ?? '📍'} {plot.plotType}
            {plot.areaHa ? ` · ${plot.areaHa} ha` : ''}
            {plot.currentCrop ? ` · ${plot.currentCrop}` : ''}
          </p>
        </div>
        <button onClick={() => setEditing(true)}
          className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-xl font-semibold">
          {t('Edit', 'Hariri')}
        </button>
      </div>

      {plot.notes && (
        <p className="text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">{plot.notes}</p>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => { setShowAdd(s => !s); setShowActivity(false) }}
          className="bg-green-700 text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm">
          {showAdd ? t('Cancel', 'Ghairi') : `+ ${t('Add Note', 'Ongeza Maelezo')}`}
        </button>
        <button onClick={() => { setShowActivity(s => !s); setShowAdd(false) }}
          className="bg-amber-600 text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm">
          {showActivity ? t('Cancel', 'Ghairi') : `📋 ${t('Log Activity', 'Rekodi Shughuli')}`}
        </button>
      </div>

      {showActivity && (
        <ActivityLogForm
          plotId={plotId!}
          currentCrop={plot.currentCrop}
          onSaved={() => { setShowActivity(false); load() }}
          onCancel={() => setShowActivity(false)}
        />
      )}

      {showAdd && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={4}
            placeholder={t('What to note about this section?', 'Ni nini cha kuandika kuhusu sehemu hii?')}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />
          <input ref={fileRef} type="file" accept="image/*" capture="environment"
            className="hidden" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()}
            className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500">
            📷 {preview ? t('Replace photo', 'Badilisha picha') : t('Attach photo', 'Ambatanisha picha')}
          </button>
          {preview && <img src={preview} alt="" className="w-full max-h-40 object-cover rounded-xl" />}
          {formErr && <p className="text-xs text-red-600">{formErr}</p>}
          <button onClick={saveNote} disabled={saving || !body.trim()}
            className="w-full bg-green-700 text-white font-bold py-3 rounded-2xl disabled:opacity-40">
            {saving ? '…' : t('Save', 'Hifadhi')}
          </button>
        </div>
      )}

      {/* Entries from manager + owner */}
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
        {t('Activity Log', 'Kumbukumbu ya Shughuli')} ({logs.length})
      </p>

      {logs.length === 0 ? (
        <p className="text-sm text-gray-400">{t('No entries yet.', 'Hakuna maelezo bado.')}</p>
      ) : (
        <div className="space-y-3">
          {logs.map(log => {
            const logMedia = mediaByLog[log.id] ?? []
            return (
              <div key={log.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium capitalize">
                      {log.category}
                    </span>
                    {log.createdBy && (
                      <span className="text-xs text-gray-400">{log.createdBy}</span>
                    )}
                    {log.title && <span className="text-sm font-semibold text-gray-800">{log.title}</span>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{fmtDate(log.logDate)}</span>
                </div>
                <p className="text-sm text-gray-700">{log.body}</p>
                {logMedia.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {logMedia.map(m => <PhotoThumb key={m.id} plotId={plot.id} mediaId={m.id} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Archive */}
      <div className="pt-4 border-t border-gray-100">
        <button onClick={archivePlot} disabled={archiving}
          className="text-xs text-red-500 hover:text-red-700 font-semibold">
          {t('Archive this section (hide from map)', 'Hifadhi sehemu hii (ficha kwenye ramani)')}
        </button>
      </div>
    </div>
  )
}

// ─── OwnerFarmPage (list + create + by-crop tab) ─────────────────────────────

export function OwnerFarmPage() {
  const { t, lang } = useLang()
  const navigate    = useNavigate()

  const [tab, setTab]           = useState<'sections' | 'crops' | 'map'>('sections')
  const [plots, setPlots]       = useState<Plot[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)

  function load() {
    setLoading(true)
    fetch(`${API}/api/plots`, { headers: { Authorization: `Bearer ${token()}` } })
      .then(r => r.json()).then(setPlots).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // Group by plotType
  const groups = plots.reduce<Record<string, Plot[]>>((acc, p) => {
    (acc[p.plotType ?? 'other'] ??= []).push(p); return acc
  }, {})
  const typeOrder = ['tea', 'crop', 'pasture', 'other']

  const groupLabel: Record<string, [string, string]> = {
    tea:     ['Tea Zones', 'Maeneo ya Chai'],
    crop:    ['Crop Plots', 'Mashamba ya Mazao'],
    pasture: ['Pasture', 'Malisho'],
    other:   ['Other Areas', 'Maeneo Mengine'],
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-green-800">{t('Farm Map', 'Ramani ya Shamba')}</h1>
          <p className="text-xs text-gray-400">{plots.length} {t('sections', 'sehemu')}</p>
        </div>
        {tab === 'sections' && (
          <button onClick={() => setShowForm(s => !s)}
            className="text-sm bg-green-700 text-white px-4 py-2 rounded-xl font-semibold">
            {showForm ? t('Cancel', 'Ghairi') : `+ ${t('Add Section', 'Ongeza Sehemu')}`}
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex rounded-xl overflow-hidden border border-gray-200 mb-5">
        <button onClick={() => setTab('sections')}
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === 'sections' ? 'bg-green-700 text-white' : 'bg-white text-gray-500'}`}>
          ☰ {t('Sections', 'Sehemu')}
        </button>
        <button onClick={() => setTab('crops')}
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === 'crops' ? 'bg-green-700 text-white' : 'bg-white text-gray-500'}`}>
          🌱 {t('Crops', 'Mazao')}
        </button>
        <button onClick={() => setTab('map')}
          className={`flex-1 py-2 text-sm font-semibold transition-colors ${tab === 'map' ? 'bg-green-700 text-white' : 'bg-white text-gray-500'}`}>
          🗺️ {t('Map', 'Ramani')}
        </button>
      </div>

      {tab === 'crops' && <CropSummaryTab />}

      {tab === 'map' && (
        <div className="h-[65vh]">
          {!loading && (
            <FarmMap
              plots={plots}
              onPlotClick={id => navigate(`/owner/shamba/${id}`)}
            />
          )}
          <p className="text-xs text-gray-400 text-center mt-2">
            {t('Tap a pin to open the plot. Set GPS in the section editor.', 'Gusa pini kufungua sehemu. Weka GPS katika kihariri.')}
          </p>
        </div>
      )}

      {tab === 'sections' && (
        <>
          {showForm && (
            <div className="mb-6">
              <PlotForm
                onSaved={() => { setShowForm(false); load() }}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}

          {loading && <p className="text-center text-gray-400 py-8">{t('Loading…', 'Inapakia…')}</p>}

          {!loading && plots.length === 0 && !showForm && (
            <div className="text-center py-12">
              <p className="text-4xl mb-3">🗺️</p>
              <p className="text-gray-500 mb-2">{t('No farm sections yet.', 'Hakuna sehemu bado.')}</p>
              <p className="text-xs text-gray-400">{t('Tap "+ Add Section" to define your first plot.', 'Gusa "+ Ongeza Sehemu" kuanza.')}</p>
            </div>
          )}

          <div className="space-y-6">
            {typeOrder.filter(k => groups[k]).map(type => {
              const cfg = PLOT_TYPES.find(p => p.key === type)!
              return (
                <div key={type}>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    {cfg.icon} {lang === 'en' ? groupLabel[type][0] : groupLabel[type][1]}
                  </p>
                  <div className="grid grid-cols-1 gap-3">
                    {groups[type].map(plot => (
                      <button key={plot.id}
                        onClick={() => navigate(`/owner/shamba/${plot.id}`)}
                        className={`rounded-2xl border p-4 text-left w-full active:scale-95 transition-transform ${TYPE_COLOR[type] ?? 'bg-gray-50 border-gray-200'}`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-gray-800">{plot.canonicalName}</p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap text-xs text-gray-500">
                              {plot.areaHa      && <span>{plot.areaHa} ha</span>}
                              {plot.currentCrop && <span>🌱 {plot.currentCrop}</span>}
                              {plot.mediaCount > 0 && <span>📷 {plot.mediaCount}</span>}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            {plot.latestLogDate ? (
                              <p className="text-xs text-gray-400">{daysAgo(plot.latestLogDate)}</p>
                            ) : (
                              <p className="text-xs text-gray-300">{t('No entries', 'Hakuna')}</p>
                            )}
                            <span className="text-gray-400 text-lg">›</span>
                          </div>
                        </div>
                        {plot.latestLogBody && (
                          <p className="text-xs text-gray-500 mt-2 line-clamp-1">{plot.latestLogBody}</p>
                        )}
                        {plot.notes && !plot.latestLogBody && (
                          <p className="text-xs text-gray-400 mt-1 line-clamp-1 italic">{plot.notes}</p>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
