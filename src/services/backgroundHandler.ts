import messaging from '@react-native-firebase/messaging';
import TrackPlayer, {RepeatMode} from 'react-native-track-player';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {setupPlayer} from './trackPlayerService';

const BACKGROUND_NOTIFICATIONS_KEY = '@background_notifications';

// Helper function để store background notifications
const storeBackgroundNotification = async notificationData => {
  try {
    const existingNotifications = await AsyncStorage.getItem(
      BACKGROUND_NOTIFICATIONS_KEY,
    );
    const notifications = existingNotifications
      ? JSON.parse(existingNotifications)
      : [];

    notifications.push({
      ...notificationData,
      timestamp: Date.now(),
      processed: false,
    });

    // Keep only last 10 notifications
    const recentNotifications = notifications.slice(-10);

    await AsyncStorage.setItem(
      BACKGROUND_NOTIFICATIONS_KEY,
      JSON.stringify(recentNotifications),
    );
    console.log('💾 Background notification stored');
  } catch (error) {
    console.error('❌ Error storing background notification:', error);
  }
};

messaging().setBackgroundMessageHandler(async remoteMessage => {
  console.log('📱 Background message received:', remoteMessage);

  try {
    // Store notification data for when app becomes active
    const notificationData = {
      title: remoteMessage.notification?.title ?? 'Notification',
      body: remoteMessage.notification?.body ?? '',
      data: remoteMessage.data || {},
      receivedAt: Date.now(),
    };

    await storeBackgroundNotification(notificationData);

    // Initialize TrackPlayer if needed
    try {
      await TrackPlayer.getState();
    } catch (error) {
      console.log('🔧 Initializing TrackPlayer for background...');
      await setupPlayer();
    }

    // Parse notification data
    const data = remoteMessage.data || {};
    const notificationType = data.type;

    // Play sound only if enabled
    if (data.soundEnabled !== 'false') {
      let soundTrack;
      let volume = 0.7;
      let repeatMode = RepeatMode.Off;
      let autoStopDelay = null;

      switch (notificationType) {
        case 'call':
        case 'video_call':
          soundTrack = {
            id: 'bg_call_notification',
            url: require('../assets/sounds/ringtone.mp3'),
            title: 'Incoming Call',
            artist: 'App',
            duration: 30,
          };
          volume = 0.8;
          repeatMode = RepeatMode.Track;
          autoStopDelay = 30000; // 30 seconds
          break;

        case 'message':
          soundTrack = {
            id: 'bg_message_notification',
            url: require('../assets/sounds/new_messenger.mp3'),
            title: 'New Message',
            artist: 'App',
            duration: 3,
          };
          volume = 0.6;
          break;

        default:
          soundTrack = {
            id: 'bg_default_notification',
            url: require('../assets/sounds/new_messenger.mp3'),
            title: 'Notification',
            artist: 'App',
            duration: 2,
          };
          volume = 0.5;
      }

      // Play background notification sound
      try {
        await TrackPlayer.reset();
        await TrackPlayer.add(soundTrack);
        await TrackPlayer.setVolume(volume);
        await TrackPlayer.setRepeatMode(repeatMode);
        await TrackPlayer.play();

        console.log(`🔊 Background ${notificationType} sound played`);

        // Auto-stop for calls
        if (autoStopDelay) {
          setTimeout(async () => {
            try {
              await TrackPlayer.stop();
              console.log('🔇 Background sound auto-stopped');
            } catch (e) {
              console.log('Background sound auto-stop error:', e);
            }
          }, autoStopDelay);
        }
      } catch (soundError) {
        console.error('❌ Background sound error:', soundError);
      }
    }

    console.log('✅ Background notification processed successfully');
  } catch (error) {
    console.error('❌ Background message handler error:', error);
  }
});

// Export function để get stored notifications
export const getBackgroundNotifications = async () => {
  try {
    const notifications = await AsyncStorage.getItem(
      BACKGROUND_NOTIFICATIONS_KEY,
    );
    return notifications ? JSON.parse(notifications) : [];
  } catch (error) {
    console.error('❌ Error getting background notifications:', error);
    return [];
  }
};

// Export function để clear processed notifications
export const clearProcessedNotifications = async () => {
  try {
    await AsyncStorage.removeItem(BACKGROUND_NOTIFICATIONS_KEY);
    console.log('🧹 Background notifications cleared');
  } catch (error) {
    console.error('❌ Error clearing background notifications:', error);
  }
};
