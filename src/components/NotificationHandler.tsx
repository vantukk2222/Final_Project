import React, { useEffect } from 'react';
import { Alert } from 'react-native';
import messaging from '@react-native-firebase/messaging';

export default function NotificationHandler() {
  useEffect(() => {
    // Yêu cầu quyền nhận thông báo (iOS)
    async function requestPermission() {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Notification permission granted:', authStatus);
      } else {
        console.log('Notification permission denied');
      }
    }

    requestPermission();

    // Xử lý khi app ở foreground
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
      Alert.alert(
        remoteMessage.notification?.title ?? 'Thông báo',
        remoteMessage.notification?.body ?? ''
      );
      console.log('Received FCM message in foreground:', remoteMessage);
    });

    // Xử lý khi app từ background mở lên do nhấn thông báo
    const unsubscribeOnNotificationOpened = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification caused app to open from background:', remoteMessage);
      // Bạn có thể xử lý điều hướng ở đây
    });

    // Xử lý khi app được mở từ trạng thái tắt hoàn toàn do nhấn thông báo
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('Notification caused app to open from quit:', remoteMessage);
          // Xử lý điều hướng hoặc thao tác bạn cần
        }
      });

    return () => {
      unsubscribeOnMessage();
      unsubscribeOnNotificationOpened();
    };
  }, []);

  return null;
}
