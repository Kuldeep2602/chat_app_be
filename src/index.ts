import WebSocket, { WebSocketServer } from 'ws';

interface Room {
  id: string;
  clients: Map<WebSocket, string>; // WebSocket to username mapping
}

interface Message {
  type: 'create' | 'join' | 'chat' | 'leave';
  payload: {
    roomId?: string;
    message?: string;
    username?: string;
  };
}

const wss = new WebSocketServer({ port: 8080 });
const rooms = new Map<string, Room>();

function createRoom(roomId: string): Room {
  const room: Room = {
    id: roomId,
    clients: new Map()
  };
  rooms.set(roomId, room);
  return room;
}

function broadcastToRoom(room: Room, message: string, excludeWs?: WebSocket) {
  room.clients.forEach((_, client) => {
    if (client !== excludeWs && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

wss.on('connection', function connection(ws) {
  ws.on('message', function message(data) {
    try {
      const parsedData: Message = JSON.parse(data.toString());
      console.log('received:', parsedData);

      switch (parsedData.type) {
        case 'create': {
          const roomId = parsedData.payload.roomId;
          const username = parsedData.payload.username;
          if (roomId && username) {
            if (!rooms.has(roomId)) {
              const room = createRoom(roomId);
              room.clients.set(ws, username);
              ws.send(JSON.stringify({
                type: 'system',
                payload: {
                  message: `Room ${roomId} created and joined as ${username}`,
                  roomId: roomId
                }
              }));
            } else {
              ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'Room already exists' }
              }));
            }
          }
          break;
        }
        case 'join': {
          const roomId = parsedData.payload.roomId;
          const username = parsedData.payload.username;
          if (roomId && username) {
            const room = rooms.get(roomId);
            if (room) {
              room.clients.set(ws, username);
              ws.send(JSON.stringify({
                type: 'system',
                payload: {
                  message: `Joined room ${roomId} as ${username}`,
                  roomId: roomId
                }
              }));
              broadcastToRoom(room, JSON.stringify({
                type: 'system',
                payload: { message: `${username} joined the room` }
              }), ws);
            } else {
              ws.send(JSON.stringify({
                type: 'error',
                payload: { message: 'Room not found' }
              }));
            }
          }
          break;
        }
        case 'chat': {
          // Find which room this client belongs to
          for (const [roomId, room] of rooms) {
            if (room.clients.has(ws)) {
              const username = room.clients.get(ws);
              broadcastToRoom(room, JSON.stringify({
                type: 'chat',
                payload: {
                  message: parsedData.payload.message,
                  username: username
                }
              }), ws);
              break;
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    // Remove client from any room they were in
    for (const [roomId, room] of rooms) {
      if (room.clients.has(ws)) {
        const username = room.clients.get(ws);
        room.clients.delete(ws);
        broadcastToRoom(room, JSON.stringify({
          type: 'system',
          payload: { message: `${username} left the room` }
        }));
        if (room.clients.size === 0) {
          rooms.delete(roomId);
        }
        break;
      }
    }
  });
});

console.log('WebSocket server is running on port 8080');