import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import {Platform, AppState, AppStateStatus} from 'react-native';
import DeviceInfo from 'react-native-device-info';

// Types
interface SessionData {
  sessionId: string;
  deviceId: string;
  fcmToken: string;
  platform: string;
  appVersion: string;
  deviceModel: string;
  loginTime: any;
  lastActive: any;
  isActive: boolean;
  kickedAt?: any;
  kickedBy?: string;
  logoutTime?: any;
}

interface SessionConflictData {
  sessionId: string;
  deviceId: string;
  deviceModel: string;
  kickedAt: any;
  kickedBy: string;
}

interface FCMServiceConfig {
  sessionTimeoutMs: number;
  heartbeatIntervalMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  batchUpdateDelayMs: number;
}

interface DeviceInfo {
  deviceId: string;
  model: string;
  platform: string;
  appVersion: string;
  buildNumber: string;
}

// Enums
enum SessionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  KICKED = 'kicked',
  EXPIRED = 'expired',
}

enum FCMEvents {
  TOKEN_UPDATED = 'token_updated',
  SESSION_CONFLICT = 'session_conflict',
  SESSION_EXPIRED = 'session_expired',
  CONNECTION_ERROR = 'connection_error',
}

// Constants
const DEFAULT_CONFIG: FCMServiceConfig = Object.freeze({
  sessionTimeoutMs: 5 * 60 * 1000, // 5 minutes
  heartbeatIntervalMs: 2 * 60 * 1000, // 2 minutes
  retryAttempts: 3,
  retryDelayMs: 1000,
  batchUpdateDelayMs: 5000, // 5 seconds
});

// Utility functions
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

class FCMService {
  // Private properties with enhanced typing
  private tokenRef: string | null = null;
  private unsubscribeTokenRefresh: (() => void) | null = null;
  private unsubscribeSessionWatch: (() => void) | null = null;
  private currentUserId: string | null = null;
  private deviceInfo: DeviceInfo | null = null;
  private sessionId: string | null = null;
  private config: FCMServiceConfig = DEFAULT_CONFIG;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private batchUpdateQueue: Array<() => Promise<void>> = [];
  private batchUpdateTimeout: NodeJS.Timeout | null = null;
  private isProcessingBatch: boolean = false;
  private appStateSubscription: any = null;
  private eventListeners: Map<string, Set<Function>> = new Map();
  private lastActiveUpdate: number = 0;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<boolean> | null = null;

  constructor(config?: Partial<FCMServiceConfig>) {
    this.config = {...DEFAULT_CONFIG, ...config};
    this.setupAppStateListener();
  }

  // Public API Methods

