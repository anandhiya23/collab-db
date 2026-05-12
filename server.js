const { createServer } = require('http')
const { parse } = require('url')
const { randomUUID } = require('crypto')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// roomId -> { tables, edges }
const rooms = new Map()
// roomId -> Set of socket IDs
const roomUsers = new Map()
// roomId -> [{ eid, op, description, name, color, timestamp }]
const roomHistory = new Map()

const HISTORY_TYPES = new Set([
  'add-table', 'delete-table', 'update-table-name',
  'add-column', 'update-column', 'delete-column',
  'add-edge', 'delete-edge', 'clear-all',
])

function tableName(state, id) {
  return state.tables.find((t) => t.id === id)?.name ?? id
}
function columnName(state, tableId, columnId) {
  return state.tables.find((t) => t.id === tableId)?.columns.find((c) => c.id === columnId)?.name ?? columnId
}

function describeOp(op, state) {
  switch (op.type) {
    case 'add-table':
      return `Added table "${op.table.name}"`
    case 'delete-table':
      return `Deleted table "${tableName(state, op.id)}"`
    case 'update-table-name':
      return `Renamed "${tableName(state, op.id)}" → "${op.name}"`
    case 'add-column':
      return `Added column "${op.column.name}" to "${tableName(state, op.tableId)}"`
    case 'update-column': {
      const col = columnName(state, op.tableId, op.columnId)
      const tbl = tableName(state, op.tableId)
      const u = op.updates
      if (u.name) return `Renamed column "${col}" → "${u.name}" in "${tbl}"`
      if (u.type) return `Changed "${col}" type to ${u.type} in "${tbl}"`
      const flags = [
        u.notNull !== undefined && `NOT NULL ${u.notNull ? 'on' : 'off'}`,
        u.unique !== undefined && `UNIQUE ${u.unique ? 'on' : 'off'}`,
      ].filter(Boolean).join(', ')
      return `Updated "${col}" in "${tbl}"${flags ? ` (${flags})` : ''}`
    }
    case 'delete-column':
      return `Deleted column "${columnName(state, op.tableId, op.columnId)}" from "${tableName(state, op.tableId)}"`
    case 'add-edge': {
      const src = tableName(state, op.edge.source)
      const tgt = tableName(state, op.edge.target)
      return `Added relationship: ${src} → ${tgt}`
    }
    case 'delete-edge':
      return `Deleted a relationship`
    case 'clear-all':
      return `Cleared all tables`
    default:
      return op.type
  }
}

function applyOp(state, op) {
  switch (op.type) {
    case 'add-table':
      return { ...state, tables: [...state.tables, op.table] }
    case 'delete-table':
      return {
        tables: state.tables.filter((t) => t.id !== op.id),
        edges: state.edges.filter((e) => e.source !== op.id && e.target !== op.id),
      }
    case 'update-table-name':
      return { ...state, tables: state.tables.map((t) => (t.id === op.id ? { ...t, name: op.name } : t)) }
    case 'move-table':
      return { ...state, tables: state.tables.map((t) => (t.id === op.id ? { ...t, position: op.position } : t)) }
    case 'add-column':
      return {
        ...state,
        tables: state.tables.map((t) =>
          t.id === op.tableId ? { ...t, columns: [...t.columns, op.column] } : t
        ),
      }
    case 'update-column':
      return {
        ...state,
        tables: state.tables.map((t) =>
          t.id !== op.tableId
            ? t
            : { ...t, columns: t.columns.map((c) => (c.id === op.columnId ? { ...c, ...op.updates } : c)) }
        ),
      }
    case 'delete-column':
      return {
        ...state,
        tables: state.tables.map((t) =>
          t.id !== op.tableId ? t : { ...t, columns: t.columns.filter((c) => c.id !== op.columnId) }
        ),
      }
    case 'add-edge':
      return { ...state, edges: [...state.edges, op.edge] }
    case 'delete-edge':
      return { ...state, edges: state.edges.filter((e) => e.id !== op.id) }
    case 'load-state':
      return { tables: op.tables, edges: op.edges }
    case 'clear-all':
      return { tables: [], edges: [] }
    default:
      return state
  }
}

function clientHistory(history) {
  return history.map(({ eid, description, name, color, timestamp }) => ({
    eid, description, name, color, timestamp,
  }))
}

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error handling request:', err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  })

  const io = new Server(httpServer, {
    cors: { origin: '*' },
  })

  io.on('connection', (socket) => {
    let currentRoom = null

    socket.on('join-room', (roomId) => {
      if (currentRoom) {
        socket.leave(currentRoom)
        const users = roomUsers.get(currentRoom)
        if (users) {
          users.delete(socket.id)
          io.to(currentRoom).emit('user-count', users.size)
        }
      }

      currentRoom = roomId
      socket.join(roomId)

      if (!rooms.has(roomId)) rooms.set(roomId, { tables: [], edges: [] })
      if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Set())
      if (!roomHistory.has(roomId)) roomHistory.set(roomId, [])

      roomUsers.get(roomId).add(socket.id)

      socket.emit('room-state', {
        ...rooms.get(roomId),
        history: clientHistory(roomHistory.get(roomId)),
      })
      io.to(roomId).emit('user-count', roomUsers.get(roomId).size)
    })

    socket.on('op', (wire) => {
      if (!currentRoom) return
      const { _eid, _name, _color, _historyEntry: _drop, ...cleanOp } = wire
      const eid = _eid || randomUUID()
      const state = rooms.get(currentRoom) || { tables: [], edges: [] }

      let entry = null
      if (HISTORY_TYPES.has(cleanOp.type)) {
        entry = {
          eid,
          op: cleanOp,
          description: describeOp(cleanOp, state),
          name: _name || 'Unknown',
          color: _color || '#888888',
          timestamp: Date.now(),
        }
        roomHistory.get(currentRoom).push(entry)
      }

      rooms.set(currentRoom, applyOp(state, cleanOp))

      const payload = entry
        ? { ...cleanOp, _eid: eid, _historyEntry: clientHistory([entry])[0] }
        : { ...cleanOp, _eid: eid }
      io.to(currentRoom).emit('op', payload)
    })

    socket.on('revert', ({ eid }) => {
      if (!currentRoom) return
      const history = roomHistory.get(currentRoom)
      if (!history) return
      const idx = history.findIndex((e) => e.eid === eid)
      if (idx === -1) return

      let state = { tables: [], edges: [] }
      for (let i = 0; i <= idx; i++) state = applyOp(state, history[i].op)

      const truncated = history.slice(0, idx + 1)
      roomHistory.set(currentRoom, truncated)
      rooms.set(currentRoom, state)

      io.to(currentRoom).emit('room-state', {
        ...state,
        history: clientHistory(truncated),
      })
    })

    socket.on('cursor', (payload) => {
      if (!currentRoom) return
      socket.to(currentRoom).emit('cursor', { ...payload, socketId: socket.id })
    })

    socket.on('disconnect', () => {
      if (!currentRoom) return
      const users = roomUsers.get(currentRoom)
      if (users) {
        users.delete(socket.id)
        io.to(currentRoom).emit('user-count', users.size)
      }
    })
  })

  httpServer.listen(port, hostname, () => {
    console.log(`> Ready on http://0.0.0.0:${port} (LAN: http://192.168.x.x:${port})`)
  })
})
