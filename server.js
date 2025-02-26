import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer as createViteServer } from 'vite';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isProd = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: isProd 
        ? ["https://fluffy-pegasus-5cb073.netlify.app", "https://rbkwdjwubmmdqhfyyyvw.supabase.co"]
        : "*",
      methods: ["GET", "POST"],
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"]
    },
    path: '/socket.io',
    transports: ['websocket', 'polling']
  });

  // Track connected users and rooms
  const rooms = new Map();
  const userSessions = new Map();
  const uniqueViewers = new Map(); // Track unique viewers by IP + room

  if (isProd) {
    app.use(express.static(join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  // Helper function to get viewer count
  const getViewerCount = (roomId) => {
    const viewers = uniqueViewers.get(roomId) || new Set();
    return viewers.size;
  };

  // Helper function to broadcast viewer count
  const broadcastViewerCount = (roomId) => {
    const count = getViewerCount(roomId);
    io.to(roomId).emit(`viewer-count-${roomId}`, count);
    console.log(`Room ${roomId}: ${count} unique viewers`);
  };

  // Socket.IO event handlers
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Get client IP address
    const clientIp = socket.handshake.headers['x-forwarded-for'] || 
                     socket.handshake.address;

    // socket.on('join-room', (roomId) => {
    //   // Leave any previous room
    //   const previousRoom = userSessions.get(socket.id);
    //   if (previousRoom) {
    //     handleLeaveRoom(socket, previousRoom, clientIp);
    //   }

    //   // Join new room
    //   socket.join(roomId);
      
    //   // Track user in room
    //   if (!rooms.has(roomId)) {
    //     rooms.set(roomId, new Set());
    //   }
    //   rooms.get(roomId).add(socket.id);
    //   userSessions.set(socket.id, roomId);

    //   // Track unique viewer
    //   if (!uniqueViewers.has(roomId)) {
    //     uniqueViewers.set(roomId, new Set());
    //   }
    //   uniqueViewers.get(roomId).add(clientIp);
      
    //   // Broadcast updated viewer count
    //   broadcastViewerCount(roomId);
      
    //   console.log(`Socket ${socket.id} joined room ${roomId}`);
    // });

    socket.on('join-room', (roomId) => {
      // Extract just the webinar ID portion if using the format "webinarId:sessionId"
      console.log("ADMIN ROOM")
      const webinarRoomId = roomId.split(':')[0];
      
      // Leave any previous room
      const previousRoom = userSessions.get(socket.id);
      if (previousRoom) {
        handleLeaveRoom(socket, previousRoom, clientIp);
      }
    
      // Join the webinar room
      socket.join(webinarRoomId);
      
      // The rest of your existing code...
      console.log(`Socket ${socket.id} joined webinar room ${webinarRoomId}`);
    });

    socket.on('leave-room', (roomId) => {
      handleLeaveRoom(socket, roomId, clientIp);
    });

    socket.on('chat-message', (data) => {
      // Validate the data has all required fields
      if (!data.roomId || !data.message) {
        console.error('Invalid chat message data:', data);
        return;
      }
    
      // Broadcast message to all users in the room (including sender)
      io.to(data.roomId).emit(`chat-message-${data.roomId}`, data);
      console.log(`Message broadcast in room ${data.roomId}:`, data);
    });

    socket.on('disconnect', () => {
      // Clean up user's room membership
      const roomId = userSessions.get(socket.id);
      if (roomId) {
        handleLeaveRoom(socket, roomId, clientIp);
        userSessions.delete(socket.id);
      }
      
      console.log('Client disconnected:', socket.id);
    });
  });

  function handleLeaveRoom(socket, roomId, clientIp) {
    socket.leave(roomId);
    
    if (rooms.has(roomId)) {
      rooms.get(roomId).delete(socket.id);
      
      // Check if this was the last socket for this IP in this room
      let ipStillActive = false;
      for (const socketId of rooms.get(roomId)) {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && (socket.handshake.headers['x-forwarded-for'] || socket.handshake.address) === clientIp) {
          ipStillActive = true;
          break;
        }
      }

      if (!ipStillActive && uniqueViewers.has(roomId)) {
        uniqueViewers.get(roomId).delete(clientIp);
      }

      if (rooms.get(roomId).size === 0) {
        rooms.delete(roomId);
        uniqueViewers.delete(roomId);
      } else {
        // Broadcast updated viewer count
        broadcastViewerCount(roomId);
      }
      
      console.log(`Socket ${socket.id} left room ${roomId}`);
    }
  }

  // Periodic cleanup of empty rooms
  setInterval(() => {
    rooms.forEach((users, roomId) => {
      if (users.size === 0) {
        rooms.delete(roomId);
        uniqueViewers.delete(roomId);
      }
    });
  }, 60000); // Clean up every minute

  const port = process.env.PORT || 3000;
  httpServer.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
}

startServer();
