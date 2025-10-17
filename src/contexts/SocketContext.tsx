import { createContext, useContext, useMemo, useEffect, useState } from 'react';
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
  const { user, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    let socketInstance: Socket | null = null;
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 1000; // 1 ثانية

    const initializeSocket = () => {
      const token = localStorage.getItem('token');
      if (!isAuthenticated || !token) {
        if (retryCount < maxRetries) {
          console.log(`[${new Date().toISOString()}] Token not available, retrying (${retryCount + 1}/${maxRetries})...`);
          setTimeout(initializeSocket, retryDelay);
          retryCount++;
          return;
        } else {
          console.error(`[${new Date().toISOString()}] Failed to initialize socket: No token after ${maxRetries} retries`);
          toast.error('فشل الاتصال: لا يوجد توكن متاح', { position: 'top-right', toastId: `no-token-${Date.now()}` });
          return;
        }
      }

      socketInstance = io(process.env.REACT_APP_API_URL || 'https://eljoodia-server-production.up.railway.app', {
        auth: { token },
        autoConnect: false,
        transports: ['websocket', 'polling'],
        path: '/socket.io',
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socketInstance.on('connect', () => {
        console.log(`[${new Date().toISOString()}] Socket connected: ${socketInstance?.id}`);
        setIsConnected(true);
      });

      socketInstance.on('connect_error', (err) => {
        console.error(`[${new Date().toISOString()}] Socket connect error: ${err.message}`);
        setIsConnected(false);
        toast.error(`فشل الاتصال: ${err.message}`, { position: 'top-right', toastId: `connect-error-${Date.now()}` });
      });

      socketInstance.on('reconnect', (attempt) => {
        console.log(`[${new Date().toISOString()}] Socket reconnected after ${attempt} attempts`);
        setIsConnected(true);
      });

      socketInstance.on('disconnect', (reason) => {
        console.log(`[${new Date().toISOString()}] Socket disconnected: ${reason}`);
        setIsConnected(false);
      });

      setSocket(socketInstance);
      socketInstance.connect();
    };

    if (isAuthenticated && user) {
      initializeSocket();
    }

    return () => {
      if (socketInstance) {
        socketInstance.off('connect');
        socketInstance.off('connect_error');
        socketInstance.off('reconnect');
        socketInstance.off('disconnect');
        socketInstance.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
    };
  }, [isAuthenticated, user]);

  const emit = (event: string, data: any) => {
    if (!socket || !isConnected) {
      console.warn(`[${new Date().toISOString()}] Cannot emit ${event}: Socket not connected`);
      return;
    }
    const eventId = data.eventId || crypto.randomUUID();
    console.log(`[${new Date().toISOString()}] Emitting event: ${event} with eventId: ${eventId}`);
    socket.emit(event, { ...data, eventId });
  };

  return <SocketContext.Provider value={{ socket, emit, isConnected }}>{children}</SocketContext.Provider>;
};

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) throw new Error('يجب استخدام useSocket داخل SocketProvider');
  return context;
};