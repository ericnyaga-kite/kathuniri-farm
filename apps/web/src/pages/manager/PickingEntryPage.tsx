import { useState } from 'react'
import { db, queueSync } from '../../db/localDb'
import { useLang } from '../../store/langStore'
import type { PickingSession, PickerRecord } from '@kathuniri/shared'

const CENTRE_ID = 'kathangariri'
const RATE_PER_KG = 14

interface PickerRow {
  name: string
  kg: string
}

function emptyRow(): PickerRow {
  return { name: '', kg: '' }
}

export function PickingEntryPage() {
  const { t } = useLang()
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)
  const [pickers, setPickers] = useState<PickerRow[]>([emptyRow(), emptyRow()])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  function updateRow(i: number, field: keyof PickerRow, val: string) {
    setPickers(rows => rows.map((r, idx) =>
      idx === i ? { ...r, [field]: field === 'kg' ? val.replace(/[^0-9.]/g, '') : val } : r
    ))
  }

  function addRow() {
    setPickers(rows => [...rows, emptyRow()])
  }

  function removeRow(i: number) {
    setPickers(rows => rows.filter((_, idx) => idx !== i))
  }

  const validRows = pickers.filter(r => r.name.trim() && parseFloat(r.kg) > 0)
  const totalKg  = validRows.reduce((sum, r) => sum + parseFloat(r.kg), 0)
  const totalPay = totalKg * RATE_PER_KG

  async function handleSave() {
    if (validRows.length === 0) return
    setSaving(true)
    try {
      const sessionId = crypto.randomUUID()

      const session: PickingSession = {
        id: sessionId,
        sessionDate: date,
        centreId: CENTRE_ID,
        pickerTotalKg: totalKg,
        reconciliationStatus: 'pending',
      }
      await db.pickingSessions.put(session)
      await queueSync({
        tableName: 'picking_sessions',
        recordId: sessionId,
        operation: 'INSERT',
        payload: session as unknown as Record<string, unknown>,
        createdAt: new Date().toISOString(),
        attemptCount: 0,
      })

      for (const row of validRows) {
        const record: PickerRecord = {
          id: crypto.randomUUID(),
          sessionId,
          staffId: row.name.trim(),
          kgPicked: parseFloat(row.kg),
          ratePerKg: RATE_PER_KG,
          grossPay: parseFloat(row.kg) * RATE_PER_KG,
        }
        await db.pickerRecords.put(record)
        await queueSync({
          tableName: 'picker_records',
          recordId: record.id,
          operation: 'INSERT',
          payload: { ...record, staffName: row.name.trim() } as unknown as Record<string, unknown>,
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
        <div className="bg-green-50 rounded-2xl p-4 mb-6 w-full max-w-xs text-center">
          <p className="text-gray-600 text-sm mb-1">{t('Total tea', 'Jumla ya chai')}</p>
          <p className="text-3xl font-bold text-green-800">{totalKg.toFixed(1)} kg</p>
          <p className="text-gray-500 text-sm mt-2">{t('Picker pay', 'Malipo ya wavunaji')}</p>
          <p className="text-2xl font-bold text-green-700">KES {totalPay.toLocaleString()}</p>
        </div>
        <p className="text-gray-400 text-sm text-center mb-8">
          {t('Will sync when online.', 'Zitasawazishwa mtandaoni punde.')}
        </p>
        <button
          className="manager-btn bg-green-700 text-white max-w-xs"
          onClick={() => { setSaved(false); setPickers([emptyRow(), emptyRow()]) }}
        >
          {t('Enter Another', 'Rekodi Nyingine')}
        </button>
      </div>
    )
  }

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold text-green-800 mb-1">{t('Tea — Picking', 'Chai — Kuokota')}</h1>

      {/* Date */}
      <div className="mb-5">
        <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1 block">
          {t('Date', 'Tarehe')}
        </label>
        <input
          type="date"
          value={date}
          max={today}
          onChange={e => setDate(e.target.value)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
        />
      </div>

      {/* Pickers */}
      <div className="mb-2">
        <label className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-3 block">
          {t('Pickers', 'Wavunaji')}
        </label>
        <div className="space-y-3">
          {pickers.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1 bg-white rounded-xl border border-gray-200 flex overflow-hidden">
                <input
                  type="text"
                  placeholder={t('Name', 'Jina')}
                  value={row.name}
                  onChange={e => updateRow(i, 'name', e.target.value)}
                  className="flex-1 px-3 py-3 text-base focus:outline-none min-w-0"
                />
                <div className="w-px bg-gray-200" />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="kg"
                  value={row.kg}
                  onChange={e => updateRow(i, 'kg', e.target.value)}
                  className="w-20 px-3 py-3 text-base text-right focus:outline-none"
                />
                <span className="pr-3 flex items-center text-gray-400 text-sm">kg</span>
              </div>
              {pickers.length > 1 && (
                <button
                  onClick={() => removeRow(i)}
                  className="text-red-400 text-2xl w-10 h-10 flex items-center justify-center"
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addRow}
          className="mt-3 w-full py-3 border-2 border-dashed border-green-400 rounded-xl text-green-700 font-semibold text-base"
        >
          + {t('Add Picker', 'Ongeza Mvunaji')}
        </button>
      </div>

      {/* Totals */}
      {totalKg > 0 && (
        <div className="my-5 bg-green-50 rounded-2xl p-4 flex justify-between items-center">
          <div>
            <p className="text-xs text-gray-500">{t('Total (kg)', 'Jumla (kg)')}</p>
            <p className="text-2xl font-bold text-green-800">{totalKg.toFixed(1)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">{t('Pay', 'Malipo')} (KES {RATE_PER_KG}/kg)</p>
            <p className="text-2xl font-bold text-green-700">{totalPay.toLocaleString()}</p>
          </div>
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving || validRows.length === 0}
        className="manager-btn bg-green-700 text-white disabled:opacity-40 mt-2"
      >
        {saving ? t('Saving...', 'Inahifadhi...') : `✓ ${t('Confirm', 'Thibitisha')}`}
      </button>
    </div>
  )
}
