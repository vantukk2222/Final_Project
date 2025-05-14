import { AudioConfig, AudioInputStream, SpeechTranslationConfig, TranslationRecognizer } from 'microsoft-cognitiveservices-speech-sdk';
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
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import AudioRecord from 'react-native-live-audio-stream';
import { speakTranslation } from '../api/SpeakText';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';

const VoiceCallScreen = ({ route }) => {
  const navigation = useNavigation();
  const { user, meetingId } = route.params;
  const key = '1qepnQJBmBjwMzXHkIzvzbLOkpL9Kb8TfRAavmA8Z9VlanYj8WegJQQJ99BCACYeBjFXJ3w3AAAYACOG6bxW';
  const region = 'eastus';
  const [text, setText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [participants, setParticipants] = useState([]);
  const channels = 1;
  const bitsPerChannel = 16;
  const sampleRate = 16000;
  const recognizerRef = useRef(null);
  const initializedRef = useRef(false);

  // Fetch participants
  useEffect(() => {
    const fetchParticipants = async () => {
      const meetingDoc = await firestore().collection('meetings').doc(meetingId).get();
      if (meetingDoc.exists) {
        const members = meetingDoc.data()?.members || [];
        // Filter out current user
        const otherParticipants = members.filter(m => m.uid !== user.uid);
        setParticipants(otherParticipants);
      }
    };

    fetchParticipants();
    
    // Set up real-time listener for participants
    const unsubscribe = firestore()
      .collection('meetings')
      .doc(meetingId)
      .onSnapshot(doc => {
        if (doc.exists) {
          const members = doc.data()?.members || [];
          const otherParticipants = members.filter(m => m.uid !== user.uid);
          setParticipants(otherParticipants);
        }
      });
      
    return () => unsubscribe();
  }, [meetingId, user.uid]);

  const checkPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        ]);

        if (
          grants['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
          grants['android.permission.RECORD_AUDIO'] === PermissionsAndroid.RESULTS.GRANTED
        ) {
          console.log('Permissions granted');
        } else {
          console.log('Required permissions not granted');
          return;
        }
      } catch (err) {
        console.warn(err);
        return;
      }
    }
  };

  const initializeAudio = async () => {
    await checkPermissions();
    if (!initializedRef.current) {
      setIsListening(true);

      const pushStream = AudioInputStream.createPushStream();
      const options = { sampleRate, channels, bitsPerChannel, audioSource: 6 };

      AudioRecord.init(options);
      console.log('AudioRecord initialized with options:', options);
      AudioRecord.on('data', (data) => {
        const pcmData = Buffer.from(data, 'base64');
        pushStream.write(pcmData);
      });
      AudioRecord.start();

      const config = SpeechTranslationConfig.fromSubscription(key, region);
      config.speechRecognitionLanguage = user.language;

      const membersSnap = await firestore().collection('meetings').doc(meetingId).get();
      const members = membersSnap.data()?.members?.filter(m => m.uid !== user.uid) || [];
      console.log('members:', members);
      members.forEach(m => config.addTargetLanguage(m.translateCode));

      const audioConfig = AudioConfig.fromStreamInput(pushStream);
      const recognizer = new TranslationRecognizer(config, audioConfig);
      recognizerRef.current = recognizer;
      recognizer.recognizing = (s, e) => {
        const original = e.result.text;
        setText(original);
      }

      recognizer.recognized = async (s, e) => {
        const original = e.result.text;
        setText(original);
        for (const m of members) {
          const translated = e.result.translations.get(m.translateCode);
          if (translated) {
            console.log(`Translated to ${m.translateCode}:`, translated);
            await firestore()
              .collection('meetings')
              .doc(meetingId)
              .collection('messages')
              .add({
                from: user.uid,
                to: m.uid,
                text: translated,
                lang: m.translateCode,
                timestamp: firestore.FieldValue.serverTimestamp(),
              });
          }
        }
      };

      recognizer.startContinuousRecognitionAsync();
      initializedRef.current = true;
    }
  };

  const stopAudio = async () => {
    setIsListening(false);
    AudioRecord.stop();
    if (recognizerRef.current) {
      recognizerRef.current.stopContinuousRecognitionAsync();
      recognizerRef.current.close();
      recognizerRef.current = null;
      initializedRef.current = false;
    }
  };
  useEffect(() => {
    return () => {
      // Clean up when component unmounts
      if (isListening) {
        stopAudio();
      }
    };
  }, [isListening]);


  useEffect(() => {
    return () => {
      // Clean up when component unmounts
      if (isListening) {
        stopAudio();
      }
    };
  }, [isListening]);

  // Modify the navigation back function to ensure cleanup
  const handleExitScreen = () => {
    if (isListening) {
      stopAudio();
    }
    navigation.goBack();
  };
  
  useEffect(() => {
    const joinTime = Date.now();
    console.log("Join time:", joinTime);
  
    const unsubscribe = firestore()
      .collection('meetings')
      .doc(meetingId)
      .collection('messages')
      .where('to', '==', user.uid)
      .onSnapshot(snapshot => {
        snapshot.docChanges().forEach(async change => {
          if (change.type === 'added') {
            const { text, lang, timestamp } = change.doc.data();
            const ts = timestamp?.toDate?.().getTime?.() || 0;
            
            
  
            if (ts > joinTime && text && lang) {
              console.log("Message timestamp:", ts);
              console.log("Join time:", joinTime);
              console.log("Message text:", text);
              console.log("Message lang:", lang);
              const startTime = new Date();
              console.log("time start Speak:", `${startTime.getHours()}:${startTime.getMinutes()}:${startTime.getSeconds()}.${startTime.getMilliseconds()}`);
              await speakTranslation(text, key, region, lang);
              setText(text);

              const endTime = new Date();
              console.log("time start Speak:", `${endTime.getHours()}:${endTime.getMinutes()}:${endTime.getSeconds()}.${endTime.getMilliseconds()}`);


            }
          }
        });
      });
  
    return () => unsubscribe();
  }, [user.uid]);
  
  const renderParticipantItem = ({ item }) => (
    <View style={styles.participantItem}>
      <View style={styles.smallAvatar}>
        <Text style={styles.smallAvatarText}>{item.name?.charAt(0) || "?"}</Text>
      </View>
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
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name?.charAt(0) || "You"}</Text>
          </View>
          <Text style={styles.participantName}>{user.name || "You"}</Text>
          <View style={[styles.micIndicator, { backgroundColor: isListening ? '#6264A7' : '#555555' }]}>
            <Icon name={isListening ? "mic" : "mic-off"} size={16} color="#ffffff" />
          </View>
        </View>

        <View style={styles.translationContainer}>
          <Text style={styles.translationLabel}>Live Transcription</Text>
          <Text style={styles.translationText}>{text || 'No speech detected'}</Text>
        </View>
        
        {/* Participants list */}
        <View style={styles.participantsListContainer}>
          <Text style={styles.participantsHeader}>
            Participants ({participants.length + 1})
          </Text>
          <FlatList
            data={participants}
            renderItem={renderParticipantItem}
            keyExtractor={item => item.uid}
            ListHeaderComponent={() => (
              <View style={[styles.participantItem, styles.currentUserItem]}>
                <View style={styles.smallAvatar}>
                  <Text style={styles.smallAvatarText}>{user.name?.charAt(0) || "Y"}</Text>
                </View>
                <Text style={styles.participantItemName}>{user.name || "You"} (You)</Text>
                <Icon 
                  name={isListening ? "mic" : "mic-off"} 
                  size={16} 
                  color={isListening ? "#6264A7" : "#555555"} 
                  style={styles.participantMicIcon} 
                />
              </View>
            )}
          />
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity style={styles.controlButton}>
          <Icon name="videocam-off" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        {!isListening ? (
        <TouchableOpacity onPress={initializeAudio} style={styles.controlButton}>
          <Icon name={isListening ? "mic" : "mic-off"} size={24} color="#ffffff" />
        </TouchableOpacity>):
        <TouchableOpacity onPress={stopAudio} style={[styles.controlButton, styles.endCallButton]}>
          <Icon name={isListening ? "mic" : "mic-off"} size={24} color="#ffffff" />
        </TouchableOpacity>}

        <TouchableOpacity onPress={handleExitScreen} style={[styles.callButton, styles.endCallButton]}>
          <Icon name="call-end" size={28} color="#ffffff" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton}>
          <Icon name="screen-share" size={24} color="#ffffff" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.controlButton}>
          <Icon name="more-horiz" size={24} color="#ffffff" />
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
