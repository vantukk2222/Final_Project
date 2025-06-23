import React, {useEffect, useRef, useState, useCallback, useMemo} from 'react';
import {
  Platform,
  PermissionsAndroid,
  Animated,
  AppState,
  AppStateStatus,
} from 'react-native';
import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {useNavigation, NavigationProp} from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import {useAuth} from '../contexts/AuthContext';
import {Member} from '../contains/type';
import TrackPlayer, {State, RepeatMode, Track} from 'react-native-track-player';
import LanguageModal from '../components/LanSelect';
import InAppMessageNotification from '../components/ModalInAppMessages';
import CallModalNotification from '../components/ModalCallNotification';
import {
  clearProcessedNotifications,
  getBackgroundNotifications,
} from './backgroundHandler';

// Types
interface NotificationData {
  title: string;
  body: string;
  meetingId?: string;
  type: NotificationType;
  callerName?: string;
  isVideoCall: boolean;
  chatId?: string;
  senderId?: string;
  timestamp: number;
}

interface SoundConfig {
  volume: number;
  numberOfLoops: number;
  enabled: boolean;
  duration: number;
}

interface NotificationConfig {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  inAppEnabled: boolean;
  backgroundEnabled: boolean;
}

// Enums
enum NotificationType {
  MESSAGE = 'message',
  CALL = 'call',
  VIDEO_CALL = 'video_call',
  SYSTEM = 'system',
  DEFAULT = 'default',
}

enum SoundType {
  MESSAGE = 'message',
  CALL = 'call',
  VIDEO_CALL = 'video_call',
  DEFAULT = 'default',
}

// Constants
const SOUND_CONFIG: Record<SoundType, SoundConfig> = Object.freeze({
  [SoundType.MESSAGE]: {
    volume: 0.6,
    numberOfLoops: 2,
    enabled: true,
    duration: 3000,
  },
  [SoundType.CALL]: {
    volume: 0.8,
    numberOfLoops: -1,
    enabled: true,
    duration: 30000,
  },
  [SoundType.VIDEO_CALL]: {
    volume: 0.8,
    numberOfLoops: -1,
    enabled: true,
    duration: 30000,
  },
  [SoundType.DEFAULT]: {
    volume: 0.5,
    numberOfLoops: 1,
    enabled: true,
    duration: 2000,
  },
});

const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = Object.freeze({
  soundEnabled: true,
  vibrationEnabled: true,
  inAppEnabled: true,
  backgroundEnabled: true,
});

const NOTIFICATION_TIMEOUT = 30000;

// Track definitions for different notification types
const NOTIFICATION_TRACKS: Record<SoundType, Track> = Object.freeze({
  [SoundType.MESSAGE]: {
    id: 'notification_message',
    url: require('../assets/sounds/new_messenger.mp3'),
    title: 'Message Notification',
    artist: 'App Notification',
    duration: 3,
  },
  [SoundType.CALL]: {
    id: 'notification_call',
    url: require('../assets/sounds/ringtone.mp3'),
    title: 'Incoming Call',
    artist: 'App Notification',
    duration: 30,
  },
  [SoundType.VIDEO_CALL]: {
    id: 'notification_video_call',
    url: require('../assets/sounds/ringtone.mp3'),
    title: 'Video Call',
    artist: 'App Notification',
    duration: 30,
  },
  [SoundType.DEFAULT]: {
    id: 'notification_default',
    url: require('../assets/sounds/new_messenger.mp3'),
    title: 'Notification',
    artist: 'App Notification',
    duration: 2,
  },
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

        const retryDelay = delay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw lastError!;
  };
};

// Custom hooks
const useStableRefs = () => {
  const refs = useRef({
    notificationTimeouts: new Map<string, NodeJS.Timeout>(),
    appStateSubscription: null as any,
    lastNotificationTime: 0,
    notificationQueue: [] as NotificationData[],
    isProcessingQueue: false,
    currentlyPlayingTrack: null as string | null,
    playbackLoopInterval: null as NodeJS.Timeout | null,
  });

  return refs.current;
};

