'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Copy, Check, Database } from 'lucide-react'
import { tokenizeSQL } from '@/lib/sqlGenerator'
import { tokenizeDBML } from '@/lib/dbmlGenerator'
import { RemoteDBMLCursor } from '@/types/presence'

type Tab = 'sql' | 'dbml'

interface SQLPanelProps {
  sql: string
  dbml: string
  remoteDBMLCursors: RemoteDBMLCursor[]
  onDBMLChange?: (dbml: string) => void
  onDBMLCursor?: (line: number) => void
  onDBMLEditStart?: () => void
}

export function SQLPanel({ sql, dbml, remoteDBMLCursors, onDBMLChange, onDBMLCursor, onDBMLEditStart }: SQLPanelProps) {
  const [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<Tab>('sql')
  const [localDBML, setLocalDBML] = useState(dbml)
  const [isEditingDBML, setIsEditingDBML] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!isEditingDBML) setLocalDBML(dbml)
  }, [dbml, isEditingDBML])

  const reportCursorLine = useCallback(
    (el: HTMLTextAreaElement) => {
      const line = localDBML.slice(0, el.selectionStart).split('\n').length
      onDBMLCursor?.(line)
    },
    [localDBML, onDBMLCursor]
  )

  const handleDBMLInput = useCallback(
    (value: string) => {
      setLocalDBML(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => onDBMLChange?.(value), 300)
    },
    [onDBMLChange]
  )

  const activeCode = tab === 'sql' ? sql : localDBML

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(activeCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [activeCode])

  const sqlTokens = tab === 'sql' ? tokenizeSQL(sql) : []
  const lines = activeCode.split('\n')

  return (
    <div
      className="flex flex-col"
      style={{
        width: 380,
        minWidth: 280,
        maxWidth: 520,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        flexShrink: 0,
      }}
    >
      {/* Panel header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
      >
        <div className="flex items-center gap-2">
          <Database size={15} style={{ color: 'var(--accent)' }} />
          <div className="flex items-center gap-1">
            {(['sql', 'dbml'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setCopied(false) }}
                className="px-2.5 py-0.5 rounded text-xs font-semibold transition-all"
                style={{
                  background: tab === t ? 'var(--accent)' : 'transparent',
                  color: tab === t ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${tab === t ? 'var(--accent)' : 'transparent'}`,
                }}
              >
                {t === 'sql' ? 'PostgreSQL' : 'DBML'}
              </button>
            ))}
          </div>
        </div>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all"
          style={{
            background: copied ? '#10b98122' : 'var(--surface)',
            color: copied ? '#10b981' : 'var(--text-muted)',
            border: `1px solid ${copied ? '#10b98144' : 'var(--border)'}`,
          }}
          onClick={handleCopy}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Remote DBML cursor badges — only shown on DBML tab */}
      {tab === 'dbml' && remoteDBMLCursors.length > 0 && (
        <div
          className="flex flex-wrap gap-1 px-3 py-1.5"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}
        >
          {remoteDBMLCursors.map((c) => (
            <span
              key={c.socketId}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold"
              style={{ background: c.color + '22', color: c.color, border: `1px solid ${c.color}44` }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: c.color,
                  display: 'inline-block',
                }}
              />
              {c.name} L{c.line}
            </span>
          ))}
        </div>
      )}

      {/* Code content */}
      <div
        className="flex-1 overflow-auto"
        style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
      >
        {tab === 'dbml' ? (
          <textarea
            spellCheck={false}
            value={localDBML}
            onChange={(e) => handleDBMLInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault()
                return
              }
              if (e.key === 'Tab') {
                e.preventDefault()
                const el = e.currentTarget
                const start = el.selectionStart
                const end = el.selectionEnd
                const next = localDBML.slice(0, start) + '  ' + localDBML.slice(end)
                setLocalDBML(next)
                requestAnimationFrame(() => {
                  el.selectionStart = el.selectionEnd = start + 2
                })
                if (debounceRef.current) clearTimeout(debounceRef.current)
                debounceRef.current = setTimeout(() => onDBMLChange?.(next), 300)
              }
            }}
            onFocus={() => { setIsEditingDBML(true); onDBMLEditStart?.() }}
            onBlur={() => {
              setIsEditingDBML(false)
              if (debounceRef.current) clearTimeout(debounceRef.current)
              onDBMLChange?.(localDBML)
            }}
            onKeyUp={(e) => reportCursorLine(e.currentTarget)}
            onMouseUp={(e) => reportCursorLine(e.currentTarget)}
            onSelect={(e) => reportCursorLine(e.currentTarget as HTMLTextAreaElement)}
            style={{
              display: 'block',
              width: '100%',
              minHeight: '100%',
              padding: '16px',
              color: 'var(--text)',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: '20px',
              border: 'none',
              outline: 'none',
              resize: 'none',
            }}
          />
        ) : (
          <div className="flex min-h-full">
            <div
              className="select-none py-4 pr-3 pl-3 text-right"
              style={{
                color: 'var(--text-muted)',
                background: 'var(--surface-2)',
                borderRight: '1px solid var(--border)',
                minWidth: 40,
                lineHeight: '20px',
                fontSize: 11,
              }}
            >
              {lines.map((_, i) => (
                <div key={i}>{i + 1}</div>
              ))}
            </div>
            <pre
              className="flex-1 py-4 pl-4 pr-4 m-0 overflow-x-auto"
              style={{
                color: 'var(--text)',
                lineHeight: '20px',
                background: 'transparent',
                whiteSpace: 'pre',
              }}
            >
              {sqlTokens.map((tok, i) =>
                tok.cls ? (
                  <span key={i} className={tok.cls}>
                    {tok.text}
                  </span>
                ) : (
                  tok.text
                )
              )}
            </pre>
          </div>
        )}
      </div>
    </div>
  )
}
