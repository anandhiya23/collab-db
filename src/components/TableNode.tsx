'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Handle, Position, NodeProps } from '@xyflow/react'
import { Trash2, Plus, Key, ChevronDown } from 'lucide-react'
import { useERDStore } from '@/lib/store'
import { ERDTable, Column, PG_TYPES, PGType } from '@/types/erd'

function TypeSelect({
  value,
  onChange,
}: {
  value: PGType
  onChange: (t: PGType) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="nodrag relative flex-shrink-0">
      <button
        className="flex items-center justify-center w-6 h-6"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}
      >
        <ChevronDown size={10} style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <div
          className="nodrag absolute z-50 right-0 top-full mt-0.5 rounded overflow-auto"
          style={{
            background: '#1e2030',
            border: '1px solid var(--border)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            minWidth: 120,
            maxHeight: 200,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {PG_TYPES.map((t) => (
            <div
              key={t}
              className="px-3 py-1 text-xs cursor-pointer"
              style={{
                color: t === value ? 'var(--accent)' : 'var(--text)',
                background: t === value ? 'rgba(99,102,241,0.15)' : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (t !== value) (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)'
              }}
              onMouseLeave={(e) => {
                if (t !== value) (e.currentTarget as HTMLDivElement).style.background = 'transparent'
              }}
              onClick={(e) => {
                e.stopPropagation()
                onChange(t)
                setOpen(false)
              }}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const TYPE_BADGE_COLOR: Record<string, string> = {
  SERIAL: '#6366f1',
  BIGSERIAL: '#6366f1',
  INTEGER: '#3b82f6',
  BIGINT: '#3b82f6',
  SMALLINT: '#3b82f6',
  VARCHAR: '#10b981',
  TEXT: '#10b981',
  BOOLEAN: '#f59e0b',
  TIMESTAMP: '#8b5cf6',
  TIMESTAMPTZ: '#8b5cf6',
  DATE: '#8b5cf6',
  TIME: '#8b5cf6',
  UUID: '#ec4899',
  JSONB: '#ef4444',
  JSON: '#ef4444',
  DECIMAL: '#06b6d4',
  REAL: '#06b6d4',
}

function ColumnRow({
  col,
  tableId,
  isEditing,
  onStartEdit,
  onStopEdit,
}: {
  col: Column
  tableId: string
  isEditing: boolean
  onStartEdit: () => void
  onStopEdit: () => void
}) {
  const { updateColumn, deleteColumn } = useERDStore()
  const [editName, setEditName] = useState(col.name)

  const commitName = useCallback(() => {
    if (editName.trim()) {
      updateColumn(tableId, col.id, { name: editName.trim() })
    } else {
      setEditName(col.name)
    }
    onStopEdit()
  }, [editName, col.name, col.id, tableId, updateColumn, onStopEdit])

  const formatType = (c: Column) => {
    if (c.type === 'VARCHAR') return `VARCHAR(${c.length ?? 255})`
    if (c.type === 'DECIMAL') return `DECIMAL(${c.precision ?? 10},${c.scale ?? 2})`
    return c.type
  }

  return (
    <div
      className="group flex items-center gap-1 px-2 py-1 text-xs hover:bg-[#2d3148] rounded cursor-pointer"
      style={{ minHeight: 28 }}
    >
      {/* PK / FK indicator */}
      <span className="w-4 flex-shrink-0">
        {col.primaryKey && <Key size={10} style={{ color: '#f59e0b' }} />}
      </span>

      {/* Name */}
      {isEditing ? (
        <input
          autoFocus
          className="flex-1 bg-[#1a1d27] border border-indigo-500 rounded px-1 outline-none text-xs"
          style={{ color: 'var(--text)', minWidth: 0 }}
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitName()
            if (e.key === 'Escape') { setEditName(col.name); onStopEdit() }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className="flex-1 truncate cursor-text"
          style={{ color: col.primaryKey ? '#f59e0b' : 'var(--text)' }}
          onDoubleClick={onStartEdit}
        >
          {col.name}
        </span>
      )}

      {/* Type badge */}
      <span
        className="px-1 rounded text-[10px] font-mono flex-shrink-0"
        style={{
          background: (TYPE_BADGE_COLOR[col.type] ?? '#6366f1') + '22',
          color: TYPE_BADGE_COLOR[col.type] ?? '#6366f1',
          border: `1px solid ${(TYPE_BADGE_COLOR[col.type] ?? '#6366f1')}44`,
        }}
      >
        {formatType(col)}
      </span>

      {/* Constraint tags */}
      <span className="flex gap-0.5 flex-shrink-0">
        {col.notNull && !col.primaryKey && (
          <span className="text-[9px] px-0.5 rounded" style={{ color: '#f59e0b', background: '#f59e0b22' }}>NN</span>
        )}
        {col.unique && !col.primaryKey && (
          <span className="text-[9px] px-0.5 rounded" style={{ color: '#10b981', background: '#10b98122' }}>UQ</span>
        )}
      </span>

      {/* Type selector (visible on hover) */}
      {!col.primaryKey && (
        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
          <TypeSelect
            value={col.type}
            onChange={(t) => updateColumn(tableId, col.id, { type: t })}
          />
        </div>
      )}

      {/* Delete column button */}
      {!col.primaryKey && (
        <button
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation()
            deleteColumn(tableId, col.id)
          }}
        >
          <Trash2 size={10} style={{ color: 'var(--danger)' }} />
        </button>
      )}

      {/* Constraint toggles on hover */}
      {!col.primaryKey && (
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            className="text-[9px] px-0.5 rounded transition-colors"
            style={{
              color: col.notNull ? '#f59e0b' : 'var(--text-muted)',
              background: col.notNull ? '#f59e0b22' : 'transparent',
            }}
            onClick={(e) => {
              e.stopPropagation()
              updateColumn(tableId, col.id, { notNull: !col.notNull })
            }}
            title="Toggle NOT NULL"
          >
            NN
          </button>
          <button
            className="text-[9px] px-0.5 rounded transition-colors"
            style={{
              color: col.unique ? '#10b981' : 'var(--text-muted)',
              background: col.unique ? '#10b98122' : 'transparent',
            }}
            onClick={(e) => {
              e.stopPropagation()
              updateColumn(tableId, col.id, { unique: !col.unique })
            }}
            title="Toggle UNIQUE"
          >
            UQ
          </button>
        </div>
      )}
    </div>
  )
}

export function TableNode({ id, selected }: NodeProps) {
  const table = useERDStore((s) => s.tables.find((t) => t.id === id))
  const { deleteTable, addColumn, updateTableName } = useERDStore()
  const [editingColId, setEditingColId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(table?.name ?? '')

  if (!table) return null

  const commitName = () => {
    if (nameVal.trim()) updateTableName(table.id, nameVal.trim())
    else setNameVal(table.name)
    setEditingName(false)
  }

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: `2px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 8,
        minWidth: 220,
        boxShadow: selected
          ? '0 0 0 1px var(--accent), 0 4px 24px rgba(99,102,241,0.2)'
          : '0 2px 12px rgba(0,0,0,0.4)',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
    >
      {/* Source handle (right) */}
      <Handle
        type="source"
        position={Position.Right}
        style={{ top: '50%' }}
      />
      {/* Target handle (left) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{ top: '50%' }}
      />

      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 rounded-t"
        style={{
          background: selected ? 'rgba(99,102,241,0.15)' : 'var(--surface-2)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        {editingName ? (
          <input
            autoFocus
            className="flex-1 bg-transparent border-b border-indigo-500 outline-none text-sm font-semibold"
            style={{ color: 'var(--text)' }}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') { setNameVal(table.name); setEditingName(false) }
            }}
          />
        ) : (
          <span
            className="font-semibold text-sm cursor-text select-none"
            style={{ color: 'var(--text)', letterSpacing: '0.02em' }}
            onDoubleClick={() => { setEditingName(true); setNameVal(table.name) }}
            title="Double-click to rename"
          >
            {table.name}
          </span>
        )}
        <button
          className="ml-2 opacity-50 hover:opacity-100 transition-opacity"
          onClick={() => deleteTable(table.id)}
          title="Delete table"
        >
          <Trash2 size={14} style={{ color: 'var(--danger)' }} />
        </button>
      </div>

      {/* Column header labels */}
      <div
        className="flex items-center gap-1 px-2 py-1 text-[10px]"
        style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
      >
        <span className="w-4" />
        <span className="flex-1">Column</span>
        <span>Type</span>
      </div>

      {/* Columns */}
      <div className="py-1">
        {table.columns.length === 0 && (
          <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            No columns
          </div>
        )}
        {table.columns.map((col) => (
          <ColumnRow
            key={col.id}
            col={col}
            tableId={table.id}
            isEditing={editingColId === col.id}
            onStartEdit={() => setEditingColId(col.id)}
            onStopEdit={() => setEditingColId(null)}
          />
        ))}
      </div>

      {/* Add column button */}
      <button
        className="w-full flex items-center gap-1 px-3 py-1.5 text-xs transition-colors rounded-b"
        style={{
          color: 'var(--text-muted)',
          borderTop: '1px solid var(--border)',
          background: 'transparent',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-2)'
          e.currentTarget.style.color = 'var(--accent-hover)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
        onClick={() => addColumn(table.id)}
      >
        <Plus size={12} />
        Add column
      </button>
    </div>
  )
}
