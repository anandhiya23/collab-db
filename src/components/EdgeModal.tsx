'use client'

import { useState } from 'react'
import { X, Link2 } from 'lucide-react'
import { ERDTable, RelationType } from '@/types/erd'

interface EdgeModalProps {
  sourceTable: ERDTable
  targetTable: ERDTable
  onConfirm: (sourceColumnId: string, targetColumnId: string, relationType: RelationType) => void
  onCancel: () => void
}

export function EdgeModal({ sourceTable, targetTable, onConfirm, onCancel }: EdgeModalProps) {
  const [sourceColId, setSourceColId] = useState(sourceTable.columns[0]?.id ?? '')
  const [targetColId, setTargetColId] = useState(targetTable.columns[0]?.id ?? '')
  const [relationType, setRelationType] = useState<RelationType>('one-to-many')

  const handleConfirm = () => {
    if (sourceColId && targetColId) {
      onConfirm(sourceColId, targetColId, relationType)
    }
  }

  const selectStyle = {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text)',
    borderRadius: 8,
    padding: '6px 10px',
    fontSize: 13,
    width: '100%',
    outline: 'none',
    fontFamily: 'monospace',
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div
        className="rounded-xl p-6 w-[420px] shadow-2xl"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Link2 size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
              Define Relationship
            </h2>
          </div>
          <button onClick={onCancel}>
            <X size={16} style={{ color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* Relationship type */}
        <div className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Relationship type
          </label>
          <div className="flex gap-2">
            {(['one-to-one', 'one-to-many', 'many-to-many'] as RelationType[]).map((t) => (
              <button
                key={t}
                className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: relationType === t ? 'var(--accent)' : 'var(--surface-2)',
                  color: relationType === t ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${relationType === t ? 'var(--accent)' : 'var(--border)'}`,
                }}
                onClick={() => setRelationType(t)}
              >
                {t === 'one-to-one' ? '1:1' : t === 'one-to-many' ? '1:N' : 'N:M'}
              </button>
            ))}
          </div>
        </div>

        {/* FK column (source) */}
        <div className="mb-4">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
            Foreign key column in{' '}
            <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{sourceTable.name}</span>
          </label>
          <select
            style={selectStyle}
            value={sourceColId}
            onChange={(e) => setSourceColId(e.target.value)}
          >
            {sourceTable.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>

        {/* Referenced column (target) */}
        <div className="mb-5">
          <label className="block text-xs mb-1.5" style={{ color: 'var(--text-muted)' }}>
            References column in{' '}
            <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{targetTable.name}</span>
          </label>
          <select
            style={selectStyle}
            value={targetColId}
            onChange={(e) => setTargetColId(e.target.value)}
          >
            {targetTable.columns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.type})
              </option>
            ))}
          </select>
        </div>

        {/* Preview */}
        <div
          className="rounded-lg p-3 mb-5 text-xs font-mono"
          style={{ background: 'var(--surface-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          <span style={{ color: '#c792ea' }}>ALTER TABLE</span>{' '}
          <span style={{ color: '#c3e88d' }}>{sourceTable.name}</span>{' '}
          <span style={{ color: '#c792ea' }}>ADD CONSTRAINT</span>{' '}fk_{sourceTable.name}_{sourceTable.columns.find(c => c.id === sourceColId)?.name ?? '...'}
          <br />
          {'  '}<span style={{ color: '#c792ea' }}>FOREIGN KEY</span> ({sourceTable.columns.find(c => c.id === sourceColId)?.name ?? '...'}){' '}
          <span style={{ color: '#c792ea' }}>REFERENCES</span>{' '}
          <span style={{ color: '#c3e88d' }}>{targetTable.name}</span>({targetTable.columns.find(c => c.id === targetColId)?.name ?? '...'});
        </div>

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
            className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={handleConfirm}
          >
            Add Relationship
          </button>
        </div>
      </div>
    </div>
  )
}
