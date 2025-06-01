import React, {useState, useEffect} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import {useNavigation} from '@react-navigation/native';

export default function NotificationModal() {
  const navigation = useNavigation();
  const [modalVisible, setModalVisible] = useState(false);
  const [notifTitle, setNotifTitle] = useState('');
  const [notifBody, setNotifBody] = useState('');
  const [meetingId, setMeetingId] = useState<string | null>(null);

  // Optional animation
  const opacity = React.useRef(new Animated.Value(0)).current;

  const showModal = (title: string, body: string, meetId: string | null) => {
    setNotifTitle(title);
    setNotifBody(body);
    setMeetingId(meetId);
    setModalVisible(true);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  };

  const hideModal = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false);
      setNotifTitle('');
      setNotifBody('');
      setMeetingId(null);
    });
  };

  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const title = remoteMessage.notification?.title ?? '';
      const body = remoteMessage.notification?.body ?? '';
      const meetId = remoteMessage.data?.meetingId ?? null;

      showModal(title, body, meetId);
    });

    return unsubscribe;
  }, []);

  const onConfirm = () => {
    hideModal();
    if (meetingId) {
      navigation.navigate('VoiceCall', {meetingId});
    }
  };

  return (
    <Modal
      transparent
      visible={modalVisible}
      animationType="none"
      onRequestClose={hideModal}>
      <Animated.View style={[styles.overlay, {opacity}]}>
        <View style={styles.container}>
          <Text style={styles.title}>{notifTitle}</Text>
          <Text style={styles.body}>{notifBody}</Text>
          <View style={styles.buttonsRow}>
            <TouchableOpacity style={styles.buttonCancel} onPress={hideModal}>
              <Text style={styles.buttonCancelText}>Hủy</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.buttonConfirm} onPress={onConfirm}>
              <Text style={styles.buttonConfirmText}>Tham gia</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#fff',
    marginHorizontal: 30,
    padding: 25,
    borderRadius: 12,
    width: '80%',
    elevation: 10, // shadow for Android
    shadowColor: '#000', // shadow for iOS
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 15,
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    color: '#444',
    marginBottom: 25,
    textAlign: 'center',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  buttonCancel: {
    flex: 1,
    marginRight: 10,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#ccc',
  },
  buttonCancelText: {
    textAlign: 'center',
    fontWeight: '600',
    color: '#555',
  },
  buttonConfirm: {
    flex: 1,
    marginLeft: 10,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  buttonConfirmText: {
    textAlign: 'center',
    fontWeight: '600',
    color: 'white',
  },
});
