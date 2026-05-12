const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const hostname = '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// In-memory room state: roomId -> { tables, edges }
const rooms = new Map()
// Room user counts: roomId -> Set of socket IDs
const roomUsers = new Map()

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

      if (!rooms.has(roomId)) {
        rooms.set(roomId, { tables: [], edges: [] })
      }
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set())
      }

      roomUsers.get(roomId).add(socket.id)

      // Send current state to new joiner
      socket.emit('room-state', rooms.get(roomId))
      // Broadcast updated user count
      io.to(roomId).emit('user-count', roomUsers.get(roomId).size)
    })

    socket.on('update-state', ({ tables, edges }) => {
      if (!currentRoom) return
      rooms.set(currentRoom, { tables, edges })
      socket.to(currentRoom).emit('state-updated', { tables, edges })
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
