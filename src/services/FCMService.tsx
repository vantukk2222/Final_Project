import messaging from '@react-native-firebase/messaging';
import firestore from '@react-native-firebase/firestore';
import {Platform} from 'react-native';
import DeviceInfo from 'react-native-device-info';

class FCMService {
  private tokenRef: string | null = null;
  private unsubscribeTokenRefresh: (() => void) | null = null;
  private unsubscribeSessionWatch: (() => void) | null = null;
  private currentUserId: string | null = null;
  private deviceId: string | null = null;
  private sessionId: string | null = null;
  getSessionId(): string | null {
    return this.sessionId;
  }

  getDeviceId(): string | null {
    return this.deviceId;
  }

  getCurrentUserId(): string | null {
    return this.currentUserId;
  }
  removeToken(uId: string) {
    console.log('FCMService: Removing token for user', uId);
    if (!uId) {
      console.warn('FCMService: No user ID provided for token removal');
      return;
    }

    // Remove FCM token from Firestore
    firestore()
      .collection('users')
      .doc(uId)
      .update({
        fcmToken: firestore.FieldValue.delete(),
        'currentSession.fcmToken': firestore.FieldValue.delete(),
      })
      .then(() => {
        console.log('FCMService: Token removed successfully');
      })
      .catch(error => {
        console.error('FCMService: Error removing token:', error);
      });
  }

  // Check if current session is active
  async isSessionActive(): Promise<boolean> {
    if (!this.currentUserId || !this.sessionId) {
      return false;
    }

    try {
      const userDoc = await firestore()
        .collection('users')
        .doc(this.currentUserId)
        .get();

      const userData = userDoc.data();
      const currentSession = userData?.currentSession;

      return (
        currentSession?.sessionId === this.sessionId &&
        currentSession?.isActive === true
      );
    } catch (error) {
      console.error('FCMService: Error checking session status:', error);
      return false;
    }
  }

  async initialize() {
    // Get unique device ID
    this.deviceId = await DeviceInfo.getUniqueId();

    // Request permission
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (enabled) {
      console.log('FCM Authorization status:', authStatus);
    }

    return enabled;
  }

  async setUser(userId: string | null, onSessionConflict?: () => void) {
    console.log('FCMService: Setting user', userId);

    // Clean up previous user
    if (this.currentUserId !== userId) {
      this.cleanup();
      this.currentUserId = userId;
      this.tokenRef = null;
    }

    if (userId) {
      await this.createSession(userId, onSessionConflict);
      await this.updateToken(userId);
      this.setupTokenRefreshListener(userId);
    }
  }

