import { v4 as uuidv4 } from 'uuid'
import { Column, ERDEdge, ERDState, ERDTable, PGType, RelationType } from '@/types/erd'

function dbmlType(col: Column): string {
  switch (col.type) {
    case 'VARCHAR':
      return `varchar(${col.length ?? 255})`
    case 'DECIMAL':
      return `decimal(${col.precision ?? 10}, ${col.scale ?? 2})`
    case 'SERIAL':
    case 'INTEGER':
      return 'int'
    case 'BIGSERIAL':
    case 'BIGINT':
      return 'bigint'
    default:
      return col.type.toLowerCase()
  }
}

function columnToDBML(col: Column): string {
  const settings: string[] = []
  if (col.primaryKey) settings.push('pk')
  if (col.type === 'SERIAL' || col.type === 'BIGSERIAL') settings.push('increment')
  if (col.unique && !col.primaryKey) settings.push('unique')
  if (col.notNull && !col.primaryKey) settings.push('not null')
  if (col.default !== undefined && col.default !== '') settings.push(`default: ${col.default}`)

  const settingStr = settings.length > 0 ? ` [${settings.join(', ')}]` : ''
  return `  ${col.name} ${dbmlType(col)}${settingStr}`
}

function tableToDBML(table: ERDTable): string {
  if (table.columns.length === 0) return `Table ${table.name} {}`
  const cols = table.columns.map(columnToDBML).join('\n')
  return `Table ${table.name} {\n${cols}\n}`
}

function edgeToDBML(edge: ERDEdge, tables: ERDTable[]): string | null {
  const src = tables.find((t) => t.id === edge.source)
  const tgt = tables.find((t) => t.id === edge.target)
  if (!src || !tgt) return null

  const srcCol = src.columns.find((c) => c.id === edge.data.sourceColumnId)
  const tgtCol = tgt.columns.find((c) => c.id === edge.data.targetColumnId)
  if (!srcCol || !tgtCol) return null

  const relMap: Record<string, string> = {
    'one-to-one': '-',
    'one-to-many': '<',
    'many-to-many': '<>',
  }
  const rel = relMap[edge.data.relationType] ?? '<'
  return `Ref: ${src.name}.${srcCol.name} ${rel} ${tgt.name}.${tgtCol.name}`
}

export function generateDBML(state: ERDState): string {
  if (state.tables.length === 0) {
    return '// No tables defined yet.\n// Add tables using the canvas on the right.'
  }

  const parts: string[] = []
  parts.push(`// Generated DBML\n// ${new Date().toUTCString()}\n`)

  for (const table of state.tables) {
    parts.push(tableToDBML(table))
  }

  const refs = state.edges
    .map((e) => edgeToDBML(e, state.tables))
    .filter((s): s is string => s !== null)

  if (refs.length > 0) {
    parts.push(refs.join('\n'))
  }

  return parts.join('\n\n')
}

export function tokenizeDBML(code: string): Array<{ text: string; cls: string }> {
  const ranges: Array<{ start: number; end: number; cls: string }> = []
  let m: RegExpExecArray | null

  const commentRe = /\/\/.*$/gm
  while ((m = commentRe.exec(code)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length, cls: 'sql-comment' })
  }

  const isInComment = (start: number, end: number) =>
    ranges.some((r) => r.cls === 'sql-comment' && start >= r.start && end <= r.end)

  const kwRe = /\b(Table|Ref|Project|Note|indexes|enum)\b/g
  while ((m = kwRe.exec(code)) !== null) {
    if (!isInComment(m.index, m.index + m[0].length)) {
      ranges.push({ start: m.index, end: m.index + m[0].length, cls: 'sql-keyword' })
    }
  }

  // Settings in brackets [...]
  const settingsRe = /\[[^\]]*\]/g
  while ((m = settingsRe.exec(code)) !== null) {
    if (!isInComment(m.index, m.index + m[0].length)) {
      ranges.push({ start: m.index, end: m.index + m[0].length, cls: 'sql-type' })
    }
  }

  ranges.sort((a, b) => a.start - b.start)

  const cleanRanges: typeof ranges = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start >= cursor) {
      cleanRanges.push(r)
      cursor = r.end
    }
  }

  const tokens: Array<{ text: string; cls: string }> = []
  let lastIndex = 0
  for (const r of cleanRanges) {
    if (r.start > lastIndex) {
      tokens.push({ text: code.slice(lastIndex, r.start), cls: '' })
    }
    tokens.push({ text: code.slice(r.start, r.end), cls: r.cls })
    lastIndex = r.end
  }
  if (lastIndex < code.length) {
    tokens.push({ text: code.slice(lastIndex), cls: '' })
  }

  return tokens
}

