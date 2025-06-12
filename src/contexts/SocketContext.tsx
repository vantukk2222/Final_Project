import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useReducer,
  memo,
} from 'react';
import {io, Socket} from 'socket.io-client';
import messaging from '@react-native-firebase/messaging';
import {useAuth} from './AuthContext';
import {AppState, AppStateStatus} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import NetInfo from '@react-native-community/netinfo';

// Constants
const SOCKET_SERVER_URL = 'ws://backendfinalpro-ct.onrender.com';
// const SOCKET_SERVER_URL = 'http://192.168.1.10:3001';

const SOCKET_CONFIG = Object.freeze({
  timeout: 10000,
  reconnectionDelay: 3000,
  reconnectionDelayMax: 10000,
  reconnectionAttempts: 5,
  heartbeatInterval: 30000,
  maxReconnectAttempts: 10,
  connectionTimeout: 15000,
  statusCheckInterval: 2 * 60 * 1000, // 2 minutes
});

// Types
type UserStatus = 'online' | 'offline' | 'away' | 'busy';

interface UserStatusData {
  status: UserStatus;
  lastSeen: any;
  lastActivity: any;
  isOnline: boolean;
  updatedAt: any;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  connectionState: ConnectionState;
  userStatus: UserStatus;
  lastSeen: Date | null;
  reconnectAttempts: number;
  emit: (event: string, data?: any) => Promise<boolean>;
  on: (event: string, callback: (...args: any[]) => void) => () => void;
  off: (event: string, callback?: (...args: any[]) => void) => void;
  waitForConnection: (timeout?: number) => Promise<boolean>;
  reconnect: () => Promise<void>;
  setUserStatus: (status: UserStatus) => Promise<void>;
  getUserStatus: (userId: string) => Promise<{
    status: UserStatus;
    lastSeen: Date | null;
    isOnline: boolean;
  }>;
  getConnectionHealth: () => ConnectionHealth;
}

interface SocketProviderProps {
  children: React.ReactNode;
  serverUrl?: string;
  config?: Partial<typeof SOCKET_CONFIG>;
}

// Enums
enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

enum SocketEvents {
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  CONNECT_ERROR = 'connect_error',
  RECONNECT = 'reconnect',
  REGISTER = 'register',
  USER_STATUS_CHANGE = 'user_status_change',
  USER_STATUS_UPDATED = 'user_status_updated',
}

// State management with reducer
type StateAction =
  | {type: 'SET_CONNECTION_STATE'; payload: ConnectionState}
  | {type: 'SET_USER_STATUS'; payload: UserStatus}
  | {type: 'SET_LAST_SEEN'; payload: Date | null}
  | {type: 'SET_RECONNECT_ATTEMPTS'; payload: number}
  | {type: 'INCREMENT_RECONNECT_ATTEMPTS'}
  | {type: 'RESET_RECONNECT_ATTEMPTS'}
  | {type: 'CONNECTION_SUCCESS'}
  | {type: 'CONNECTION_FAILED'}
  | {type: 'USER_DISCONNECTED'};

interface SocketState {
  connectionState: ConnectionState;
  userStatus: UserStatus;
  lastSeen: Date | null;
  reconnectAttempts: number;
}

const initialState: SocketState = {
  connectionState: ConnectionState.DISCONNECTED,
  userStatus: 'offline',
  lastSeen: null,
  reconnectAttempts: 0,
};

// Atomic state reducer
const socketReducer = (
  state: SocketState,
  action: StateAction,
): SocketState => {
  switch (action.type) {
    case 'SET_CONNECTION_STATE':
      return {...state, connectionState: action.payload};
    case 'SET_USER_STATUS':
      return {...state, userStatus: action.payload};
    case 'SET_LAST_SEEN':
      return {...state, lastSeen: action.payload};
    case 'SET_RECONNECT_ATTEMPTS':
      return {...state, reconnectAttempts: action.payload};
    case 'INCREMENT_RECONNECT_ATTEMPTS':
      return {...state, reconnectAttempts: state.reconnectAttempts + 1};
    case 'RESET_RECONNECT_ATTEMPTS':
      return {...state, reconnectAttempts: 0};
    case 'CONNECTION_SUCCESS':
      return {
        ...state,
        connectionState: ConnectionState.CONNECTED,
        reconnectAttempts: 0,
      };
    case 'CONNECTION_FAILED':
      return {
        ...state,
        connectionState: ConnectionState.ERROR,
        userStatus: 'offline',
      };
    case 'USER_DISCONNECTED':
      return {
        ...state,
        connectionState: ConnectionState.DISCONNECTED,
        userStatus: 'offline',
        lastSeen: new Date(),
      };
    default:
      return state;
  }
};

