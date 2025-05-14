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
} from 'react-native';
import AudioRecord from 'react-native-live-audio-stream';
import { AudioConfig, AudioInputStream, SpeechTranslationConfig, TranslationRecognizer } from 'microsoft-cognitiveservices-speech-sdk';
import { speakTranslation } from '../api/SpeakText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import io from 'socket.io-client';

const VoiceCallScreen = ({ route }) => {
  const navigation = useNavigation();
  const { user, meetingId, participants } = route.params;
  const key = '1qepnQJBmBjwMzXHkIzvzbLOkpL9Kb8TfRAavmA8Z9VlanYj8WegJQQJ99BCACYeBjFXJ3w3AAAYACOG6bxW';
  const region = 'eastus';
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const recognizerRef = useRef(null);
  const initializedRef = useRef(false);
  const socketRef = useRef(null);
  const audioQueue = [];
  let isPlaying = false;

  const channels = 1;
  const bitsPerChannel = 16;
  const sampleRate = 16000;

  
  const playFromQueue = async () => {
    if (isPlaying || audioQueue.length === 0) return;

    isPlaying = true;
    const { text, lang } = audioQueue.shift();

    try {
      await speakTranslation(text, key, region, lang);
    } catch (error) {
      console.error("Error playing audio:", error);
    } finally {
      isPlaying = false;
      playFromQueue(); 
    }
  };
  // ✅ Connect to socket.io
  useEffect(() => {
    try {
      const socket = io('http://192.168.229.253:3001');
      socketRef.current = socket;

      socket.on('connect', () => {
        try {
          socket.emit('register', user.uid);
          console.log('Connected to socket server, registered user:', user.uid);
        } catch (error) {
          console.error('Error registering user:', error);
        }
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });

      socket.on('receive_translation', async ({ text, lang, isFinal }) => {
        try {
          console.log('Received translation:', text, lang, isFinal);
          setText(text);
          
          const date = new Date();
          const time = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}.${date.getMilliseconds()}`;
          console.log("time h-m-s-ms:", time);
          
          if (isFinal) {
            if (!(text =="Comma." || text == "."))
            {
              // await speakTranslation(text, key, region, lang);
              audioQueue.push({ text, lang }); // thêm vào queue
              console.log("audioQueue", audioQueue);
              playFromQueue(); // chạy hàm phát âm thanh


            }
          }
          
          const endDate = new Date();
          const endTime = `${endDate.getHours()}:${endDate.getMinutes()}:${endDate.getSeconds()}.${endDate.getMilliseconds()}`;
          console.log("end time h-m-s-ms:", endTime);
        } catch (error) {
          console.error('Error handling translation:', error);
        }
      });

      return () => {
        try {
          socket.disconnect();
        } catch (error) {
          console.error('Error disconnecting socket:', error);
        }
      };
    } catch (error) {
      console.error('Error initializing socket connection:', error);
    }
  }, []);

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
    const hasPermission = await checkPermissions();
    if (!hasPermission || initializedRef.current) return;

    setIsListening(true);
    const pushStream = AudioInputStream.createPushStream();
    AudioRecord.init({ sampleRate, channels, bitsPerChannel, audioSource: 7 });
    AudioRecord.on('data', (data) => {
      const pcmData = Buffer.from(data, 'base64');
      pushStream.write(pcmData);
    });
    AudioRecord.start();

    const config = SpeechTranslationConfig.fromSubscription(key, region);
    config.speechRecognitionLanguage = user.language;
    const filteredParticipants = participants.filter(m => m.uid !== user.uid);
    console.log("userid ", user.uid);
    console.log("filteredParticipants", filteredParticipants);
    filteredParticipants.forEach(m => config.addTargetLanguage(m.translateCode));

    const audioConfig = AudioConfig.fromStreamInput(pushStream);
    const recognizer = new TranslationRecognizer(config, audioConfig);
    recognizerRef.current = recognizer;

    recognizer.recognizing = (s, e) => {
      const text = e.result.text;
      setText(text); // Hiển thị tạm
    
      // Gửi realtime nội dung chưa hoàn tất
      filteredParticipants.forEach((m) => {
        const translated = e.result.translations.get(m.translateCode);
        if (translated) {

          socketRef.current?.emit('send_translation', {
            fromUserId: user.uid,
            toUserId: m.uid,
            text: translated,
            lang: m.translateCode,
            isFinal: false, // ❌ KHÔNG phát
          });
          console.log("Emit to", m.uid, translated, "isFinal:", false); // hoặc false

        }
      });
    };

    recognizer.recognized = async (s, e) => {
      const text = e.result.text;
      setText(text); // Ghi nhận đoạn đã hoàn tất
    
      for (const m of  filteredParticipants) {
        const translated = e.result.translations.get(m.translateCode);
        if (translated) {
          socketRef.current?.emit('send_translation', {
            fromUserId: user.uid,
            toUserId: m.uid,
            text: translated,
            lang: m.translateCode,
            isFinal: true, // ✅ Phát âm thanh
          });
          console.log("Emit to", m.uid, translated, "isFinal:", true); // hoặc false

        }
      }
    };
    recognizer.canceled = (s, e) => {
      console.warn(`CANCELED: Reason=${e.reason}, Error=${e.errorDetails}`);
      Alert.alert('Error', `CANCELED: Reason=${e.reason}, Error=${e.errorDetails}`);
      stopAudio();
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

  const handleExitScreen = () => {
    if (isListening) stopAudio();
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
          <Text style={styles.callStatus}>{isListening ? 'Connected' : 'Disconnected'}</Text>
        </View>
      </View>

      <View style={styles.callArea}>
        <View style={styles.participantContainer}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user.name?.charAt(0) || 'You'}</Text></View>
          <Text style={styles.participantName}>{user.name || 'You'}</Text>
          <View style={[styles.micIndicator, { backgroundColor: isListening ? '#6264A7' : '#555555' }]}>
            <Icon name={isListening ? 'mic' : 'mic-off'} size={16} color="#ffffff" />
          </View>
        </View>

        <View style={styles.translationContainer}>
          <Text style={styles.translationLabel}>Live Transcription</Text>
          <Text style={styles.translationText}>{text || 'No speech detected'}</Text>
        </View>

        <View style={styles.participantsListContainer}>
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
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton}><Icon name="videocam-off" size={24} color="#ffffff" /></TouchableOpacity>
        <TouchableOpacity onPress={isListening ? stopAudio : initializeAudio} style={[styles.controlButton, isListening && styles.endCallButton]}>
          <Icon name={isListening ? 'mic' : 'mic-off'} size={24} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={handleExitScreen} style={[styles.callButton, styles.endCallButton]}>
          <Icon name="call-end" size={28} color="#ffffff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}><Icon name="screen-share" size={24} color="#ffffff" /></TouchableOpacity>
        <TouchableOpacity style={styles.controlButton}><Icon name="more-horiz" size={24} color="#ffffff" /></TouchableOpacity>
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
    position: 'absolute',
    bottom: 5,
    right: 'auto',
    borderRadius: 12,
    padding: 4,
  },
  translationContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 15,
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
