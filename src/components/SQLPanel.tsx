'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { Copy, Check, Database, X, ChevronUp, ChevronDown } from 'lucide-react'
import { tokenizeSQL } from '@/lib/sqlGenerator'
import { tokenizeDBML } from '@/lib/dbmlGenerator'
import { RemoteDBMLCursor } from '@/types/presence'

type Tab = 'sql' | 'dbml'

// Reorder table blocks in `generated` to match the table order in `reference`.
// New tables (not in reference) are appended at end. Preserves header/Ref lines.
function reorderDBML(generated: string, reference: string): string {
  const preferred = [...reference.matchAll(/^Table\s+(\w+)/gm)].map((m) => m[1])
  const chunks = generated.split('\n\n')
  const headers: string[] = []
  const tableChunks = new Map<string, string>()
  const refChunks: string[] = []
  for (const chunk of chunks) {
    const t = chunk.trimStart()
    if (t.startsWith('//')) headers.push(chunk)
    else if (t.startsWith('Table ')) {
      const m = t.match(/^Table\s+(\w+)/)
      if (m) tableChunks.set(m[1], chunk)
    } else if (t) refChunks.push(chunk)
  }
  const ordered = [
    ...preferred.filter((n) => tableChunks.has(n)).map((n) => tableChunks.get(n)!),
    ...[...tableChunks.entries()].filter(([n]) => !preferred.includes(n)).map(([, v]) => v),
  ]
  return [...headers, ...ordered, ...refChunks].filter(Boolean).join('\n\n')
}

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
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [showFR, setShowFR] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchIndex, setMatchIndex] = useState(0)
  const findInputRef = useRef<HTMLInputElement>(null)

  const matches = useMemo(() => {
    if (!findText) return []
    const out: { start: number; end: number }[] = []
    let i = 0
    while (i <= localDBML.length - findText.length) {
      const idx = localDBML.indexOf(findText, i)
      if (idx === -1) break
      out.push({ start: idx, end: idx + findText.length })
      i = idx + 1
    }
    return out
  }, [localDBML, findText])

  const clampedIdx = matches.length > 0 ? matchIndex % matches.length : 0

  const scrollToMatch = useCallback((idx: number, allMatches: typeof matches) => {
    const ta = textareaRef.current
    if (!ta || allMatches.length === 0) return
    const m = allMatches[idx % allMatches.length]
    ta.focus()
    ta.setSelectionRange(m.start, m.end)
    const linesBefore = localDBML.slice(0, m.start).split('\n').length - 1
    ta.scrollTop = Math.max(0, linesBefore * 20 - ta.clientHeight / 2)
  }, [localDBML])

  const openFR = useCallback(() => {
    setShowFR(true)
    setTimeout(() => findInputRef.current?.select(), 0)
  }, [])

  const closeFR = useCallback(() => {
    setShowFR(false)
    textareaRef.current?.focus()
  }, [])

  const goNext = useCallback(() => {
    const next = matches.length > 0 ? (clampedIdx + 1) % matches.length : 0
    setMatchIndex(next)
    scrollToMatch(next, matches)
  }, [matches, clampedIdx, scrollToMatch])

  const goPrev = useCallback(() => {
    const prev = matches.length > 0 ? (clampedIdx - 1 + matches.length) % matches.length : 0
    setMatchIndex(prev)
    scrollToMatch(prev, matches)
  }, [matches, clampedIdx, scrollToMatch])

  const replaceCurrent = useCallback(() => {
    if (matches.length === 0) return
    const m = matches[clampedIdx]
    const next = localDBML.slice(0, m.start) + replaceText + localDBML.slice(m.end)
    setLocalDBML(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onDBMLChange?.(next), 300)
  }, [matches, clampedIdx, localDBML, replaceText, onDBMLChange])

  const replaceAll = useCallback(() => {
    if (!findText) return
    const next = localDBML.split(findText).join(replaceText)
    setLocalDBML(next)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onDBMLChange?.(next), 300)
    setMatchIndex(0)
  }, [findText, replaceText, localDBML, onDBMLChange])

  useEffect(() => {
    if (!isEditingDBML) {
      setLocalDBML((prev) => reorderDBML(dbml, prev))
    }
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
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(activeCode)
    } else {
      const el = document.createElement('textarea')
      el.value = activeCode
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
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

      {/* Find & Replace bar — DBML tab only */}
      {tab === 'dbml' && showFR && (
        <div
          style={{
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-2)',
            padding: '8px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {/* Find row */}
          <div className="flex items-center gap-1.5">
            <input
              ref={findInputRef}
              placeholder="Find"
              value={findText}
              onChange={(e) => { setFindText(e.target.value); setMatchIndex(0) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.shiftKey ? goPrev() : goNext() }
                if (e.key === 'Escape') closeFR()
              }}
              spellCheck={false}
              style={{
                flex: 1,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text)',
                fontSize: 12,
                padding: '3px 8px',
                outline: 'none',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            />
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                minWidth: 40,
                textAlign: 'center',
              }}
            >
              {findText ? (matches.length === 0 ? '0 / 0' : `${clampedIdx + 1} / ${matches.length}`) : ''}
            </span>
            <button
              onClick={goPrev}
              disabled={matches.length === 0}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: matches.length > 0 ? 'var(--text-muted)' : 'var(--border)',
                cursor: matches.length > 0 ? 'pointer' : 'default',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Previous match (Shift+Enter)"
            >
              <ChevronUp size={13} />
            </button>
            <button
              onClick={goNext}
              disabled={matches.length === 0}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: matches.length > 0 ? 'var(--text-muted)' : 'var(--border)',
                cursor: matches.length > 0 ? 'pointer' : 'default',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Next match (Enter)"
            >
              <ChevronDown size={13} />
            </button>
            <button
              onClick={closeFR}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '2px 4px',
                display: 'flex',
                alignItems: 'center',
              }}
              title="Close (Esc)"
            >
              <X size={13} />
            </button>
          </div>
          {/* Replace row */}
          <div className="flex items-center gap-1.5">
            <input
              placeholder="Replace"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') replaceCurrent()
                if (e.key === 'Escape') closeFR()
              }}
              spellCheck={false}
              style={{
                flex: 1,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: 'var(--text)',
                fontSize: 12,
                padding: '3px 8px',
                outline: 'none',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            />
            <button
              onClick={replaceCurrent}
              disabled={matches.length === 0}
              style={{
                background: matches.length > 0 ? 'var(--surface)' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: matches.length > 0 ? 'var(--text)' : 'var(--text-muted)',
                cursor: matches.length > 0 ? 'pointer' : 'default',
                fontSize: 11,
                padding: '3px 8px',
                whiteSpace: 'nowrap',
              }}
            >
              Replace
            </button>
            <button
              onClick={replaceAll}
              disabled={matches.length === 0}
              style={{
                background: matches.length > 0 ? 'var(--surface)' : 'transparent',
                border: '1px solid var(--border)',
                borderRadius: 4,
                color: matches.length > 0 ? 'var(--text)' : 'var(--text-muted)',
                cursor: matches.length > 0 ? 'pointer' : 'default',
                fontSize: 11,
                padding: '3px 8px',
                whiteSpace: 'nowrap',
              }}
            >
              All
            </button>
          </div>
        </div>
      )}

      {/* Code content */}
      <div
        className="flex-1 overflow-auto"
        style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12 }}
      >
        {tab === 'dbml' ? (
          <textarea
            ref={textareaRef}
            spellCheck={false}
            value={localDBML}
            onChange={(e) => handleDBMLInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault()
                openFR()
                return
              }
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