// Connection health interface
interface ConnectionHealth {
  isHealthy: boolean;
  latency: number;
  lastPing: Date | null;
  consecutiveFailures: number;
  uptime: number;
}

// Custom hooks
const useStableRefs = () => {
  const refs = useRef({
    socket: null as Socket | null,
    reconnectTimeout: null as NodeJS.Timeout | null,
    heartbeatInterval: null as NodeJS.Timeout | null,
    appStateSubscription: null as any,
    netInfoSubscription: null as any,
    isConnecting: false,
    lastPingTime: 0,
    connectionStartTime: 0,
    consecutiveFailures: 0,
    eventListeners: new Map<string, Set<Function>>(),
    statusUpdateQueue: [] as Array<() => Promise<void>>,
    isProcessingQueue: false,
  });

  return refs.current;
};

const useNetworkMonitoring = () => {
  const [isNetworkAvailable, setIsNetworkAvailable] = React.useState(true);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsNetworkAvailable(state.isConnected ?? false);
    });

    return unsubscribe;
  }, []);

  return isNetworkAvailable;
};

// Create context
const SocketContext = createContext<SocketContextType | undefined>(undefined);

// Memoized utility functions
const createRetryableFunction = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxRetries: number = 3,
  delay: number = 1000,
) => {
  return async (...args: T): Promise<R> => {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        const retryDelay = delay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw lastError!;
  };
};
const withTimeout = <T,>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), timeoutMs),
    ),
  ]);
};

