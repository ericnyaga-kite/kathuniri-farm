import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLang } from '../../store/langStore'
import { compressImage, base64SizeLabel } from '../../utils/imageUtils'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function token() { return localStorage.getItem('kf_token') ?? '' }

const ACTIVITY_TYPES = [
  { key: 'planting',    icon: '🌱', en: 'Planted',    sw: 'Kupanda'   },
  { key: 'weeding',     icon: '🌿', en: 'Weeded',     sw: 'Kupalilia' },
  { key: 'fertilizing', icon: '💧', en: 'Fertilized', sw: 'Mbolea'    },
  { key: 'spraying',    icon: '🧪', en: 'Sprayed',    sw: 'Kupulizia' },
  { key: 'tilling',     icon: '🚜', en: 'Tilled',     sw: 'Kulima'    },
  { key: 'harvesting',  icon: '🌾', en: 'Harvested',  sw: 'Kuvuna'    },
]

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
          crop:         actType === 'planting' ? (crop.trim() || undefined) : undefined,
          notes:        notes.trim() || undefined,
          labourDays:   labourDays ? Number(labourDays) : undefined,
        }),
      })
      if (!r.ok) throw new Error('Failed')
      onSaved()
    } catch { setError(t('Failed to save', 'Imeshindwa kuhifadhi')) }
    finally { setSaving(false) }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <h3 className="font-bold text-gray-800 text-sm">{t('Log Activity', 'Rekodi Shughuli')}</h3>

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

      {actType === 'planting' && (
        <div>
          <label className="text-xs text-gray-500">{t('Crop being planted', 'Zao linalopandwa')}</label>
          <input type="text" value={crop} onChange={e => setCrop(e.target.value)}
            placeholder="e.g. Potatoes, Maize"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm mt-1" />
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

interface Plot {
  id: string; canonicalName: string; plotType: string
  currentCrop: string | null; areaHa: number | null; notes: string | null
}
interface LogEntry {
  id: string; logDate: string; category: string; title: string | null; body: string
}
interface MediaItem {
  id: string; logId: string | null; mimeType: string; note: string | null; createdAt: string
}
interface PlotEntries { plot: Plot; logs: LogEntry[]; media: MediaItem[] }

const CATEGORIES = [
  { key: 'crops',     label: ['Crops', 'Mazao'] },
  { key: 'tea',       label: ['Tea', 'Chai'] },
  { key: 'machinery', label: ['Machinery', 'Mashine'] },
  { key: 'staff',     label: ['Staff', 'Wafanyakazi'] },
  { key: 'general',   label: ['General', 'Jumla'] },
]

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Lazily load a single photo from API
function PhotoThumb({ plotId, mediaId }: { plotId: string; mediaId: string }) {
  const [src, setSrc] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch(`${API}/api/plots/${plotId}/media/${mediaId}`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(d => setSrc(d.dataUrl))
      .catch(() => {})
  }, [plotId, mediaId])

  if (!src) return <div className="w-24 h-24 rounded-xl bg-gray-100 animate-pulse" />

  return (
    <>
      <img
        src={src} alt=""
        onClick={() => setOpen(true)}
        className="w-24 h-24 object-cover rounded-xl cursor-pointer active:scale-95 transition-transform"
      />
      {open && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <img src={src} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </>
  )
}

export function PlotDetailPage() {
  const { plotId } = useParams<{ plotId: string }>()
  const navigate   = useNavigate()
  const { t, lang } = useLang()

  const [data, setData]           = useState<PlotEntries | null>(null)
  const [loading, setLoading]     = useState(true)
  const [showForm, setShowForm]   = useState(false)
  const [showActivity, setShowActivity] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Form state
  const today = new Date().toISOString().split('T')[0]
  const [logDate, setLogDate]     = useState(today)
  const [category, setCategory]   = useState('crops')
  const [title, setTitle]         = useState('')
  const [body, setBody]           = useState('')
  const [preview, setPreview]     = useState<string | null>(null)
  const [imgSize, setImgSize]     = useState('')
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  function load() {
    setLoading(true)
    fetch(`${API}/api/plots/${plotId}/entries`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { if (plotId) load() }, [plotId])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.type.startsWith('video/')) {
      setError(t(
        'Video clips require cloud storage — not yet set up. Capture a photo instead.',
        'Video zinahitaji uhifadhi wa wingu — bado haijasanidiwa. Piga picha badala yake.'
      ))
      e.target.value = ''
      return
    }

    setError('')
    try {
      const compressed = await compressImage(file)
      setPreview(compressed)
      setImgSize(base64SizeLabel(compressed))
    } catch {
      setError(t('Could not process image', 'Imeshindwa kusindika picha'))
    }
  }

  async function save() {
    if (!body.trim()) {
      setError(t('Write something before saving.', 'Andika kitu kabla ya kuhifadhi.'))
      return
    }
    setSaving(true); setError('')
    try {
      const r = await fetch(`${API}/api/plots/${plotId}/entries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          logDate, category, title: title.trim() || undefined,
          body: body.trim(), imageDataUrl: preview ?? undefined,
          createdBy: 'manager',
        }),
      })
      if (!r.ok) {
        const err = await r.json().catch(() => ({}))
        throw new Error(err.error ?? 'Failed')
      }
      setShowForm(false)
      setBody(''); setTitle(''); setPreview(null); setImgSize('')
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('Failed to save', 'Imeshindwa kuhifadhi'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="p-6 text-center text-gray-400">{t('Loading…', 'Inapakia…')}</div>
  if (!data)   return <div className="p-6 text-center text-gray-400">{t('Not found', 'Haikupatikana')}</div>

  const { plot, logs, media } = data
  const mediaByLog = media.reduce<Record<string, MediaItem[]>>((acc, m) => {
    if (m.logId) (acc[m.logId] ??= []).push(m)
    return acc
  }, {})
  const unlinkedMedia = media.filter(m => !m.logId)

  return (
    <div className="p-4 pb-8 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pt-1">
        <button onClick={() => navigate(-1)} className="text-green-700 text-2xl">←</button>
        <div>
          <h1 className="text-xl font-bold text-green-800">{plot.canonicalName}</h1>
          <p className="text-xs text-gray-400 capitalize">
            {plot.plotType}{plot.areaHa ? ` · ${plot.areaHa} ha` : ''}
            {plot.currentCrop ? ` · ${plot.currentCrop}` : ''}
          </p>
        </div>
      </div>

      {plot.notes && (
        <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">{plot.notes}</p>
      )}

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => { setShowForm(s => !s); setShowActivity(false); setError('') }}
          className="bg-green-700 text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm"
        >
          {showForm ? t('Cancel', 'Ghairi') : `+ ${t('Add Note', 'Ongeza Maelezo')}`}
        </button>
        <button
          onClick={() => { setShowActivity(s => !s); setShowForm(false); setError('') }}
          className="bg-amber-600 text-white font-bold py-3 rounded-2xl active:scale-95 transition-transform text-sm"
        >
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

      {/* Entry form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500">{t('Date', 'Tarehe')}</label>
              <input type="date" value={logDate} onChange={e => setLogDate(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-500">{t('Category', 'Kitengo')}</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                {CATEGORIES.map(c => (
                  <option key={c.key} value={c.key}>{lang === 'en' ? c.label[0] : c.label[1]}</option>
                ))}
              </select>
            </div>
          </div>

          <input type="text"
            placeholder={t('Title (optional)', 'Kichwa (si lazima)')}
            value={title} onChange={e => setTitle(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />

          <textarea
            placeholder={t('What happened? What was done?', 'Nini kilitokea? Nini kilifanyika?')}
            value={body} onChange={e => setBody(e.target.value)}
            rows={4}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-none" />

          {/* Camera / file capture */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-500 flex items-center justify-center gap-2 active:bg-gray-50"
            >
              📷 {preview
                ? t(`Replace photo (${imgSize})`, `Badilisha picha (${imgSize})`)
                : t('Take photo or choose from gallery', 'Piga picha au chagua kutoka matunzio')}
            </button>

            {preview && (
              <div className="mt-2 relative">
                <img src={preview} alt="preview"
                  className="w-full max-h-48 object-cover rounded-xl" />
                <button
                  onClick={() => { setPreview(null); setImgSize(''); if (fileRef.current) fileRef.current.value = '' }}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full w-7 h-7 text-sm font-bold"
                >×</button>
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400">
            {t('Video clips: record on your phone then share the file — video upload coming soon.', 'Video: rekodi kwenye simu yako — kupakia video kunakuja hivi karibuni.')}
          </p>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <button onClick={save} disabled={saving || !body.trim()}
            className="w-full bg-green-700 text-white font-bold py-3 rounded-2xl disabled:opacity-40">
            {saving ? '…' : t('Save', 'Hifadhi')}
          </button>
        </div>
      )}

      {/* Entries */}
      {logs.length === 0 && unlinkedMedia.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          {t('No entries yet. Tap the button above to add one.', 'Hakuna maelezo bado. Gusa kitufe hapo juu kuongeza.')}
        </p>
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
                    {log.title && <span className="text-sm font-semibold text-gray-800">{log.title}</span>}
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{fmtDate(log.logDate)}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed">{log.body}</p>

                {logMedia.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {logMedia.map(m => (
                      <PhotoThumb key={m.id} plotId={plot.id} mediaId={m.id} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {unlinkedMedia.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <p className="text-xs font-semibold text-gray-500 mb-2">{t('Photos', 'Picha')}</p>
              <div className="flex flex-wrap gap-2">
                {unlinkedMedia.map(m => (
                  <PhotoThumb key={m.id} plotId={plot.id} mediaId={m.id} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
