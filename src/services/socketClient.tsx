import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  Modal,
  Text,
  TouchableOpacity,
  View,
  StyleSheet,
  Dimensions,
  Platform,
  PermissionsAndroid,
  Animated,
  Image,
  StatusBar,
} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import {useNavigation} from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';
import {useAuth} from '../contexts/AuthContext';
import {Member} from '../contains/type';
import Sound from 'react-native-sound';
import LanguageModal from '../components/LanSelect';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

const {width, height} = Dimensions.get('window');

// In-App Message Notification Component (như Messenger)
const InAppMessageNotification = ({
  visible,
  notificationData,
  onPress,
  onDismiss,
  fadeAnim,
  slideAnim,
}) => {
  const slideDownAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideDownAnim, {
          toValue: 0,
          tension: 80,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto dismiss after 4 seconds
      const timer = setTimeout(() => {
        onDismiss();
      }, 4000);

      return () => clearTimeout(timer);
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideDownAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible || !notificationData) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.inAppNotificationContainer,
        {
          opacity: fadeAnim,
          transform: [{translateY: slideDownAnim}],
        },
      ]}>
      <TouchableOpacity
        style={styles.inAppNotification}
        onPress={onPress}
        activeOpacity={0.9}>
        <LinearGradient
          colors={['#4AC6D0', '#3BB8C3']}
          style={styles.inAppNotificationGradient}>
          {/* Avatar */}
          <View style={styles.inAppAvatar}>
            <Icon name="message" size={24} color="#fff" />
          </View>

          {/* Content */}
          <View style={styles.inAppContent}>
            <Text style={styles.inAppTitle} numberOfLines={1}>
              {notificationData.title}
            </Text>
            <Text style={styles.inAppBody} numberOfLines={2}>
              {notificationData.body}
            </Text>
          </View>

          {/* Close button */}
          <TouchableOpacity
            style={styles.inAppCloseButton}
            onPress={onDismiss}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon name="close" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};
