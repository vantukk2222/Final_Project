// ✅ VoiceCallScreen tích hợp socket.io thay cho Firestore (không lưu lịch sử)

import React, { useRef, useState, useEffect } from 'react';
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
import { AudioConfig, AudioInputStream, SpeechTranslationConfig, TranslationRecognizer } from 'microsoft-cognitiveservices-speech-sdk';
import { speakTranslation } from '../api/SpeakText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import io from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import firestore from '@react-native-firebase/firestore';

const VoiceCallScreen = ({ route }) => {
  const navigation = useNavigation();
  const { meetingId } = route.params;
  const {user} = useAuth();
  const key = '1qepnQJBmBjwMzXHkIzvzbLOkpL9Kb8TfRAavmA8Z9VlanYj8WegJQQJ99BCACYeBjFXJ3w3AAAYACOG6bxW';
  const region = 'eastus';
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognizerRef = useRef(null);
  const initializedRef = useRef(false);
  const socketRef = useRef(null);
  const audioQueue = useRef([]);
  const isPlayingRef = useRef(false);
  const [participants, setParticipants] = useState([]);

  const channels = 1;
  const bitsPerChannel = 16;
  const sampleRate = 16000;
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('meetings')
      .doc(meetingId)
      .onSnapshot(async (doc) => {
        if (doc.exists) {
          console.log("meetingId", meetingId);
          const data = doc.data();
          console.log('Meeting data:', data);
          const uids = data.members?.flatMap(m => m.uid !== user.uid ? m.uid : []) || [];

          console.log('uids', uids);

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
              }))
            );

            setParticipants(users);
          } catch (error) {
            console.error('Error fetching users:', error);
          }

        } else {
          console.warn('Meeting document does not exist.');
          setParticipants([]);
        }
      }, error => {
        console.error('Firestore listener error:', error);
      });

    return () => unsubscribe();
  }, [meetingId]);


  const playFromQueue = async () => {
    if (isPlayingRef.current || audioQueue.current.length === 0) return;

    isPlayingRef.current = true;
    const { text, lang } = audioQueue.current.shift();

    try {
      await speakTranslation(text, key, region, lang);
    } catch (error) {
      console.error("Error playing audio:", error);
    } finally {
      isPlayingRef.current = false;
      playFromQueue();
    }
  };

  useEffect(() => {
    const socket = io('http://192.168.1.15:3001');
    socketRef.current = socket;

    socket.on('connect', () => {
        socketRef.current.emit('register', {
          userId: user.uid,
          fcmToken: user.fcmToken,
          from: 'voiceStart',
        });
        console.log('Connected to socket server, registered user:', user.uid);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socket.on('receive_translation', ({ text, lang, isFinal }) => {
      setText(text);

      if (isFinal && !(text === "Comma." || text === ".")) {
        audioQueue.current.push({ text, lang });
        playFromQueue();
      }
    });

    return () => socket.disconnect();
  }, [user.uid]);

  const checkPermissions = async () => {
    if (Platform.OS === 'android') {
      const grants = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      return Object.values(grants).every(g => g === PermissionsAndroid.RESULTS.GRANTED);
    }
    return true;
  };

  const initializeAudio = async () => {
    if (!(await checkPermissions()) || initializedRef.current) return;
    setIsListening(true);
    const pushStream = AudioInputStream.createPushStream();
    AudioRecord.init({ sampleRate, channels, bitsPerChannel, audioSource: 7 });
    AudioRecord.on('data', data => pushStream.write(Buffer.from(data, 'base64')));
    AudioRecord.start();

    const config = SpeechTranslationConfig.fromSubscription(key, region);
    config.speechRecognitionLanguage = user.language;
    (participants || []).filter(m => m.uid !== user.uid).forEach(m => {
      if (m.translateCode) {
      config.addTargetLanguage(m.translateCode);
      }
    });
    if (!config.targetLanguages || config.targetLanguages.length === 0) {
      config.addTargetLanguage('en');
    }

    const recognizer = new TranslationRecognizer(config, AudioConfig.fromStreamInput(pushStream));

    recognizerRef.current = recognizer;

    recognizer.recognizing = (s, e) => {
      console.log('Recognizing:', e.result.text);
      setText(e.result.text);
    };

    recognizer.recognized = (s, e) => {
      participants.filter(m => m.uid !== user.uid).forEach(m => {
        const translated = e.result.translations.get(m.translateCode);
        if (translated) {
          socketRef.current.emit('send_translation', {
            fromUserId: user.uid,
            toUserId: m.uid,
            text: translated,
            lang: m.translateCode,
            isFinal: true,
          });
        }
      });
    };

    recognizer.startContinuousRecognitionAsync();
    initializedRef.current = true;
  };

  const stopAudio = () => {
    setIsListening(false);
    AudioRecord.stop();
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync();
      recognizerRef.current.close();
      recognizerRef.current = null;
      initializedRef.current = false;
    }
  };

  useEffect(() => () => { if (isListening) stopAudio(); }, [isListening]);
  const handleBackPress = () => {
    Alert.alert(
      'Exit Meeting',
      'Are you sure you want to exit the meeting?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'OK', onPress: handleExitScreen },
      ],
      { cancelable: false }
    );
    return true;
  };
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', handleBackPress);
    return () => backHandler.remove();
  }, []);
  const handleExitScreen = () => {
    if (isListening) stopAudio();
    // delete members from meetings of firestore
  

    navigation.goBack();
  };

  const renderParticipantItem = ({ item }) => (
    <View style={styles.participantItem}>
      <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{item.name?.charAt(0) || '?'}</Text></View>
      <Text style={styles.participantItemName}>{item.name}</Text>
      <Icon name="mic" size={16} color="#6264A7" style={styles.participantMicIcon} />
    </View>
  );

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar backgroundColor="#252526" barStyle="light-content" />
      <View style={styles.headerContainer}>
        <Text style={styles.head}>Meeting in progress</Text>
        <View style={styles.timeContainer}>
          <Icon name="schedule" size={18} color="#ffffff" />
          {/* <Text style={styles.callStatus}>{isListening ? 'Connected' : 'Disconnected'}</Text> */}
        </View>
      </View>

      <View style={styles.callArea}>
        <View style={styles.participantContainer}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user.name?.charAt(0)|| user?.email?.charAt(0).toUpperCase() || 'You'}</Text></View>
          <Text style={styles.participantName}>{user.name || 'You'}</Text>
          <View style={[styles.micIndicator, { backgroundColor: isListening ? '#6264A7' : '#555555' }]}>
            <Icon name={isListening ? 'mic' : 'mic-off'} size={16} color="#ffffff" />
          </View>
        </View>

        <ScrollView style={styles.translationContainer}>
          <Text style={styles.translationLabel}>Live Transcription</Text>
          <Text style={styles.translationText}>{text || 'No speech detected'}</Text>
        </ScrollView>

        {/* <View style={styles.participantsListContainer}>
          <Text style={styles.participantsHeader}>Participants ({participants.length + 1})</Text>
          <FlatList
            data={participants}
            renderItem={renderParticipantItem}
            keyExtractor={item => item.uid}
            ListHeaderComponent={() => (
              <View style={[styles.participantItem, styles.currentUserItem]}>
                <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{user.name?.charAt(0) || 'Y'}</Text></View>
                <Text style={styles.participantItemName}>{user.name || 'You'} (You)</Text>
                <Icon name={isListening ? 'mic' : 'mic-off'} size={16} color={isListening ? '#6264A7' : '#555'} style={styles.participantMicIcon} />
              </View>
            )}
          />
        </View> */}
      </View>

      <View style={styles.controlsContainer}>
        {/* <TouchableOpacity style={styles.controlButton}><Icon name="videocam-off" size={24} color="#ffffff" /></TouchableOpacity> */}
        <TouchableOpacity onPress={isListening ? stopAudio : initializeAudio} style={[styles.controlButton, isListening && styles.endCallButton]}>
          <Icon name={isListening ? 'mic' : 'mic-off'} size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleExitScreen} style={[styles.callButton, styles.endCallButton]}>
          <Icon name="call-end" size={28} color="#ffffff" />
        </TouchableOpacity>
        {/* <TouchableOpacity style={styles.controlButton}><Icon name="screen-share" size={24} color="#ffffff" /></TouchableOpacity> */}
        {/* <TouchableOpacity style={styles.controlButton}><Icon name="more-horiz" size={24} color="#ffffff" /></TouchableOpacity> */}
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
  callStatus: {
    fontSize: 14,
    color: '#ffffff',
    marginLeft: 5,
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
    // position: 'absolute',
    // bottom: 5,
    // right: 'auto',
    borderRadius: 12,
    padding: 4,
  },
  translationContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 15,
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
  },
  participantsListContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 10,
    flex: 1,
  },
  participantsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#C8C8C8',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  currentUserItem: {
    backgroundColor: 'rgba(98, 100, 167, 0.1)',
    borderRadius: 4,
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
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    backgroundColor: '#6264A7',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallButton: {
    backgroundColor: '#E81123',
  },
});

export default VoiceCallScreen;
