import { useAuthStore } from '../../store/authStore'

// Owner dashboard — full implementation in Phase 2+
export function OwnerShell() {
  const { user, logout } = useAuthStore()
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold text-green-800 mb-2">Kathuniri Farm</h1>
      <p className="text-gray-500 mb-8">Karibu, {user?.name}</p>
      <p className="text-gray-400 text-center text-sm mb-8">
        Dashboard ya mmiliki inakuja. Muundo unakamilishwa.
      </p>
      <button onClick={logout} className="text-sm text-red-500 underline">Toka</button>
    </div>
  )
}
