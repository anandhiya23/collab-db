'use client'

import { useState, useRef, useEffect } from 'react'
import { Plus, Copy, Check, Users, Trash2, GitBranch, LayoutGrid, Pencil, History, Search, Download } from 'lucide-react'

interface ToolbarProps {
  roomId: string
  userCount: number
  userName: string
  userColor: string
  historyCount: number
  showHistory: boolean
  tables: { id: string; name: string }[]
  onAddTable: () => void
  onClearAll: () => void
  onTidy: () => void
  onRenameUser: (name: string) => void
  onToggleHistory: () => void
  onFocusTable: (tableId: string) => void
  onExportJSON: () => void
}

export function Toolbar({ roomId, userCount, userName, userColor, historyCount, showHistory, tables, onAddTable, onClearAll, onTidy, onRenameUser, onToggleHistory, onFocusTable, onExportJSON }: ToolbarProps) {
  const [copied, setCopied] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState(userName)
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const searchResults = searchQuery.trim()
    ? tables.filter((t) => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : tables

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  useEffect(() => { setNameVal(userName) }, [userName])
  useEffect(() => { if (editingName) nameInputRef.current?.select() }, [editingName])

  const commitName = () => {
    const trimmed = nameVal.trim()
    if (trimmed) onRenameUser(trimmed)
    else setNameVal(userName)
    setEditingName(false)
  }

  const [shareUrl, setShareUrl] = useState('')
  useEffect(() => {
    setShareUrl(`${window.location.origin}/room/${roomId}`)
  }, [roomId])

  const handleCopyLink = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      const el = document.createElement('textarea')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
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

      {/* Tidy */}
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all"
        style={{
          background: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-2)'
          e.currentTarget.style.color = 'var(--text)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
        onClick={onTidy}
        title="Auto-arrange tables in a grid"
      >
        <LayoutGrid size={14} />
        Tidy
      </button>

      {/* History */}
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all"
        style={{
          background: showHistory ? 'var(--accent)' : 'transparent',
          color: showHistory ? '#fff' : 'var(--text-muted)',
          border: `1px solid ${showHistory ? 'var(--accent)' : 'var(--border)'}`,
        }}
        onMouseEnter={(e) => {
          if (!showHistory) {
            e.currentTarget.style.background = 'var(--surface-2)'
            e.currentTarget.style.color = 'var(--text)'
          }
        }}
        onMouseLeave={(e) => {
          if (!showHistory) {
            e.currentTarget.style.background = 'transparent'
            e.currentTarget.style.color = 'var(--text-muted)'
          }
        }}
        onClick={onToggleHistory}
        title="Toggle history panel"
      >
        <History size={14} />
        History
        {historyCount > 0 && (
          <span
            className="px-1 rounded text-[10px]"
            style={{
              background: showHistory ? 'rgba(255,255,255,0.2)' : 'var(--surface)',
              color: showHistory ? '#fff' : 'var(--text-muted)',
              border: showHistory ? 'none' : '1px solid var(--border)',
            }}
          >
            {historyCount}
          </span>
        )}
      </button>

      {/* Export JSON */}
      <button
        className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-all"
        style={{
          background: 'transparent',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--surface-2)'
          e.currentTarget.style.color = 'var(--text)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.color = 'var(--text-muted)'
        }}
        onClick={onExportJSON}
        title="Export room as JSON"
      >
        <Download size={14} />
        Export
      </button>

      {/* Search */}
      <div ref={searchRef} style={{ position: 'relative' }}>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1"
          style={{
            background: 'var(--surface-2)',
            border: `1px solid ${searchOpen ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 6,
            width: 180,
          }}
        >
          <Search size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            className="bg-transparent outline-none text-xs w-full"
            style={{ color: 'var(--text)' }}
            placeholder="Find table…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery('') }
              if (e.key === 'Enter' && searchResults.length > 0) {
                onFocusTable(searchResults[0].id)
                setSearchOpen(false)
                setSearchQuery('')
              }
            }}
          />
        </div>
        {searchOpen && searchResults.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              width: 180,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              zIndex: 100,
              overflow: 'hidden',
            }}
          >
            {searchResults.slice(0, 8).map((t) => (
              <button
                key={t.id}
                className="w-full text-left px-3 py-1.5 text-xs transition-colors"
                style={{ color: 'var(--text)', fontFamily: 'monospace' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  onFocusTable(t.id)
                  setSearchOpen(false)
                  setSearchQuery('')
                }}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

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

      {/* Username */}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs"
        style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
      >
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: userColor, flexShrink: 0, display: 'inline-block' }} />
        {editingName ? (
          <input
            ref={nameInputRef}
            className="bg-transparent outline-none text-xs"
            style={{ color: 'var(--text)', width: 100 }}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') { setNameVal(userName); setEditingName(false) }
            }}
          />
        ) : (
          <span style={{ color: 'var(--text)' }}>{userName}</span>
        )}
        <button
          className="transition-opacity opacity-50 hover:opacity-100"
          onClick={() => setEditingName(true)}
          title="Change display name"
        >
          <Pencil size={10} style={{ color: 'var(--text-muted)' }} />
        </button>
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
