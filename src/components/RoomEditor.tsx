'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ReactFlowProvider, type Connection } from '@xyflow/react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import { useERDStore } from '@/lib/store'
import { generateSQL } from '@/lib/sqlGenerator'
import { generateDBML, parseDBML } from '@/lib/dbmlGenerator'
import { diffERDState } from '@/lib/erdDiff'
import { ERDEdge, ERDState, ERDTable, RelationType } from '@/types/erd'
import { HistoryEntry } from '@/types/history'
import { Op } from '@/types/op'
import { randomPresence, RemoteCanvasCursor, RemoteDBMLCursor } from '@/types/presence'
import { ERDCanvas } from './ERDCanvas'
import { HistoryPanel } from './HistoryPanel'
import { SQLPanel } from './SQLPanel'
import { Toolbar } from './Toolbar'
import { AddTableModal } from './AddTableModal'
import { EdgeModal } from './EdgeModal'

interface PendingConnection {
  source: string
  target: string
}

export function RoomEditor({ roomId }: { roomId: string }) {
  const store = useERDStore()
  const [showAddTable, setShowAddTable] = useState(false)
  const [pendingConn, setPendingConn] = useState<PendingConnection | null>(null)
  const [userCount, setUserCount] = useState(1)
  const [remoteVersion, setRemoteVersion] = useState(0)
  const [canvasCursors, setCanvasCursors] = useState<RemoteCanvasCursor[]>([])
  const [dbmlCursors, setDbmlCursors] = useState<RemoteDBMLCursor[]>([])
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [showHistory, setShowHistory] = useState(false)

  const socketRef = useRef<Socket | null>(null)
  const presenceRef = useRef(randomPresence())
  const [userName, setUserName] = useState('')
  const [userColor, setUserColor] = useState('')

  useEffect(() => {
    const savedName = localStorage.getItem('collab-erd-username')
    if (savedName) presenceRef.current = { ...presenceRef.current, name: savedName }
    setUserName(presenceRef.current.name)
    setUserColor(presenceRef.current.color)
  }, [])
  const cursorTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const screenToFlowRef = useRef<((pos: { x: number; y: number }) => { x: number; y: number }) | null>(null)
  const sentEids = useRef(new Set<string>())
  const dbmlEditBaseRef = useRef<ERDState | null>(null)

  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })
    socketRef.current = socket

    useERDStore.getState().setOpListener((op: Op) => {
      if (socketRef.current?.connected) {
        const eid = uuidv4()
        sentEids.current.add(eid)
        socketRef.current.emit('op', {
          ...op, _eid: eid,
          _name: presenceRef.current.name,
          _color: presenceRef.current.color,
        })
      }
    })

    socket.on('connect', () => socket.emit('join-room', roomId))

    socket.on('room-state', ({ tables, edges, history: h }: { tables: ERDTable[]; edges: ERDEdge[]; history?: HistoryEntry[] }) => {
      useERDStore.getState().applyOp({ type: 'load-state', tables, edges })
      setRemoteVersion((v) => v + 1)
      if (h) setHistory(h)
    })

    socket.on('op', (wire: Op & { _eid?: string; _historyEntry?: HistoryEntry }) => {
      const eid = wire._eid
      const historyEntry = wire._historyEntry
      // Process history entry regardless of sender (dedup by eid to avoid duplicates)
      if (historyEntry) {
        setHistory((prev) =>
          prev.some((e) => e.eid === historyEntry.eid) ? prev : [...prev, historyEntry]
        )
      }
      if (eid && sentEids.current.has(eid)) {
        sentEids.current.delete(eid)
        return // already applied optimistically
      }
      useERDStore.getState().applyOp(wire as Op)
      setRemoteVersion((v) => v + 1)
    })

    socket.on('cursor', (data: { socketId: string; kind: string; color: string; name: string; x?: number; y?: number; line?: number }) => {
      const { socketId, kind, color, name } = data

      // Reset inactivity timeout — remove cursor after 4s of silence
      const existing = cursorTimeouts.current.get(socketId)
      if (existing) clearTimeout(existing)
      cursorTimeouts.current.set(
        socketId,
        setTimeout(() => {
          setCanvasCursors((prev) => prev.filter((c) => c.socketId !== socketId))
          setDbmlCursors((prev) => prev.filter((c) => c.socketId !== socketId))
          cursorTimeouts.current.delete(socketId)
        }, 4000)
      )

      if (kind === 'canvas' && data.x !== undefined && data.y !== undefined) {
        setCanvasCursors((prev) => [
          ...prev.filter((c) => c.socketId !== socketId),
          { socketId, color, name, x: data.x!, y: data.y! },
        ])
        // Remove from DBML when active on canvas
        setDbmlCursors((prev) => prev.filter((c) => c.socketId !== socketId))
      } else if (kind === 'dbml' && data.line !== undefined) {
        setDbmlCursors((prev) => [
          ...prev.filter((c) => c.socketId !== socketId),
          { socketId, color, name, line: data.line! },
        ])
        setCanvasCursors((prev) => prev.filter((c) => c.socketId !== socketId))
      }
    })

    socket.on('user-count', (count: number) => setUserCount(count))

    return () => {
      useERDStore.getState().setOpListener(null)
      for (const t of cursorTimeouts.current.values()) clearTimeout(t)
      cursorTimeouts.current.clear()
      socket.disconnect()
      socketRef.current = null
    }
  }, [roomId])

  const handleCanvasCursorMove = useCallback((x: number, y: number) => {
    socketRef.current?.emit('cursor', { kind: 'canvas', x, y, ...presenceRef.current })
  }, [])

  const handleDBMLCursor = useCallback((line: number) => {
    socketRef.current?.emit('cursor', { kind: 'dbml', line, ...presenceRef.current })
  }, [])

  const handleAddTable = useCallback(
    (name: string) => {
      let x = 150
      let y = 150
      const container = document.querySelector('.react-flow')
      if (container && screenToFlowRef.current) {
        const rect = container.getBoundingClientRect()
        const flowPos = screenToFlowRef.current({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        x = flowPos.x
        y = flowPos.y
      }
      store.addTable(name, { x, y })
      setShowAddTable(false)
    },
    [store]
  )

  const handleConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    if (connection.source === connection.target) return
    setPendingConn({ source: connection.source, target: connection.target })
  }, [])

  const handleEdgeConfirm = useCallback(
    (sourceColumnId: string, targetColumnId: string, relationType: RelationType) => {
      if (!pendingConn) return
      const edge: ERDEdge = {
        id: uuidv4(),
        source: pendingConn.source,
        target: pendingConn.target,
        data: { sourceColumnId, targetColumnId, relationType },
      }
      store.addEdge(edge)
      setPendingConn(null)
    },
    [pendingConn, store]
  )

  const handleNodeDragStop = useCallback(
    (tableId: string, position: { x: number; y: number }) => {
      store.updateTablePosition(tableId, position)
    },
    [store]
  )

  const handleRevert = useCallback((eid: string) => {
    socketRef.current?.emit('revert', { eid })
  }, [])

  const handleRenameUser = useCallback((name: string) => {
    presenceRef.current = { ...presenceRef.current, name }
    setUserName(name)
    localStorage.setItem('collab-erd-username', name)
  }, [])

  const handleClearAll = useCallback(() => store.clearAll(), [store])

  const handleTidy = useCallback(() => {
    const { tables, edges } = useERDStore.getState()
    if (tables.length === 0) return

    const tableSet = new Set(tables.map((t) => t.id))
    const outgoing = new Map<string, string[]>(tables.map((t) => [t.id, []]))
    const inDeg = new Map<string, number>(tables.map((t) => [t.id, 0]))

    for (const e of edges) {
      if (tableSet.has(e.source) && tableSet.has(e.target) && e.source !== e.target) {
        outgoing.get(e.source)!.push(e.target)
        inDeg.set(e.target, (inDeg.get(e.target) ?? 0) + 1)
      }
    }

    // Kahn's layering: source (FK holder) → target (referenced) means source is left of target
    const layerOf = new Map<string, number>(tables.map((t) => [t.id, 0]))
    const queue = tables.filter((t) => inDeg.get(t.id) === 0).map((t) => t.id)
    while (queue.length > 0) {
      const id = queue.shift()!
      const cur = layerOf.get(id) ?? 0
      for (const tgt of outgoing.get(id) ?? []) {
        if (cur + 1 > (layerOf.get(tgt) ?? 0)) layerOf.set(tgt, cur + 1)
        const d = (inDeg.get(tgt) ?? 1) - 1
        inDeg.set(tgt, d)
        if (d === 0) queue.push(tgt)
      }
    }
    // Tables still with inDeg > 0 are in cycles — push past max layer
    const maxLayer = Math.max(0, ...layerOf.values())
    for (const [id, d] of inDeg) {
      if (d > 0) layerOf.set(id, maxLayer + 1)
    }

    // Group and sort each layer by current Y (preserve vertical order)
    const groups = new Map<number, ERDTable[]>()
    for (const t of tables) {
      const l = layerOf.get(t.id) ?? 0
      if (!groups.has(l)) groups.set(l, [])
      groups.get(l)!.push(t)
    }
    for (const g of groups.values()) g.sort((a, b) => a.position.y - b.position.y)

    // BASE_H: 2px borders + 36px header + 1px border + 20px labels bar + 1px border
    //       + 4px container-top + 4px container-bottom + 1px border + 28px add-col btn + 2px borders
    const BASE_H = 99
    // Each ColumnRow: py-1 (4+4) + h-6 TypeSelect (24px, always in DOM) = 32px
    // Empty table shows "No columns" py-2 text-xs = 32px — treat as 1 virtual row
    const COL_H = 32
    const GAP_Y = 24
    const COL_W = 340
    const START_X = 60
    const START_Y = 60

    for (const [layer, group] of [...groups.entries()].sort((a, b) => a[0] - b[0])) {
      let y = START_Y
      for (const t of group) {
        store.updateTablePosition(t.id, { x: START_X + layer * COL_W, y })
        y += BASE_H + Math.max(1, t.columns.length) * COL_H + GAP_Y
      }
    }

    setRemoteVersion((v) => v + 1)
  }, [store])

  const handleDBMLEditStart = useCallback(() => {
    const { tables, edges } = useERDStore.getState()
    dbmlEditBaseRef.current = { tables, edges }
  }, [])

  const handleDBMLChange = useCallback((rawDBML: string) => {
    const current = useERDStore.getState()
    // Use snapshot from edit-start so remote additions (e.g. B's new columns)
    // never appear in prev — preventing spurious delete ops against them.
    const prev = dbmlEditBaseRef.current ?? { tables: current.tables, edges: current.edges }
    const next = parseDBML(rawDBML, prev.tables)
    const ops = diffERDState(prev, next)
    // Advance base to reflect A's committed intent; keeps future diffs incremental.
    dbmlEditBaseRef.current = { tables: next.tables, edges: next.edges }
    for (const op of ops) {
      current.applyOp(op)
      if (socketRef.current?.connected) {
        const eid = uuidv4()
        sentEids.current.add(eid)
        socketRef.current.emit('op', {
          ...op, _eid: eid,
          _name: presenceRef.current.name,
          _color: presenceRef.current.color,
        })
      }
    }
  }, [])

  const erdState = { tables: store.tables, edges: store.edges }
  const sql = generateSQL(erdState)
  const dbml = generateDBML(erdState)

  const sourceTable = pendingConn ? store.tables.find((t) => t.id === pendingConn.source) : undefined
  const targetTable = pendingConn ? store.tables.find((t) => t.id === pendingConn.target) : undefined

  return (
    <ReactFlowProvider>
      <div className="flex flex-col" style={{ height: '100vh', background: 'var(--background)' }}>
        <Toolbar
          roomId={roomId}
          userCount={userCount}
          userName={userName}
          userColor={userColor}
          historyCount={history.length}
          showHistory={showHistory}
          onAddTable={() => setShowAddTable(true)}
          onClearAll={handleClearAll}
          onTidy={handleTidy}
          onRenameUser={handleRenameUser}
          onToggleHistory={() => setShowHistory((v) => !v)}
        />
        <div className="flex flex-1 overflow-hidden relative">
          <SQLPanel
            sql={sql}
            dbml={dbml}
            remoteDBMLCursors={dbmlCursors}
            onDBMLChange={handleDBMLChange}
            onDBMLCursor={handleDBMLCursor}
            onDBMLEditStart={handleDBMLEditStart}
          />
          <ERDCanvas
            tables={store.tables}
            edges={store.edges}
            remoteVersion={remoteVersion}
            remoteCursors={canvasCursors}
            screenToFlowRef={screenToFlowRef}
            onNodeDragStop={handleNodeDragStop}
            onConnect={handleConnect}
            onEdgeDelete={store.deleteEdge}
            onTableDelete={store.deleteTable}
            onCursorMove={handleCanvasCursorMove}
          />
          {showHistory && (
            <HistoryPanel
              entries={history}
              onRevert={handleRevert}
              onClose={() => setShowHistory(false)}
            />
          )}
        </div>
      </div>

      {showAddTable && (
        <AddTableModal onConfirm={handleAddTable} onCancel={() => setShowAddTable(false)} />
      )}
      {pendingConn && sourceTable && targetTable && (
        <EdgeModal
          sourceTable={sourceTable}
          targetTable={targetTable}
          onConfirm={handleEdgeConfirm}
          onCancel={() => setPendingConn(null)}
        />
      )}
    </ReactFlowProvider>
  )
}