const useAnimationValues = () => {
  return useMemo(
    () => ({
      fadeAnim: new Animated.Value(0),
      scaleAnim: new Animated.Value(0.8),
      pulseAnim: new Animated.Value(1),
      slideAnim: new Animated.Value(50),
    }),
    [],
  );
};

// Enhanced TrackPlayer Sound Manager
const useSoundManager = () => {
  const refs = useStableRefs();

  // Play notification sound with TrackPlayer (đã được khởi tạo ở index.js)
  const playNotificationSound = useCallback(
    async (type: SoundType = SoundType.DEFAULT): Promise<void> => {
      const config = SOUND_CONFIG[type];
      if (!config.enabled) {
        console.log('🔇 Sound disabled for type:', type);
        return;
      }
      console.log(`🎵 Playing sound for type: ${type}`, config);
      try {
        // Stop any currently playing track
        await TrackPlayer.stop();
        await TrackPlayer.reset();

        const track = NOTIFICATION_TRACKS[type];

        // Add track and configure
        await TrackPlayer.add(track);
        await TrackPlayer.setVolume(config.volume);

        // Set repeat mode
        if (config.numberOfLoops === -1) {
          await TrackPlayer.setRepeatMode(RepeatMode.Track);
        } else {
          await TrackPlayer.setRepeatMode(RepeatMode.Off);
        }

        refs.currentlyPlayingTrack = track.id;

        // Start playback
        await TrackPlayer.play();
        console.log(`✅ Playing sound: ${type}`);

        // Handle finite loops
        if (config.numberOfLoops > 0 && config.numberOfLoops !== -1) {
          let playCount = 0;
          const maxPlays = config.numberOfLoops;

          const checkPlayback = async () => {
            try {
              const state = await TrackPlayer.getState();

              if (state === State.Stopped && playCount < maxPlays) {
                playCount++;
                await TrackPlayer.seekTo(0);
                await TrackPlayer.play();

                if (playCount < maxPlays) {
                  refs.playbackLoopInterval = setTimeout(
                    checkPlayback,
                    config.duration,
                  );
                } else {
                  refs.currentlyPlayingTrack = null;
                }
              }
            } catch (error) {
              console.error('❌ Error in playback loop:', error);
              refs.currentlyPlayingTrack = null;
            }
          };

          refs.playbackLoopInterval = setTimeout(
            checkPlayback,
            config.duration,
          );
        }

        // Auto-stop for infinite loops after duration (for calls)
        if (config.numberOfLoops === -1 && config.duration > 0) {
          setTimeout(async () => {
            try {
              await TrackPlayer.stop();
              refs.currentlyPlayingTrack = null;
            } catch (error) {
              console.error('❌ Error auto-stopping sound:', error);
            }
          }, config.duration);
        }
      } catch (error) {
        console.error('❌ Error playing notification sound:', error);
      }
    },
    [refs],
  );

  // Stop notification sound
  const stopNotificationSound = useCallback(async (): Promise<void> => {
    try {
      if (refs.playbackLoopInterval) {
        clearTimeout(refs.playbackLoopInterval);
        refs.playbackLoopInterval = null;
      }

      await TrackPlayer.stop();
      refs.currentlyPlayingTrack = null;
      console.log('🔇 Notification sound stopped');
    } catch (error) {
      console.error('❌ Error stopping sound:', error);
    }
  }, [refs]);

  // Cleanup function
  const cleanupSound = useCallback((): void => {
    // console.log('🧹 Cleaning up sound manager...');

    if (refs.playbackLoopInterval) {
      clearTimeout(refs.playbackLoopInterval);
      refs.playbackLoopInterval = null;
    }

    refs.currentlyPlayingTrack = null;
  }, [refs]);

  return {
    playNotificationSound,
    stopNotificationSound,
    cleanupSound,
  };
};

