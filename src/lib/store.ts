import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { Column, ERDEdge, ERDTable, PGType } from '@/types/erd'
import { Op } from '@/types/op'

interface ERDStore {
  tables: ERDTable[]
  edges: ERDEdge[]
  _opListener: ((op: Op) => void) | null

  setOpListener: (fn: ((op: Op) => void) | null) => void
  applyOp: (op: Op) => void

  addTable: (name: string, position?: { x: number; y: number }) => void
  updateTableName: (id: string, name: string) => void
  updateTablePosition: (id: string, position: { x: number; y: number }) => void
  deleteTable: (id: string) => void

  addColumn: (tableId: string) => void
  updateColumn: (tableId: string, columnId: string, updates: Partial<Column>) => void
  deleteColumn: (tableId: string, columnId: string) => void

  duplicateTable: (table: ERDTable, offset?: { x: number; y: number }) => void

  addEdge: (edge: ERDEdge) => void
  deleteEdge: (id: string) => void

  loadState: (tables: ERDTable[], edges: ERDEdge[]) => void
  clearAll: () => void
}

export const useERDStore = create<ERDStore>()(
  subscribeWithSelector((set, get) => ({
    tables: [],
    edges: [],
    _opListener: null,

    setOpListener: (fn) => set({ _opListener: fn }),

    applyOp: (op) =>
      set((state) => {
        switch (op.type) {
          case 'add-table':
            return { tables: [...state.tables, op.table] }
          case 'delete-table':
            return {
              tables: state.tables.filter((t) => t.id !== op.id),
              edges: state.edges.filter((e) => e.source !== op.id && e.target !== op.id),
            }
          case 'update-table-name':
            return { tables: state.tables.map((t) => (t.id === op.id ? { ...t, name: op.name } : t)) }
          case 'move-table':
            return { tables: state.tables.map((t) => (t.id === op.id ? { ...t, position: op.position } : t)) }
          case 'add-column':
            return {
              tables: state.tables.map((t) =>
                t.id === op.tableId ? { ...t, columns: [...t.columns, op.column] } : t
              ),
            }
          case 'update-column':
            return {
              tables: state.tables.map((t) =>
                t.id !== op.tableId
                  ? t
                  : { ...t, columns: t.columns.map((c) => (c.id === op.columnId ? { ...c, ...op.updates } : c)) }
              ),
            }
          case 'delete-column':
            return {
              tables: state.tables.map((t) =>
                t.id !== op.tableId ? t : { ...t, columns: t.columns.filter((c) => c.id !== op.columnId) }
              ),
            }
          case 'reorder-columns':
            return {
              tables: state.tables.map((t) =>
                t.id !== op.tableId ? t : {
                  ...t,
                  columns: op.columnIds
                    .map((id) => t.columns.find((c) => c.id === id))
                    .filter((c): c is Column => c !== undefined),
                }
              ),
            }
          case 'add-edge':
            return { edges: [...state.edges, op.edge] }
          case 'delete-edge':
            return { edges: state.edges.filter((e) => e.id !== op.id) }
          case 'load-state':
            return { tables: op.tables, edges: op.edges }
          case 'clear-all':
            return { tables: [], edges: [] }
          default:
            return state
        }
      }),

    addTable: (name, position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }) => {
      const table: ERDTable = {
        id: uuidv4(),
        name,
        position,
        columns: [{ id: uuidv4(), name: 'id', type: 'SERIAL' as PGType, primaryKey: true, notNull: true, unique: false }],
      }
      set((state) => ({ tables: [...state.tables, table] }))
      get()._opListener?.({ type: 'add-table', table })
    },

    updateTableName: (id, name) => {
      set((state) => ({ tables: state.tables.map((t) => (t.id === id ? { ...t, name } : t)) }))
      get()._opListener?.({ type: 'update-table-name', id, name })
    },

    updateTablePosition: (id, position) => {
      set((state) => ({ tables: state.tables.map((t) => (t.id === id ? { ...t, position } : t)) }))
      get()._opListener?.({ type: 'move-table', id, position })
    },

    deleteTable: (id) => {
      set((state) => ({
        tables: state.tables.filter((t) => t.id !== id),
        edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      }))
      get()._opListener?.({ type: 'delete-table', id })
    },

    addColumn: (tableId) => {
      const table = get().tables.find((t) => t.id === tableId)
      if (!table) return
      const column: Column = {
        id: uuidv4(),
        name: `column_${table.columns.length + 1}`,
        type: 'VARCHAR' as PGType,
        length: 255,
        primaryKey: false,
        notNull: false,
        unique: false,
      }
      set((state) => ({
        tables: state.tables.map((t) =>
          t.id === tableId ? { ...t, columns: [...t.columns, column] } : t
        ),
      }))
      get()._opListener?.({ type: 'add-column', tableId, column })
    },

    updateColumn: (tableId, columnId, updates) => {
      set((state) => ({
        tables: state.tables.map((t) =>
          t.id !== tableId
            ? t
            : { ...t, columns: t.columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c)) }
        ),
      }))
      get()._opListener?.({ type: 'update-column', tableId, columnId, updates })
    },

    deleteColumn: (tableId, columnId) => {
      set((state) => ({
        tables: state.tables.map((t) =>
          t.id !== tableId ? t : { ...t, columns: t.columns.filter((c) => c.id !== columnId) }
        ),
      }))
      get()._opListener?.({ type: 'delete-column', tableId, columnId })
    },

    duplicateTable: (table, offset = { x: 40, y: 40 }) => {
      const newTable: ERDTable = {
        id: uuidv4(),
        name: `${table.name}_copy`,
        position: { x: table.position.x + offset.x, y: table.position.y + offset.y },
        columns: table.columns.map((c) => ({ ...c, id: uuidv4() })),
      }
      set((state) => ({ tables: [...state.tables, newTable] }))
      get()._opListener?.({ type: 'add-table', table: newTable })
    },

    addEdge: (edge) => {
      set((state) => ({ edges: [...state.edges, edge] }))
      get()._opListener?.({ type: 'add-edge', edge })
    },

    deleteEdge: (id) => {
      set((state) => ({ edges: state.edges.filter((e) => e.id !== id) }))
      get()._opListener?.({ type: 'delete-edge', id })
    },

    loadState: (tables, edges) => {
      set({ tables, edges })
      get()._opListener?.({ type: 'load-state', tables, edges })
    },

    clearAll: () => {
      set({ tables: [], edges: [] })
      get()._opListener?.({ type: 'clear-all' })
    },
  }))
)
