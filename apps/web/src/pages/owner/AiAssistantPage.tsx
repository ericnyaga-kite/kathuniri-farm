import { useState, useEffect, useRef } from 'react'
import { useLang } from '../../store/langStore'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

function token() { return localStorage.getItem('kf_token') ?? '' }

// ─── Types ─────────────────────────────────────────────────────────────────

interface Insight {
  id: string
  category: string
  title: string
  body: string
  confidence: 'high' | 'medium' | 'low'
  suggestedAction?: string | null
  status: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function categoryIcon(category: string): string {
  switch (category.toLowerCase()) {
    case 'tea':       return '🍃'
    case 'dairy':     return '🥛'
    case 'rental':    return '🏠'
    case 'financial': return '💰'
    case 'crops':     return '🌾'
    case 'staff':     return '👷'
    default:          return '📌'
  }
}

function confidenceBadge(confidence: 'high' | 'medium' | 'low'): string {
  switch (confidence) {
    case 'high':   return 'bg-green-100 text-green-700'
    case 'medium': return 'bg-amber-100 text-amber-700'
    case 'low':    return 'bg-gray-100 text-gray-500'
  }
}

// ─── InsightsPanel ─────────────────────────────────────────────────────────

function InsightsPanel({
  insights,
  collapsed,
  onToggle,
  onDismiss,
  t,
}: {
  insights: Insight[]
  collapsed: boolean
  onToggle: () => void
  onDismiss: (id: string) => void
  t: (en: string, sw: string) => string
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">💡</span>
          <span className="font-semibold text-gray-800">
            {t('AI Insights', 'Mapendekezo ya AI')}
          </span>
          <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">
            {insights.length}
          </span>
        </div>
        <span className="text-gray-400 text-lg">{collapsed ? '›' : '‹'}</span>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
          {insights.map(ins => (
            <div
              key={ins.id}
              className="bg-gray-50 rounded-xl border border-gray-200 p-3"
            >
              <div className="flex items-start gap-2 mb-1">
                <span className="text-xl mt-0.5">{categoryIcon(ins.category)}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-800 text-sm">{ins.title}</p>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${confidenceBadge(ins.confidence)}`}
                    >
                      {t(ins.confidence, ins.confidence === 'high' ? 'juu' : ins.confidence === 'medium' ? 'wastani' : 'chini')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{ins.body}</p>
                  {ins.suggestedAction && (
                    <p className="text-xs text-green-700 font-medium mt-1.5">
                      → {ins.suggestedAction}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end mt-2">
                <button
                  onClick={() => onDismiss(ins.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1 rounded-lg"
                >
                  {t('Dismiss', 'Ondoa')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── LoadingBubble ──────────────────────────────────────────────────────────

function LoadingBubble() {
  return (
    <div className="flex gap-2 items-end">
      <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
        <span className="flex gap-1 items-center">
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  )
}

// ─── MessageBubble ──────────────────────────────────────────────────────────

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl text-base leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-green-700 text-white rounded-br-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
        }`}
      >
        {msg.content}
      </div>
    </div>
  )
}

// ─── EmptyState ─────────────────────────────────────────────────────────────

function EmptyState({
  onChip,
  t,
}: {
  onChip: (text: string) => void
  t: (en: string, sw: string) => string
}) {
  const chips = [
    { en: 'How much milk this week?', sw: 'Maziwa wiki hii?' },
    { en: "Who hasn't paid rent?",    sw: 'Nani hajalipa kodi?' },
    { en: "What's the farm income this month?", sw: 'Mapato ya shamba mwezi huu?' },
  ]

  return (
    <div className="flex flex-col items-center justify-center h-full gap-6 py-8 px-4">
      <div className="text-center">
        <div className="text-5xl mb-3">🤖</div>
        <p className="text-gray-500 text-sm">
          {t('Ask me anything about the farm.', 'Niulize chochote kuhusu shamba.')}
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-sm">
        {chips.map(chip => (
          <button
            key={chip.en}
            onClick={() => onChip(t(chip.en, chip.sw))}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-left text-sm text-gray-700 active:scale-95 transition-transform"
          >
            {t(chip.en, chip.sw)}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── AiAssistantPage ────────────────────────────────────────────────────────

export function AiAssistantPage() {
  const { t } = useLang()

  // Insights state
  const [insights, setInsights]           = useState<Insight[]>([])
  const [insightsLoading, setInsightsLoading] = useState(true)
  const [insightsCollapsed, setInsightsCollapsed] = useState(false)

  // Chat state
  const [history, setHistory]   = useState<Message[]>([])
  const [input, setInput]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  // Load insights on mount
  useEffect(() => {
    fetch(`${API}/api/ai/insights`, {
      headers: { Authorization: `Bearer ${token()}` },
    })
      .then(r => r.json())
      .then((data: Insight[]) => {
        setInsights(data.filter(i => i.status === 'active'))
      })
      .catch(() => {
        // Silently ignore — insights are optional
      })
      .finally(() => setInsightsLoading(false))
  }, [])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history, loading])

  async function dismissInsight(id: string) {
    setInsights(prev => prev.filter(i => i.id !== id))
    try {
      await fetch(`${API}/api/ai/insights/${id}/dismiss`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token()}` },
      })
    } catch {
      // Fire-and-forget; already removed from UI
    }
  }

  async function sendMessage(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return

    setInput('')
    setError(null)

    const userMsg: Message = { role: 'user', content: trimmed }
    const nextHistory = [...history, userMsg]
    setHistory(nextHistory)
    setLoading(true)

    try {
      const res = await fetch(`${API}/api/ai/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token()}`,
        },
        body: JSON.stringify({ query: trimmed, history }),
      })

      if (!res.ok) throw new Error(`${res.status}`)

      const data = await res.json() as { answer: string }
      setHistory([...nextHistory, { role: 'assistant', content: data.answer }])
    } catch {
      setError(t('Failed to get a response. Tap to retry.', 'Imeshindwa kupata jibu. Gonga ili ujaribu tena.'))
      // Roll back the user message so user can try again
      setHistory(history)
      setInput(trimmed)
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    sendMessage(input)
  }

  const showInsights = !insightsLoading && insights.length > 0

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 max-w-2xl mx-auto space-y-4">
          {/* Page title */}
          <div className="flex items-center gap-2">
            <span className="text-2xl">🤖</span>
            <h1 className="text-xl font-bold text-green-800">
              {t('AI Assistant', 'Msaidizi wa AI')}
            </h1>
          </div>

          {/* Insights panel */}
          {showInsights && (
            <InsightsPanel
              insights={insights}
              collapsed={insightsCollapsed}
              onToggle={() => setInsightsCollapsed(c => !c)}
              onDismiss={dismissInsight}
              t={t}
            />
          )}

          {/* Chat thread */}
          {history.length === 0 && !loading ? (
            <EmptyState onChip={sendMessage} t={t} />
          ) : (
            <div className="space-y-3 pb-2">
              {history.map((msg, i) => (
                <MessageBubble key={i} msg={msg} />
              ))}
              {loading && <LoadingBubble />}
            </div>
          )}

          {/* Error state */}
          {error && (
            <div
              className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 cursor-pointer active:scale-95 transition-transform"
              onClick={() => {
                setError(null)
                if (input.trim()) sendMessage(input)
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar — pinned to bottom */}
      <div className="bg-white border-t border-gray-200 px-4 py-3 safe-bottom">
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 max-w-2xl mx-auto"
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={t('Ask a question…', 'Uliza swali…')}
            disabled={loading}
            className="flex-1 border border-gray-300 rounded-2xl px-4 py-3 text-base outline-none focus:border-green-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-green-700 text-white font-bold px-5 py-3 rounded-2xl disabled:opacity-40 active:scale-95 transition-transform"
          >
            {loading ? '…' : t('Send', 'Tuma')}
          </button>
        </form>
      </div>
    </div>
  )
}
