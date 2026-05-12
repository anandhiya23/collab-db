'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type Node,
  type Edge,
} from '@xyflow/react'
import { TableNode } from './TableNode'
import { ERDTable, ERDEdge } from '@/types/erd'

const nodeTypes = { tableNode: TableNode }

interface ERDCanvasProps {
  tables: ERDTable[]
  edges: ERDEdge[]
  // Increments only when a remote socket update arrives — signals RF to sync positions
  remoteVersion: number
  onNodeDragStop: (tableId: string, position: { x: number; y: number }) => void
  onConnect: (connection: Connection) => void
  onEdgeDelete: (edgeId: string) => void
  onTableDelete: (tableId: string) => void
}

function makeNode(table: ERDTable): Node {
  return {
    id: table.id,
    type: 'tableNode',
    position: table.position,
    // Only store the id — TableNode reads the rest directly from Zustand.
    // This prevents node recreation on every column/name edit.
    data: { tableId: table.id } as unknown as Record<string, unknown>,
  }
}

function erdEdgeToRFEdge(edge: ERDEdge, tables: ERDTable[]): Edge {
  const src = tables.find((t) => t.id === edge.source)
  const tgt = tables.find((t) => t.id === edge.target)
  const srcCol = src?.columns.find((c) => c.id === edge.data.sourceColumnId)
  const tgtCol = tgt?.columns.find((c) => c.id === edge.data.targetColumnId)
  const label =
    edge.data.relationType === 'one-to-one' ? '1:1'
    : edge.data.relationType === 'many-to-many' ? 'N:M'
    : '1:N'

  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
    animated: false,
    label: `${srcCol?.name ?? '?'} → ${tgtCol?.name ?? '?'} (${label})`,
    labelStyle: { fill: '#7c86a2', fontSize: 10, fontFamily: 'monospace' },
    labelBgStyle: { fill: '#1a1d27', fillOpacity: 0.9 },
    labelBgPadding: [4, 2] as [number, number],
    style: { stroke: '#6366f1', strokeWidth: 2 },
    markerEnd: { type: 'arrowclosed' as const, color: '#6366f1' },
  }
}

export function ERDCanvas({
  tables,
  edges,
  remoteVersion,
  onNodeDragStop,
  onConnect,
  onEdgeDelete,
  onTableDelete,
}: ERDCanvasProps) {
  const [nodes, setNodes] = useNodesState(tables.map(makeNode))
  const [rfEdges, setRfEdges] = useEdgesState(edges.map((e) => erdEdgeToRFEdge(e, tables)))
  // Track which node IDs are currently being dragged locally — exclude from remote position sync.
  const draggingIds = useRef(new Set<string>())

  // Sync structural changes (table added / removed) without touching positions.
  const tableIdKey = tables.map((t) => t.id).join(',')
  const prevTableIdKey = useRef(tableIdKey)

  useEffect(() => {
    if (tableIdKey === prevTableIdKey.current) return
    prevTableIdKey.current = tableIdKey

    setNodes((prev) => {
      const prevMap = new Map(prev.map((n) => [n.id, n]))
      const tableSet = new Set(tables.map((t) => t.id))

      // Keep existing nodes (preserves RF positions), add new ones
      const kept = prev.filter((n) => tableSet.has(n.id))
      const added = tables
        .filter((t) => !prevMap.has(t.id))
        .map(makeNode)

      return [...kept, ...added]
    })
  }, [tableIdKey, tables])

  // Sync positions only when a remote update arrives. Skip nodes being dragged locally.
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

  // Sync edges whenever they change
  const edgeKey = edges.map((e) => e.id).join(',')
  useEffect(() => {
    setRfEdges(edges.map((e) => erdEdgeToRFEdge(e, tables)))
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

  return (
    <div className="flex-1 relative">
      <ReactFlow
        nodes={nodes}
        edges={rfEdges}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onNodeDragStart={handleNodeDragStart}
        onNodeDragStop={handleNodeDragStop}
        onConnect={onConnect}
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
        />
      </ReactFlow>
    </div>
  )
}
