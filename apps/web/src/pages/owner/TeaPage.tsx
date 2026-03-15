import { useState } from 'react'
import { useLang } from '../../store/langStore'
import { TeaProductionPage } from './TeaProductionPage'
import { TeaRecordsPage } from './TeaRecordsPage'
import { ReconciliationPage } from './ReconciliationPage'

export function TeaPage() {
  const { t } = useLang()
  const [tab, setTab] = useState<'production' | 'records' | 'reconcile'>('production')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex bg-white border-b border-gray-200">
        {([
          { key: 'production', label: t('Production', 'Uzalishaji') },
          { key: 'records',    label: t('SMS Records', 'Rekodi za SMS') },
          { key: 'reconcile', label: t('Reconcile', 'Usuluhisho') },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === key
                ? 'border-green-700 text-green-700'
                : 'border-transparent text-gray-500'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'production' && <TeaProductionPage />}
      {tab === 'records'    && <TeaRecordsPage />}
      {tab === 'reconcile'  && <ReconciliationPage />}
    </div>
  )
}
