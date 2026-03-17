import { useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useLang } from '../../store/langStore'
import { TeaPage } from './TeaPage'
import { DairyPage } from './DairyPage'
import { CowDetailPage } from './CowDetailPage'
import { RentalPage } from './RentalPage'
import { StaffPage } from './StaffPage'
import { SettingsPage } from './SettingsPage'
import { OwnerFarmPage, OwnerPlotDetailPage } from './FarmPage'
import { DailyReportPage } from './DailyReportPage'
import { SmallStockPage } from './SmallStockPage'
import { AiAssistantPage } from './AiAssistantPage'
import { PayrollPage } from './PayrollPage'
import { ExpensePage } from './ExpensePage'

function OwnerHome() {
  const { user } = useAuthStore()
  const { t } = useLang()

  return (
    <div className="p-3">
      <h1 className="text-xl font-bold text-green-800 mb-0.5">Kathuniri Farm</h1>
      <p className="text-sm text-gray-500 mb-3">{t('Welcome', 'Karibu')}, {user?.name}</p>
      <div className="grid grid-cols-2 gap-2">
        {[
          { to: 'chai',   icon: '🍃', label: t('Tea', 'Chai') },
          { to: 'maziwa', icon: '🥛', label: t('Dairy', 'Maziwa') },
          { to: 'nyumba', icon: '🏠', label: t('Rental', 'Nyumba') },
          { to: 'staff',    icon: '👷', label: t('Staff', 'Wafanyakazi') },
          { to: 'shamba',   icon: '🌾', label: t('Farm Map', 'Ramani') },
          { to: 'mifugo',   icon: '🐑', label: t('Small Stock', 'Mifugo') },
          { to: 'ripoti',   icon: '📋', label: t('Daily Report', 'Ripoti') },
          { to: 'settings',   icon: '⚙️', label: t('Settings', 'Mipangilio') },
          { to: 'msaidizi',  icon: '🤖', label: t('AI Assistant', 'Msaidizi') },
          { to: 'payroll',   icon: '💰', label: t('Payroll', 'Mishahara') },
          { to: 'matumizi',  icon: '📊', label: t('Expenses', 'Matumizi') },
        ].map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            className="bg-white rounded-2xl border border-gray-200 p-3 flex flex-col items-center gap-1.5 text-center"
          >
            <span className="text-3xl">{item.icon}</span>
            <span className="font-semibold text-gray-700 text-sm">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export function OwnerShell() {
  const { user, logout } = useAuthStore()
  const { lang, init, toggle, t } = useLang()

  useEffect(() => {
    if (user?.id) init(user.id)
  }, [user?.id])

  function handleToggle() {
    if (user?.id) toggle(user.id)
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="bg-green-700 text-white px-4 py-3 flex items-center justify-between">
        <NavLink to="/owner" className="font-bold text-lg">🌿 Kathuniri Farm</NavLink>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggle}
            className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded-lg font-semibold tracking-wide"
          >
            {lang === 'en' ? 'SW' : 'EN'}
          </button>
          <button onClick={logout} className="text-sm opacity-80 hover:opacity-100">
            {t('Sign out', 'Toka')}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Routes>
          <Route index element={<OwnerHome />} />
          <Route path="chai"   element={<TeaPage />} />
          <Route path="maziwa"          element={<DairyPage />} />
          <Route path="maziwa/:cowId"   element={<CowDetailPage />} />
          <Route path="nyumba" element={<RentalPage />} />
          <Route path="staff"           element={<StaffPage />} />
          <Route path="shamba"          element={<OwnerFarmPage />} />
          <Route path="shamba/:plotId"  element={<OwnerPlotDetailPage />} />
          <Route path="mifugo"          element={<SmallStockPage />} />
          <Route path="ripoti"          element={<DailyReportPage />} />
          <Route path="settings"        element={<SettingsPage />} />
          <Route path="msaidizi"        element={<AiAssistantPage />} />
          <Route path="payroll"         element={<PayrollPage />} />
          <Route path="matumizi"        element={<ExpensePage />} />
        </Routes>
      </main>
    </div>
  )
}
