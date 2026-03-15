import { useState } from 'react'
import { db, queueSync } from '../../db/localDb'
import { useLang } from '../../store/langStore'
import type { MilkProductionRecord } from '@kathuniri/shared'

const COWS = [
  { id: 'cow-ndama-1', name: 'Ndama I' },
  { id: 'cow-ndama-2', name: 'Ndama II' },
]

type Session = 'AM' | 'PM'

export function MilkEntryPage() {
  const { t } = useLang()
  const [session, setSession] = useState<Session>('AM')
  const [litres, setLitres] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const today = new Date().toISOString().split('T')[0]

  function handleLitres(cowId: string, val: string) {
    if (/^\d*\.?\d*$/.test(val)) {
      setLitres(prev => ({ ...prev, [cowId]: val }))
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      for (const cow of COWS) {
        const raw = litres[cow.id]
        if (!raw || raw === '') continue
        const record: MilkProductionRecord = {
          id: crypto.randomUUID(),
          productionDate: today,
          cowId: cow.id,
          session,
          litres: parseFloat(raw),
          withdrawalActive: false,
          saleable: true,
          source: 'manual',
        }
        await db.milkProduction.put(record)
        await queueSync({
          tableName: 'milk_production',
          recordId: record.id,
          operation: 'INSERT',
          payload: record as unknown as Record<string, unknown>,
          createdAt: new Date().toISOString(),
          attemptCount: 0,
        })
      }
      setSaved(true)
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <div className="text-6xl mb-4">✅</div>
        <h2 className="text-2xl font-bold text-green-700 mb-2">{t('Saved!', 'Imehifadhiwa!')}</h2>
        <p className="text-gray-500 text-center mb-8">
          {t('Milk records saved. Will sync when online.', 'Rekodi za maziwa zimehifadhiwa. Zitasawazishwa mtandaoni punde.')}
        </p>
        <button
          className="manager-btn bg-green-700 text-white max-w-xs"
          onClick={() => { setSaved(false); setLitres({}) }}
        >
          {t('Enter Another', 'Rekodi Nyingine')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-green-800 mb-1">{t("Today's Milk", 'Maziwa Leo')}</h1>
      <p className="text-sm text-gray-500 mb-6">
        {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* Session toggle */}
      <div className="flex gap-3 mb-6">
        {(['AM', 'PM'] as Session[]).map(s => (
          <button
            key={s}
            onClick={() => setSession(s)}
            className={`flex-1 py-4 rounded-2xl text-lg font-bold transition-all ${
              session === s
                ? 'bg-green-700 text-white shadow-md'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            {s === 'AM' ? `🌅 ${t('Morning', 'Asubuhi')}` : `🌇 ${t('Evening', 'Jioni')}`}
          </button>
        ))}
      </div>

      {/* Cow entries */}
      <div className="space-y-4 mb-8">
        {COWS.map(cow => (
          <div key={cow.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            <label className="block text-base font-semibold text-gray-700 mb-2">
              🐄 {cow.name}
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                inputMode="decimal"
                placeholder="0.0"
                value={litres[cow.id] ?? ''}
                onChange={e => handleLitres(cow.id, e.target.value)}
                className="flex-1 text-3xl font-bold text-center border-b-2 border-green-500 focus:outline-none py-2 bg-transparent"
              />
              <span className="text-gray-500 text-lg font-medium">L</span>
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={saving || Object.values(litres).every(v => !v)}
        className="manager-btn bg-green-700 text-white disabled:opacity-40"
      >
        {saving ? t('Saving...', 'Inahifadhi...') : `✓ ${t('Confirm', 'Thibitisha')}`}
      </button>
    </div>
  )
}
