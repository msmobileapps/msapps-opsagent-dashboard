import React from 'react'

export default function Notifications({ notifications }) {
  if (!notifications || notifications.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2">
      {notifications.map(n => (
        <div
          key={n.id}
          className={`animate-slide-in rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
            n.type === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : n.type === 'success'
              ? 'border-[var(--accent-500)]/30 bg-[var(--accent-500)]/10 text-[var(--accent-300)]'
              : 'border-[var(--brand-500)]/30 bg-[var(--brand-500)]/10 text-[var(--brand-300)]'
          }`}
        >
          {n.message}
        </div>
      ))}
    </div>
  )
}
