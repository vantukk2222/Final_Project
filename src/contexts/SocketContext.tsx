import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import {io, Socket} from 'socket.io-client';
import messaging from '@react-native-firebase/messaging';
import {useAuth} from './AuthContext';
import {AppState, AppStateStatus} from 'react-native';
import firestore from '@react-native-firebase/firestore';

const SOCKET_SERVER_URL = 'ws://backendfinalpro-ct.onrender.com';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  userStatus: 'online' | 'offline' | 'away';
  lastSeen: Date | null;
  emit: (event: string, data?: any) => void;
  on: (event: string, callback: (...args: any[]) => void) => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  waitForConnection: (timeout?: number) => Promise<boolean>;
  reconnect: () => void;
  setUserStatus: (status: 'online' | 'offline' | 'away') => void;
  getUserStatus: (
    userId: string,
  ) => Promise<{status: string; lastSeen: any; isOnline: boolean}>;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const {user} = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [userStatus, setUserStatusState] = useState<
    'online' | 'offline' | 'away'
  >('offline');
  const [lastSeen, setLastSeen] = useState<Date | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectingRef = useRef(false);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>('active');

  // Update user status in Firestore
  const updateUserStatus = useCallback(
    async (status: 'online' | 'offline' | 'away') => {
      if (!user?.uid) {
        return;
      }

      try {
        const statusData = {
          status: status,
          lastSeen: firestore.FieldValue.serverTimestamp(),
          lastActivity: firestore.FieldValue.serverTimestamp(),
          isOnline: status === 'online',
          updatedAt: firestore.FieldValue.serverTimestamp(),
        };

        await firestore().collection('users').doc(user.uid).update({
          userStatus: statusData,
        });

        setUserStatusState(status);
        setLastSeen(new Date());

        console.log(`SocketProvider: User status updated to ${status}`);

        // Emit status to socket server
        if (socketRef.current?.connected) {
          socketRef.current.emit('user_status_change', {
            userId: user.uid,
            status: status,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error('SocketProvider: Error updating user status:', error);
      }
    },
    [user?.uid],
  );

  // Set up heartbeat to maintain online status
  const setupHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (user?.uid && appStateRef.current === 'active') {
        updateUserStatus('online');
      }
    }, 30000); // Update every 30 seconds when app is active
  }, [user?.uid, updateUserStatus]);

  // Handle app state changes
  const handleAppStateChange = useCallback(
    (nextAppState: AppStateStatus) => {
      appStateRef.current = nextAppState;

      if (!user?.uid) {
        return;
      }

      switch (nextAppState) {
        case 'active':
          updateUserStatus('online');
          setupHeartbeat();
          break;
        case 'background':
          updateUserStatus('away');
          if (heartbeatIntervalRef.current) {
            clearInterval(heartbeatIntervalRef.current);
          }
          break;
        case 'inactive':
          updateUserStatus('away');
          break;
      }
    },
    [user?.uid, updateUserStatus, setupHeartbeat],
  );

  // Initialize socket connection
  const initializeSocket = useCallback(async () => {
    if (isConnectingRef.current || !user?.uid) {
      return;
    }

    try {
      isConnectingRef.current = true;

      // Clean up existing socket
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }

      // Get FCM token
      const fcmToken = await messaging().getToken();
      console.log('SocketProvider: Initializing socket for user:', user.uid);

      // Create new socket connection
      socketRef.current = io(SOCKET_SERVER_URL, {
        timeout: 10000,
        forceNew: true,
        transports: ['websocket'],
      });

      // Socket event listeners
      socketRef.current.on('connect', () => {
        console.log(
          'SocketProvider: Connected with ID:',
          socketRef.current?.id,
        );
        setIsConnected(true);
        isConnectingRef.current = false;

        // Register user with server
        socketRef.current?.emit('register', {
          userId: user.uid,
          fcmToken,
          from: 'socketProvider',
        });

        // Set user as online when connected
        updateUserStatus('online');
        setupHeartbeat();

        // Clear any pending reconnect timeout
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      });

      socketRef.current.on('disconnect', reason => {
        console.log('SocketProvider: Disconnected, reason:', reason);
        setIsConnected(false);
        isConnectingRef.current = false;

        // Set user as offline when disconnected
        updateUserStatus('offline');

        // Auto reconnect for client-side disconnections
        if (reason === 'io client disconnect') {
          // Manual disconnect, don't reconnect
          return;
        }

        // Schedule reconnection
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log('SocketProvider: Attempting to reconnect...');
            initializeSocket();
          }, 3000);
        }
      });

      socketRef.current.on('connect_error', error => {
        console.error('SocketProvider: Connection error:', error);
        setIsConnected(false);
        isConnectingRef.current = false;
        updateUserStatus('offline');

        // Schedule reconnection on error
        if (!reconnectTimeoutRef.current) {
          reconnectTimeoutRef.current = setTimeout(() => {
            initializeSocket();
          }, 5000);
        }
      });

      socketRef.current.on('reconnect', () => {
        console.log('SocketProvider: Reconnected successfully');
        setIsConnected(true);
        updateUserStatus('online');
      });

      // Listen for user status updates from other users
      socketRef.current.on('user_status_updated', data => {
        console.log('SocketProvider: User status updated:', data);
        // You can emit this to other parts of your app if needed
      });
    } catch (error) {
      console.error('SocketProvider: Error initializing socket:', error);
      setIsConnected(false);
      isConnectingRef.current = false;
      updateUserStatus('offline');
    }
  }, [user?.uid, updateUserStatus, setupHeartbeat]);

  // Cleanup socket connection
  const cleanupSocket = useCallback(() => {
    console.log('SocketProvider: Cleaning up socket');

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnected(false);
    isConnectingRef.current = false;

    // Set user offline when cleaning up
    if (user?.uid) {
      updateUserStatus('offline');
    }
  }, [user?.uid, updateUserStatus]);

  // Initialize socket when user changes
  useEffect(() => {
    if (user?.uid) {
      initializeSocket();
    } else {
      cleanupSocket();
      setUserStatusState('offline');
      setLastSeen(null);
    }

    return cleanupSocket;
  }, [user?.uid, initializeSocket, cleanupSocket]);

  // Setup app state listener
  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    // Set initial status
    if (user?.uid && AppState.currentState === 'active') {
      updateUserStatus('online');
      setupHeartbeat();
    }

    return () => {
      subscription?.remove();
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [handleAppStateChange, user?.uid, updateUserStatus, setupHeartbeat]);

  // Emit event to server
  const emit = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      console.log('SocketProvider: Emitting event:', event, data);
      socketRef.current.emit(event, data);
    } else {
      console.warn('SocketProvider: Cannot emit, socket not connected');
    }
  }, []);

  // Listen to events
  const on = useCallback(
    (event: string, callback: (...args: any[]) => void) => {
      if (socketRef.current) {
        socketRef.current.on(event, callback);
      }
    },
    [],
  );

  // Remove event listeners
  const off = useCallback(
    (event: string, callback?: (...args: any[]) => void) => {
      if (socketRef.current) {
        socketRef.current.off(event, callback);
      }
    },
    [],
  );

  // Wait for socket connection with timeout
  const waitForConnection = useCallback(
    (timeout = 5000): Promise<boolean> => {
      return new Promise(resolve => {
        if (isConnected && socketRef.current?.connected) {
          resolve(true);
          return;
        }

        let waitTime = 0;
        const checkInterval = 100;

        const interval = setInterval(() => {
          waitTime += checkInterval;

          if (isConnected && socketRef.current?.connected) {
            clearInterval(interval);
            resolve(true);
          } else if (waitTime >= timeout) {
            clearInterval(interval);
            console.warn('SocketProvider: Connection timeout');
            resolve(false);
          }
        }, checkInterval);
      });
    },
    [isConnected],
  );

  // Manual reconnect
  const reconnect = useCallback(() => {
    console.log('SocketProvider: Manual reconnect requested');
    cleanupSocket();
    setTimeout(() => {
      initializeSocket();
    }, 1000);
  }, [cleanupSocket, initializeSocket]);

  // Manual status update
  const setUserStatus = useCallback(
    (status: 'online' | 'offline' | 'away') => {
      updateUserStatus(status);
    },
    [updateUserStatus],
  );

  // Get user status from Firestore
  const getUserStatus = useCallback(async (userId: string) => {
    try {
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      const userStatus = userData?.userStatus;

      if (userStatus) {
        const lastSeenTimestamp = userStatus.lastSeen?.toDate();
        const isOnline = userStatus.isOnline && userStatus.status === 'online';

        // Check if user was online in the last 2 minutes
        const isRecentlyOnline =
          lastSeenTimestamp &&
          Date.now() - lastSeenTimestamp.getTime() < 2 * 60 * 1000;

        return {
          status: isRecentlyOnline ? userStatus.status : 'offline',
          lastSeen: lastSeenTimestamp,
          isOnline: isOnline && isRecentlyOnline,
        };
      }

      return {
        status: 'offline',
        lastSeen: null,
        isOnline: false,
      };
    } catch (error) {
      console.error('SocketProvider: Error getting user status:', error);
      return {
        status: 'offline',
        lastSeen: null,
        isOnline: false,
      };
    }
  }, []);

  const value: SocketContextType = {
    socket: socketRef.current,
    isConnected,
    userStatus,
    lastSeen,
    emit,
    on,
    off,
    waitForConnection,
    reconnect,
    setUserStatus,
    getUserStatus,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within SocketProvider');
  }
  return context;
};
