'use client'

import { useState } from 'react'
import { Plus, Copy, Check, Users, Trash2, GitBranch } from 'lucide-react'

interface ToolbarProps {
  roomId: string
  userCount: number
  onAddTable: () => void
  onClearAll: () => void
}

export function Toolbar({ roomId, userCount, onAddTable, onClearAll }: ToolbarProps) {
  const [copied, setCopied] = useState(false)

  const shareUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/room/${roomId}` : ''

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
      style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        height: 52,
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mr-2">
        <GitBranch size={18} style={{ color: 'var(--accent)' }} />
        <span className="font-bold text-sm" style={{ color: 'var(--text)', letterSpacing: '0.05em' }}>
          CollabERD
        </span>
      </div>

      <div className="w-px h-6 mx-1" style={{ background: 'var(--border)' }} />

      {/* Add Table */}
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all"
        style={{ background: 'var(--accent)', color: '#fff' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--accent-hover)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
        onClick={onAddTable}
      >
        <Plus size={14} />
        Add Table
      </button>

      {/* Clear All */}
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all"
        style={{
          background: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = '#ef444422'
          e.currentTarget.style.color = 'var(--danger)'
          e.currentTarget.style.borderColor = '#ef444444'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-muted)'
          e.currentTarget.style.borderColor = 'var(--border)'
        }}
        onClick={() => {
          if (confirm('Clear all tables and relationships?')) onClearAll()
        }}
      >
        <Trash2 size={14} />
        Clear
      </button>

      <div className="flex-1" />

      {/* User count */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
        style={{
          background: userCount > 1 ? '#10b98122' : 'var(--surface-2)',
          color: userCount > 1 ? '#10b981' : 'var(--text-muted)',
          border: `1px solid ${userCount > 1 ? '#10b98144' : 'var(--border)'}`,
        }}
      >
        <Users size={12} />
        {userCount} {userCount === 1 ? 'user' : 'users'}
      </div>

      {/* Share link */}
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded text-xs"
        style={{
          background: 'var(--surface-2)',
          border: '1px solid var(--border)',
          color: 'var(--text-muted)',
          maxWidth: 260,
        }}
      >
        <span className="truncate font-mono text-[11px]" style={{ color: 'var(--text)' }}>
          /room/{roomId.slice(0, 8)}...
        </span>
        <button
          className="flex items-center gap-1 flex-shrink-0 transition-colors"
          style={{ color: copied ? '#10b981' : 'var(--accent)' }}
          onClick={handleCopyLink}
          title="Copy share link"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Share'}
        </button>
      </div>
    </div>
  )
}
