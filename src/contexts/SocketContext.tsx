import React, { createContext, useContext, useMemo, useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

export interface User {
  id: string;
  username: string;
  role: 'admin' | 'branch' | 'chef' | 'production';
  name: string;
  branchId?: string;
  chefId?: string;
  departmentId?: string;
  _id?: string;
}

const SocketContext = createContext<{ socket: Socket | null; emit: (event: string, data: any) => void; isConnected: boolean } | null>(null);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  const socket = useMemo(() => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app', {
      auth: { token: localStorage.getItem('token') },
      autoConnect: false,
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    newSocket.on('connect', () => {
      console.log(`[${new Date().toISOString()}] Socket connected: ${newSocket.id}`);
      setIsConnected(true);
    });

    newSocket.on('connect_error', (err) => {
      console.error(`[${new Date().toISOString()}] Socket connect error: ${err.message}`);
      setIsConnected(false);
      toast.error(`فشل الاتصال: ${err.message}`, { position: 'top-right', toastId: `connect-error-${Date.now()}` });
    });

    newSocket.on('reconnect', (attempt) => {
      console.log(`[${new Date().toISOString()}] Socket reconnected after ${attempt} attempts`);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log(`[${new Date().toISOString()}] Socket disconnected: ${reason}`);
      setIsConnected(false);
    });

    return newSocket;
  }, []);

  const emit = (event: string, data: any) => {
    if (!socket || !isConnected) {
      console.warn(`[${new Date().toISOString()}] Cannot emit ${event}: Socket not connected`);
      return;
    }
    const eventId = data.eventId || crypto.randomUUID();
    console.log(`[${new Date().toISOString()}] Emitting event: ${event} with eventId: ${eventId}`);
    socket.emit(event, { ...data, eventId });
  };

  useEffect(() => {
    if (!user) {
      socket.disconnect();
      setIsConnected(false);
      return;
    }

    if (!socket.connected) {
      socket.connect();
    }

    const joinRoomOnConnect = () => {
      if (socket.connected) {
        emit('joinRoom', {
          role: user.role,
          branchId: user.branchId,
          chefId: user.role === 'chef' ? user._id || user.id : null,
          departmentId: user.role === 'production' ? user._id || user.departmentId : null,
          userId: user._id || user.id,
        });
      }
    };

    socket.on('connect', joinRoomOnConnect);
    socket.on('reconnect', joinRoomOnConnect);

    return () => {
      socket.off('connect', joinRoomOnConnect);
      socket.off('reconnect', joinRoomOnConnect);
      socket.disconnect();
    };
  }, [socket, user]);

  return <SocketContext.Provider value={{ socket, emit, isConnected }}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('يجب استخدام useSocket داخل SocketProvider');
  return context;
};