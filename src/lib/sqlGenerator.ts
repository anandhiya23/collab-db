import { Column, ERDEdge, ERDState, ERDTable } from '@/types/erd'

function formatType(col: Column): string {
  switch (col.type) {
    case 'VARCHAR':
      return `VARCHAR(${col.length ?? 255})`
    case 'DECIMAL':
      return `DECIMAL(${col.precision ?? 10}, ${col.scale ?? 2})`
    default:
      return col.type
  }
}

function columnToSQL(col: Column): string {
  const parts: string[] = [`  ${col.name}`, formatType(col)]
  if (col.primaryKey) {
    parts.push('PRIMARY KEY')
  } else {
    if (col.notNull) parts.push('NOT NULL')
    if (col.unique) parts.push('UNIQUE')
  }
  if (col.default !== undefined && col.default !== '') {
    parts.push(`DEFAULT ${col.default}`)
  }
  return parts.join(' ')
}

function tableToSQL(table: ERDTable): string {
  if (table.columns.length === 0) {
    return `CREATE TABLE ${table.name} ();`
  }
  const cols = table.columns.map(columnToSQL).join(',\n')
  return `CREATE TABLE ${table.name} (\n${cols}\n);`
}

function edgeToSQL(edge: ERDEdge, tables: ERDTable[]): string | null {
  const src = tables.find((t) => t.id === edge.source)
  const tgt = tables.find((t) => t.id === edge.target)
  if (!src || !tgt) return null

  const srcCol = src.columns.find((c) => c.id === edge.data.sourceColumnId)
  const tgtCol = tgt.columns.find((c) => c.id === edge.data.targetColumnId)
  if (!srcCol || !tgtCol) return null

  const constraintName = `fk_${src.name}_${srcCol.name}`
  return `ALTER TABLE ${src.name}\n  ADD CONSTRAINT ${constraintName}\n  FOREIGN KEY (${srcCol.name})\n  REFERENCES ${tgt.name}(${tgtCol.name});`
}

export function generateSQL(state: ERDState): string {
  if (state.tables.length === 0) {
    return '-- No tables defined yet.\n-- Add tables using the canvas on the right.'
  }

  const parts: string[] = []
  parts.push(`-- Generated PostgreSQL DDL\n-- ${new Date().toUTCString()}\n`)

  for (const table of state.tables) {
    parts.push(tableToSQL(table))
  }

  const fkLines = state.edges
    .map((e) => edgeToSQL(e, state.tables))
    .filter((s): s is string => s !== null)

  if (fkLines.length > 0) {
    parts.push('-- Foreign Key Constraints')
    parts.push(...fkLines)
  }

  return parts.join('\n\n')
}

// Tokenize SQL for syntax highlighting
export function tokenizeSQL(sql: string): Array<{ text: string; cls: string }> {
  const keywords = /\b(CREATE|TABLE|ALTER|ADD|CONSTRAINT|FOREIGN|KEY|REFERENCES|PRIMARY|NOT|NULL|UNIQUE|DEFAULT|INDEX|IF|EXISTS|CASCADE|ON|DELETE|UPDATE|RESTRICT|SET)\b/gi
  const types = /\b(SERIAL|BIGSERIAL|INTEGER|BIGINT|SMALLINT|VARCHAR|TEXT|BOOLEAN|TIMESTAMP|TIMESTAMPTZ|DATE|TIME|UUID|JSONB|JSON|DECIMAL|REAL|INT|CHAR)\b/gi
  const comments = /^--.*$/gm

  const tokens: Array<{ text: string; cls: string }> = []
  let lastIndex = 0

  const ranges: Array<{ start: number; end: number; cls: string }> = []

  let m: RegExpExecArray | null

  const commentRe = /^--.*$/gm
  while ((m = commentRe.exec(sql)) !== null) {
    ranges.push({ start: m.index, end: m.index + m[0].length, cls: 'sql-comment' })
  }

  // Only match keywords/types outside comment ranges
  const isInComment = (start: number, end: number) =>
    ranges.some((r) => r.cls === 'sql-comment' && start >= r.start && end <= r.end)

  const kwRe = new RegExp(keywords.source, 'gi')
  while ((m = kwRe.exec(sql)) !== null) {
    if (!isInComment(m.index, m.index + m[0].length)) {
      ranges.push({ start: m.index, end: m.index + m[0].length, cls: 'sql-keyword' })
    }
  }

  const typeRe = new RegExp(types.source, 'gi')
  while ((m = typeRe.exec(sql)) !== null) {
    if (!isInComment(m.index, m.index + m[0].length)) {
      // Don't overlap with keywords
      const overlaps = ranges.some(
        (r) => r.cls === 'sql-keyword' && m!.index >= r.start && m!.index + m![0].length <= r.end
      )
      if (!overlaps) {
        ranges.push({ start: m.index, end: m.index + m[0].length, cls: 'sql-type' })
      }
    }
  }

  // Sort ranges by start position
  ranges.sort((a, b) => a.start - b.start)

  // Remove overlapping ranges (keep first)
  const cleanRanges: typeof ranges = []
  let cursor = 0
  for (const r of ranges) {
    if (r.start >= cursor) {
      cleanRanges.push(r)
      cursor = r.end
    }
  }

  lastIndex = 0
  for (const r of cleanRanges) {
    if (r.start > lastIndex) {
      tokens.push({ text: sql.slice(lastIndex, r.start), cls: '' })
    }
    tokens.push({ text: sql.slice(r.start, r.end), cls: r.cls })
    lastIndex = r.end
  }
  if (lastIndex < sql.length) {
    tokens.push({ text: sql.slice(lastIndex), cls: '' })
  }

  return tokens
}