// Main Provider Component
export const SocketProvider: React.FC<SocketProviderProps> = memo(
  ({children, serverUrl = SOCKET_SERVER_URL, config = {}}) => {
    const {user} = useAuth();
    const [state, dispatch] = useReducer(socketReducer, initialState);
    const refs = useStableRefs();
    const isNetworkAvailable = useNetworkMonitoring();

    // Merge configs
    const socketConfig = useMemo(
      () => ({
        ...SOCKET_CONFIG,
        ...config,
      }),
      [config],
    );

    // Enhanced user status update with queue processing
    const updateUserStatus = useCallback(
      async (status: UserStatus, immediate: boolean = false): Promise<void> => {
        if (!user?.uid) {
          return;
        }

        const updateFunction = async (): Promise<void> => {
          try {
            const statusData: UserStatusData = {
              status,
              lastSeen: firestore.FieldValue.serverTimestamp(),
              lastActivity: firestore.FieldValue.serverTimestamp(),
              isOnline: status === 'online',
              updatedAt: firestore.FieldValue.serverTimestamp(),
            };

            // Update Firestore with retry
            const retryableUpdate = createRetryableFunction(
              () =>
                firestore().collection('users').doc(user.uid).update({
                  userStatus: statusData,
                }),
              3,
              1000,
            );

            await retryableUpdate();

            // Update local state
            dispatch({type: 'SET_USER_STATUS', payload: status});
            dispatch({type: 'SET_LAST_SEEN', payload: new Date()});

            // Emit to socket server if connected
            if (refs.socket?.connected) {
              refs.socket.emit(SocketEvents.USER_STATUS_CHANGE, {
                userId: user.uid,
                status,
                timestamp: Date.now(),
              });
            }

            console.log(`🔄 User status updated to ${status}`);
          } catch (error) {
            console.error('❌ Error updating user status:', error);
            throw error;
          }
        };

        if (immediate) {
          await updateFunction();
        } else {
          // Add to queue for batch processing
          refs.statusUpdateQueue.push(updateFunction);
          processStatusQueue();
        }
      },
      [user?.uid, refs],
    );

    // Process status update queue
    const processStatusQueue = useCallback(async () => {
      if (refs.isProcessingQueue || refs.statusUpdateQueue.length === 0) {
        return;
      }

      refs.isProcessingQueue = true;

      try {
        // Process latest status update (skip older ones)
        const latestUpdate = refs.statusUpdateQueue.pop();
        refs.statusUpdateQueue.length = 0; // Clear queue

        if (latestUpdate) {
          await latestUpdate();
        }
      } catch (error) {
        console.error('❌ Error processing status queue:', error);
      } finally {
        refs.isProcessingQueue = false;
      }
    }, [refs]);

    // Enhanced heartbeat with health monitoring
    const setupHeartbeat = useCallback(() => {
      if (refs.heartbeatInterval) {
        clearInterval(refs.heartbeatInterval);
      }

      refs.heartbeatInterval = setInterval(async () => {
        if (!user?.uid || !isNetworkAvailable) {
          return;
        }

        try {
          // Ping server for latency measurement
          const startTime = Date.now();
          refs.lastPingTime = startTime;

          if (refs.socket?.connected) {
            refs.socket.emit('ping', startTime);
          }

          // Update status if app is active
          if (AppState.currentState === 'active') {
            await updateUserStatus('online');
          }

          // Reset consecutive failures on success
          refs.consecutiveFailures = 0;
        } catch (error) {
          refs.consecutiveFailures++;
          console.error('❌ Heartbeat error:', error);

          // Trigger reconnection after multiple failures
          if (refs.consecutiveFailures >= 3) {
            reconnect();
          }
        }
      }, socketConfig.heartbeatInterval);
    }, [user?.uid, isNetworkAvailable, socketConfig.heartbeatInterval]);

    // Enhanced app state handling
    const handleAppStateChange = useCallback(
      async (nextAppState: AppStateStatus) => {
        if (!user?.uid) {
          return;
        }

        try {
          switch (nextAppState) {
            case 'active':
              await updateUserStatus('online', true);
              setupHeartbeat();

              // Reconnect if disconnected
              if (!refs.socket?.connected && isNetworkAvailable) {
                reconnect();
              }
              break;

            case 'background':
              await updateUserStatus('away', true);
              if (refs.heartbeatInterval) {
                clearInterval(refs.heartbeatInterval);
                refs.heartbeatInterval = null;
              }
              break;

            case 'inactive':
              await updateUserStatus('away');
              break;
          }
        } catch (error) {
          console.error('❌ Error handling app state change:', error);
        }
      },
      [user?.uid, updateUserStatus, setupHeartbeat, isNetworkAvailable],
    );

    // Enhanced socket initialization with comprehensive error handling
    const initializeSocket = useCallback(async (): Promise<void> => {
      if (refs.isConnecting || !user?.uid || !isNetworkAvailable) {
        return;
      }

      try {
        refs.isConnecting = true;
        dispatch({
          type: 'SET_CONNECTION_STATE',
          payload: ConnectionState.CONNECTING,
        });

        // Clean up existing socket
        if (refs.socket) {
          refs.socket.removeAllListeners();
          refs.socket.disconnect();
          refs.socket = null;
        }

        // Get FCM token with retry
        const retryableGetToken = createRetryableFunction(
          () => messaging().getToken(),
          3,
          1000,
        );

        const fcmToken = await withTimeout(retryableGetToken(), 10000);
        console.log('🚀 Initializing socket for user:', user.uid);

        // Create socket with enhanced configuration
        refs.socket = io(serverUrl, {
          timeout: socketConfig.timeout,
          forceNew: true,
          transports: ['websocket'],
          reconnection: true,
          reconnectionDelay: socketConfig.reconnectionDelay,
          reconnectionDelayMax: socketConfig.reconnectionDelayMax,
          reconnectionAttempts: socketConfig.reconnectionAttempts,
        });

        // Connection event handlers
        refs.socket.on(SocketEvents.CONNECT, async () => {
          console.log('✅ Socket connected with ID:', refs.socket?.id);
          refs.connectionStartTime = Date.now();
          dispatch({type: 'CONNECTION_SUCCESS'});

          // Register user with server
          refs.socket?.emit(SocketEvents.REGISTER, {
            userId: user.uid,
            fcmToken,
            from: 'socketProvider',
            timestamp: Date.now(),
          });

          // Set user as online
          await updateUserStatus('online', true);
          setupHeartbeat();

          // Clear reconnect timeout
          if (refs.reconnectTimeout) {
            clearTimeout(refs.reconnectTimeout);
            refs.reconnectTimeout = null;
          }
        });

        refs.socket.on(SocketEvents.DISCONNECT, async (reason: string) => {
          console.log('🔌 Socket disconnected, reason:', reason);
          dispatch({type: 'USER_DISCONNECTED'});

          // Set user as offline
          await updateUserStatus('offline', true);

          // Clear heartbeat
          if (refs.heartbeatInterval) {
            clearInterval(refs.heartbeatInterval);
            refs.heartbeatInterval = null;
          }

          // Handle reconnection based on reason
          if (reason !== 'io client disconnect' && isNetworkAvailable) {
            scheduleReconnection();
          }
        });

        refs.socket.on(SocketEvents.CONNECT_ERROR, (error: Error) => {
          console.error('❌ Socket connection error:', error);
          dispatch({type: 'CONNECTION_FAILED'});
          refs.consecutiveFailures++;

          if (
            isNetworkAvailable &&
            refs.consecutiveFailures < socketConfig.maxReconnectAttempts
          ) {
            scheduleReconnection();
          }
        });

        refs.socket.on(SocketEvents.RECONNECT, async () => {
          console.log('🔄 Socket reconnected successfully');
          dispatch({type: 'CONNECTION_SUCCESS'});
          await updateUserStatus('online', true);
          setupHeartbeat();
        });

        // Pong handler for latency measurement
        refs.socket.on('pong', (timestamp: number) => {
          const latency = Date.now() - timestamp;
          console.log(`🏓 Ping latency: ${latency}ms`);
        });

        // Enhanced user status updates
        refs.socket.on(SocketEvents.USER_STATUS_UPDATED, (data: any) => {
          console.log('📱 User status updated:', data);
          // Emit to other listeners if needed
        });
      } catch (error) {
        console.error('❌ Error initializing socket:', error);
        dispatch({type: 'CONNECTION_FAILED'});
        refs.consecutiveFailures++;

        if (isNetworkAvailable) {
          scheduleReconnection();
        }
      } finally {
        refs.isConnecting = false;
      }
    }, [
      user?.uid,
      serverUrl,
      socketConfig,
      isNetworkAvailable,
      updateUserStatus,
      setupHeartbeat,
    ]);

    // Smart reconnection scheduling
    const scheduleReconnection = useCallback(() => {
      if (refs.reconnectTimeout || refs.isConnecting) {
        return;
      }

      dispatch({type: 'INCREMENT_RECONNECT_ATTEMPTS'});

      // Exponential backoff with jitter
      const baseDelay = socketConfig.reconnectionDelay;
      const maxDelay = socketConfig.reconnectionDelayMax;
      const attempt = state.reconnectAttempts;

      const delay = Math.min(
        baseDelay * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelay,
      );

      console.log(
        `🔄 Scheduling reconnection in ${delay}ms (attempt ${attempt + 1})`,
      );
      dispatch({
        type: 'SET_CONNECTION_STATE',
        payload: ConnectionState.RECONNECTING,
      });

      refs.reconnectTimeout = setTimeout(() => {
        refs.reconnectTimeout = null;

        if (state.reconnectAttempts < socketConfig.maxReconnectAttempts) {
          initializeSocket();
        } else {
          console.error('❌ Max reconnection attempts reached');
          dispatch({type: 'CONNECTION_FAILED'});
        }
      }, delay);
    }, [socketConfig, state.reconnectAttempts, initializeSocket]);

    // Enhanced cleanup function
    const cleanupSocket = useCallback(async () => {
      console.log('🧹 Cleaning up socket');

      // Clear timeouts and intervals
      if (refs.reconnectTimeout) {
        clearTimeout(refs.reconnectTimeout);
        refs.reconnectTimeout = null;
      }

      if (refs.heartbeatInterval) {
        clearInterval(refs.heartbeatInterval);
        refs.heartbeatInterval = null;
      }

      // Clean up subscriptions
      refs.appStateSubscription?.remove();
      refs.netInfoSubscription?.();

      // Disconnect socket
      if (refs.socket) {
        refs.socket.removeAllListeners();
        refs.socket.disconnect();
        refs.socket = null;
      }

      // Clear event listeners
      refs.eventListeners.clear();

      // Reset state
      dispatch({type: 'USER_DISCONNECTED'});
      refs.isConnecting = false;
      refs.consecutiveFailures = 0;

      // Set user offline
      if (user?.uid) {
        await updateUserStatus('offline', true);
      }
    }, [user?.uid, updateUserStatus, refs]);

    // Public API methods - enhanced with better error handling
    const api = useMemo(
      () => ({
        emit: async (event: string, data?: any): Promise<boolean> => {
          try {
            if (!refs.socket?.connected) {
              console.warn('⚠️ Cannot emit, socket not connected');
              return false;
            }

            console.log('📤 Emitting event:', event, data);
            refs.socket.emit(event, data);
            return true;
          } catch (error) {
            console.error('❌ Error emitting event:', error);
            return false;
          }
        },

        on: (
          event: string,
          callback: (...args: any[]) => void,
        ): (() => void) => {
          if (refs.socket) {
            refs.socket.on(event, callback);

            // Track listeners for cleanup
            if (!refs.eventListeners.has(event)) {
              refs.eventListeners.set(event, new Set());
            }
            refs.eventListeners.get(event)!.add(callback);
          }

          // Return cleanup function
          return () => {
            if (refs.socket) {
              refs.socket.off(event, callback);
            }
            refs.eventListeners.get(event)?.delete(callback);
          };
        },

        off: (event: string, callback?: (...args: any[]) => void) => {
          if (refs.socket) {
            refs.socket.off(event, callback);
          }
          if (callback) {
            refs.eventListeners.get(event)?.delete(callback);
          } else {
            refs.eventListeners.delete(event);
          }
        },

        waitForConnection: (timeout = 5000): Promise<boolean> => {
          return new Promise(resolve => {
            if (
              state.connectionState === ConnectionState.CONNECTED &&
              refs.socket?.connected
            ) {
              resolve(true);
              return;
            }

            let waitTime = 0;
            const checkInterval = 100;

            const interval = setInterval(() => {
              waitTime += checkInterval;

              if (
                state.connectionState === ConnectionState.CONNECTED &&
                refs.socket?.connected
              ) {
                clearInterval(interval);
                resolve(true);
              } else if (waitTime >= timeout) {
                clearInterval(interval);
                console.warn('⚠️ Connection timeout');
                resolve(false);
              }
            }, checkInterval);
          });
        },

        reconnect: async (): Promise<void> => {
          console.log('🔄 Manual reconnect requested');
          await cleanupSocket();
          dispatch({type: 'RESET_RECONNECT_ATTEMPTS'});
          setTimeout(() => {
            initializeSocket();
          }, 1000);
        },

        setUserStatus: async (status: UserStatus): Promise<void> => {
          await updateUserStatus(status, true);
        },

        getUserStatus: async (userId: string) => {
          try {
            const retryableGetUser = createRetryableFunction(
              () => firestore().collection('users').doc(userId).get(),
              3,
              1000,
            );

            const userDoc = await retryableGetUser();
            const userData = userDoc.data();
            const userStatus = userData?.userStatus;

            if (userStatus) {
              const lastSeenTimestamp = userStatus.lastSeen?.toDate();
              const isOnline =
                userStatus.isOnline && userStatus.status === 'online';

              // Check if user was online recently
              const isRecentlyOnline =
                lastSeenTimestamp &&
                Date.now() - lastSeenTimestamp.getTime() <
                  socketConfig.statusCheckInterval;

              return {
                status: (isRecentlyOnline
                  ? userStatus.status
                  : 'offline') as UserStatus,
                lastSeen: lastSeenTimestamp || null,
                isOnline: isOnline && isRecentlyOnline,
              };
            }

            return {
              status: 'offline' as UserStatus,
              lastSeen: null,
              isOnline: false,
            };
          } catch (error) {
            console.error('❌ Error getting user status:', error);
            return {
              status: 'offline' as UserStatus,
              lastSeen: null,
              isOnline: false,
            };
          }
        },

        getConnectionHealth: (): ConnectionHealth => {
          const now = Date.now();
          const uptime =
            refs.connectionStartTime > 0 ? now - refs.connectionStartTime : 0;
          const latency = refs.lastPingTime > 0 ? now - refs.lastPingTime : 0;

          return {
            isHealthy:
              state.connectionState === ConnectionState.CONNECTED &&
              refs.consecutiveFailures === 0,
            latency,
            lastPing:
              refs.lastPingTime > 0 ? new Date(refs.lastPingTime) : null,
            consecutiveFailures: refs.consecutiveFailures,
            uptime,
          };
        },
      }),
      [
        state.connectionState,
        refs,
        updateUserStatus,
        cleanupSocket,
        initializeSocket,
        socketConfig,
      ],
    );

    // Memoized context value
    const contextValue = useMemo(
      (): SocketContextType => ({
        socket: refs.socket,
        isConnected: state.connectionState === ConnectionState.CONNECTED,
        connectionState: state.connectionState,
        userStatus: state.userStatus,
        lastSeen: state.lastSeen,
        reconnectAttempts: state.reconnectAttempts,
        ...api,
      }),
      [state, refs.socket, api],
    );

    // Effects
    useEffect(() => {
      if (user?.uid && isNetworkAvailable) {
        initializeSocket();
      } else {
        cleanupSocket();
      }

      return cleanupSocket;
    }, [user?.uid, isNetworkAvailable]);

    // App state listener
    useEffect(() => {
      refs.appStateSubscription = AppState.addEventListener(
        'change',
        handleAppStateChange,
      );

      // Set initial status
      if (user?.uid && AppState.currentState === 'active') {
        updateUserStatus('online', true);
        setupHeartbeat();
      }

      return () => {
        refs.appStateSubscription?.remove();
        if (refs.heartbeatInterval) {
          clearInterval(refs.heartbeatInterval);
        }
      };
    }, [user?.uid]);

    return (
      <SocketContext.Provider value={contextValue}>
        {children}
      </SocketContext.Provider>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.serverUrl === nextProps.serverUrl &&
      JSON.stringify(prevProps.config) === JSON.stringify(nextProps.config)
    );
  },
);

