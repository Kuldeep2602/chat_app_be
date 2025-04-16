"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importStar(require("ws"));
const wss = new ws_1.WebSocketServer({ port: 8080 });
const rooms = new Map();
function createRoom(roomId) {
    const room = {
        id: roomId,
        clients: new Map()
    };
    rooms.set(roomId, room);
    return room;
}
function broadcastToRoom(room, message, excludeWs) {
    room.clients.forEach((_, client) => {
        if (client !== excludeWs && client.readyState === ws_1.default.OPEN) {
            client.send(message);
        }
    });
}
wss.on('connection', function connection(ws) {
    ws.on('message', function message(data) {
        try {
            const parsedData = JSON.parse(data.toString());
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
                        }
                        else {
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
                        }
                        else {
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
        }
        catch (error) {
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
