import { AudioConfig, AudioInputStream, SpeechTranslationConfig, TranslationRecognizer } from 'microsoft-cognitiveservices-speech-sdk';
import React, { useRef, useState, useEffect } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import {
  createAgoraRtcEngine,
  ChannelProfileType,
  ClientRoleType,
  IRtcEngine,
  IRtcEngineEventHandler,
} from 'react-native-agora';
import AudioRecord from 'react-native-live-audio-stream';

// Khai báo các biến cơ bản
const appId = '84c2d93c1a354a478cf78914b7dc506b';
const token = '';  // Token (nếu có)
const channelName = 'mot';
const localUid = 0;

const VoiceCallScreen = () => {
    
    const key = "1qepnQJBmBjwMzXHkIzvzbLOkpL9Kb8TfRAavmA8Z9VlanYj8WegJQQJ99BCACYeBjFXJ3w3AAAYACOG6bxW";
    const region = "eastus";
  const agoraEngineRef = useRef<IRtcEngine>();
  const [isJoined, setIsJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [message, setMessage] = useState('');
  const [isListening, setIsListening] = useState(false);
  const eventHandler = useRef<IRtcEngineEventHandler>();

  useEffect(() => {
    const init = async () => {
      await setupVoiceSDKEngine();
      setupEventHandler();
    };
    init();

    return () => {
      cleanupAgoraEngine();
    };
  }, []);

  // Thiết lập sự kiện cho Agora
  const setupEventHandler = () => {
    eventHandler.current = {
      onJoinChannelSuccess: () => {
        setMessage('Successfully joined channel: ' + channelName);
        setIsJoined(true);
        initializeAudio();  // Gọi hàm này khi gia nhập kênh
      },
      onUserJoined: (_connection, uid: number) => {
        setMessage('Remote user ' + uid + ' joined');
        setRemoteUid(uid);
      },
      onUserOffline: (_connection, uid: number) => {
        setMessage('Remote user ' + uid + ' left the channel');
        setRemoteUid(uid);
      },
    };
    agoraEngineRef.current?.registerEventHandler(eventHandler.current);
  };

  // Khởi tạo Agora SDK
  const setupVoiceSDKEngine = async () => {
    try {
      if (Platform.OS === 'android') {
        await getPermission();
      }
      agoraEngineRef.current = createAgoraRtcEngine();
      const agoraEngine = agoraEngineRef.current;
      await agoraEngine.initialize({ appId });
    } catch (e) {
      console.error(e);
    }
  };

  // Gia nhập kênh
  const join = async () => {
    if (isJoined) {
      return;
    }
    try {
      await agoraEngineRef.current?.joinChannel(token, channelName, localUid, {
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        autoSubscribeAudio: true,
      });
    } catch (e) {
      console.log(e);
    }
  };

  // Rời khỏi kênh
  const leave = () => {
    try {
      agoraEngineRef.current?.leaveChannel();
      setRemoteUid(0);
      setIsJoined(false);
      setMessage('Left the channel');
    } catch (e) {
      console.log(e);
    }
  };

  // Tắt/mở micro
  const toggleMute = () => {
    try {
      agoraEngineRef.current?.enableLocalAudio(!isMuted);
      setIsMuted(!isMuted);
      setMessage(isMuted ? 'Microphone unmuted' : 'Microphone muted');
    } catch (e) {
      console.log(e);
    }
  };

  // Dọn dẹp tài nguyên Agora khi không còn sử dụng
  const cleanupAgoraEngine = () => {
    return () => {
      agoraEngineRef.current?.unregisterEventHandler(eventHandler.current!);
      agoraEngineRef.current?.release();
    };
  };

  // Yêu cầu quyền đối với Android
  const getPermission = async () => {
    if (Platform.OS === 'android') {
      await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      ]);
    }
  };

  // Kiểm tra quyền và khởi tạo AudioRecord
  const checkPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const grants = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
        ]);
        console.log('Permissions granted:', grants);
      } catch (err) {
        console.warn(err);
      }
    }
  };

  // Khởi tạo Audio Input Stream và nhận diện giọng nói
  const initializeAudio = async () => {
    await checkPermissions();
    if (!isListening) {
      setIsListening(true);

      // Tạo một stream mới cho Audio Input
      const pushStream = AudioInputStream.createPushStream();
      const options = {
        sampleRate: 16000, // Tần số mẫu
        channels: 1,       // Số kênh
        bitsPerChannel: 16,
        audioSource: 6,
      };

      AudioRecord.init(options);
      // Lắng nghe dữ liệu từ microphone và ghi vào stream
      AudioRecord.on('data', (data) => {
        const pcmData = Buffer.from(data, 'base64');
        pushStream.write(pcmData);
      });

      AudioRecord.start();

      const speechTranslationConfig = SpeechTranslationConfig.fromSubscription(
        key, region
      );
      speechTranslationConfig.speechRecognitionLanguage = 'vi-VN'; // Ngôn ngữ nhận diện giọng nói
      speechTranslationConfig.addTargetLanguage('en'); // Ngôn ngữ dịch (Ví dụ: Spanish)

      const audioConfig = AudioConfig.fromStreamInput(pushStream);
      const recognizer = new TranslationRecognizer(
        speechTranslationConfig,
        audioConfig
      );

      // Cấu hình các sự kiện nhận diện giọng nói
      recognizer.sessionStarted = (s, e) => {
        console.log('sessionStarted');
      };

      recognizer.sessionStopped = (s, e) => {
        console.log('sessionStopped');
      };

      recognizer.recognizing = (s, e) => {
        console.log('Recognizing:', e.result.translations.get('en'));
      };

      recognizer.recognized = (s, e) => {
        // console.log('Recognized:', e.result.text);
        console.log('Recognized:', e.result.translations.get('en'));

      };

      recognizer.startContinuousRecognitionAsync();
    }
  };

  // Dừng nhận diện âm thanh và dừng ghi âm
  const stopAudio = async () => {
    setIsListening(false);
    AudioRecord.stop();
    if (recognizer) {
      recognizer.stopContinuousRecognitionAsync();
    }
  };

  return (
    <SafeAreaView style={styles.main}>
      <Text style={styles.head}>Agora Voice SDK Quickstart</Text>
      <View style={styles.btnContainer}>
        <Text onPress={join} style={styles.button}>Join Channel</Text>
        <Text onPress={leave} style={styles.button}>Leave Channel</Text>
      </View>
      {isJoined && (
        <Text onPress={toggleMute} style={[styles.button, isMuted && styles.mutedButton]}>
          {isMuted ? 'Unmute' : 'Mute'}
        </Text>
      )}
      <View style={styles.messageContainer}>
        <Text style={styles.info}>{message}</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 25,
    paddingVertical: 4,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#0055cc',
    margin: 5,
  },
  mutedButton: {
    backgroundColor: '#cc0000',
  },
  main: {
    flex: 1,
    alignItems: 'center',
  },
  btnContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  head: {
    fontSize: 20,
  },
  messageContainer: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  info: {
    backgroundColor: '#ffffe0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    color: '#0000ff',
    textAlign: 'center',
  },
});

export default VoiceCallScreen;
