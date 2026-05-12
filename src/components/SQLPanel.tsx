'use client'

import { useState, useCallback } from 'react'
import { Copy, Check, Database } from 'lucide-react'
import { tokenizeSQL } from '@/lib/sqlGenerator'

interface SQLPanelProps {
  sql: string
}

export function SQLPanel({ sql }: SQLPanelProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [sql])

  const tokens = tokenizeSQL(sql)
  const lines = sql.split('\n')

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
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            PostgreSQL DDL
          </span>
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

      {/* SQL content */}
      <div
        className="flex-1 overflow-auto"
        style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
      >
        <div className="flex min-h-full">
          {/* Line numbers */}
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

          {/* Code */}
          <pre
            className="flex-1 py-4 pl-4 pr-4 m-0 overflow-x-auto"
            style={{
              color: 'var(--text)',
              lineHeight: '20px',
              background: 'transparent',
              whiteSpace: 'pre',
            }}
          >
            {tokens.map((tok, i) =>
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
      </div>
    </div>
  )
}