// Call Modal Notification Component - Travel Themed Redesign
const CallModalNotification = ({
  visible,
  notificationData,
  onAccept,
  onDecline,
  fadeAnim,
  scaleAnim,
  pulseAnim,
}) => {
  const isCallNotification =
    notificationData?.type === 'call' ||
    notificationData?.type === 'video_call';

  // Additional animations for travel feel
  const pulseRing1 = useRef(new Animated.Value(1)).current;
  const pulseRing2 = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible && isCallNotification) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 120,
          friction: 10,
          useNativeDriver: true,
        }),
      ]).start();

      // Travel-themed pulsing waves
      const createWaveAnimation = (animValue, delay = 0) => {
        return Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(animValue, {
              toValue: 1.4,
              duration: 2000,
              useNativeDriver: true,
            }),
            Animated.timing(animValue, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
        );
      };

      // Gentle floating animation
      const floatAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(floatAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ]),
      );

      Animated.parallel([
        createWaveAnimation(pulseAnim),
        createWaveAnimation(pulseRing1, 500),
        createWaveAnimation(pulseRing2, 1000),
        floatAnimation,
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, isCallNotification]);

  if (!visible || !isCallNotification || !notificationData) {
    return null;
  }

  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDecline}
      statusBarTranslucent>
      <Animated.View
        style={[
          styles.modalBackground,
          {
            opacity: fadeAnim,
          },
        ]}>
        <Animated.View
          style={[
            styles.modalContainer,
            styles.callModalContainer,
            {
              transform: [{scale: scaleAnim}, {translateY}],
            },
          ]}>
          {/* Travel-themed background with gradient */}
          <LinearGradient
            colors={['#E0F7FA', '#F0FFFE', '#FFFFFF']}
            style={styles.modalHeaderBackground}
          />

          {/* Floating wave animations */}
          <View style={styles.waveContainer}>
            <Animated.View
              style={[
                styles.waveRing,
                styles.wave1,
                {
                  transform: [{scale: pulseRing2}],
                  opacity: pulseRing2.interpolate({
                    inputRange: [1, 1.4],
                    outputRange: [0.3, 0],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.waveRing,
                styles.wave2,
                {
                  transform: [{scale: pulseRing1}],
                  opacity: pulseRing1.interpolate({
                    inputRange: [1, 1.4],
                    outputRange: [0.4, 0],
                  }),
                },
              ]}
            />
            <Animated.View
              style={[
                styles.waveRing,
                styles.wave3,
                {
                  transform: [{scale: pulseAnim}],
                  opacity: pulseAnim.interpolate({
                    inputRange: [1, 1.4],
                    outputRange: [0.5, 0],
                  }),
                },
              ]}
            />
          </View>

          {/* Header with travel icon */}
          <View style={styles.modalHeader}>
            <View style={styles.headerIconContainer}>
              <Animated.View
                style={[
                  styles.iconContainer,
                  {
                    transform: [{scale: pulseAnim}],
                  },
                ]}>
                <LinearGradient
                  colors={['#4AC6D0', '#36B7C1', '#2AA8B3']}
                  style={styles.iconGradient}>
                  <Icon
                    name={notificationData?.isVideoCall ? 'videocam' : 'phone'}
                    size={36}
                    color="#FFFFFF"
                  />
                </LinearGradient>

                {/* Travel-themed status indicator */}
                <View style={styles.statusIndicator}>
                  <Icon name="flight" size={12} color="#FFFFFF" />
                </View>
              </Animated.View>
            </View>

            <View style={styles.headerTextContainer}>
              <Text style={styles.modalTitle}>
                {`${
                  notificationData?.isVideoCall ? 'Video' : 'Audio'
                } Connection`}
              </Text>
              <Text style={styles.modalSubtitle}>Ready to Connect</Text>
              {notificationData?.callerName && (
                <View style={styles.callerContainer}>
                  <Icon name="person" size={16} color="#4AC6D0" />
                  <Text style={styles.callerName}>
                    {notificationData.callerName}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Content with travel-friendly message */}
          <View style={styles.modalContent}>
            <View style={styles.messageContainer}>
              <Icon name="explore" size={24} color="#4AC6D0" />
              <Text style={styles.modalBody}>
                Someone wants to connect with you for a conversation
              </Text>
            </View>

            {/* Travel-themed action buttons */}
            <View style={styles.buttonContainer}>
              {/* Accept call button */}
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={onAccept}
                activeOpacity={0.9}>
                <LinearGradient
                  colors={['#4AC6D0', '#36B7C1']}
                  style={styles.acceptButtonGradient}>
                  <Icon name="check-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.acceptButtonText}>Join</Text>
                </LinearGradient>
              </TouchableOpacity>

              {/* Decline call button */}
              <TouchableOpacity
                style={styles.declineButton}
                onPress={onDecline}
                activeOpacity={0.9}>
                <View style={styles.declineButtonContainer}>
                  <Icon name="cancel" size={24} color="#9CA3AF" />
                  <Text style={styles.declineButtonText}>Maybe Later</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* Decorative travel elements */}
          <View style={styles.decorativeElements}>
            <Icon
              name="language"
              size={16}
              color="#4AC6D0"
              style={styles.decorIcon1}
            />
            <Icon
              name="public"
              size={14}
              color="#7DD3FC"
              style={styles.decorIcon2}
            />
            <Icon
              name="connect-without-contact"
              size={12}
              color="#A5F3FC"
              style={styles.decorIcon3}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default function SocketClient() {
  const navigation = useNavigation();
  const {user} = useAuth();
  const [meetingID, setMeetingId] = useState<string | null>(null);
  const [modalCalledOK, setModalCalledOK] = useState(false);

  const dingRef = useRef<Sound | null>(null);

  // State for different notification types
  const [inAppNotificationVisible, setInAppNotificationVisible] =
    useState(false);
  const [callModalVisible, setCallModalVisible] = useState(false);
  const [notificationData, setNotificationData] = useState<{
    title?: string;
    body?: string;
    meetingId?: string;
    type?: string;
    callerName?: string;
    isVideoCall?: boolean;
    chatId?: string;
    senderId?: string;
  } | null>(null);

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Request audio permissions for Android 12+
  const requestAudioPermissions = async () => {
    if (Platform.OS === 'android' && Platform.Version >= 31) {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Audio Permission',
            message:
              'This app needs access to audio to play notification sounds.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Permission request failed:', err);
        return false;
      }
    }
    return true;
  };

  // Initialize sound with better Android 12+ support
  const initializeSound = async () => {
    try {
      const hasPermission = await requestAudioPermissions();
      if (!hasPermission) {
        console.warn('Audio permission denied');
        return;
      }

      if (Platform.OS === 'android') {
        Sound.setCategory('Playback', false);
        Sound.setActive(true);
      } else {
        Sound.setCategory('Playback', true);
      }

      console.log('Loading notification sound...');

      const soundFile =
        Platform.OS === 'android'
          ? 'ringtone.mp3'
          : require('../assets/sounds/ringtone.mp3');

      const basePath =
        Platform.OS === 'android' ? Sound.MAIN_BUNDLE : undefined;

      dingRef.current = new Sound(soundFile, basePath, error => {
        if (error) {
          console.log('❌ Sound load error:', error);
          dingRef.current = new Sound(
            require('../assets/sounds/ringtone.mp3'),
            undefined,
            fallbackError => {
              if (fallbackError) {
                console.log('❌ Fallback sound load error:', fallbackError);
              } else {
                console.log('✅ Fallback sound loaded successfully');
                setupSound();
              }
            },
          );
          return;
        }

        console.log('✅ Sound loaded successfully');
        setupSound();
      });
    } catch (error) {
      console.error('Error initializing sound:', error);
    }
  };

  const setupSound = () => {
    if (dingRef.current) {
      dingRef.current.setVolume(0.8);
    }
  };

  const playNotificationSound = (type: string = 'default') => {
    if (!dingRef.current?.isLoaded()) {
      console.warn('Sound not loaded yet');
      return;
    }

    try {
      dingRef.current.stop(() => {
        dingRef.current?.setCurrentTime(0);

        if (type === 'call' || type === 'video_call') {
          dingRef.current?.setNumberOfLoops(-1); // Infinite loop for calls
        } else {
          dingRef.current?.setNumberOfLoops(2); // Short loop for messages
        }

        dingRef.current?.play(success => {
          if (success) {
            console.log('✅ Sound played successfully');
          } else {
            console.log('❌ Sound playback failed');
          }
        });
      });
    } catch (error) {
      console.error('Error playing sound:', error);
    }
  };

  const stopNotificationSound = () => {
    if (dingRef.current?.isLoaded()) {
      dingRef.current.stop(() => {
        dingRef.current?.setCurrentTime(0);
      });
    }
  };

  useEffect(() => {
    initializeSound();

    return () => {
      if (dingRef.current) {
        dingRef.current.stop(() => {
          dingRef.current?.release();
          dingRef.current = null;
        });
      }
    };
  }, []);

  // Handle different notification types
  const showNotification = (data: any) => {
    const notificationInfo = {
      title: data.title,
      body: data.body,
      meetingId: data.meetingId,
      type: data.type || 'default',
      callerName: data.callerName,
      isVideoCall: data.isVideoCall === 'true',
      chatId: data.chatId,
      senderId: data.senderId,
    };

    setNotificationData(notificationInfo);

    if (
      notificationInfo.type === 'call' ||
      notificationInfo.type === 'video_call'
    ) {
      // Show call modal for calls
      setCallModalVisible(true);
      playNotificationSound(notificationInfo.type);
    } else if (notificationInfo.type === 'message') {
      // Show in-app notification for messages
      setInAppNotificationVisible(true);
      playNotificationSound('message');
    }
  };

  // Handle foreground notifications
  useEffect(() => {
    const unsubscribe = messaging().onMessage(async remoteMessage => {
      const title = remoteMessage.notification?.title ?? 'Thông báo';
      const body = remoteMessage.notification?.body ?? '';
      const data = remoteMessage.data || {};

      console.log('📱 Notification received in foreground:', remoteMessage);

      showNotification({
        title,
        body,
        ...data,
      });
    });

    return unsubscribe;
  }, []);

  // Handle background/killed app notifications
  useEffect(() => {
    const unsubscribeBackground = messaging().onNotificationOpenedApp(
      remoteMessage => {
        const meetingId = remoteMessage.data?.meetingId;
        const chatId = remoteMessage.data?.chatId;

        if (meetingId) {
          setModalCalledOK(true);
          setMeetingId(meetingId);
        } else if (chatId) {
          // Navigate to chat screen
          navigation.navigate('Chat', {
            chatId: chatId,
            // Add other required params
          });
        }
      },
    );

    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          const meetingId = remoteMessage.data?.meetingId;
          const chatId = remoteMessage.data?.chatId;

          if (meetingId) {
            setModalCalledOK(true);
            setMeetingId(meetingId);
          } else if (chatId) {
            navigation.navigate('Chat', {
              chatId: chatId,
            });
          }
        }
      });

    return unsubscribeBackground;
  }, [navigation]);

  // Handle in-app message notification press
  const handleInAppNotificationPress = () => {
    setInAppNotificationVisible(false);
    stopNotificationSound();

    if (notificationData?.chatId) {
      navigation.navigate('Chat', {
        chatId: notificationData.chatId,
        // Add other required params
      });
    }
  };

  // Handle in-app notification dismiss
  const handleInAppNotificationDismiss = () => {
    setInAppNotificationVisible(false);
    stopNotificationSound();
  };

  // Handle call modal accept
  const onCallModalAccept = async () => {
    setCallModalVisible(false);
    stopNotificationSound();

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

      const meetingRef = firestore()
        .collection('meetings')
        .doc(notificationData.meetingId);

      try {
        const doc = await meetingRef.get();
        if (!doc.exists) {
          updatedUser.role = 'admin';
          await meetingRef.set(
            {
              createdAt: firestore.Timestamp.now(),
              createdBy: updatedUser.uid,
              members: [updatedUser],
            },
            {merge: true},
          );
        } else {
          const currentMembers = doc.data()?.members || [];
          const alreadyExists = currentMembers.find(
            (m: Member) => m.uid === updatedUser.uid,
          );

          let updatedMembers: Member[];
          if (alreadyExists) {
            updatedMembers = currentMembers.map((m: Member) =>
              m.uid === updatedUser.uid ? updatedUser : m,
            );
          } else {
            updatedMembers = [...currentMembers, updatedUser];
          }
          await meetingRef.update({members: updatedMembers});
        }

        await meetingRef.set(
          {
            updatedAt: Date.now(),
          },
          {merge: true},
        );
      } catch (err) {
        console.error('Error updating Firestore:', err);
      }

      setModalCalledOK(true);
      setMeetingId(notificationData.meetingId);
    }
  };

  // Handle call modal decline
  const onCallModalDecline = () => {
    setCallModalVisible(false);
    stopNotificationSound();
  };

  if (modalCalledOK) {
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
      {/* In-App Message Notification */}
      <InAppMessageNotification
        visible={inAppNotificationVisible}
        notificationData={notificationData}
        onPress={handleInAppNotificationPress}
        onDismiss={handleInAppNotificationDismiss}
        fadeAnim={fadeAnim}
        slideAnim={slideAnim}
      />

      {/* Call Modal Notification */}
      <CallModalNotification
        visible={callModalVisible}
        notificationData={notificationData}
        onAccept={onCallModalAccept}
        onDecline={onCallModalDecline}
        fadeAnim={fadeAnim}
        scaleAnim={scaleAnim}
        pulseAnim={pulseAnim}
      />
    </>
  );
}
const styles = StyleSheet.create({
  // In-App Notification Styles - Improved
  inAppNotificationContainer: {
    position: 'absolute',
    top: StatusBar.currentHeight || 44,
    left: 12,
    right: 12,
    zIndex: 9999,
    elevation: 25,
  },
  inAppNotification: {
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 15,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.25,
    shadowRadius: 12,
    // Glassmorphism effect
    backgroundColor: 'rgba(255,255,255,0.95)',
    backdropFilter: 'blur(20px)',
  },
  inAppNotificationGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 80,
    backgroundColor: 'transparent',
  },
  inAppAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4AC6D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  inAppContent: {
    flex: 1,
    marginRight: 12,
  },
  inAppTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  inAppBody: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
    fontWeight: '500',
  },
  inAppCloseButton: {
    padding: 1,
    borderRadius: 20,
    backgroundColor: 'red',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },

  // Call Modal Styles - Completely redesigned
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    elevation: 20,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  callModalContainer: {
    borderWidth: 0,
  },
  modalHeaderBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 180,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  waveContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
  },
  waveRing: {
    position: 'absolute',
    borderRadius: 60,
    borderWidth: 2,
  },
  wave1: {
    width: 120,
    height: 120,
    borderColor: 'rgba(74, 198, 208, 0.2)',
  },
  wave2: {
    width: 100,
    height: 100,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  wave3: {
    width: 80,
    height: 80,
    borderColor: 'rgba(74, 198, 208, 0.4)',
  },
  modalHeader: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 24,
    backgroundColor: 'transparent',
    position: 'relative',
    zIndex: 1,
  },
  headerIconContainer: {
    marginBottom: 20,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 40,
  },
  statusIndicator: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#10B981',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
  },
  headerTextContainer: {
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#4AC6D0',
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  callerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  callerName: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  modalContent: {
    paddingHorizontal: 32,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FFFE',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 32,
    gap: 12,
  },
  modalBody: {
    flex: 1,
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 22,
    fontWeight: '500',
  },
  buttonContainer: {
    gap: 16,
  },
  acceptButton: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  acceptButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    gap: 12,
  },
  acceptButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  declineButton: {
    borderRadius: 16,
  },
  declineButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 16,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  declineButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  decorativeElements: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  },
  decorIcon1: {
    position: 'absolute',
    top: 30,
    right: 30,
    opacity: 0.6,
  },
  decorIcon2: {
    position: 'absolute',
    top: 50,
    left: 30,
    opacity: 0.4,
  },
  decorIcon3: {
    position: 'absolute',
    bottom: 40,
    right: 40,
    opacity: 0.3,
  },
});
