'use client'

import React, { useCallback, useEffect, useReducer, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useStore,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type EdgeProps,
  type Node,
  type Edge,
} from '@xyflow/react'
import { TableNode } from './TableNode'
import { ERDTable, ERDEdge } from '@/types/erd'
import { RemoteCanvasCursor } from '@/types/presence'

function RelationEdge({
  selected, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  })
  const stroke = selected ? '#818cf8' : '#6366f1'
  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={markerEnd}
        style={{ stroke, strokeWidth: selected ? 2.5 : 2 }}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            display: 'flex',
            alignItems: 'stretch',
            gap: 4,
          }}
        >
          <span
            style={{
              background: '#1a1d27',
              color: selected ? '#a5b4fc' : '#7c86a2',
              fontSize: 10,
              fontFamily: 'monospace',
              padding: '2px 6px',
              borderRadius: 3,
              border: `1px solid ${selected ? '#6366f144' : 'transparent'}`,
            }}
          >
            {(data as Record<string, unknown>).label as string}
          </span>
          {selected && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                ;(data as Record<string, () => void>).onDelete?.()
              }}
              style={{
                background: '#2a1a1a',
                border: '1px solid #ef444488',
                borderRadius: 3,
                color: '#ef4444',
                fontSize: 13,
                cursor: 'pointer',
                padding: '0 5px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              ×
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

const nodeTypes = { tableNode: TableNode }
const edgeTypes = { erdEdge: RelationEdge }

interface ERDCanvasProps {
  tables: ERDTable[]
  edges: ERDEdge[]
  remoteVersion: number
  remoteCursors: RemoteCanvasCursor[]
  screenToFlowRef?: React.MutableRefObject<((pos: { x: number; y: number }) => { x: number; y: number }) | null>
  focusTableRef?: React.MutableRefObject<((tableId: string) => void) | null>
  onNodeDragStop: (tableId: string, position: { x: number; y: number }) => void
  onConnect: (connection: Connection) => void
  onEdgeDelete: (edgeId: string) => void
  onTableDelete: (tableId: string) => void
  onCursorMove: (x: number, y: number) => void
}

function makeNode(table: ERDTable): Node {
  return {
    id: table.id,
    type: 'tableNode',
    position: table.position,
    data: { tableId: table.id } as unknown as Record<string, unknown>,
  }
}

function erdEdgeToRFEdge(edge: ERDEdge, tables: ERDTable[], onDelete: (id: string) => void): Edge {
  const src = tables.find((t) => t.id === edge.source)
  const tgt = tables.find((t) => t.id === edge.target)
  const srcCol = src?.columns.find((c) => c.id === edge.data.sourceColumnId)
  const tgtCol = tgt?.columns.find((c) => c.id === edge.data.targetColumnId)
  const rel =
    edge.data.relationType === 'one-to-one' ? '1:1'
    : edge.data.relationType === 'many-to-many' ? 'N:M'
    : '1:N'

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'erdEdge',
    animated: false,
    data: {
      label: `${srcCol?.name ?? '?'} → ${tgtCol?.name ?? '?'} (${rel})`,
      onDelete: () => onDelete(edge.id),
    },
    markerEnd: { type: 'arrowclosed' as const, color: '#6366f1' },
  }
}

function CursorLayer({ cursors }: { cursors: RemoteCanvasCursor[] }) {
  const [vpX, vpY, zoom] = useStore((s) => s.transform)
  const targetsRef = useRef(new Map<string, { x: number; y: number }>())
  const lerpedRef = useRef(new Map<string, { x: number; y: number }>())
  const rafRef = useRef<number | null>(null)
  const [, redraw] = useReducer((n: number) => n + 1, 0)

  useEffect(() => {
    const ids = new Set(cursors.map((c) => c.socketId))
    for (const c of cursors) {
      targetsRef.current.set(c.socketId, { x: c.x, y: c.y })
      // New cursor: snap to position instead of lerping from (0,0)
      if (!lerpedRef.current.has(c.socketId)) {
        lerpedRef.current.set(c.socketId, { x: c.x, y: c.y })
      }
    }
    for (const id of [...lerpedRef.current.keys()]) {
      if (!ids.has(id)) { lerpedRef.current.delete(id); targetsRef.current.delete(id) }
    }

    if (cursors.length === 0) return

    let active = true
    const animate = () => {
      if (!active) return
      let moving = false
      for (const [id, target] of targetsRef.current) {
        const cur = lerpedRef.current.get(id)
        if (!cur) { lerpedRef.current.set(id, target); continue }
        const dx = target.x - cur.x
        const dy = target.y - cur.y
        if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) {
          lerpedRef.current.set(id, { x: cur.x + dx * 0.3, y: cur.y + dy * 0.3 })
          moving = true
        } else {
          lerpedRef.current.set(id, target)
        }
      }
      redraw()
      if (moving) rafRef.current = requestAnimationFrame(animate)
    }

    rafRef.current = requestAnimationFrame(animate)
    return () => {
      active = false
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [cursors])

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 10 }}>
      {cursors.map((c) => {
        const pos = lerpedRef.current.get(c.socketId) ?? { x: c.x, y: c.y }
        return (
          <div
            key={c.socketId}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              pointerEvents: 'none',
              transform: `translate(${pos.x * zoom + vpX - 3}px, ${pos.y * zoom + vpY - 3}px)`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" style={{ display: 'block' }}>
              <circle cx="6" cy="6" r="5" fill={c.color} stroke="#0f1117" strokeWidth="1.5" />
            </svg>
            <div
              style={{
                position: 'absolute',
                left: 14,
                top: -3,
                fontSize: 10,
                fontWeight: 600,
                color: '#fff',
                background: c.color,
                padding: '1px 6px',
                borderRadius: 4,
                whiteSpace: 'nowrap',
                boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
              }}
            >
              {c.name}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function CanvasInner({
  tables,
  edges,
  remoteVersion,
  remoteCursors,
  screenToFlowRef,
  focusTableRef,
  onNodeDragStop,
  onConnect,
  onEdgeDelete,
  onTableDelete,
  onCursorMove,
}: ERDCanvasProps) {
  const [nodes, setNodes] = useNodesState(tables.map(makeNode))
  const onEdgeDeleteRef = useRef(onEdgeDelete)
  onEdgeDeleteRef.current = onEdgeDelete
  const [rfEdges, setRfEdges] = useEdgesState(
    edges.map((e) => erdEdgeToRFEdge(e, tables, (id) => onEdgeDeleteRef.current(id)))
  )
  const draggingIds = useRef(new Set<string>())
  const rf = useReactFlow()
  const lastCursorTime = useRef(0)

  useEffect(() => {
    if (screenToFlowRef) screenToFlowRef.current = rf.screenToFlowPosition
  }, [rf, screenToFlowRef])

  const tablesRef = useRef(tables)
  tablesRef.current = tables
  useEffect(() => {
    if (!focusTableRef) return
    focusTableRef.current = (tableId: string) => {
      const t = tablesRef.current.find((t) => t.id === tableId)
      if (!t) return
      rf.setCenter(t.position.x + 170, t.position.y + 80, { zoom: 1.2, duration: 500 })
    }
  }, [rf, focusTableRef])

  const tableIdKey = tables.map((t) => t.id).join(',')
  const prevTableIdKey = useRef(tableIdKey)

  useEffect(() => {
    if (tableIdKey === prevTableIdKey.current) return
    prevTableIdKey.current = tableIdKey
    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]))
      const tableSet = new Set(tables.map((t) => t.id))
      const kept = prev.filter((n) => tableSet.has(n.id))
      const added = tables.filter((t) => !prevMap.has(t.id)).map(makeNode)
      return [...kept, ...added]
    })
  }, [tableIdKey, tables])

  const isFirst = useRef(true)
  useEffect(() => {
    if (isFirst.current) { isFirst.current = false; return }
    setNodes((prev) => {
      const posMap = new Map(tables.map((t) => [t.id, t.position]))
      return prev.map((n) => {
        if (draggingIds.current.has(n.id)) return n
        const pos = posMap.get(n.id)
        return pos ? { ...n, position: pos } : n
      })
    })
  }, [remoteVersion]) // eslint-disable-line react-hooks/exhaustive-deps

  const edgeKey = edges.map((e) => e.id).join(',')
  useEffect(() => {
    setRfEdges(edges.map((e) => erdEdgeToRFEdge(e, tables, (id) => onEdgeDeleteRef.current(id))))
  }, [edgeKey, tables]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => applyNodeChanges(changes, prev))
      for (const c of changes) {
        if (c.type === 'remove') onTableDelete(c.id)
      }
    },
    [onTableDelete, setNodes]
  )

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setRfEdges((prev) => applyEdgeChanges(changes, prev))
      for (const c of changes) {
        if (c.type === 'remove') onEdgeDelete(c.id)
      }
    },
    [onEdgeDelete, setRfEdges]
  )

  const handleNodeDragStart = useCallback((_: React.MouseEvent, node: Node) => {
    draggingIds.current.add(node.id)
  }, [])

  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      draggingIds.current.delete(node.id)
      onNodeDragStop(node.id, { x: node.position.x, y: node.position.y })
    },
    [onNodeDragStop]
  )

  const handleSelectionDragStart = useCallback((_: React.MouseEvent, nodes: Node[]) => {
    for (const n of nodes) draggingIds.current.add(n.id)
  }, [])

  const handleSelectionDragStop = useCallback(
    (_: React.MouseEvent, nodes: Node[]) => {
      for (const n of nodes) {
        draggingIds.current.delete(n.id)
        onNodeDragStop(n.id, { x: n.position.x, y: n.position.y })
      }
    },
    [onNodeDragStop]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const now = Date.now()
      if (now - lastCursorTime.current < 50) return
      lastCursorTime.current = now
      const pos = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY })
      onCursorMove(pos.x, pos.y)
    },
    [rf, onCursorMove]
  )

  return (
    <div className="flex-1 relative" style={{ userSelect: 'none' }}>
      <ReactFlow
        nodes={nodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onSelectionDragStart={handleSelectionDragStart}
        onSelectionDragStop={handleSelectionDragStop}
        onConnect={onConnect}
        onMouseMove={handleMouseMove}
        deleteKeyCode={null}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: 'var(--background)' }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#2d3148" />
        <Controls style={{ bottom: 16, left: 16 }} showInteractive={false} />
        <MiniMap
          style={{
            bottom: 16,
            right: 16,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
          }}
          nodeColor="#6366f1"
          maskColor="rgba(15,17,23,0.8)"
          pannable
          zoomable
        />
      </ReactFlow>
      <CursorLayer cursors={remoteCursors} />
    </div>
  )
}

export function ERDCanvas(props: ERDCanvasProps) {
  return <CanvasInner {...props} />
}
