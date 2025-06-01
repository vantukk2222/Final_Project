import {useEffect} from 'react';
import messaging from '@react-native-firebase/messaging';
import {useNavigation} from '@react-navigation/native';

function useNotificationNavigation() {
  const navigation = useNavigation();

  useEffect(() => {
    const unsubscribe = messaging().onNotificationOpenedApp(remoteMessage => {
      console.log(
        'Notification caused app to open from background state:',
        remoteMessage,
      );
      const meetingId = remoteMessage.data?.meetingId;
      if (meetingId) {
        navigation.navigate('VoiceCall', {meetingId});
      }
    });

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            'Notification caused app to open from quit state:',
            remoteMessage,
          );
          const meetingId = remoteMessage.data?.meetingId;
          if (meetingId) {
            navigation.navigate('VoiceCall', {meetingId});
          }
        }
      });

    return unsubscribe;
  }, [navigation]);
}
export default useNotificationNavigation;