  /**
   * Initialize FCM service with enhanced error handling
   */
  async initialize(): Promise<boolean> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.performInitialization();
    return this.initializationPromise;
  }

  /**
   * Set user with enhanced session management
   */
  async setUser(
    userId: string | null,
    onSessionConflict?: (conflictData: SessionConflictData) => void,
  ): Promise<void> {
    console.log('🔧 FCMService: Setting user', userId);

    try {
      // Clean up previous user if different
      if (this.currentUserId !== userId) {
        await this.cleanup();
        this.currentUserId = userId;
        this.tokenRef = null;
      }

      if (userId) {
        // Ensure initialization is complete
        await this.initialize();

        // Create session with retry logic
        const retryableCreateSession = createRetryableFunction(
          () => this.createSession(userId, onSessionConflict),
          this.config.retryAttempts,
          this.config.retryDelayMs,
        );

        await retryableCreateSession();
        await this.updateToken(userId);
        this.setupTokenRefreshListener(userId);
        this.startHeartbeat(userId);

        console.log('✅ FCMService: User set successfully');
      }
    } catch (error) {
      console.error('❌ FCMService: Error setting user:', error);
      throw new Error(`Failed to set user: ${(error as Error).message}`);
    }
  }

  /**
   * Remove token with enhanced cleanup
   */
  async removeToken(userId: string): Promise<void> {
    console.log('🗑️ FCMService: Removing token for user', userId);

    if (!userId) {
      console.warn('⚠️ FCMService: No user ID provided for token removal');
      return;
    }

    try {
      const retryableRemove = createRetryableFunction(
        () =>
          firestore().collection('users').doc(userId).update({
            fcmToken: firestore.FieldValue.delete(),
            'currentSession.fcmToken': firestore.FieldValue.delete(),
            'currentSession.isActive': false,
            'currentSession.logoutTime': firestore.FieldValue.serverTimestamp(),
            lastActive: firestore.FieldValue.serverTimestamp(),
          }),
        this.config.retryAttempts,
        this.config.retryDelayMs,
      );

      await retryableRemove();
      console.log('✅ FCMService: Token removed successfully');
    } catch (error) {
      console.error('❌ FCMService: Error removing token:', error);
      throw error;
    }
  }

  /**
   * Check if current session is active with enhanced validation
   */
  async isSessionActive(): Promise<boolean> {
    if (!this.currentUserId || !this.sessionId) {
      return false;
    }

    try {
      const retryableCheck = createRetryableFunction(
        () => firestore().collection('users').doc(this.currentUserId!).get(),
        this.config.retryAttempts,
        this.config.retryDelayMs,
      );

      const userDoc = await retryableCheck();
      const userData = userDoc.data();
      const currentSession = userData?.currentSession;

      const isActive =
        currentSession?.sessionId === this.sessionId &&
        currentSession?.isActive === true &&
        currentSession?.deviceId === this.deviceInfo?.deviceId;

      // Check session timeout
      if (isActive && currentSession?.lastActive) {
        const lastActiveTime = currentSession.lastActive.toMillis();
        const isExpired =
          Date.now() - lastActiveTime > this.config.sessionTimeoutMs;

        if (isExpired) {
          console.log('⏰ FCMService: Session expired due to timeout');
          return false;
        }
      }

      return isActive;
    } catch (error) {
      console.error('❌ FCMService: Error checking session status:', error);
      return false;
    }
  }

  /**
   * Update last active with batching for performance
   */
  async updateLastActive(userId: string): Promise<void> {
    if (!userId || !this.sessionId) {
      return;
    }

    const now = Date.now();

    // Throttle updates to prevent excessive Firestore writes
    if (now - this.lastActiveUpdate < this.config.batchUpdateDelayMs) {
      return;
    }

    this.lastActiveUpdate = now;

    const updateFunction = async (): Promise<void> => {
      try {
        await firestore().collection('users').doc(userId).update({
          'currentSession.lastActive': firestore.FieldValue.serverTimestamp(),
          lastActive: firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error('❌ FCMService: Error updating last active:', error);
      }
    };

    // Add to batch queue
    this.batchUpdateQueue.push(updateFunction);
    this.processBatchUpdates();
  }

  /**
   * Remove session with enhanced cleanup
   */
  async removeSession(userId: string): Promise<void> {
    try {
      if (userId && this.sessionId) {
        console.log('🚪 FCMService: Removing session for user', userId);

        const retryableRemove = createRetryableFunction(
          () =>
            firestore()
              .collection('users')
              .doc(userId)
              .update({
                'currentSession.isActive': false,
                'currentSession.logoutTime':
                  firestore.FieldValue.serverTimestamp(),
                lastActive: firestore.FieldValue.serverTimestamp(),
                fcmToken: firestore.FieldValue.delete(),
                [`sessionHistory.${this.sessionId}`]: {
                  sessionId: this.sessionId,
                  deviceId: this.deviceInfo?.deviceId,
                  logoutTime: firestore.FieldValue.serverTimestamp(),
                  status: SessionStatus.INACTIVE,
                },
              }),
          this.config.retryAttempts,
          this.config.retryDelayMs,
        );

        await retryableRemove();
        console.log('✅ FCMService: Session removed successfully');
      }
    } catch (error) {
      console.error('❌ FCMService: Error removing session:', error);
      throw error;
    }
  }

  /**
   * Enhanced cleanup with complete resource deallocation
   */
  async cleanup(): Promise<void> {
    console.log('🧹 FCMService: Cleaning up');

    try {
      // Stop heartbeat
      this.stopHeartbeat();

      // Clean up batch processing
      this.clearBatchQueue();

      // Clean up listeners
      if (this.unsubscribeTokenRefresh) {
        this.unsubscribeTokenRefresh();
        this.unsubscribeTokenRefresh = null;
      }

      if (this.unsubscribeSessionWatch) {
        this.unsubscribeSessionWatch();
        this.unsubscribeSessionWatch = null;
      }

      // Clean up app state listener
      if (this.appStateSubscription) {
        this.appStateSubscription.remove();
        this.appStateSubscription = null;
      }

      // Clear event listeners
      this.eventListeners.clear();

      // Remove session if exists
      if (this.currentUserId && this.sessionId) {
        await this.removeSession(this.currentUserId);
      }

      // Reset state
      this.tokenRef = null;
      this.currentUserId = null;
      this.sessionId = null;
      this.lastActiveUpdate = 0;
      this.isInitialized = false;
      this.initializationPromise = null;

      console.log('✅ FCMService: Cleanup completed');
    } catch (error) {
      console.error('❌ FCMService: Error during cleanup:', error);
    }
  }

  // Getters with validation
  getSessionId(): string | null {
    return this.sessionId;
  }

  getDeviceId(): string | null {
    return this.deviceInfo?.deviceId || null;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }

  getDeviceInfo(): DeviceInfo | null {
    return this.deviceInfo;
  }

  getSessionStatus(): SessionStatus {
    if (!this.sessionId || !this.currentUserId) {
      return SessionStatus.INACTIVE;
    }
    return SessionStatus.ACTIVE;
  }

  // Event management
  addEventListener(event: string, listener: Function): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);

    // Return cleanup function
    return () => {
      this.eventListeners.get(event)?.delete(listener);
    };
  }

  removeEventListener(event: string, listener?: Function): void {
    if (listener) {
      this.eventListeners.get(event)?.delete(listener);
    } else {
      this.eventListeners.delete(event);
    }
  }

  // Private Methods

  /**
   * Perform initialization with enhanced device info gathering
   */
  private async performInitialization(): Promise<boolean> {
    try {
      console.log('🚀 FCMService: Initializing...');

      // Gather comprehensive device info
      const [deviceId, model, appVersion, buildNumber] = await Promise.all([
        DeviceInfo.getUniqueId(),
        DeviceInfo.getModel(),
        DeviceInfo.getVersion(),
        DeviceInfo.getBuildNumber(),
      ]);

      this.deviceInfo = {
        deviceId,
        model,
        platform: Platform.OS,
        appVersion,
        buildNumber,
      };

      // Request FCM permission with timeout
      const authStatus = await withTimeout(
        messaging().requestPermission(),
        10000,
      );

      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('✅ FCM Authorization status:', authStatus);
        this.isInitialized = true;
      } else {
        console.warn('⚠️ FCM Permission denied');
      }

      return enabled;
    } catch (error) {
      console.error('❌ FCMService: Initialization failed:', error);
      this.isInitialized = false;
      throw error;
    }
  }

  /**
   * Create session with enhanced conflict detection
   */
  private async createSession(
    userId: string,
    onSessionConflict?: (conflictData: SessionConflictData) => void,
  ): Promise<void> {
    try {
      const fcmToken = await withTimeout(messaging().getToken(), 10000);
      this.sessionId = `${this.deviceInfo!.deviceId}_${Date.now()}`;

      const sessionData: SessionData = {
        sessionId: this.sessionId,
        deviceId: this.deviceInfo!.deviceId,
        fcmToken,
        platform: this.deviceInfo!.platform,
        appVersion: this.deviceInfo!.appVersion,
        deviceModel: this.deviceInfo!.model,
        loginTime: firestore.FieldValue.serverTimestamp(),
        lastActive: firestore.FieldValue.serverTimestamp(),
        isActive: true,
      };

      // Use transaction for atomic session management
      await firestore().runTransaction(async transaction => {
        const userRef = firestore().collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error('User document not found');
        }

        const userData = userDoc.data();
        const existingSession = userData?.currentSession;

        // Handle existing active session from different device
        if (
          existingSession &&
          existingSession.isActive &&
          existingSession.deviceId !== this.deviceInfo!.deviceId
        ) {
          console.log(
            '🔄 FCMService: Kicking existing session:',
            existingSession,
          );

          // Archive existing session
          transaction.update(userRef, {
            [`sessionHistory.${existingSession.sessionId}`]: {
              ...existingSession,
              isActive: false,
              kickedAt: firestore.FieldValue.serverTimestamp(),
              kickedBy: this.sessionId,
              status: SessionStatus.KICKED,
            },
          });

          // Emit session conflict event
          this.emitEvent(FCMEvents.SESSION_CONFLICT, {
            sessionId: existingSession.sessionId,
            deviceId: existingSession.deviceId,
            deviceModel: existingSession.deviceModel,
            kickedAt: firestore.FieldValue.serverTimestamp(),
            kickedBy: this.sessionId,
          });
        }

        // Set new current session
        transaction.update(userRef, {
          currentSession: sessionData,
          fcmToken, // Backward compatibility
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });

      // Setup session monitoring
      this.watchSession(userId, onSessionConflict);

      console.log(
        '✅ FCMService: Session created successfully:',
        this.sessionId,
      );
    } catch (error) {
      console.error('❌ FCMService: Error creating session:', error);
      throw error;
    }
  }

  /**
   * Enhanced session monitoring with conflict detection
   */
  private watchSession(
    userId: string,
    onSessionConflict?: (conflictData: SessionConflictData) => void,
  ): void {
    if (this.unsubscribeSessionWatch) {
      this.unsubscribeSessionWatch();
    }

    this.unsubscribeSessionWatch = firestore()
      .collection('users')
      .doc(userId)
      .onSnapshot(
        doc => {
          try {
            const userData = doc.data();
            const currentSession = userData?.currentSession;

            // Check if our session has been kicked
            if (this.isSessionKicked(currentSession)) {
              console.log('👋 FCMService: Session kicked by:', currentSession);

              const conflictData: SessionConflictData = {
                sessionId: currentSession.sessionId,
                deviceId: currentSession.deviceId,
                deviceModel: currentSession.deviceModel || 'Unknown',
                kickedAt: currentSession.kickedAt,
                kickedBy: currentSession.kickedBy,
              };

              this.emitEvent(FCMEvents.SESSION_CONFLICT, conflictData);

              if (onSessionConflict) {
                onSessionConflict(conflictData);
              }
            }

            // Check for session expiry
            if (this.isSessionExpired(currentSession)) {
              console.log('⏰ FCMService: Session expired');
              this.emitEvent(FCMEvents.SESSION_EXPIRED, {
                sessionId: this.sessionId,
              });
            }
          } catch (error) {
            console.error('❌ FCMService: Error in session watcher:', error);
          }
        },
        error => {
          console.error('❌ FCMService: Session watch error:', error);
          this.emitEvent(FCMEvents.CONNECTION_ERROR, error);
        },
      );
  }

  /**
   * Check if current session has been kicked
   */
  private isSessionKicked(currentSession: any): boolean {
    if (!currentSession || !this.sessionId) {
      return false;
    }

    return (
      currentSession.sessionId !== this.sessionId &&
      currentSession.deviceId !== this.deviceInfo?.deviceId &&
      currentSession.isActive &&
      currentSession.kickedBy &&
      currentSession.kickedAt &&
      currentSession.kickedAt.toMillis() >
        Date.now() - this.config.sessionTimeoutMs
    );
  }

  /**
   * Check if session has expired
   */
  private isSessionExpired(currentSession: any): boolean {
    if (!currentSession || !this.sessionId) {
      return false;
    }

    if (
      currentSession.sessionId === this.sessionId &&
      currentSession.lastActive
    ) {
      const lastActiveTime = currentSession.lastActive.toMillis();
      return Date.now() - lastActiveTime > this.config.sessionTimeoutMs;
    }

    return false;
  }

  /**
   * Update FCM token with enhanced error handling
   */
  private async updateToken(userId: string): Promise<void> {
    try {
      const fcmToken = await withTimeout(messaging().getToken(), 10000);

      if (fcmToken && fcmToken !== this.tokenRef) {
        console.log('🔄 FCMService: Updating token...');

        const retryableUpdate = createRetryableFunction(
          () =>
            firestore().collection('users').doc(userId).update({
              'currentSession.fcmToken': fcmToken,
              fcmToken, // Backward compatibility
              'currentSession.lastActive':
                firestore.FieldValue.serverTimestamp(),
              updatedAt: firestore.FieldValue.serverTimestamp(),
            }),
          this.config.retryAttempts,
          this.config.retryDelayMs,
        );

        await retryableUpdate();
        this.tokenRef = fcmToken;

        this.emitEvent(FCMEvents.TOKEN_UPDATED, {token: fcmToken});
        console.log('✅ FCMService: Token updated successfully');
      }
    } catch (error) {
      console.error('❌ FCMService: Error updating token:', error);
      throw error;
    }
  }

  /**
   * Setup token refresh listener with enhanced handling
   */
  private setupTokenRefreshListener(userId: string): void {
    if (this.unsubscribeTokenRefresh) {
      this.unsubscribeTokenRefresh();
    }

    this.unsubscribeTokenRefresh = messaging().onTokenRefresh(
      async (newToken: string) => {
        console.log('🔄 FCMService: Token refreshed:', newToken);

        if (newToken !== this.tokenRef && userId) {
          try {
            const retryableUpdate = createRetryableFunction(
              () =>
                firestore().collection('users').doc(userId).update({
                  'currentSession.fcmToken': newToken,
                  fcmToken: newToken,
                  'currentSession.lastActive':
                    firestore.FieldValue.serverTimestamp(),
                  updatedAt: firestore.FieldValue.serverTimestamp(),
                }),
              this.config.retryAttempts,
              this.config.retryDelayMs,
            );

            await retryableUpdate();
            this.tokenRef = newToken;

            this.emitEvent(FCMEvents.TOKEN_UPDATED, {token: newToken});
            console.log('✅ FCMService: Refreshed token updated');
          } catch (error) {
            console.error(
              '❌ FCMService: Error updating refreshed token:',
              error,
            );
          }
        }
      },
    );
  }

  /**
   * Start heartbeat for session keep-alive
   */
  private startHeartbeat(userId: string): void {
    this.stopHeartbeat();

    this.heartbeatInterval = setInterval(async () => {
      try {
        if (AppState.currentState === 'active') {
          await this.updateLastActive(userId);
        }
      } catch (error) {
        console.error('❌ FCMService: Heartbeat error:', error);
      }
    }, this.config.heartbeatIntervalMs);

    console.log('💓 FCMService: Heartbeat started');
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log('💤 FCMService: Heartbeat stopped');
    }
  }

  /**
   * Process batched updates for performance optimization
   */
  private processBatchUpdates(): void {
    if (this.isProcessingBatch || this.batchUpdateQueue.length === 0) {
      return;
    }

    // Clear existing timeout
    if (this.batchUpdateTimeout) {
      clearTimeout(this.batchUpdateTimeout);
    }

    // Debounce batch processing
    this.batchUpdateTimeout = setTimeout(async () => {
      this.isProcessingBatch = true;

      try {
        // Process only the latest update (discard older ones)
        const latestUpdate = this.batchUpdateQueue.pop();
        this.batchUpdateQueue.length = 0; // Clear queue

        if (latestUpdate) {
          await latestUpdate();
        }
      } catch (error) {
        console.error('❌ FCMService: Error processing batch updates:', error);
      } finally {
        this.isProcessingBatch = false;
        this.batchUpdateTimeout = null;
      }
    }, this.config.batchUpdateDelayMs);
  }

  /**
   * Clear batch update queue
   */
  private clearBatchQueue(): void {
    this.batchUpdateQueue.length = 0;

    if (this.batchUpdateTimeout) {
      clearTimeout(this.batchUpdateTimeout);
      this.batchUpdateTimeout = null;
    }

    this.isProcessingBatch = false;
  }

  /**
   * Setup app state listener for background/foreground handling
   */
  private setupAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        console.log('📱 FCMService: App state changed to:', nextAppState);

        if (nextAppState === 'active' && this.currentUserId) {
          // Resume heartbeat when app becomes active
          this.startHeartbeat(this.currentUserId);
        } else if (nextAppState === 'background') {
          // Reduce activity when app goes to background
          this.stopHeartbeat();
        }
      },
    );
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: string, data: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error('❌ FCMService: Error in event listener:', error);
        }
      });
    }
  }
}

// Export singleton instance with enhanced configuration
export const fcmService = new FCMService();

// Export types and enums for external use
export type {SessionData, SessionConflictData, FCMServiceConfig, DeviceInfo};

export {SessionStatus, FCMEvents};
