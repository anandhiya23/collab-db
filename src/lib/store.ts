import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import { Column, ERDEdge, ERDTable, PGType } from '@/types/erd'

interface ERDStore {
  tables: ERDTable[]
  edges: ERDEdge[]

  addTable: (name: string, position?: { x: number; y: number }) => void
  updateTableName: (id: string, name: string) => void
  updateTablePosition: (id: string, position: { x: number; y: number }) => void
  deleteTable: (id: string) => void

  addColumn: (tableId: string) => void
  updateColumn: (tableId: string, columnId: string, updates: Partial<Column>) => void
  deleteColumn: (tableId: string, columnId: string) => void

  addEdge: (edge: ERDEdge) => void
  deleteEdge: (id: string) => void

  loadState: (tables: ERDTable[], edges: ERDEdge[]) => void
  clearAll: () => void
}

export const useERDStore = create<ERDStore>()(
  subscribeWithSelector((set) => ({
    tables: [],
    edges: [],

    addTable: (name, position = { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 }) =>
      set((state) => ({
        tables: [
          ...state.tables,
          {
            id: uuidv4(),
            name,
            position,
            columns: [
              {
                id: uuidv4(),
                name: 'id',
                type: 'SERIAL' as PGType,
                primaryKey: true,
                notNull: true,
                unique: false,
              },
            ],
          },
        ],
      })),

    updateTableName: (id, name) =>
      set((state) => ({
        tables: state.tables.map((t) => (t.id === id ? { ...t, name } : t)),
      })),

    updateTablePosition: (id, position) =>
      set((state) => ({
        tables: state.tables.map((t) => (t.id === id ? { ...t, position } : t)),
      })),

    deleteTable: (id) =>
      set((state) => ({
        tables: state.tables.filter((t) => t.id !== id),
        edges: state.edges.filter((e) => e.source !== id && e.target !== id),
      })),

    addColumn: (tableId) =>
      set((state) => ({
        tables: state.tables.map((t) => {
          if (t.id !== tableId) return t
          return {
            ...t,
            columns: [
              ...t.columns,
              {
                id: uuidv4(),
                name: `column_${t.columns.length + 1}`,
                type: 'VARCHAR' as PGType,
                length: 255,
                primaryKey: false,
                notNull: false,
                unique: false,
              },
            ],
          }
        }),
      })),

    updateColumn: (tableId, columnId, updates) =>
      set((state) => ({
        tables: state.tables.map((t) => {
          if (t.id !== tableId) return t
          return {
            ...t,
            columns: t.columns.map((c) => (c.id === columnId ? { ...c, ...updates } : c)),
          }
        }),
      })),

    deleteColumn: (tableId, columnId) =>
      set((state) => ({
        tables: state.tables.map((t) => {
          if (t.id !== tableId) return t
          return { ...t, columns: t.columns.filter((c) => c.id !== columnId) }
        }),
      })),

    addEdge: (edge) =>
      set((state) => ({ edges: [...state.edges, edge] })),

    deleteEdge: (id) =>
      set((state) => ({ edges: state.edges.filter((e) => e.id !== id) })),

    loadState: (tables, edges) => set({ tables, edges }),

    clearAll: () => set({ tables: [], edges: [] }),
  }))
)
