import React, { useEffect, useState } from 'react';
import { Alert, Modal, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { Member } from '../contains/type';
import Sound from 'react-native-sound';

export default function SocketClient() {
  const navigation = useNavigation();
  const {user} = useAuth();
  
  Sound.setCategory('Playback');

  const dingSound = new Sound(require('../assets/sounds/ringtone.mp3'), Sound.MAIN_BUNDLE, (error) => {
    if (error) {
      console.log('Lỗi load âm thanh:', error);
    }
  });

  const [modalVisible, setModalVisible] = useState(false);
  const [notificationData, setNotificationData] = useState<{ title?: string; body?: string; meetingId?: string } | null>(null);

  // Xử lý khi app foreground nhận notification
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const title = remoteMessage.notification?.title ?? 'Thông báo';
      const body = remoteMessage.notification?.body ?? '';
      const meetingId = remoteMessage.data?.meetingId;
      const path = require('../assets/sounds/ringtone.mp3');
      console.log('Notification received in foreground:', remoteMessage);
      if (dingSound && dingSound.isLoaded()) {
        dingSound.stop(() => {
          dingSound.play();
        });
      }
      setNotificationData({ title, body, meetingId });
      setModalVisible(true);
    });

    return unsubscribe;
  }, []);

  // Xử lý khi app mở từ background hoặc killed do nhấn notification
  useEffect(() => {
    // Khi app từ background được mở bằng notification
    const unsubscribeBackground = messaging().onNotificationOpenedApp(remoteMessage => {
      const meetingId = remoteMessage.data?.meetingId;
      if (meetingId) {
        navigation.navigate('VoiceCall', { meetingId });
      }
    });

    // Khi app từ killed được mở bằng notification
    messaging().getInitialNotification().then(remoteMessage => {
      if (remoteMessage) {
        const meetingId = remoteMessage.data?.meetingId;
        if (meetingId) {
          navigation.navigate('VoiceCall', { meetingId });
        }
      }
    });

    return unsubscribeBackground;
  }, [navigation]);

  const onModalOk = async() => {
    setModalVisible(false);
    if (notificationData?.meetingId) {
      const updatedUser: Member = {
        uid: user.uid || user._user?.uid || '',
        email: user.email || user._user?.email || '',
        displayName: user.displayName || user._user?.displayName || '',
        photoURL: user.photoURL || user._user?.photoURL || '',
        language: user.language,
        translateCode: user.translateCode,
        role: 'member',
      };
      const meetingRef = firestore().collection('meetings').doc(notificationData.meetingId);
      let updatedMembers: Member[];

      try {
        const doc = await meetingRef.get();
        if (!doc.exists) {
          updatedUser.role = 'admin';
          await meetingRef.set({
            createdAt: firestore.Timestamp.now(),
            createdBy: updatedUser.uid,
            members: [updatedUser],
          });
          updatedMembers = [updatedUser];
        } else {
          const currentMembers = doc.data()?.members || [];
          const alreadyExists = currentMembers.find(
            (m: Member) => m.uid === updatedUser.uid,
          );

          if (alreadyExists) {
            updatedMembers = currentMembers.map((m: Member) =>
              m.uid === updatedUser.uid ? updatedUser : m,
            );
          } else {
            updatedMembers = [...currentMembers, updatedUser];
          }
          await meetingRef.update({members: updatedMembers});
        }

        if (user.uid) {

          await firestore().collection('meetings').doc(notificationData.meetingId).set({
            updatedAt: Date.now(),
          }, { merge: true });
        }
      } catch (err) {
        console.error('Lỗi khi cập nhật Firestore:', err);
      }

      navigation.navigate('VoiceCall', { meetingId: notificationData.meetingId });
    }
  };

  return (
    <>
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackground}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>{notificationData?.title}</Text>
            <Text style={styles.modalBody}>{notificationData?.body}</Text>
            <TouchableOpacity style={styles.button} onPress={onModalOk}>
              <Text style={styles.buttonText}>Tham gia ngay</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.button, styles.buttonCancel]} onPress={() => setModalVisible(false)}>
              <Text style={styles.buttonCancelText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    elevation: 5,
  },
  modalTitle: {
    fontWeight: 'bold',
    fontSize: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  modalBody: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 16,
  },
  buttonCancel: {
    backgroundColor: '#ddd',
  },
  buttonCancelText: {
    color: '#333',
  },
});