const useNotificationManager = () => {
  const refs = useStableRefs();

  // Process notification queue
  const processNotificationQueue = useCallback(async (): Promise<void> => {
    if (refs.isProcessingQueue || refs.notificationQueue.length === 0) {
      return;
    }

    refs.isProcessingQueue = true;

    try {
      while (refs.notificationQueue.length > 0) {
        const notification = refs.notificationQueue.shift();
        if (!notification) {
          continue;
        }

        const isExpired =
          Date.now() - notification.timestamp > NOTIFICATION_TIMEOUT;
        if (isExpired) {
          console.log('⏰ Notification expired:', notification.title);
          continue;
        }

        console.log('📱 Processing notification:', notification.title);

        const notificationId = `${notification.type}_${notification.timestamp}`;
        const timeoutId = setTimeout(() => {
          refs.notificationTimeouts.delete(notificationId);
        }, NOTIFICATION_TIMEOUT);

        refs.notificationTimeouts.set(notificationId, timeoutId);

        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('❌ Error processing notification queue:', error);
    } finally {
      refs.isProcessingQueue = false;
    }
  }, [refs]);

  // Queue notification
  const queueNotification = useCallback(
    (data: NotificationData): void => {
      const currentTime = Date.now();

      if (currentTime - refs.lastNotificationTime < 1000) {
        console.log('🚫 Notification debounced');
        return;
      }

      refs.lastNotificationTime = currentTime;
      refs.notificationQueue.push({
        ...data,
        timestamp: currentTime,
      });

      processNotificationQueue();
    },
    [refs, processNotificationQueue],
  );

  // Clear notification timeouts
  const clearNotificationTimeouts = useCallback((): void => {
    refs.notificationTimeouts.forEach(timeoutId => {
      clearTimeout(timeoutId);
    });
    refs.notificationTimeouts.clear();
  }, [refs]);

  return {
    queueNotification,
    processNotificationQueue,
    clearNotificationTimeouts,
  };
};

// Main component
export default function SocketClient() {
  const navigation = useNavigation<NavigationProp<any>>();
  const {user} = useAuth();
  const refs = useStableRefs();
  const animationValues = useAnimationValues();
  const soundManager = useSoundManager();
  const notificationManager = useNotificationManager();

  // State management
  const [meetingID, setMeetingId] = useState<string | null>(null);
  const [modalCalledOK, setModalCalledOK] = useState(false);
  const [inAppNotificationVisible, setInAppNotificationVisible] =
    useState(false);
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [notificationData, setNotificationData] =
    useState<NotificationData | null>(null);
  const [backgroundNotifications, setBackgroundNotifications] = useState<
    NotificationData[]
  >([]);

  const [config] = useState<NotificationConfig>(DEFAULT_NOTIFICATION_CONFIG);

  // Helpers
  const helpers = useMemo(
    () => ({
      createNotificationData: (
        remoteMessage: FirebaseMessagingTypes.RemoteMessage,
      ): NotificationData => {
        const data = remoteMessage.data || {};
        return {
          title: remoteMessage.notification?.title ?? 'Notification',
          body: remoteMessage.notification?.body ?? '',
          meetingId: data.meetingId as string,
          type: (data.type as NotificationType) || NotificationType.DEFAULT,
          callerName: data.callerName as string,
          isVideoCall: data.isVideoCall === 'true',
          chatId: data.chatId as string,
          senderId: data.senderId as string,
          timestamp: Date.now(),
        };
      },

      shouldShowNotification: (type: NotificationType): boolean => {
        if (!config.inAppEnabled) {
          return false;
        }

        switch (type) {
          case NotificationType.CALL:
          case NotificationType.VIDEO_CALL:
            return true;
          case NotificationType.MESSAGE:
            return AppState.currentState === 'active';
          default:
            return true;
        }
      },

      getSoundType: (notificationType: NotificationType): SoundType => {
        switch (notificationType) {
          case NotificationType.CALL:
            return SoundType.CALL;
          case NotificationType.VIDEO_CALL:
            return SoundType.VIDEO_CALL;
          case NotificationType.MESSAGE:
            return SoundType.MESSAGE;
          default:
            return SoundType.DEFAULT;
        }
      },
    }),
    [config],
  );

  // Show notification
  const showNotification = useCallback(
    (data: NotificationData): void => {
      console.log('📱 Showing notification:', data);

      if (!helpers.shouldShowNotification(data.type)) {
        console.log('🚫 Notification blocked by configuration');
        return;
      }

      setNotificationData(data);

      if (
        data.type === NotificationType.CALL ||
        data.type === NotificationType.VIDEO_CALL
      ) {
        setCallModalVisible(true);
      } else if (data.type === NotificationType.MESSAGE) {
        setInAppNotificationVisible(true);
      }

      if (config.soundEnabled) {
        const soundType = helpers.getSoundType(data.type);
        soundManager.playNotificationSound(soundType);
      }
    },
    [config.soundEnabled, helpers, soundManager],
  );

  // Update meeting document
  const updateMeetingDocument = useCallback(
    async (meetingId: string): Promise<void> => {
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      const updatedUser: Member = {
        uid: user.uid || user._user?.uid || '',
        email: user.email || user._user?.email || '',
        displayName: user.displayName || user._user?.displayName || '',
        photoURL: user.photoURL || user._user?.photoURL || '',
        language: user.language,
        translateCode: user.translateCode,
        role: 'member',
      };

      const meetingRef = firestore().collection('meetings').doc(meetingId);

      await firestore().runTransaction(async transaction => {
        const doc = await transaction.get(meetingRef);

        if (!doc.exists) {
          updatedUser.role = 'admin';
          transaction.set(meetingRef, {
            createdAt: firestore.Timestamp.now(),
            createdBy: updatedUser.uid,
            members: [updatedUser],
            updatedAt: Date.now(),
          });
        } else {
          const currentMembers = doc.data()?.members || [];
          const existingMemberIndex = currentMembers.findIndex(
            (m: Member) => m.uid === updatedUser.uid,
          );

          let updatedMembers: Member[];
          if (existingMemberIndex >= 0) {
            updatedMembers = [...currentMembers];
            updatedMembers[existingMemberIndex] = updatedUser;
          } else {
            updatedMembers = [...currentMembers, updatedUser];
          }

          transaction.update(meetingRef, {
            members: updatedMembers,
            updatedAt: Date.now(),
          });
        }
      });

      console.log('✅ Meeting document updated');
    },
    [user],
  );

  // Event handlers
  const handleInAppNotificationPress = useCallback((): void => {
    setInAppNotificationVisible(false);
    soundManager.stopNotificationSound();

    if (notificationData?.chatId) {
      navigation.navigate('Chat', {
        chatId: notificationData.chatId,
      });
    }
  }, [notificationData, navigation, soundManager]);

  const handleInAppNotificationDismiss = useCallback((): void => {
    setInAppNotificationVisible(false);
    soundManager.stopNotificationSound();
  }, [soundManager]);

  const onCallModalAccept = useCallback(async (): Promise<void> => {
    setCallModalVisible(false);
    soundManager.stopNotificationSound();

    if (!notificationData?.meetingId) {
      console.warn('⚠️ No meeting ID provided');
      return;
    }

    try {
      // const retryableUpdate = createRetryableFunction(
      //   () => updateMeetingDocument(notificationData.meetingId!),
      //   3,
      //   1000,
      // );

      // await retryableUpdate();
      setModalCalledOK(true);
      setMeetingId(notificationData.meetingId);
    } catch (error) {
      console.error('❌ Error accepting call:', error);
    }
  }, [notificationData, soundManager]);

  const onCallModalDecline = useCallback((): void => {
    setCallModalVisible(false);
    soundManager.stopNotificationSound();
  }, [soundManager]);

  const handleBackgroundNotificationOpen = useCallback(
    (remoteMessage: FirebaseMessagingTypes.RemoteMessage): void => {
      const meetingId = remoteMessage.data?.meetingId as string;
      const chatId = remoteMessage.data?.chatId as string;

      if (meetingId) {
        setModalCalledOK(true);
        setMeetingId(meetingId);
      } else if (chatId) {
        navigation.navigate('Chat', {chatId});
      }
    },
    [navigation],
  );

  // Effects
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      console.log('📱 App state changed to:', nextAppState);

      if (nextAppState === 'background') {
        soundManager.stopNotificationSound();
      } else if (nextAppState === 'active') {
        // Process any queued background notifications
        notificationManager.processNotificationQueue();

        // Check for any background notifications that need to be displayed
        checkBackgroundNotifications();
      }
    };

    refs.appStateSubscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );

    return () => {
      refs.appStateSubscription?.remove();
    };
  }, [refs, soundManager, notificationManager]);

  // Trong SocketClient component
  const checkBackgroundNotifications = useCallback(async () => {
    try {
      console.log('🔍 Checking for background notifications...');
      const backgroundNotifications = await getBackgroundNotifications();

      if (backgroundNotifications.length > 0) {
        console.log(
          `📱 Found ${backgroundNotifications.length} background notifications`,
        );

        // Process each background notification
        for (const bgNotification of backgroundNotifications) {
          if (!bgNotification.processed) {
            const notificationData = helpers.createNotificationData({
              notification: {
                title: bgNotification.title,
                body: bgNotification.body,
              },
              data: bgNotification.data,
            });

            // Show notification in app
            showNotification(notificationData);
          }

          // Clear processed notifications
          await clearProcessedNotifications();
        }
      }
    } catch (error) {
      console.error('❌ Error checking background notifications:', error);
    }
  }, [helpers, showNotification]);
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      console.log('📱 Foreground notification:', remoteMessage);

      const notificationData = helpers.createNotificationData(remoteMessage);
      notificationManager.queueNotification(notificationData);
      showNotification(notificationData);
    });

    return unsubscribe;
  }, [helpers, notificationManager, showNotification]);

  useEffect(() => {
    const unsubscribeBackground = messaging().onNotificationOpenedApp(
      handleBackgroundNotificationOpen,
    );

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('📱 App launched from notification:', remoteMessage);
          handleBackgroundNotificationOpen(remoteMessage);
        }
      })
      .catch(error => {
        console.error('❌ Error getting initial notification:', error);
      });

    return unsubscribeBackground;
  }, [handleBackgroundNotificationOpen]);

  useEffect(() => {
    return () => {
      notificationManager.clearNotificationTimeouts();
      soundManager.cleanupSound();
    };
  }, [notificationManager, soundManager]);

  // Render
  if (modalCalledOK && meetingID) {
    return (
      <LanguageModal
        visible={modalCalledOK}
        chatId={meetingID}
        onDone={setModalCalledOK}
        setLoading={setModalCalledOK}
      />
    );
  }

  return (
    <>
      <InAppMessageNotification
        visible={inAppNotificationVisible}
        notificationData={notificationData}
        onPress={handleInAppNotificationPress}
        onDismiss={handleInAppNotificationDismiss}
        fadeAnim={animationValues.fadeAnim}
        slideAnim={animationValues.slideAnim}
      />

      <CallModalNotification
        visible={callModalVisible}
        notificationData={notificationData}
        onAccept={onCallModalAccept}
        onDecline={onCallModalDecline}
        fadeAnim={animationValues.fadeAnim}
        scaleAnim={animationValues.scaleAnim}
        pulseAnim={animationValues.pulseAnim}
      />
    </>
  );
}
