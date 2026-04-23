import { io, Socket } from 'socket.io-client';

// single socket instance shared across the app
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      withCredentials: true,
      // Vite proxy forwards /socket.io → backend
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
