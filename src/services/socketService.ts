import { Server as SocketIOServer, Socket } from 'socket.io';
import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env.js';
import { User, Conversation } from '../models/index.js';
import type { DecodedToken } from '../middleware/authMiddleware.js';

let io: SocketIOServer | null = null;

/**
 * Initialize Socket.IO server with CORS and authentication
 */
export const initSocket = (httpServer: HttpServer): SocketIOServer => {
  if (io) return io;

  const allowedOrigins = [
    ENV.CLIENT_URL,
    'http://localhost:5173',
    'https://temple-blond.vercel.app',
    'https://main.d2d8a4sp0475kj.amplifyapp.com',
  ].filter(Boolean);

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    pingTimeout: 30000,
    pingInterval: 25000,
  });

  // Socket Authentication Middleware
  io.use(async (socket: Socket, next) => {
    try {
      let token =
        socket.handshake.auth?.token ||
        (socket.handshake.headers?.authorization?.startsWith('Bearer ')
          ? socket.handshake.headers.authorization.split(' ')[1]
          : null);

      if (!token && socket.handshake.headers?.cookie) {
        const cookies = socket.handshake.headers.cookie.split(';');
        for (const c of cookies) {
          const [key, val] = c.trim().split('=');
          if (key === 'devasetu_token' || key === 'token') {
            token = decodeURIComponent(val);
            break;
          }
        }
      }

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, ENV.JWT_SECRET as string) as DecodedToken;
      if (!decoded?.userId) {
        return next(new Error('Authentication error: Invalid token'));
      }

      const user = await User.findById(decoded.userId).select('name email role templeId isActive');
      if (!user || !user.isActive) {
        return next(new Error('Authentication error: Inactive or not found'));
      }

      // Devotee restriction: only Admin and Temple Authority can participate in messaging
      if (user.role !== 'ADMIN' && user.role !== 'TEMPLE_AUTHORITY') {
        return next(new Error('Unauthorized: Devotees not permitted in messaging socket'));
      }

      socket.data.user = user;
      next();
    } catch (err: any) {
      next(new Error(`Authentication error: ${err.message}`));
    }
  });

  // Socket Connection Handlers
  io.on('connection', (socket: Socket) => {
    const user = socket.data.user;

    // Join conversation room with strict tenant verification
    socket.on('conversation:join', async (conversationId: string) => {
      try {
        if (!conversationId) return;

        if (user.role === 'ADMIN') {
          // Admin can access all conversations
          socket.join(`conversation:${conversationId}`);
        } else if (user.role === 'TEMPLE_AUTHORITY') {
          // Verify authority belongs to the conversation's temple
          const conv = await Conversation.findById(conversationId).select('templeId');
          if (conv && user.templeId && conv.templeId.toString() === user.templeId.toString()) {
            socket.join(`conversation:${conversationId}`);
          }
        }
      } catch {
        // Silently ignore invalid joins
      }
    });

    // Leave conversation room
    socket.on('conversation:leave', (conversationId: string) => {
      if (conversationId) {
        socket.leave(`conversation:${conversationId}`);
        // Notify other room participants that typing has stopped
        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          senderId: user._id.toString(),
          senderRole: user.role,
        });
      }
    });

    // Typing start event
    socket.on('typing:start', async ({ conversationId }: { conversationId: string }) => {
      try {
        if (!conversationId) return;

        // Authorize participant
        if (user.role === 'TEMPLE_AUTHORITY') {
          const conv = await Conversation.findById(conversationId).select('templeId');
          if (!conv || !user.templeId || conv.templeId.toString() !== user.templeId.toString()) {
            return;
          }
        }

        socket.to(`conversation:${conversationId}`).emit('typing:start', {
          conversationId,
          senderId: user._id.toString(),
          senderRole: user.role,
        });
      } catch {
        // Silently ignore
      }
    });

    // Typing stop event
    socket.on('typing:stop', async ({ conversationId }: { conversationId: string }) => {
      try {
        if (!conversationId) return;

        socket.to(`conversation:${conversationId}`).emit('typing:stop', {
          conversationId,
          senderId: user._id.toString(),
          senderRole: user.role,
        });
      } catch {
        // Silently ignore
      }
    });

    // Handle disconnect: clear typing state in all active conversation rooms
    socket.on('disconnecting', () => {
      for (const room of socket.rooms) {
        if (room.startsWith('conversation:')) {
          const conversationId = room.replace('conversation:', '');
          socket.to(room).emit('typing:stop', {
            conversationId,
            senderId: user._id.toString(),
            senderRole: user.role,
          });
        }
      }
    });
  });

  return io;
};

export const getIO = (): SocketIOServer | null => io;
