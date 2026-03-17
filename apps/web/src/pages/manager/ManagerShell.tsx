import { useEffect } from 'react'
import { Routes, Route, NavLink } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useLang } from '../../store/langStore'
import { MilkEntryPage }    from './MilkEntryPage'
import { PickingEntryPage } from './PickingEntryPage'
import { HomePage }         from './HomePage'
import { DailyLogPage }     from './DailyLogPage'
import { FarmMapPage }      from './FarmMapPage'
import { PlotDetailPage }   from './PlotDetailPage'
import { RentalEntryPage }  from './RentalEntryPage'
import { AnimalEntryPage }  from './AnimalEntryPage'
import { LabourPage }       from './LabourPage'

export function ManagerShell() {
  const { user, logout } = useAuthStore()
  const { lang, init, toggle, t } = useLang()

  useEffect(() => {
    if (user?.id) init(user.id)
  }, [user?.id])

  return (
    <div className="flex flex-col min-h-screen">
      {/* Slim top bar */}
      <header className="bg-green-700 text-white px-4 py-2 flex items-center justify-between">
        <p className="text-sm font-semibold opacity-90">🌿 {user?.name ?? 'Msimamizi'}</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => { if (user?.id) toggle(user.id) }}
            className="text-xs bg-green-600 hover:bg-green-500 px-2 py-1 rounded-lg font-semibold tracking-wide"
          >
            {lang === 'en' ? 'SW' : 'EN'}
          </button>
          <button onClick={logout} className="text-xs opacity-75 hover:opacity-100 underline">
            {t('Sign out', 'Toka')}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        <Routes>
          <Route index                  element={<HomePage />} />
          <Route path="maziwa"          element={<MilkEntryPage />} />
          <Route path="chai"            element={<PickingEntryPage />} />
          <Route path="kodi"            element={<RentalEntryPage />} />
          <Route path="log"             element={<DailyLogPage />} />
          <Route path="shamba"          element={<FarmMapPage />} />
          <Route path="shamba/:plotId"  element={<PlotDetailPage />} />
          <Route path="wanyama"         element={<AnimalEntryPage />} />
          <Route path="kazi"            element={<LabourPage />} />
        </Routes>
      </main>

      {/* Bottom nav — 6 items */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 grid grid-cols-6 h-20">
        {[
          { to: '/manager',          end: true,  icon: '🏠', en: 'Home',    sw: 'Nyumba'      },
          { to: '/manager/maziwa',   end: false, icon: '🥛', en: 'Milk',    sw: 'Maziwa'      },
          { to: '/manager/chai',     end: false, icon: '🍃', en: 'Tea',     sw: 'Chai'        },
          { to: '/manager/wanyama',  end: false, icon: '🐄', en: 'Animals', sw: 'Wanyama'     },
          { to: '/manager/kazi',     end: false, icon: '👷', en: 'Work',    sw: 'Kazi'        },
          { to: '/manager/log',      end: false, icon: '📝', en: 'Log',     sw: 'Kumbukumbu'  },
        ].map(item => (
          <NavLink key={item.to} to={item.to} end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-xs font-medium ${isActive ? 'text-green-700' : 'text-gray-500'}`
            }
          >
            <span className="text-2xl">{item.icon}</span>
            {t(item.en, item.sw)}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