// Enhanced hook with additional utilities
export const useSocket = () => {
  const context = useContext(SocketContext);

  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }

  // Additional helper functions
  const helpers = useMemo(
    () => ({
      // Check if socket is healthy
      isHealthy: (): boolean => {
        const health = context.getConnectionHealth();
        return health.isHealthy;
      },

      // Emit with automatic retry
      emitWithRetry: async (
        event: string,
        data?: any,
        maxRetries = 3,
      ): Promise<boolean> => {
        for (let attempt = 0; attempt < maxRetries; attempt++) {
          const success = await context.emit(event, data);
          if (success) {
            return true;
          }

          // Wait for connection
          const connected = await context.waitForConnection(5000);
          if (!connected && attempt === maxRetries - 1) {
            return false;
          }
        }
        return false;
      },

      // Get formatted connection status
      getConnectionStatus: (): string => {
        const health = context.getConnectionHealth();
        if (health.isHealthy) {
          return `Connected (${health.latency}ms)`;
        } else if (context.connectionState === ConnectionState.CONNECTING) {
          return 'Connecting...';
        } else if (context.connectionState === ConnectionState.RECONNECTING) {
          return `Reconnecting (attempt ${context.reconnectAttempts})`;
        } else {
          return 'Disconnected';
        }
      },
    }),
    [context],
  );

  return {
    ...context,
    ...helpers,
  };
};

// Export provider with display name
SocketProvider.displayName = 'SocketProvider';

// Export types and enums
export type {UserStatus, ConnectionHealth, SocketContextType};
export {ConnectionState, SocketEvents};
