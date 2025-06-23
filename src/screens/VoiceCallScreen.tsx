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
  Animated,
  Dimensions,
  Image,
  Modal,
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
import LinearGradient from 'react-native-linear-gradient';
import moment from 'moment';
import RNFS from 'react-native-fs';

const {width, height} = Dimensions.get('window');

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
  const [callDuration, setCallDuration] = useState(0);
  const [startTime] = useState(Date.now());
  const [showParticipantsModal, setShowParticipantsModal] = useState(false);

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const micWaveAnim = useRef(new Animated.Value(0)).current;
  const modalFadeAnim = useRef(new Animated.Value(0)).current;

  const processedTranslations = useRef(new Set());
  // ✅ Thêm refs để tránh stale closure
  const participantsRef = useRef(participants);
  const userRef = useRef(user);
  const emitRef = useRef(emit);

  // ✅ Update refs khi values change
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    emitRef.current = emit;
  }, [emit]);

  const playbackTimeoutRef = useRef(null);
  const recognizerRef = useRef(null);
  const initializedRef = useRef(false);
  const audioQueue = useRef([]);
  const isPlayingRef = useRef(false);
  const currentText = useRef('');
  const channels = 1;
  const bitsPerChannel = 16;
  const sampleRate = 16000;

  const wordBuffer = useRef('');
  const lastSentText = useRef('');
  const sentenceTimeoutRef = useRef(null);
  const SENTENCE_DELAY = 2000; // 2 giây
  const MIN_WORDS = 5; // Tối thiểu 5 từ
  const audioQueueRef = useRef([]); // Hàng đợi chứa các đường dẫn file âm thanh

  const processAudioQueue = useCallback(async () => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      return;
    }

    isPlayingRef.current = true;

    const path = audioQueueRef.current.shift();

    if (!path) {
      isPlayingRef.current = false;
      return;
    }

    console.log(`🔊 [Queue] Playing: ${path}`);

    const sound = new Sound(path, '', error => {
      if (error) {
        console.error('❌ [Queue] Failed to load sound:', error);
        isPlayingRef.current = false; // Mở khóa
        RNFS.unlink(path).catch(e =>
          console.error('Failed to delete temp file', e),
        );
        processAudioQueue();
        return;
      }

      sound.play(success => {
        if (!success) {
          console.error('❌ [Queue] Playback failed');
        }

        sound.release();
        RNFS.unlink(path).catch(e =>
          console.error('Failed to delete temp file', e),
        );
        isPlayingRef.current = false;

        processAudioQueue();
      });
    });
  }, []);

  // Call duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration(Date.now() - startTime);
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);
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
            const uids = data.members?.flatMap(m => m.uid) || [];

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
              console.log(
                'VoiceCall: Fetched participants:',
                users.map(u => u.name || u.email),
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

  // ✅ DI CHUYỂN CÁC HELPER FUNCTIONS RA NGOÀI
  const isCompleteSentence = useCallback(text => {
    const trimmed = text.trim();
    // Kiểm tra kết thúc bằng dấu câu hoặc có ít nhất 8 từ
    const endsWithPunctuation = /[.!?;:]$/.test(trimmed);
    const wordCount = trimmed.split(/\s+/).length;
    const hasMinLength = trimmed.length >= 30;

    return (
      (endsWithPunctuation && wordCount >= 3) ||
      (wordCount >= 8 && hasMinLength)
    );
  }, []);

  const sendTranslation = useCallback(
    (text, isFinal = false) => {
      if (!text || text.trim().length < 10) {
        return;
      }

      console.log(`${isFinal ? '🎯' : '📤'} Sending translation:`, text);

      const currentParticipants = participantsRef.current;
      const currentUser = userRef.current;
      const currentEmit = emitRef.current;

      currentParticipants
        .filter(m => m.uid !== currentUser.uid)
        .forEach(m => {
          try {
            const translated = recognizerRef.current?.lastTranslations?.get(
              m.translateCode,
            );
            if (translated && translated.trim()) {
              currentEmit('send_translation', {
                fromUserId: currentUser.uid,
                toUserId: m.uid,
                text: translated,
                lang: m.translateCode,
                isFinal,
                confidence: isFinal ? 'high' : 'medium',
              });
            }
          } catch (error) {
            console.error('Translation error:', error);
          }
        });
    },
    [], // ✅ Empty deps vì dùng refs
  );
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
  // Setup socket event listeners

  useEffect(() => {
    // ✅ Enhanced playTranslationAudio with better state management
    const handleReceiveTranslation = async ({
      text,
      lang,
      isFinal,
      confidence,
      fromUserId,
    }) => {
      console.log('VoiceCall: Received translation:', {
        text,
        lang,
        isFinal,
        confidence,
        fromUserId,
      });
      if ([',', '.', ':', ';', '!', '?'].includes(text.trim())) {
        return;
      }

      // ✅ Create unique key để tránh duplicate
      const translationKey = `${fromUserId}_${text}_${isFinal}_${Date.now()}`;

      // ✅ Check if already processed
      if (processedTranslations.current.has(translationKey)) {
        console.log('⚠️ Duplicate translation blocked:', text.substring(0, 30));
        return;
      }

      // ✅ Mark as processed
      processedTranslations.current.add(translationKey);

      // ✅ Cleanup old processed keys (keep only last 10)
      if (processedTranslations.current.size > 10) {
        const keysArray = Array.from(processedTranslations.current);
        const toDelete = keysArray.slice(0, keysArray.length - 10);
        toDelete.forEach(key => processedTranslations.current.delete(key));
      }

      // ✅ Check if audio is currently playing
      const isCurrentlyPlaying = window.AUDIO_PLAYING;

      if (isCurrentlyPlaying && !isFinal) {
        console.log('⚠️ Audio is playing, queuing intermediate translation');
        // Queue the translation but don't interrupt current audio
        setTimeout(() => {
          if (!window.AUDIO_PLAYING) {
            setText(text);
            currentText.current = text;
            playTranslationAudio(text, lang, translationKey);
          }
        }, 1000);
        return;
      }

      // ✅ Only update UI if not interrupting audio, or if it's final
      if (!isCurrentlyPlaying || isFinal) {
        setText(text);
        currentText.current = text;
      }

      // Clear previous timeout
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }

      if (isFinal) {
        // ✅ Final translation - wait for current audio to finish if playing
        if (isCurrentlyPlaying) {
          console.log(
            '🎯 Final translation - waiting for current audio to finish',
          );
          const waitForAudioFinish = () => {
            if (!window.AUDIO_PLAYING) {
              setText(text);
              currentText.current = text;
              playTranslationAudio(text, lang, translationKey);
            } else {
              setTimeout(waitForAudioFinish, 200);
            }
          };
          waitForAudioFinish();
        } else {
          console.log('🎯 Playing final translation immediately');
          await playTranslationAudio(text, lang, translationKey);
        }
      } else {
        // Intermediate translation - play sau delay if not currently playing
        const delay = confidence === 'high' ? 1500 : 2500;

        playbackTimeoutRef.current = setTimeout(async () => {
          // ✅ Double check if audio is still not playing
          if (
            !window.AUDIO_PLAYING &&
            currentText.current === text &&
            text.trim() !== '.' &&
            text.trim().toLowerCase() !== 'comma.'
          ) {
            console.log(
              `⏰ Playing intermediate translation (confidence: ${confidence})`,
            );
            await playTranslationAudio(text, lang, translationKey);
          } else {
            console.log(
              '⚠️ Skipping intermediate - audio is playing or text changed',
            );
          }
        }, delay);
      }
    };

    // ✅ Enhanced playTranslationAudio with better audio management
    const playTranslationAudio = async (text, lang, playbackId) => {
      // ✅ Add stricter audio lock check
      if (window.AUDIO_PLAYING) {
        console.log(
          '⚠️ Audio already playing, skipping:',
          text.substring(0, 30),
        );
        return;
      }

      try {
        window.AUDIO_PLAYING = true;
        console.log(
          `🔊 Starting audio playback (ID: ${playbackId.substring(0, 20)}...)`,
        );

        const result = await speakTranslation(text, key, region, lang);

        if (result === 'trackplayer_played' || result === 'temp_played') {
          console.log('✅ Audio played:', result);
        } else if (
          result &&
          typeof result === 'string' &&
          result.includes('/')
        ) {
          audioQueue.current.push(result);
          console.log('✅ Audio queued:', result);
          playNextAudio();
        }
      } catch (error) {
        console.error('❌ TTS error:', error);
      } finally {
        // ✅ Always release audio lock with proper delay
        setTimeout(() => {
          window.AUDIO_PLAYING = false;
          console.log('🔓 Audio lock released');
        }, 300); // Reduced delay for better responsiveness
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
    const handleReceiveTranslatedAudio = ({audio, language}) => {
      try {
        console.log('🔊 Received audio base64, processing...');

        // Convert base64 to temporary file path
        const tempFilePath = `${
          RNFS.CachesDirectoryPath
        }/temp_audio_${Date.now()}.wav`;

        // Write base64 audio to temporary file
        RNFS.writeFile(tempFilePath, audio, 'base64')
          .then(() => {
            console.log('✅ Audio file written to:', tempFilePath);

            // Create Sound object from file path
            const sound = new Sound(tempFilePath, '', error => {
              if (error) {
                console.error('❌ [Audio] Failed to load audio file:', error);
                // Clean up temp file on error
                RNFS.unlink(tempFilePath).catch(e =>
                  console.error('Failed to delete temp file:', e),
                );
                return;
              }

              // Play the audio
              sound.play(success => {
                if (success) {
                  console.log('✅ Audio played successfully');
                } else {
                  console.error('❌ Audio playback failed');
                }

                // Clean up
                sound.release();
                RNFS.unlink(tempFilePath).catch(e =>
                  console.error('Failed to delete temp file:', e),
                );
              });
            });
          })
          .catch(error => {
            console.error('❌ Failed to write audio file:', error);
          });
      } catch (error) {
        console.error('❌ Failed to process audio base64:', error);
      }
    };

    const handleReceiveTranslatingSubtitle = ({text, lang}) => {
      console.log('VoiceCall: Received translating subtitle:', {text, lang});
      // Hiển thị phụ đề lên UI
      setText(text);
    };
    const handleReceiveFinalSubtitle = ({text, lang}) => {
      console.log('VoiceCall: Received final subtitle:', {text, lang});
      // Hiển thị phụ đề lên UI
      setText(text);
    };

    // ✅ Add socket listeners
    on('receive_translation', handleReceiveTranslation);
    on('receive_translating_subtitle', handleReceiveTranslatingSubtitle);
    on('receive_final_subtitle', handleReceiveFinalSubtitle);
    on('user_joined', handleUserJoined);
    on('user_left', handleUserLeft);
    on('call_ended', handleCallEnded);
    on('receive_translated_audio', handleReceiveTranslatedAudio);

    return () => {
      // Cleanup
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
        playbackTimeoutRef.current = null;
      }

      // ✅ Release audio lock
      window.AUDIO_PLAYING = false;

      // ✅ Clear processed translations
      processedTranslations.current.clear();

      // Remove listeners on cleanup
      off('receive_translated_audio', handleReceiveTranslatedAudio);
      off('receive_translating_subtitle', handleReceiveTranslatingSubtitle);
      off('receive_final_subtitle', handleReceiveFinalSubtitle);
      off('receive_translation', handleReceiveTranslation);
      off('user_joined', handleUserJoined);
      off('user_left', handleUserLeft);
      off('call_ended', handleCallEnded);
    };
  }, [on, off]); //  Empty dependency array - chỉ setup một lần

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

  const initializeAudio = async () => {
    try {
      if (!(await checkPermissions()) || initializedRef.current) {
        return;
      }

      setIsListening(true);
      emit('start_speaking', {user: user, meetingId: meetingId});
      // Hàm kiểm tra câu hoàn chỉnh
      try {
        const pushStream = AudioInputStream.createPushStream();

        AudioRecord.init({
          sampleRate,
          channels,
          bitsPerChannel,
          audioSource: 7,
        });

        AudioRecord.on('data', data => {
          try {
            pushStream.write(Buffer.from(data, 'base64'));
            emit('send_audio_chunk', {
              meetingId: meetingId,
              audioChunk: Buffer.from(data, 'base64'),
            });
          } catch (audioError) {
            console.error('VoiceCall: Error writing audio data:', audioError);
          }
        });
        console.log('VoiceCall: AudioRecord initialized successfully');

        AudioRecord.start();

        // const config = SpeechTranslationConfig.fromSubscription(key, region);
        // config.speechRecognitionLanguage = user.language;

        // (participants || [])
        //   .filter(m => m.uid !== user.uid)
        //   .forEach(m => {
        //     if (m.translateCode) {
        //       try {
        //         config.addTargetLanguage(m.translateCode);
        //       } catch (langError) {
        //         console.error(
        //           'VoiceCall: Error adding target language:',
        //           langError,
        //         );
        //       }
        //     }
        //   });

        // if (!config.targetLanguages || config.targetLanguages.length === 0) {
        //   config.addTargetLanguage('en');
        // }

        // const recognizer = new TranslationRecognizer(
        //   config,
        //   AudioConfig.fromStreamInput(pushStream),
        // );

        // recognizerRef.current = recognizer;

        // // IMPROVED: Smart recognizing với sentence detection
        // recognizer.recognizing = (s, e) => {
        //   const currentText = e.result.text.trim();
        //   console.log('Recognizing:', currentText);
        //   setText(currentText);
        //   sendTranslation(currentText, false);

        //   // Lưu translations để sử dụng sau
        //   recognizerRef.current.lastTranslations = e.result.translations;

        //   // Clear timeout cũ
        //   if (sentenceTimeoutRef.current) {
        //     clearTimeout(sentenceTimeoutRef.current);
        //   }

        //   // Kiểm tra nếu có câu hoàn chỉnh
        //   if (
        //     isCompleteSentence(currentText) &&
        //     currentText !== lastSentText.current
        //   ) {
        //     console.log('✅ Complete sentence detected:', currentText);
        //     sendTranslation(currentText, false);
        //     lastSentText.current = currentText;
        //   } else {
        //     // Set timeout để gửi sau 2 giây nếu không có câu hoàn chỉnh
        //     wordBuffer.current = currentText;

        //     sentenceTimeoutRef.current = setTimeout(() => {
        //       const bufferedText = wordBuffer.current.trim();
        //       const words = bufferedText.split(/\s+/);

        //       // Chỉ gửi nếu đủ từ và khác với lần trước
        //       if (
        //         words.length >= MIN_WORDS &&
        //         bufferedText !== lastSentText.current &&
        //         bufferedText.length >= 20
        //       ) {
        //         console.log(
        //           '⏰ Timeout - sending buffered text:',
        //           bufferedText,
        //         );
        //         sendTranslation(bufferedText, true);
        //         lastSentText.current = bufferedText;
        //       }
        //     }, SENTENCE_DELAY);
        //   }
        // };

        // // IMPROVED: Recognized với cleanup
        // recognizer.recognized = (s, e) => {
        //   // Clear timeout
        //   if (sentenceTimeoutRef.current) {
        //     clearTimeout(sentenceTimeoutRef.current);
        //   }

        //   const finalText = e.result.text.trim();
        //   if ([',', '.', ':', ';', '!', '?'].includes(finalText.trim())) {
        //     return;
        //   }

        //   console.log('🎯 Final recognition:', finalText);

        //   if (finalText && finalText.length > 0) {
        //     try {
        //       console.log(
        //         'participants:',
        //         participants.map(m => m.uid),
        //       );

        //       participants
        //         .filter(m => m.uid !== user.uid)
        //         .forEach(m => {
        //           try {
        //             console.log('Translating for:', m.uid, m.translateCode);
        //             const translated = e.result.translations.get(
        //               m.translateCode,
        //             );
        //             console.log('translated:', translated);
        //             if (translated && translated.trim()) {
        //               emit('send_translation', {
        //                 fromUserId: user.uid,
        //                 toUserId: m.uid,
        //                 text: translated,
        //                 lang: m.translateCode,
        //                 isFinal: true,
        //                 confidence: 'high',
        //               });
        //             }
        //           } catch (translationError) {
        //             console.error('Final translation error:', translationError);
        //           }
        //         });
        //     } catch (recognizedError) {
        //       console.error(
        //         'Error in final recognizer callback:',
        //         recognizedError,
        //       );
        //     }
        //   }

        //   // Reset buffers
        //   wordBuffer.current = '';
        //   lastSentText.current = '';
        // };

        // recognizer.startContinuousRecognitionAsync();
        // initializedRef.current = true;
      } catch (setupError) {
        console.error(
          'VoiceCall: Error setting up audio recognition:',
          setupError,
        );
        setIsListening(false);
        Alert.alert(
          'Audio Error',
          'Failed to initialize speech recognition. Please try again.',
        );
      }
    } catch (error) {
      console.error('VoiceCall: Fatal error in initializeAudio:', error);
      setIsListening(false);
      Alert.alert(
        'Error',
        'Something went wrong. Please check your internet connection and try again.',
      );
    }
  };
  const stopAudio = useCallback(() => {
    console.log('VoiceCall: Stopping audio recognition');
    setIsListening(false);
    emit('stop_speaking', {meetingId: meetingId});
    AudioRecord.stop();

    // // ✅ Cleanup timeout khi stop
    // if (sentenceTimeoutRef.current) {
    //   clearTimeout(sentenceTimeoutRef.current);
    //   sentenceTimeoutRef.current = null;
    // }

    // if (recognizerRef.current) {
    //   recognizerRef.current.stopContinuousRecognitionAsync();
    //   recognizerRef.current.close();
    //   recognizerRef.current = null;
    //   initializedRef.current = false;
    // }

    // // Reset buffers
    // wordBuffer.current = '';
    // lastSentText.current = '';
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isListening) {
        stopAudio();
      }
    };
  }, [isListening, stopAudio]);

  // Stop audio recognition
  // const stopAudio = useCallback(() => {
  //   console.log('VoiceCall: Stopping audio recognition');
  //   setIsListening(false);
  //   AudioRecord.stop();

  //   if (recognizerRef.current) {
  //     recognizerRef.current.stopContinuousRecognitionAsync();
  //     recognizerRef.current.close();
  //     recognizerRef.current = null;
  //     initializedRef.current = false;
  //   }
  // }, []);
  // Stop audio recognition

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
      emit('leave_call', {
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

  // Render participant item
  const renderParticipantItem = ({item}) => (
    <View style={styles.participantItem}>
      <View style={styles.smallAvatar}>
        <Image
          source={
            item.avatar
              ? {uri: item?.avatar?.url || item?.avatar}
              : require('../assets/default-avatar.png')
          }
          style={styles.smallAvatarImage}
        />
      </View>
      <View style={styles.participantInfo}>
        <Text style={styles.participantItemName}>{item.name}</Text>
        <Text style={styles.participantLanguage}>
          {item.language?.toUpperCase() || 'EN'}
        </Text>
      </View>
      <View style={styles.participantStatusContainer}>
        <View style={[styles.onlineIndicator, {backgroundColor: '#10B981'}]} />
        <Icon name="mic" size={16} color="#4AC6D0" />
      </View>
    </View>
  );

  // Animate entrance
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  // Modal animation
  useEffect(() => {
    if (showParticipantsModal) {
      Animated.timing(modalFadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      modalFadeAnim.setValue(0);
    }
  }, [showParticipantsModal]);

  // Mic wave animation
  useEffect(() => {
    if (isListening) {
      const waveAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(micWaveAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(micWaveAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ]),
      );
      waveAnimation.start();

      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ]),
      );
      pulseAnimation.start();

      return () => {
        waveAnimation.stop();
        pulseAnimation.stop();
      };
    }
  }, [isListening]);

  // Format call duration
  const formatDuration = ms => {
    const duration = moment.duration(ms);
    const hours = Math.floor(duration.asHours());
    const minutes = duration.minutes();
    const seconds = duration.seconds();

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds
        .toString()
        .padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };
  // Render mic waves
  const renderMicWaves = () => {
    if (!isListening) {
      return null;
    }

    return (
      <View style={styles.micWavesContainer}>
        {[...Array(4)].map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.micWave,
              {
                opacity: micWaveAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 0.8],
                }),
                transform: [
                  {
                    scale: micWaveAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [1, 1.5 + index * 0.3],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
    );
  };

  // Render participants modal
  const renderParticipantsModal = () => (
    <Modal
      visible={showParticipantsModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowParticipantsModal(false)}>
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              opacity: modalFadeAnim,
              transform: [
                {
                  scale: modalFadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.modalIcon}>
              <Icon name="people" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.modalTitle}>
              Participants ({participants.length})
            </Text>
            <TouchableOpacity
              onPress={() => setShowParticipantsModal(false)}
              style={styles.closeButton}>
              <Icon name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>

          {/* Participants List */}
          <FlatList
            data={participants}
            renderItem={renderParticipantItem}
            keyExtractor={item => item.uid}
            style={styles.modalParticipantsList}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.modalListContent}
          />

          {/* Modal Footer */}
          <View style={styles.modalFooter}>
            {/* <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowParticipantsModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity> */}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.main}>
      <StatusBar backgroundColor="#0F172A" barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={['#0F172A', '#1E293B']}
        style={styles.headerContainer}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Voice Call</Text>
            <Text style={styles.headerSubtitle}>
              {formatDuration(callDuration)}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => setShowParticipantsModal(true)}
            style={styles.participantsButton}>
            <View style={styles.participantsCount}>
              <Text style={styles.participantsCountText}>
                {participants.length}
              </Text>
            </View>
            <Icon name="people" size={20} color="#4AC6D0" />
          </TouchableOpacity>

          <View style={styles.connectionContainer}>
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
      </LinearGradient>

      <Animated.View style={[styles.content, {opacity: fadeAnim}]}>
        {/* Main User Avatar */}
        <View style={styles.mainUserContainer}>
          <View style={styles.avatarWrapper}>
            {renderMicWaves()}
            <Animated.View
              style={[
                styles.avatar,
                {
                  transform: [{scale: pulseAnim}],
                },
              ]}>
              {user.avatar ? (
                <Image
                  source={
                    user.avatar
                      ? {uri: user?.avatar?.url}
                      : require('../assets/default-avatar.png')
                  }
                  style={styles.avatarImage}
                />
              ) : (
                <Text style={styles.avatarText}>
                  {user.name?.charAt(0) ||
                    user?.email?.charAt(0).toUpperCase() ||
                    'Y'}
                </Text>
              )}
            </Animated.View>
            <View
              style={[
                styles.micIndicator,
                {backgroundColor: isListening ? '#4AC6D0' : '#64748B'},
              ]}>
              <Icon
                name={isListening ? 'mic' : 'mic-off'}
                size={18}
                color="#ffffff"
              />
            </View>
          </View>
          <Text style={styles.participantName}>{user.name || 'You'}</Text>
          <Text style={styles.languageTag}>
            Speaking: {user.language?.toUpperCase() || 'EN'}
          </Text>
        </View>

        {/* Translation Display */}
        <View style={styles.translationCard}>
          <View style={styles.translationHeader}>
            <Icon name="record-voice-over" size={20} color="#4AC6D0" />
            <Text style={styles.translationLabel}>Live Transcription</Text>
            {isListening && (
              <View style={styles.liveIndicator}>
                <View style={styles.liveDot} />
                <Text style={styles.liveText}>LIVE</Text>
              </View>
            )}
          </View>
          <ScrollView style={styles.translationContent}>
            <Text style={styles.translationText}>
              {text || 'Tap the microphone to start speaking...'}
            </Text>
          </ScrollView>
        </View>
      </Animated.View>

      {/* Controls */}
      <LinearGradient
        colors={['#1E293B', '#0F172A']}
        style={styles.controlsContainer}>
        <TouchableOpacity
          onPress={isListening ? stopAudio : initializeAudio}
          style={[
            styles.controlButton,
            isListening ? styles.micOnButton : styles.micOffButton,
          ]}>
          <LinearGradient
            colors={
              isListening ? ['#4AC6D0', '#3BB8C3'] : ['#64748B', '#475569']
            }
            style={styles.controlButtonGradient}>
            <Icon
              name={isListening ? 'mic' : 'mic-off'}
              size={22}
              color="#ffffff"
            />
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleExitScreen}
          style={styles.endCallButton}>
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.endCallButtonGradient}>
            <Icon name="call-end" size={22} color="#ffffff" />
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>

      {/* Participants Modal */}
      {renderParticipantsModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  main: {
    flex: 1,
    backgroundColor: '#0A0E1A', // Darker background để highlight màu chủ đạo
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4AC6D0', // Màu chủ đạo cho title
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginTop: 2,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  participantsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  participantsCount: {
    backgroundColor: '#4AC6D0',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
  },
  participantsCountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  connectionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectionIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  connectionStatus: {
    fontSize: 12,
    color: '#4AC6D0',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  mainUserContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  micWavesContainer: {
    position: 'absolute',
    top: -20,
    left: -20,
    right: -20,
    bottom: -20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micWave: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    borderColor: 'rgba(74, 198, 208, 0.4)',
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#4AC6D0',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
    borderWidth: 3,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  avatarImage: {
    width: 114,
    height: 114,
    borderRadius: 57,
  },
  avatarText: {
    color: 'white',
    fontSize: 48,
    fontWeight: '700',
  },
  micIndicator: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    borderRadius: 20,
    padding: 8,
    borderWidth: 3,
    borderColor: '#0A0E1A',
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  participantName: {
    color: '#4AC6D0',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
    textShadowColor: 'rgba(74, 198, 208, 0.3)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 3,
  },
  languageTag: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '600',
    backgroundColor: '#4AC6D0',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    overflow: 'hidden',
  },

  translationCard: {
    backgroundColor: 'rgba(74, 198, 208, 0.08)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: 'rgba(74, 198, 208, 0.3)',
    minHeight: 140,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  translationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  translationLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4AC6D0',
    marginLeft: 8,
    flex: 1,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4AC6D0',
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#4AC6D0',
    marginRight: 4,
  },
  liveText: {
    fontSize: 10,
    color: '#4AC6D0',
    fontWeight: '700',
  },
  translationContent: {
    maxHeight: 120,
    minHeight: 80,
  },
  translationText: {
    fontSize: 16,
    color: '#ffffff',
    lineHeight: 24,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.2,
    shadowRadius: 10,
    backgroundColor: 'rgba(74, 198, 208, 0.05)',
  },
  controlButton: {
    elevation: 6,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  controlButtonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micOnButton: {},
  micOffButton: {},
  endCallButton: {
    elevation: 8,
    shadowColor: '#EF4444',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  endCallButtonGradient: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 26, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#1A2332',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxHeight: '80%',
    elevation: 15,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(74, 198, 208, 0.2)',
  },
  modalIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4AC6D0',
    flex: 1,
  },
  closeButton: {
    padding: 8,
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    borderRadius: 20,
  },
  modalParticipantsList: {
    maxHeight: 400,
  },
  modalListContent: {
    paddingBottom: 16,
  },
  participantItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.08)',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(74, 198, 208, 0.2)',
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  smallAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#4AC6D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 2,
    borderColor: 'rgba(74, 198, 208, 0.4)',
  },
  smallAvatarImage: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  participantInfo: {
    flex: 1,
  },
  participantItemName: {
    color: '#4AC6D0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  participantLanguage: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  participantStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  modalFooter: {
    marginTop: 20,
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(74, 198, 208, 0.2)',
  },
  modalCloseButton: {
    backgroundColor: '#4AC6D0',
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 3},
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  modalCloseText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default VoiceCallScreen;