function parseDBMLType(
  raw: string,
  hasIncrement: boolean
): { type: PGType; length?: number; precision?: number; scale?: number } {
  const lower = raw.toLowerCase().trim()
  if (lower.startsWith('varchar')) {
    const m = lower.match(/varchar\((\d+)\)/)
    return { type: 'VARCHAR', length: m ? parseInt(m[1]) : 255 }
  }
  if (lower.startsWith('decimal')) {
    const m = lower.match(/decimal\((\d+),\s*(\d+)\)/)
    return { type: 'DECIMAL', precision: m ? parseInt(m[1]) : 10, scale: m ? parseInt(m[2]) : 2 }
  }
  if ((lower === 'int' || lower === 'integer') && hasIncrement) return { type: 'SERIAL' }
  if (lower === 'bigint' && hasIncrement) return { type: 'BIGSERIAL' }
  if (lower === 'int' || lower === 'integer') return { type: 'INTEGER' }
  if (lower === 'bigint') return { type: 'BIGINT' }
  if (lower === 'smallint') return { type: 'SMALLINT' }
  if (lower === 'text') return { type: 'TEXT' }
  if (lower === 'boolean' || lower === 'bool') return { type: 'BOOLEAN' }
  if (lower === 'timestamptz') return { type: 'TIMESTAMPTZ' }
  if (lower === 'timestamp') return { type: 'TIMESTAMP' }
  if (lower === 'date') return { type: 'DATE' }
  if (lower === 'time') return { type: 'TIME' }
  if (lower === 'uuid') return { type: 'UUID' }
  if (lower === 'jsonb') return { type: 'JSONB' }
  if (lower === 'json') return { type: 'JSON' }
  if (lower === 'real' || lower.startsWith('float')) return { type: 'REAL' }
  return { type: 'TEXT' }
}

interface PendingRef {
  fromTableName: string
  fromColName: string
  op: string
  toTableName: string
  toColName: string
}

function resolveRef(
  fromTableName: string, fromColName: string,
  op: string,
  toTableName: string, toColName: string,
  tables: ERDTable[],
): ERDEdge | null {
  const fromTable = tables.find((t) => t.name === fromTableName)
  const toTable = tables.find((t) => t.name === toTableName)
  if (!fromTable || !toTable) return null
  const fromCol = fromTable.columns.find((c) => c.name === fromColName)
  const toCol = toTable.columns.find((c) => c.name === toColName)
  if (!fromCol || !toCol) return null

  const relationType: RelationType =
    op === '-' ? 'one-to-one' : op === '<>' ? 'many-to-many' : 'one-to-many'

  // Convention: edge.source = "one" side (PK/parent), edge.target = "many" side (FK/child)
  // `A.col < B.col` → A is one side (source), B is many/FK side (target) — no swap
  // `A.col > B.col` → A is FK/many side (target), B is one side (source) — swap
  const swap = op === '>'
  return {
    id: uuidv4(),
    source: swap ? toTable.id : fromTable.id,
    target: swap ? fromTable.id : toTable.id,
    data: {
      sourceColumnId: swap ? toCol.id : fromCol.id,
      targetColumnId: swap ? fromCol.id : toCol.id,
      relationType,
    },
  }
}

