import { useAuthStore } from '../../store/authStore'

const today = new Date().toLocaleDateString('sw-KE', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
})

export function HomePage() {
  const { user, logout } = useAuthStore()

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-green-800">Habari, {user?.name}</h1>
          <p className="text-sm text-gray-500 capitalize">{today}</p>
        </div>
        <button onClick={logout} className="text-xs text-gray-400 underline">Toka</button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <SummaryCard title="Maziwa Leo" value="—" unit="L" color="blue" />
        <SummaryCard title="Chai Leo" value="—" unit="kg" color="green" />
      </div>

      <div className="mt-6">
        <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
          Kazi za Leo
        </h2>
        <p className="text-gray-400 text-sm text-center py-8">
          Hakuna kazi zilizopangwa kwa leo
        </p>
      </div>
    </div>
  )
}

function SummaryCard({
  title, value, unit, color
}: {
  title: string; value: string; unit: string; color: 'blue' | 'green'
}) {
  const colors = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
  }
  return (
    <div className={`rounded-2xl border p-4 ${colors[color]}`}>
      <p className="text-sm font-medium opacity-70">{title}</p>
      <p className="text-3xl font-bold mt-1">
        {value} <span className="text-base font-normal">{unit}</span>
      </p>
    </div>
  )
}