  private async createSession(userId: string, onSessionConflict?: () => void) {
    try {
      const fcmToken = await messaging().getToken();
      this.sessionId = `${this.deviceId}_${Date.now()}`;

      const sessionData = {
        sessionId: this.sessionId,
        deviceId: this.deviceId,
        fcmToken: fcmToken,
        platform: Platform.OS,
        // appVersion: DeviceInfo.getVersion(),
        loginTime: firestore.FieldValue.serverTimestamp(),
        lastActive: firestore.FieldValue.serverTimestamp(),
        isActive: true,
      };

      // Use transaction to handle concurrent logins
      await firestore().runTransaction(async transaction => {
        const userRef = firestore().collection('users').doc(userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists) {
          throw new Error('User document not found');
        }

        const userData = userDoc.data();
        const existingSession = userData?.currentSession;
        console.log('existingSession', existingSession);
        console.log('sessionData', sessionData);
        console.log('isActive', sessionData.isActive);
        console.log('deviceId', sessionData.deviceId);
        // If there's an existing active session from different device, mark it as kicked
        if (
          existingSession &&
          existingSession.isActive &&
          existingSession.deviceId !== this.deviceId
        ) {
          console.log(
            'FCMService: Kicking existing session:',
            existingSession.sessionId,
            existingSession.deviceId,
          );

          // Update the existing session as kicked
          transaction.update(userRef, {
            [`sessionHistory.${existingSession.sessionId}`]: {
              ...existingSession,
              isActive: false,
              kickedAt: firestore.FieldValue.serverTimestamp(),
              kickedBy: this.sessionId,
            },
          });
        }

        // Set new current session
        transaction.update(userRef, {
          currentSession: sessionData,
          fcmToken: fcmToken, // Keep for backward compatibility
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      });

      // Watch for session conflicts (if another device kicks this one)
      this.watchSession(userId, onSessionConflict);

      console.log('FCMService: Session created successfully:', this.sessionId);
    } catch (error) {
      console.error('FCMService: Error creating session:', error);
      throw error;
    }
  }

  private watchSession(userId: string, onSessionConflict?: () => void) {
    if (this.unsubscribeSessionWatch) {
      this.unsubscribeSessionWatch();
    }

    this.unsubscribeSessionWatch = firestore()
      .collection('users')
      .doc(userId)
      .onSnapshot(doc => {
        const userData = doc.data();
        const currentSession = userData?.currentSession;

        // Check if our session has been kicked
        if (
          currentSession &&
          currentSession.sessionId !== this.sessionId &&
          this.sessionId &&
          currentSession.deviceId !== this.deviceId &&
          currentSession.isActive === false &&
          currentSession.kickedBy !== this.sessionId &&
          currentSession.kickedAt &&
          currentSession.kickedAt.toMillis() > Date.now() - 5 * 60 * 1000 // Kicked in the last 5 minutes
        ) {
          console.log(
            'FCMService: Our session has been kicked by:',
            currentSession.sessionId,
            currentSession.deviceId,
          );

          if (onSessionConflict) {
            onSessionConflict();
          }
        }
      });
  }

  private async updateToken(userId: string) {
    try {
      const fcmToken = await messaging().getToken();

      if (fcmToken && fcmToken !== this.tokenRef) {
        console.log('FCMService: Updating token...');

        await firestore().collection('users').doc(userId).update({
          'currentSession.fcmToken': fcmToken,
          fcmToken: fcmToken, // Keep for backward compatibility
          'currentSession.lastActive': firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

        this.tokenRef = fcmToken;
        console.log('FCMService: Token updated successfully');
      }
    } catch (error) {
      console.error('FCMService: Error updating token:', error);
    }
  }

  private setupTokenRefreshListener(userId: string) {
    if (this.unsubscribeTokenRefresh) {
      this.unsubscribeTokenRefresh();
    }

    this.unsubscribeTokenRefresh = messaging().onTokenRefresh(
      async newToken => {
        console.log('FCMService: Token refreshed:', newToken);

        if (newToken !== this.tokenRef && userId) {
          try {
            await firestore().collection('users').doc(userId).update({
              'currentSession.fcmToken': newToken,
              fcmToken: newToken, // Keep for backward compatibility
              'currentSession.lastActive':
                firestore.FieldValue.serverTimestamp(),
              updatedAt: firestore.FieldValue.serverTimestamp(),
            });

            this.tokenRef = newToken;
            console.log('FCMService: Refreshed token updated');
          } catch (error) {
            console.error('FCMService: Error updating refreshed token:', error);
          }
        }
      },
    );
  }

  async updateLastActive(userId: string) {
    if (!userId || !this.sessionId) {
      return;
    }

    try {
      await firestore().collection('users').doc(userId).update({
        'currentSession.lastActive': firestore.FieldValue.serverTimestamp(),
        lastActive: firestore.FieldValue.serverTimestamp(),
      });
    } catch (error) {
      console.error('FCMService: Error updating last active:', error);
    }
  }

  async removeSession(userId: string) {
    try {
      if (userId && this.sessionId) {
        await firestore().collection('users').doc(userId).update({
          'currentSession.isActive': false,
          'currentSession.logoutTime': firestore.FieldValue.serverTimestamp(),
          lastActive: firestore.FieldValue.serverTimestamp(),
          // Remove FCM token
          fcmToken: firestore.FieldValue.delete(),
        });
        console.log('FCMService: Session ended');
      }
    } catch (error) {
      console.error('FCMService: Error removing session:', error);
    }
  }

  cleanup() {
    console.log('FCMService: Cleaning up');

    if (this.unsubscribeTokenRefresh) {
      this.unsubscribeTokenRefresh();
      this.unsubscribeTokenRefresh = null;
    }

    if (this.unsubscribeSessionWatch) {
      this.unsubscribeSessionWatch();
      this.unsubscribeSessionWatch = null;
    }

    this.tokenRef = null;
    this.currentUserId = null;
    this.sessionId = null;
  }
}

export const fcmService = new FCMService();
