'use client'

import { RotateCcw, X, History } from 'lucide-react'
import { HistoryEntry } from '@/types/history'

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

interface HistoryPanelProps {
  entries: HistoryEntry[]
  onRevert: (eid: string) => void
  onClose: () => void
}

export function HistoryPanel({ entries, onRevert, onClose }: HistoryPanelProps) {
  const reversed = [...entries].reverse()

  return (
    <div
      className="absolute right-0 top-0 bottom-0 flex flex-col"
      style={{
        width: 300,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        zIndex: 20,
        boxShadow: '-4px 0 16px rgba(0,0,0,0.3)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
      >
        <div className="flex items-center gap-2">
          <History size={14} style={{ color: 'var(--accent)' }} />
          <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>History</span>
          <span
            className="px-1.5 py-0.5 rounded text-[10px]"
            style={{ background: 'var(--surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            {entries.length}
          </span>
        </div>
        <button className="opacity-50 hover:opacity-100 transition-opacity" onClick={onClose}>
          <X size={14} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {reversed.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
            No history yet
          </div>
        ) : (
          reversed.map((entry) => (
            <div
              key={entry.eid}
              className="group flex items-start gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div
                style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: entry.color, flexShrink: 0, marginTop: 4,
                }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold truncate" style={{ color: entry.color }}>
                    {entry.name}
                  </span>
                  <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {relativeTime(entry.timestamp)}
                  </span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text)', lineHeight: 1.4 }}>
                  {entry.description}
                </p>
                <button
                  className="mt-1.5 flex items-center gap-1 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--accent)' }}
                  onClick={() => {
                    if (confirm('Revert to this point? All changes after will be lost.')) {
                      onRevert(entry.eid)
                    }
                  }}
                >
                  <RotateCcw size={9} />
                  Revert to here
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
