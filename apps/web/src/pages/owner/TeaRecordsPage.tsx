import { useState, useEffect } from 'react'
import { useLang } from '../../store/langStore'

interface KtdaAccount {
  accountCode: string
  holderName: string
}

interface Delivery {
  id: string
  deliveryDate: string
  centreRawName: string | null
  centre: { canonicalName: string } | null
  cumulativeKg: number | null
  todayKg: number | null
  casualKg: number | null
  casualPayKes: number | null
  supervisorFloat: number | null
  parseConfidence: number | null
  allocations: Array<{ ktdaAccount: KtdaAccount | null; kgAllocated: number }>
}

interface SmsRecord {
  id: string
  receivedAt: string
  senderPhone: string
  rawSms: string
  parsed: boolean
  parseError: string | null
  deliveries: Delivery[]
}

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

const KNOWN_SECTORS = [
  'Mucucari A', 'Mucucari B',
  'Kathuniri A', 'Kathuniri B', 'Kathuniri C',
  'Shule', 'New Tea',
  'Mukinduriri A', 'Mukinduriri B',
  'Mutarakwe A', 'Mutarakwe B',
  'Kamwangi A', 'Kamwangi B',
]

function EditDeliveryModal({
  delivery,
  rawSms,
  onSave,
  onClose,
  t,
}: {
  delivery: Delivery
  rawSms: string
  onSave: (updated: Delivery) => void
  onClose: () => void
  t: (en: string, sw: string) => string
}) {
  const [form, setForm] = useState({
    deliveryDate:    delivery.deliveryDate?.split('T')[0] ?? '',
    cumulativeKg:    String(delivery.cumulativeKg ?? ''),
    todayKg:         String(delivery.todayKg ?? ''),
    casualKg:        String(delivery.casualKg ?? ''),
    casualPayKes:    String(delivery.casualPayKes ?? ''),
    supervisorFloat: String(delivery.supervisorFloat ?? ''),
    centreRawName:   delivery.centreRawName ?? '',
    correctionNote:  '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function field(key: string, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const body: Record<string, unknown> = { correctionNote: form.correctionNote }
      if (form.deliveryDate)    body.deliveryDate    = form.deliveryDate
      if (form.cumulativeKg)    body.cumulativeKg    = parseFloat(form.cumulativeKg)
      if (form.todayKg)         body.todayKg         = parseFloat(form.todayKg)
      if (form.casualKg)        body.casualKg        = parseFloat(form.casualKg)
      if (form.casualPayKes)    body.casualPayKes    = parseFloat(form.casualPayKes)
      if (form.supervisorFloat !== '') body.supervisorFloat = parseFloat(form.supervisorFloat)
      if (form.centreRawName)   body.centreRawName   = form.centreRawName

      const res = await fetch(`${API}/api/tea/sms/deliveries/${delivery.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      onSave(updated)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center">
          <h2 className="font-bold text-gray-800">{t('Correct Record', 'Rekebisha Rekodi')}</h2>
          <button onClick={onClose} className="text-gray-400 text-2xl leading-none">×</button>
        </div>

        {/* Raw SMS for reference */}
        <div className="mx-4 mt-4 bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-1">{t('Original SMS', 'SMS ya Awali')}</p>
          <p className="text-sm font-mono text-gray-700 break-all">{rawSms}</p>
        </div>

        <div className="p-4 space-y-3">
          {[
            { key: 'deliveryDate',    label: t('Date', 'Tarehe'),                   type: 'date' },
            { key: 'cumulativeKg',    label: t('Cumulative kg', 'Jumla ya kg'),      type: 'number' },
            { key: 'todayKg',         label: t("Today's kg", 'Kg za Leo'),           type: 'number' },
            { key: 'casualKg',        label: t('Casual kg', 'Kg za Casual'),         type: 'number' },
            { key: 'casualPayKes',    label: t('Casual pay (KES)', 'Malipo Casual'), type: 'number' },
            { key: 'supervisorFloat', label: t('Supervisor float (KES)', 'Float'),   type: 'number' },
          ].map(({ key, label, type }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 font-semibold block mb-1">{label}</label>
              <input
                type={type}
                value={(form as Record<string, string>)[key]}
                onChange={e => field(key, e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-base"
              />
            </div>
          ))}

          {/* Sector — dropdown so owner picks the correct sub-sector */}
          <div>
            <label className="text-xs text-gray-500 font-semibold block mb-1">
              {t('Sector', 'Sekta')}
              {!delivery.centre && (
                <span className="ml-2 text-amber-600 font-bold">⚠ {t('Unresolved — please select', 'Haijulikani — tafadhali chagua')}</span>
              )}
            </label>
            <select
              value={form.centreRawName}
              onChange={e => field('centreRawName', e.target.value)}
              className={`w-full border rounded-xl px-3 py-2 text-base bg-white ${
                !delivery.centre ? 'border-amber-400 ring-1 ring-amber-300' : 'border-gray-300'
              }`}
            >
              <option value="">{t('— Select sector —', '— Chagua sekta —')}</option>
              {KNOWN_SECTORS.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs text-gray-500 font-semibold block mb-1">
              {t('Reason for correction', 'Sababu ya marekebisho')}
            </label>
            <input
              type="text"
              placeholder={t('e.g. Cathy sent wrong kg', 'mfano: Cathy alituma kg mbaya')}
              value={form.correctionNote}
              onChange={e => field('correctionNote', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-base"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-green-700 text-white py-3 rounded-2xl font-bold text-base disabled:opacity-40"
          >
            {saving ? t('Saving...', 'Inahifadhi...') : t('Save Correction', 'Hifadhi Marekebisho')}
          </button>
        </div>
      </div>
    </div>
  )
}

interface HoldingRecord {
  id: string
  receivedAt: string
  senderPhone: string
  rawSms: string
  note: string | null
}

function HoldingTab({ t }: { t: (en: string, sw: string) => string }) {
  const [records, setRecords] = useState<HoldingRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/api/sms/holding`)
      .then(r => r.json())
      .then(setRecords)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-4 text-center text-gray-400">{t('Loading...', 'Inapakia...')}</div>

  if (records.length === 0) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p className="text-3xl mb-3">📭</p>
        <p className="text-sm">{t('No holding records yet.', 'Hakuna rekodi za kuhifadhi bado.')}</p>
        <p className="text-xs mt-2 text-gray-400">{t('SMS from unknown senders appear here.', 'SMS kutoka nambari zisizojulikana zitaonekana hapa.')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 p-4">
      {records.map(rec => (
        <div key={rec.id} className="bg-white rounded-2xl border border-amber-200 overflow-hidden">
          <div className="px-4 py-3 bg-amber-50">
            <p className="text-xs text-gray-400">{new Date(rec.receivedAt).toLocaleString()} · <span className="font-mono">{rec.senderPhone}</span></p>
            <p className="text-sm font-mono text-gray-700 mt-1 break-all">{rec.rawSms}</p>
          </div>
          <div className="px-4 py-2 text-xs text-amber-700 font-medium">
            {t('No parser configured for this sender', 'Hakuna parser kwa nambari hii')}
          </div>
        </div>
      ))}
    </div>
  )
}

export function TeaRecordsPage() {
  const { t } = useLang()
  const [tab, setTab] = useState<'tea' | 'holding'>('tea')
  const [records, setRecords] = useState<SmsRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<{ delivery: Delivery; rawSms: string } | null>(null)

  useEffect(() => {
    fetch(`${API}/api/tea/sms/records?limit=30`)
      .then(r => r.json())
      .then(setRecords)
      .finally(() => setLoading(false))
  }, [])

  function handleSaved(updated: Delivery) {
    setRecords(prev =>
      prev.map(rec => ({
        ...rec,
        deliveries: rec.deliveries.map(d => d.id === updated.id ? updated : d),
      }))
    )
    setEditing(null)
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-10">
        <button
          onClick={() => setTab('tea')}
          className={`flex-1 py-3 text-sm font-semibold ${tab === 'tea' ? 'text-green-700 border-b-2 border-green-700' : 'text-gray-400'}`}
        >
          {t('Tea SMS', 'SMS ya Chai')}
        </button>
        <button
          onClick={() => setTab('holding')}
          className={`flex-1 py-3 text-sm font-semibold ${tab === 'holding' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-gray-400'}`}
        >
          {t('Holding', 'Kuhifadhi')}
        </button>
      </div>

      {tab === 'holding' && <HoldingTab t={t} />}

      {tab === 'tea' && (
      <div className="p-4">
      <p className="text-sm text-gray-500 mb-5">{t('Tap any record to correct it.', 'Gonga rekodi yoyote kuirekebisha.')}</p>

      {loading && <div className="text-center text-gray-400 py-8">{t('Loading...', 'Inapakia...')}</div>}
      {!loading && records.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">📱</p>
          <p>{t('No SMS records yet.', 'Hakuna rekodi za SMS bado.')}</p>
        </div>
      )}

      <div className="space-y-4">
        {records.map(rec => (
          <div key={rec.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
            {/* SMS header */}
            <div className="px-4 py-3 bg-gray-50 flex justify-between items-start">
              <div>
                <p className="text-xs text-gray-400">
                  {new Date(rec.receivedAt).toLocaleString()} · {rec.senderPhone}
                </p>
                <p className="text-sm font-mono text-gray-600 mt-1 break-all">{rec.rawSms}</p>
              </div>
              <span className={`ml-3 shrink-0 text-xs font-semibold px-2 py-1 rounded-full ${
                rec.parsed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
              }`}>
                {rec.parsed ? t('Parsed', 'Imesomwa') : t('Failed', 'Imeshindwa')}
              </span>
            </div>

            {/* Parse error */}
            {rec.parseError && (
              <div className="px-4 py-2 bg-red-50 text-red-600 text-xs">{rec.parseError}</div>
            )}

            {/* Parsed deliveries */}
            {rec.deliveries.length > 0 ? (
              rec.deliveries.map(d => (
                <button
                  key={d.id}
                  onClick={() => setEditing({ delivery: d, rawSms: rec.rawSms })}
                  className="w-full text-left px-4 py-3 border-t border-gray-100 hover:bg-green-50 transition-colors"
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-gray-800">
                      {d.allocations[0]?.ktdaAccount?.holderName ?? d.centreRawName ?? '—'}
                    </span>
                    <span className="text-green-700 font-bold">
                      {Number(d.cumulativeKg ?? 0).toFixed(1)} kg
                    </span>
                  </div>
                  <div className="flex gap-3 text-xs text-gray-500">
                    <span>{d.centre?.canonicalName ?? d.centreRawName}</span>
                    <span>{t('Casual', 'Casual')}: {Number(d.casualKg ?? 0).toFixed(1)} kg</span>
                    <span>{t('Float', 'Float')}: KES {Number(d.supervisorFloat ?? 0).toLocaleString()}</span>
                    {d.parseConfidence === 1.0 && (
                      <span className="text-blue-500 ml-auto">{t('Corrected', 'Imerekebishwa')}</span>
                    )}
                  </div>
                  {!d.centre && !d.centreRawName?.includes(',') && (
                    <p className="text-xs text-amber-600 font-semibold mt-1">
                      ⚠ {t('Sector unresolved — tap to fix', 'Sekta haijulikani — gonga kurekebisha')}
                    </p>
                  )}
                  {d.centre && (
                    <p className="text-xs text-green-600 mt-1">{t('Tap to edit →', 'Gonga kuhariri →')}</p>
                  )}
                </button>
              ))
            ) : (
              <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-400">
                {t('No parsed data — record failed to parse.', 'Hakuna data — imeshindwa kusomwa.')}
              </div>
            )}
          </div>
        ))}
      </div>

      {editing && (
        <EditDeliveryModal
          delivery={editing.delivery}
          rawSms={editing.rawSms}
          onSave={handleSaved}
          onClose={() => setEditing(null)}
          t={t}
        />
      )}
      </div>
      )}
    </div>
  )
}
