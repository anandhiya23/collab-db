'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Table2 } from 'lucide-react'

interface AddTableModalProps {
  onConfirm: (name: string) => void
  onCancel: () => void
}

export function AddTableModal({ onConfirm, onCancel }: AddTableModalProps) {
  const [name, setName] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSubmit = () => {
    const trimmed = name.trim()
    if (trimmed) onConfirm(trimmed)
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="rounded-xl p-6 w-96 shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Table2 size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
              New Table
            </h2>
          </div>
          <button onClick={onCancel}>
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
          Table name
        </label>
        <input
          ref={inputRef}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none"
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            fontFamily: 'monospace',
          }}
          placeholder="e.g. users, orders, products"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit()
            if (e.key === 'Escape') onCancel()
          }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--accent)')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
        <p className="text-xs mt-2 mb-5" style={{ color: 'var(--text-muted)' }}>
          An <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>id SERIAL PRIMARY KEY</span> column is added automatically.
        </p>

        <div className="flex justify-end gap-2">
          <button
            className="px-4 py-2 rounded-lg text-sm transition-colors"
            style={{
              background: 'var(--surface-2)',
              color: 'var(--text-muted)',
              border: '1px solid var(--border)',
            }}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={{
              background: name.trim() ? 'var(--accent)' : 'var(--border)',
              color: name.trim() ? '#fff' : 'var(--text-muted)',
              cursor: name.trim() ? 'pointer' : 'not-allowed',
            }}
            onClick={handleSubmit}
            disabled={!name.trim()}
          >
            Create Table
          </button>
        </div>
      </div>
    </div>
  )
}