export function parseDBML(code: string, existingTables: ERDTable[], viewportCenter?: { x: number; y: number }): ERDState {
  const tables: ERDTable[] = []
  const edges: ERDEdge[] = []
  const pendingRefs: PendingRef[] = []

  const stripped = code.replace(/\/\/.*$/gm, '')
  const lines = stripped.split('\n')

  function parseColumn(raw: string, tableName: string, existing: ERDTable | undefined): Column | null {
    const colMatch = raw.trim().match(/^(\w+)\s+([^\[]+?)\s*(?:\[([^\]]*)\])?$/)
    if (!colMatch) return null
    const [, name, rawType, settingsStr = ''] = colMatch

    // Split settings carefully — ref values can contain dots and symbols but not commas
    const settings = settingsStr.split(',').map((s) => s.trim()).filter(Boolean)

    const hasPk = settings.some((s) => /^pk$/i.test(s) || /^primary key$/i.test(s))
    const hasIncrement = settings.some((s) => /^increment$/i.test(s))
    const hasUnique = settings.some((s) => /^unique$/i.test(s))
    const hasNotNull = settings.some((s) => /^not null$/i.test(s))
    const defaultSetting = settings.find((s) => /^default:/i.test(s))
    const defaultVal = defaultSetting ? defaultSetting.replace(/^default:\s*/i, '').trim() : undefined

    // Inline ref: `ref: > table.col` or `ref: - table.col` etc.
    const refSetting = settings.find((s) => /^ref:/i.test(s))
    if (refSetting) {
      const m = refSetting.match(/^ref:\s*(<>|[-<>])\s*(\w+)\.(\w+)/i)
      if (m) {
        pendingRefs.push({ fromTableName: tableName, fromColName: name, op: m[1], toTableName: m[2], toColName: m[3] })
      }
    }

    const { type, length, precision, scale } = parseDBMLType(rawType, hasIncrement)
    const existingCol = existing?.columns.find((c) => c.name === name)
    return {
      id: existingCol?.id ?? uuidv4(),
      name,
      type,
      ...(length !== undefined && { length }),
      ...(precision !== undefined && { precision }),
      ...(scale !== undefined && { scale }),
      primaryKey: hasPk,
      notNull: hasNotNull || hasPk,
      unique: hasUnique,
      ...(defaultVal !== undefined && { default: defaultVal }),
    }
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i].trim()

    // Single-line table: Table foo { ... }
    const inlineMatch = line.match(/^Table\s+(\w+)\s*\{([^}]*)\}/)
    if (inlineMatch) {
      const tableName = inlineMatch[1]
      const existing = existingTables.find((t) => t.name === tableName)
      const cx = viewportCenter?.x ?? 300
      const cy = viewportCenter?.y ?? 300
      const position = existing?.position ?? { x: cx + (Math.random() - 0.5) * 200, y: cy + (Math.random() - 0.5) * 200 }
      const columns: Column[] = []
      for (const l of inlineMatch[2].split('\n')) {
        const col = parseColumn(l, tableName, existing)
        if (col) columns.push(col)
      }
      tables.push({ id: existing?.id ?? uuidv4(), name: tableName, position, columns })
      i++
      continue
    }

    // Multi-line table: Table foo {
    const openMatch = line.match(/^Table\s+(\w+)\s*\{/)
    if (openMatch) {
      const tableName = openMatch[1]
      const existing = existingTables.find((t) => t.name === tableName)
      const cx = viewportCenter?.x ?? 300
      const cy = viewportCenter?.y ?? 300
      const position = existing?.position ?? { x: cx + (Math.random() - 0.5) * 200, y: cy + (Math.random() - 0.5) * 200 }
      const columns: Column[] = []
      i++
      while (i < lines.length) {
        const bodyLine = lines[i].trim()
        if (bodyLine === '}') { i++; break }
        if (/^Table\s+\w+/.test(bodyLine) || /^Ref:/.test(bodyLine)) break
        const col = parseColumn(bodyLine, tableName, existing)
        if (col) columns.push(col)
        i++
      }
      tables.push({ id: existing?.id ?? uuidv4(), name: tableName, position, columns })
      continue
    }

    // Explicit Ref block
    const refMatch = line.match(/^Ref:\s*(\w+)\.(\w+)\s*(<>|[-<>])\s*(\w+)\.(\w+)/)
    if (refMatch) {
      const [, srcName, srcColName, rel, tgtName, tgtColName] = refMatch
      const edge = resolveRef(srcName, srcColName, rel, tgtName, tgtColName, tables)
      if (edge) edges.push(edge)
    }

    i++
  }

  // Resolve inline refs collected during table parsing
  for (const r of pendingRefs) {
    const edge = resolveRef(r.fromTableName, r.fromColName, r.op, r.toTableName, r.toColName, tables)
    if (edge) edges.push(edge)
  }

  return { tables, edges }
}
