const http = require('http')
const WebSocket = require('ws')

const httpServerCfg = {
  port: 3000,
}
// const WebSocketCfg = {
// 	port: 5000,
// }

let chatHisMap = new Map()

const httpServer = http.createServer(onRequest)

function onRequest(req, res) {
  // console.log('onRequest-req:', req.url)
  res.writeHead(200)
  res.end('http server connect success!!!')
}

httpServer.listen(httpServerCfg.port, function () {
  console.log(`The http server is running on port ${httpServerCfg.port}...`)
})

const ws = new WebSocket.Server({ server: httpServer })
ws.on('connection', wsConnection)

function wsConnection(socket, req) {
  // console.log('ws connect success!!!')
  // console.log('req-url:', req.url)

  const visitorName = assignVisitorName()
  const roomId = req.url.slice(1)
  socket['uname'] = visitorName
  socket['roomId'] = roomId

  const curRoom = getCurrentRoom(roomId)
  const chatHisList = chatHisMap.get(roomId)
  if (chatHisList !== undefined && chatHisList.length > 0) {
    emit(socket, { type: 'chatHis', chatHisList })
  }
  emit(socket, { type: 'assignVisitorName', visitorName })
  broadcastRoomClients(curRoom, { type: 'visitor', visitorName })
  broadcastRoomClients(curRoom, { type: 'connCount', connectCount: curRoom.length })

  // console.log('connect-ws-clients:', ws.clients)

  socket.on('message', wsIncomingMsg)
  socket.on('error', wsError)
  socket.on('close', wsClose)
}

function wsIncomingMsg(message) {
  // console.log('wsIncomingMsg-message:', message)
  const { name, words, roomId } = JSON.parse(message)
  const curRoom = getCurrentRoom(roomId)
  broadcastRoomClients(curRoom, message)

  if (!chatHisMap.has(roomId)) {
    const chatList = []
    chatList.push({ type: 'chat', name, words })
    chatHisMap.set(roomId, chatList)
  } else {
    const chatList = chatHisMap.get(roomId)
    if (chatList.length >= 30) {
      chatList.splice(0, 20)
    }
    chatList.push({ type: 'chat', name, words })
  }
}

function wsClose() {
  // console.log('ws disconnected!!!')
  // console.log('close-ws-clients:', ws.clients)
  noticeDelConnect()
}

function wsError() {
  console.log('ws error!!!')
}

function emit(socket, message) {
  let msg = ''
  msg = typeof message !== 'string' ? JSON.stringify(message) : message
  socket.send(msg)
}

function noticeDelConnect() {
  const rooms = getAllRooms()
  rooms.forEach(room =>
    room.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        emit(client, { type: 'connCount', connectCount: room.length })
      }
    })
  )
}

function getAllRooms() {
  const rooms = new Map()
  ws.clients.forEach(client => {
    const roomId = client.roomId
    if (!rooms.has(roomId)) {
      const roomMembers = []
      roomMembers.push(client)
      rooms.set(roomId, roomMembers)
    } else {
      rooms.get(roomId).push(client)
    }
  })
  return rooms
}

function getCurrentRoom(roomId) {
  let room = []
  ws.clients.forEach(client => {
    if (client.roomId === roomId) {
      room.push(client)
    }
  })
  return room
}

function broadcastRoomClients(cuRoom, message) {
  let msg = ''
  msg = typeof message !== 'string' ? JSON.stringify(message) : message
  cuRoom.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg)
    }
  })
}

function assignVisitorName() {
  return '游客' + generateID(5)
}

function generateID(length) {
  return Number(Math.random().toString().substr(3, length) + Date.now()).toString(36)
}
