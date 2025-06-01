import React, {useRef, useState, useEffect, useCallback} from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  PermissionsAndroid,
  Platform,
  TouchableOpacity,
  StatusBar,
  FlatList,
  Alert,
  ScrollView,
  BackHandler,
} from 'react-native';
import AudioRecord from 'react-native-live-audio-stream';
import {
  AudioConfig,
  AudioInputStream,
  SpeechTranslationConfig,
  TranslationRecognizer,
} from 'microsoft-cognitiveservices-speech-sdk';
import * as sdk from 'microsoft-cognitiveservices-speech-sdk';

import {speakTranslation} from '../api/SpeakText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useNavigation} from '@react-navigation/native';
import {useSocket} from '../contexts/SocketContext';
import {useAuth} from '../contexts/AuthContext';
import firestore from '@react-native-firebase/firestore';
import {translateTextAzure} from '../api/TranslateAPI';
import Sound from 'react-native-sound';

const VoiceCallScreen = ({route}) => {
  const navigation = useNavigation();
  const {meetingId} = route.params;
  const {user} = useAuth();
  const {isConnected, emit, on, off} = useSocket();

  const key =
    '1qepnQJBmBjwMzXHkIzvzbLOkpL9Kb8TfRAavmA8Z9VlanYj8WegJQQJ99BCACYeBjFXJ3w3AAAYACOG6bxW';
  const keySTT =
    'CM9T6m7rgYNegLOVQyQllWwGbl6yrLmftrYyQDYJoKD0DlWMzVF7JQQJ99BEACYeBjFXJ3w3AAAbACOGF9m3';
  const region = 'eastus';

  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [participants, setParticipants] = useState([]);

  const recognizerRef = useRef(null);
  const initializedRef = useRef(false);
  const audioQueue = useRef([]);
  const isPlayingRef = useRef(false);

  const channels = 1;
  const bitsPerChannel = 16;
  const sampleRate = 16000;

  // Setup socket event listeners
  useEffect(() => {
    const handleReceiveTranslation = async ({text, lang, isFinal}) => {
      console.log('VoiceCall: Received translation:', text, lang, isFinal);
      setText(text);

      if (
        isFinal &&
        text.trim() !== '.' &&
        text.trim().toLowerCase() !== 'comma.'
      ) {
        const filePath = await speakTranslation(text, key, region, lang);
        if (filePath) {
          audioQueue.current.push(filePath);
          playNextAudio();
        }
      }
    };

    const handleUserJoined = data => {
      console.log('VoiceCall: User joined:', data);
    };

    const handleUserLeft = data => {
      console.log('VoiceCall: User left:', data);
    };

    const handleCallEnded = data => {
      console.log('VoiceCall: Call ended:', data);
      Alert.alert(
        'Call Ended',
        'The call has been ended by another participant.',
        [
          {
            text: 'OK',
            onPress: handleExitScreen,
          },
        ],
      );
    };

    // Add socket listeners
    on('receive_translation', handleReceiveTranslation);
    on('user_joined', handleUserJoined);
    on('user_left', handleUserLeft);
    on('call_ended', handleCallEnded);

    return () => {
      // Remove listeners on cleanup
      off('receive_translation', handleReceiveTranslation);
      off('user_joined', handleUserJoined);
      off('user_left', handleUserLeft);
      off('call_ended', handleCallEnded);
    };
  }, [on, off]);

  // Fetch participants from Firestore
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('meetings')
      .doc(meetingId)
      .onSnapshot(
        async doc => {
          if (doc.exists) {
            console.log('VoiceCall: Meeting data updated for:', meetingId);
            const data = doc.data();
            const uids =
              data.members?.flatMap(m => (m.uid !== user.uid ? m.uid : [])) ||
              [];

            console.log('VoiceCall: Other participants UIDs:', uids);

            if (uids.length === 0) {
              setParticipants([]);
              return;
            }

            const batchSize = 10;
            const batches = [];

            for (let i = 0; i < uids.length; i += batchSize) {
              const batch = uids.slice(i, i + batchSize);
              const query = firestore()
                .collection('users')
                .where(firestore.FieldPath.documentId(), 'in', batch)
                .get();
              batches.push(query);
            }

            try {
              const snapshots = await Promise.all(batches);
              const users = snapshots.flatMap(snap =>
                snap.docs.map(doc => ({
                  uid: doc.id,
                  ...doc.data(),
                })),
              );

              setParticipants(users);
              console.log('VoiceCall: Participants updated:', users.length);
            } catch (error) {
              console.error('VoiceCall: Error fetching users:', error);
            }
          } else {
            console.warn('VoiceCall: Meeting document does not exist.');
            setParticipants([]);
          }
        },
        error => {
          console.error('VoiceCall: Firestore listener error:', error);
        },
      );

    return () => unsubscribe();
  }, [meetingId, user.uid]);

  // Audio queue management
  const playNextAudio = useCallback(async () => {
    if (isPlayingRef.current || audioQueue.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;
    const path = audioQueue.current.shift();

    if (!path) {
      isPlayingRef.current = false;
      return;
    }

    const sound = new Sound(path, '', error => {
      if (error) {
        console.error('VoiceCall: Sound load error:', error);
        isPlayingRef.current = false;
        playNextAudio();
        return;
      }

      sound.play(success => {
        sound.release();
        isPlayingRef.current = false;
        playNextAudio();
      });
    });
  }, []);

  // Permission check
  const checkPermissions = async () => {
    if (Platform.OS === 'android') {
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      return Object.values(grants).every(
        g => g === PermissionsAndroid.RESULTS.GRANTED,
      );
    }
    return true;
  };

  // Initialize audio recognition
  const initializeAudio = async () => {
    if (!(await checkPermissions()) || initializedRef.current) {
      return;
    }

    console.log('VoiceCall: Initializing audio recognition');
    setIsListening(true);

    const pushStream = AudioInputStream.createPushStream();
    AudioRecord.init({sampleRate, channels, bitsPerChannel, audioSource: 7});
    AudioRecord.on('data', data =>
      pushStream.write(Buffer.from(data, 'base64')),
    );
    AudioRecord.start();

    const config = SpeechTranslationConfig.fromSubscription(key, region);
    config.speechRecognitionLanguage = user.language;
    config.outputFormat = sdk.OutputFormat.Detailed;

    // Add target languages for all participants
    (participants || [])
      .filter(m => m.uid !== user.uid)
      .forEach(m => {
        if (m.translateCode) {
          config.addTargetLanguage(m.translateCode);
        }
      });

    if (!config.targetLanguages || config.targetLanguages.length === 0) {
      config.addTargetLanguage('en');
    }

    const recognizer = new TranslationRecognizer(
      config,
      AudioConfig.fromStreamInput(pushStream),
    );

    recognizerRef.current = recognizer;

    recognizer.recognizing = async (s, e) => {
      const current = e.result.text;
      setText(current);
    };

    recognizer.recognized = (s, e) => {
      console.log('VoiceCall: Speech recognized, sending translations');
      participants
        .filter(m => m.uid !== user.uid)
        .forEach(m => {
          const translated = e.result.translations.get(m.translateCode);
          if (translated && isConnected) {
            emit('send_translation', {
              fromUserId: user.uid,
              toUserId: m.uid,
              text: translated,
              lang: m.translateCode,
              isFinal: true,
            });
            console.log(
              'VoiceCall: Sent translation to',
              m.uid,
              ':',
              translated,
            );
          }
        });
    };

    recognizer.startContinuousRecognitionAsync();
    initializedRef.current = true;
  };

  // Stop audio recognition
  const stopAudio = useCallback(() => {
    console.log('VoiceCall: Stopping audio recognition');
    setIsListening(false);
    AudioRecord.stop();

    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync();
      recognizerRef.current.close();
      recognizerRef.current = null;
      initializedRef.current = false;
    }
  }, []);

  // Remove member from meeting
  const removeMemberFromMeeting = useCallback(async (meetingId, userId) => {
    try {
      console.log('VoiceCall: Removing member from meeting:', userId);
      const meetingRef = firestore().collection('meetings').doc(meetingId);
      const meetingDoc = await meetingRef.get();

      if (!meetingDoc.exists) {
        console.warn('VoiceCall: Meeting not found:', meetingId);
        return;
      }

      const meetingData = meetingDoc.data();
      const members = meetingData?.members || [];
      const updatedMembers = members.filter(member => member.uid !== userId);

      await meetingRef.update({
        members: updatedMembers,
      });

      console.log('VoiceCall: Successfully removed user from meeting');
    } catch (error) {
      console.error('VoiceCall: Error removing member:', error);
    }
  }, []);

  // Handle exit screen
  const handleExitScreen = useCallback(() => {
    console.log('VoiceCall: Exiting screen');

    if (isListening) {
      stopAudio();
    }

    // Notify other users that call ended
    if (isConnected) {
      emit('end_call', {
        meetingId,
        userId: user.uid,
      });
    }

    // Remove member from meeting
    removeMemberFromMeeting(meetingId, user.uid);
    navigation.goBack();
  }, [
    isListening,
    stopAudio,
    isConnected,
    emit,
    meetingId,
    user.uid,
    removeMemberFromMeeting,
    navigation,
  ]);

  // Handle back press
  const handleBackPress = useCallback(() => {
    Alert.alert(
      'Exit Meeting',
      'Are you sure you want to exit the meeting?',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'OK', onPress: handleExitScreen},
      ],
      {cancelable: false},
    );
    return true;
  }, [handleExitScreen]);

  // Setup back handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      handleBackPress,
    );
    return () => backHandler.remove();
  }, [handleBackPress]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        stopAudio();
      }
    };
  }, [isListening, stopAudio]);

  // Render participant item
  const renderParticipantItem = ({item}) => (
    <View style={styles.participantItem}>
      <View style={styles.smallAvatar}>
        <Text style={styles.smallAvatarText}>
          {item.name?.charAt(0) || '?'}
        </Text>
      </View>
      <Text style={styles.participantItemName}>{item.name}</Text>
      <Icon
        name="mic"
        size={16}
        color="#6264A7"
        style={styles.participantMicIcon}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar backgroundColor="#252526" barStyle="light-content" />

      <View style={styles.headerContainer}>
        <Text style={styles.head}>Meeting in progress</Text>
        <View style={styles.timeContainer}>
          <Icon name="schedule" size={18} color="#ffffff" />
          <View
            style={[
              styles.connectionIndicator,
              {backgroundColor: isConnected ? '#10B981' : '#EF4444'},
            ]}
          />
          <Text style={styles.connectionStatus}>
            {isConnected ? 'Connected' : 'Connecting...'}
          </Text>
        </View>
      </View>

      <View style={styles.callArea}>
        <View style={styles.participantContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user.name?.charAt(0) ||
                user?.email?.charAt(0).toUpperCase() ||
                'You'}
            </Text>
          </View>
          <Text style={styles.participantName}>{user.name || 'You'}</Text>
          <View
            style={[
              styles.micIndicator,
              {backgroundColor: isListening ? '#6264A7' : '#555555'},
            ]}>
            <Icon
              name={isListening ? 'mic' : 'mic-off'}
              size={16}
              color="#ffffff"
            />
          </View>
        </View>

        <ScrollView style={styles.translationContainer}>
          <Text style={styles.translationLabel}>Live Transcription</Text>
          <Text style={styles.translationText}>
            {text || 'No speech detected'}
          </Text>
        </ScrollView>

        {/* Participants count */}
        <View style={styles.participantsInfo}>
          <Text style={styles.participantsCount}>
            Participants: {participants.length + 1}
          </Text>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          onPress={isListening ? stopAudio : initializeAudio}
          style={[
            styles.controlButton,
            isListening ? styles.micOnButton : styles.micOffButton,
          ]}>
          <Icon
            name={isListening ? 'mic' : 'mic-off'}
            size={24}
            color="#ffffff"
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleExitScreen}
          style={[styles.callButton, styles.endCallButton]}>
          <Icon name="call-end" size={28} color="#ffffff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: '#1F1F1F',
  },
  headerContainer: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#252526',
  },
  head: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: 8,
    marginRight: 6,
  },
  connectionStatus: {
    fontSize: 12,
    color: '#ffffff',
    fontWeight: '500',
  },
  callArea: {
    flex: 1,
    padding: 20,
  },
  participantContainer: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  avatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: '#464775',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: 'white',
    fontSize: 48,
    fontWeight: 'bold',
  },
  participantName: {
    color: '#ffffff',
    fontSize: 18,
    marginTop: 10,
    fontWeight: '500',
  },
  micIndicator: {
    borderRadius: 12,
    padding: 4,
    marginTop: 8,
  },
  translationContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  translationLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#C8C8C8',
  },
  translationText: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 24,
    minHeight: 50,
  },
  participantsInfo: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  participantsCount: {
    fontSize: 14,
    color: '#C8C8C8',
    fontWeight: '500',
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#464775',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  smallAvatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  participantItemName: {
    color: '#ffffff',
    fontSize: 16,
    flex: 1,
  },
  participantMicIcon: {
    marginLeft: 10,
  },
  controlsContainer: {
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#252526',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micOnButton: {
    backgroundColor: '#6264A7',
  },
  micOffButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  callButton: {
    backgroundColor: '#6264A7',
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    backgroundColor: '#E81123',
  },
});

export default VoiceCallScreen;
