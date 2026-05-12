export type PGType =
  | 'SERIAL'
  | 'BIGSERIAL'
  | 'INTEGER'
  | 'BIGINT'
  | 'SMALLINT'
  | 'VARCHAR'
  | 'TEXT'
  | 'BOOLEAN'
  | 'TIMESTAMP'
  | 'TIMESTAMPTZ'
  | 'DATE'
  | 'TIME'
  | 'UUID'
  | 'JSONB'
  | 'JSON'
  | 'DECIMAL'
  | 'REAL'

export const PG_TYPES: PGType[] = [
  'SERIAL',
  'BIGSERIAL',
  'INTEGER',
  'BIGINT',
  'SMALLINT',
  'VARCHAR',
  'TEXT',
  'BOOLEAN',
  'TIMESTAMP',
  'TIMESTAMPTZ',
  'DATE',
  'TIME',
  'UUID',
  'JSONB',
  'JSON',
  'DECIMAL',
  'REAL',
]

export interface Column {
  id: string
  name: string
  type: PGType
  length?: number
  precision?: number
  scale?: number
  primaryKey: boolean
  notNull: boolean
  unique: boolean
  default?: string
}

export interface ERDTable {
  id: string
  name: string
  position: { x: number; y: number }
  columns: Column[]
}

export type RelationType = 'one-to-one' | 'one-to-many' | 'many-to-many'

export interface ERDEdge {
  id: string
  source: string
  target: string
  data: {
    sourceColumnId: string
    targetColumnId: string
    relationType: RelationType
  }
}

export interface ERDState {
  tables: ERDTable[]
  edges: ERDEdge[]
}
