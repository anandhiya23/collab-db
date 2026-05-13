import { Column, ERDEdge, ERDState } from '@/types/erd'
import { Op } from '@/types/op'

function colUpdates(prev: Column, next: Column): Partial<Column> | null {
  const u: Partial<Column> = {}
  if (prev.name !== next.name) u.name = next.name
  if (prev.type !== next.type) u.type = next.type
  if (prev.primaryKey !== next.primaryKey) u.primaryKey = next.primaryKey
  if (prev.notNull !== next.notNull) u.notNull = next.notNull
  if (prev.unique !== next.unique) u.unique = next.unique
  if (prev.default !== next.default) u.default = next.default
  if (prev.length !== next.length) u.length = next.length
  if (prev.precision !== next.precision) u.precision = next.precision
  if (prev.scale !== next.scale) u.scale = next.scale
  return Object.keys(u).length > 0 ? u : null
}

function edgeKey(e: ERDEdge): string {
  return `${e.source}:${e.data.sourceColumnId}:${e.target}:${e.data.targetColumnId}:${e.data.relationType}`
}

export function diffERDState(prev: ERDState, next: ERDState): Op[] {
  const ops: Op[] = []

  const prevTableMap = new Map(prev.tables.map((t) => [t.id, t]))
  const nextTableMap = new Map(next.tables.map((t) => [t.id, t]))

  // Deleted tables
  for (const t of prev.tables) {
    if (!nextTableMap.has(t.id)) ops.push({ type: 'delete-table', id: t.id })
  }

  // Added tables
  for (const t of next.tables) {
    if (!prevTableMap.has(t.id)) ops.push({ type: 'add-table', table: t })
  }

  // Changed tables
  for (const nextT of next.tables) {
    const prevT = prevTableMap.get(nextT.id)
    if (!prevT) continue

    if (prevT.name !== nextT.name) {
      ops.push({ type: 'update-table-name', id: nextT.id, name: nextT.name })
    }

    const prevColMap = new Map(prevT.columns.map((c) => [c.id, c]))
    const nextColMap = new Map(nextT.columns.map((c) => [c.id, c]))

    for (const c of prevT.columns) {
      if (!nextColMap.has(c.id)) ops.push({ type: 'delete-column', tableId: nextT.id, columnId: c.id })
    }
    for (const c of nextT.columns) {
      if (!prevColMap.has(c.id)) ops.push({ type: 'add-column', tableId: nextT.id, column: c })
    }
    for (const nextC of nextT.columns) {
      const prevC = prevColMap.get(nextC.id)
      if (!prevC) continue
      const u = colUpdates(prevC, nextC)
      if (u) ops.push({ type: 'update-column', tableId: nextT.id, columnId: nextC.id, updates: u })
    }

    // Detect reorder: natural post-op order is surviving-prev + new-appended
    const naturalOrder = [
      ...prevT.columns.filter((c) => nextColMap.has(c.id)).map((c) => c.id),
      ...nextT.columns.filter((c) => !prevColMap.has(c.id)).map((c) => c.id),
    ]
    const desiredOrder = nextT.columns.map((c) => c.id)
    if (naturalOrder.join(',') !== desiredOrder.join(',')) {
      ops.push({ type: 'reorder-columns', tableId: nextT.id, columnIds: desiredOrder })
    }
  }

  // Edges — DBML regenerates all refs, match by semantic key to avoid churn
  const prevEdgeKeys = new Map(prev.edges.map((e) => [edgeKey(e), e]))
  const nextEdgeKeys = new Set(next.edges.map(edgeKey))

  for (const e of prev.edges) {
    if (!nextEdgeKeys.has(edgeKey(e))) ops.push({ type: 'delete-edge', id: e.id })
  }
  for (const e of next.edges) {
    if (!prevEdgeKeys.has(edgeKey(e))) ops.push({ type: 'add-edge', edge: e })
  }

  return ops
}
