'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { ReactFlowProvider, type Connection } from '@xyflow/react'
import { io, Socket } from 'socket.io-client'
import { v4 as uuidv4 } from 'uuid'
import { useERDStore } from '@/lib/store'
import { generateSQL } from '@/lib/sqlGenerator'
import { ERDEdge, ERDTable, RelationType } from '@/types/erd'
import { ERDCanvas } from './ERDCanvas'
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
  const socketRef = useRef<Socket | null>(null)
  const emitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set to true when we load remote state. The next emit effect run clears it and skips
  // the emit — prevents echoing back the exact state we just received.
  const skipNextEmitRef = useRef(false)

  // Initialize socket
  useEffect(() => {
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] })
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join-room', roomId)
    })

    const applyRemote = ({ tables, edges }: { tables: ERDTable[]; edges: ERDEdge[] }) => {
      skipNextEmitRef.current = true
      store.loadState(tables, edges)
      setRemoteVersion((v) => v + 1)
    }

    socket.on('room-state', applyRemote)
    socket.on('state-updated', applyRemote)

    socket.on('user-count', (count: number) => {
      setUserCount(count)
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [roomId])

  // Emit state changes (debounced).
  useEffect(() => {
    if (skipNextEmitRef.current) {
      skipNextEmitRef.current = false
      return
    }

    if (emitTimerRef.current) clearTimeout(emitTimerRef.current)
    emitTimerRef.current = setTimeout(() => {
      const socket = socketRef.current
      if (socket?.connected) {
        socket.emit('update-state', {
          tables: store.tables,
          edges: store.edges,
        })
      }
    }, 150)

    return () => {
      if (emitTimerRef.current) clearTimeout(emitTimerRef.current)
    }
  }, [store.tables, store.edges])

  const handleAddTable = useCallback(
    (name: string) => {
      const canvas = document.querySelector('.react-flow__viewport')
      const rect = canvas?.getBoundingClientRect()
      const x = rect ? 100 + Math.random() * (rect.width - 300) : 150
      const y = rect ? 100 + Math.random() * (rect.height - 200) : 150
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

  const handleClearAll = useCallback(() => {
    store.clearAll()
  }, [store])

  const sql = generateSQL({ tables: store.tables, edges: store.edges })

  const sourceTable = pendingConn
    ? store.tables.find((t) => t.id === pendingConn.source)
    : undefined
  const targetTable = pendingConn
    ? store.tables.find((t) => t.id === pendingConn.target)
    : undefined

  return (
    <ReactFlowProvider>
      <div className="flex flex-col" style={{ height: '100vh', background: 'var(--background)' }}>
        <Toolbar
          roomId={roomId}
          userCount={userCount}
          onAddTable={() => setShowAddTable(true)}
          onClearAll={handleClearAll}
        />

        <div className="flex flex-1 overflow-hidden">
          {/* Left: SQL Panel */}
          <SQLPanel sql={sql} />

          {/* Right: ERD Canvas */}
          <ERDCanvas
            tables={store.tables}
            edges={store.edges}
            remoteVersion={remoteVersion}
            onNodeDragStop={handleNodeDragStop}
            onConnect={handleConnect}
            onEdgeDelete={store.deleteEdge}
            onTableDelete={store.deleteTable}
          />
        </div>
      </div>

      {/* Modals */}
      {showAddTable && (
        <AddTableModal
          onConfirm={handleAddTable}
          onCancel={() => setShowAddTable(false)}
        />
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
