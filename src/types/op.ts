import { Column, ERDEdge, ERDTable } from './erd'

export type Op =
  | { type: 'add-table'; table: ERDTable }
  | { type: 'delete-table'; id: string }
  | { type: 'update-table-name'; id: string; name: string }
  | { type: 'move-table'; id: string; position: { x: number; y: number } }
  | { type: 'add-column'; tableId: string; column: Column }
  | { type: 'update-column'; tableId: string; columnId: string; updates: Partial<Column> }
  | { type: 'delete-column'; tableId: string; columnId: string }
  | { type: 'add-edge'; edge: ERDEdge }
  | { type: 'delete-edge'; id: string }
  | { type: 'load-state'; tables: ERDTable[]; edges: ERDEdge[] }
  | { type: 'clear-all' }
