import React, {useEffect, useState, useRef, useTransition} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  PermissionsAndroid,
  StatusBar,
  Animated,
  ActivityIndicator,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {launchImageLibrary} from 'react-native-image-picker';
import {useAuth} from '../contexts/AuthContext';
import ImageModal from '../components/ImageModal';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import CallStarter from '../components/VoiceStarter';
import moment from 'moment';
import FileUpload from '../components/UploadFile';
import RNFS from 'react-native-fs';
import AvatarStatus from '../components/AvatarStatus';
import LinearGradient from 'react-native-linear-gradient';
import {useSocket} from '../contexts/SocketContext';
import {useTranslation} from '../contexts/TranslationContext';
import {translationTextService as translationService} from '../services/translationText';

const getFileTypeInfo = (fileName: string) => {
  const extension = fileName?.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'pdf':
      return {
        icon: 'picture-as-pdf',
        color: '#EF4444',
        bgColor: 'rgba(239, 68, 68, 0.15)',
      };
    case 'doc':
    case 'docx':
      return {
        icon: 'description',
        color: '#3B82F6',
        bgColor: 'rgba(59, 130, 246, 0.15)',
      };
    case 'xls':
    case 'xlsx':
      return {
        icon: 'grid-on',
        color: '#10B981',
        bgColor: 'rgba(16, 185, 129, 0.15)',
      };
    case 'ppt':
    case 'pptx':
      return {
        icon: 'slideshow',
        color: '#F59E0B',
        bgColor: 'rgba(245, 158, 11, 0.15)',
      };
    case 'zip':
    case 'rar':
      return {
        icon: 'archive',
        color: '#8B5CF6',
        bgColor: 'rgba(139, 92, 246, 0.15)',
      };
    default:
      return {
        icon: 'attach-file',
        color: '#4AC6D0',
        bgColor: 'rgba(74, 198, 208, 0.15)',
      };
  }
};

const ChatScreen = ({route}: any) => {
  const {user} = useAuth();
  const {emit} = useSocket(); // Add socket context

  const userId = user?.uid;
  const {chatId, toUserId, avatar} = route.params || {};
  const [name, setName] = useState(route.params?.name || '');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [userAvatars, setUserAvatars] = useState<any>({});
  const [userNames, setUserNames] = useState<any>({});
  const [isTyping, setIsTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const {t, currentLanguage: language} = useTranslation();
  const navigation = useNavigation<any>();

  const [translatedMessages, setTranslatedMessages] = useState<{
    [key: string]: string;
  }>({});
  const [translatingMessages, setTranslatingMessages] = useState<{
    [key: string]: boolean;
  }>({});
  const [showOriginalMessages, setShowOriginalMessages] = useState<{
    [key: string]: boolean;
  }>({});

  const handleTranslateMessage = async (
    messageId: string,
    messageText: string,
  ) => {
    try {
      // If already translated and showing translated text, show original
      if (translatedMessages[messageId] && !showOriginalMessages[messageId]) {
        setShowOriginalMessages(prev => ({
          ...prev,
          [messageId]: true,
        }));
        return;
      }

      // If showing original, show translated again
      if (showOriginalMessages[messageId]) {
        setShowOriginalMessages(prev => ({
          ...prev,
          [messageId]: false,
        }));
        return;
      }

      // Start translation
      setTranslatingMessages(prev => ({
        ...prev,
        [messageId]: true,
      }));

      const result = await translationService.translateText(
        messageText,
        language,
      );

      setTranslatedMessages(prev => ({
        ...prev,
        [messageId]: result.translatedText,
      }));

      setShowOriginalMessages(prev => ({
        ...prev,
        [messageId]: false,
      }));
    } catch (error) {
      console.error('Translation error:', error);
      Alert.alert(
        t('chatScreen.translationError'),
        error.message || t('chatScreen.translationFailed'),
      );
    } finally {
      setTranslatingMessages(prev => ({
        ...prev,
        [messageId]: false,
      }));
    }
  };

  // Animated entrance
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  // Auto scroll to bottom when messages change
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({animated: true});
      }, 100);
    }
  }, [messages]);

  // Request permissions on Android
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);
      if (
        granted['android.permission.RECORD_AUDIO'] !== 'granted' ||
        granted['android.permission.CAMERA'] !== 'granted'
      ) {
        Alert.alert(
          'Permission Denied',
          'Audio and Camera permissions are required for the call',
        );
        return;
      }
    }
  };

  const uploadFile = async (url: string, fileName: string) => {
    await firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .add({
        from: userId,
        to: toUserId,
        fileURL: url,
        fileName: fileName,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });

    await firestore()
      .collection('chats')
      .doc(chatId)
      .set(
        {
          lastMessage: fileName,
          lastMessageTime: firestore.FieldValue.serverTimestamp(),
          lastSender: userId,
          lastSenderName: user?.name || user?.email,
          messageType: 'file',
        },
        {merge: true},
      );
  };

  // Listen to chat data changes
  useEffect(() => {
    const unsubscribeChat = firestore()
      .collection('chats')
      .doc(chatId)
      .onSnapshot(async chatDoc => {
        const chatData = chatDoc.data();
        if (!chatData) {
          setName('Untitled Group');
        } else if (!chatData.members || chatData.members.length === 0) {
          setName(chatData.name || 'Untitled Group');
        }
      });

    return () => unsubscribeChat();
  }, [chatId]);

  // Listen to messages
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(querySnapshot => {
        const msgs: any[] = [];
        querySnapshot.forEach(doc => {
          msgs.push({id: doc.id, ...doc.data()});
        });
        setMessages(msgs);
      });

    return () => unsubscribe();
  }, [chatId]);

  // Fetch user data
  useEffect(() => {
    const fetchUserNames = async () => {
      const userIds = [...new Set(messages.map(msg => msg.from))];
      if (userIds.length === 0) {
        return;
      }

      const usersSnapshot = await firestore()
        .collection('users')
        .where(firestore.FieldPath.documentId(), 'in', userIds)
        .get();

      const names: any = {};
      const avatars: any = {};
      usersSnapshot.forEach(doc => {
        names[doc.id] = doc.data()?.name || doc.data().email;
        avatars[doc.id] = doc.data()?.avatar?.url || null;
      });
      setUserNames(names);
      setUserAvatars(avatars);
    };

    fetchUserNames();
  }, [messages]);
  const handleSend = async () => {
    if (message.trim() === '') {
      return;
    }

    const messageText = message.trim();
    setMessage(''); // Clear input immediately

    try {
      // Add message to Firestore
      await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .add({
          from: userId,
          to: toUserId,
          text: messageText,
          timestamp: firestore.FieldValue.serverTimestamp(),
        });

      // Update chat metadata
      await firestore()
        .collection('chats')
        .doc(chatId)
        .set(
          {
            lastMessage: messageText,
            lastMessageTime: firestore.FieldValue.serverTimestamp(),
            lastSenderName: user?.name || user?.email,
            lastSender: userId,
            messageType: 'text',
          },
          {merge: true},
        );

      // Get chat members for notification
      const chatDoc = await firestore().collection('chats').doc(chatId).get();
      if (chatDoc.exists) {
        const chatData = chatDoc.data();
        const allMemberIds = chatData?.members || [];

        // Lọc ra những người nhận (không bao gồm người gửi)
        const recipientIds = allMemberIds.filter(id => id !== userId);
        // Emit socket event for push notifications
        emit('send_message', {
          chatId,
          senderId: userId,
          message: messageText,
          memberIds: recipientIds, // Chỉ recipients
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  };
  const handleFileDownload = async (fileURL: string, fileName: string) => {
    try {
      const downloadDest =
        Platform.OS === 'android'
          ? `${RNFS.DownloadDirectoryPath}/${fileName}`
          : `${RNFS.DocumentDirectoryPath}/${fileName}`;

      const res = await RNFS.downloadFile({
        fromUrl: fileURL,
        toFile: downloadDest,
      }).promise;

      if (res.statusCode === 200) {
        Alert.alert('Download Complete', `File saved to: ${downloadDest}`);
      } else {
        Alert.alert('Error', `Download failed with code: ${res.statusCode}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download Error', 'Unable to download file.');
    }
  };

  const handlePickImage = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.didCancel) {
      return;
    }

    const asset = result.assets?.[0];
    if (!asset || !asset.uri) {
      return;
    }

    const uri = asset.uri;
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: 'chat-image.jpg',
      type: 'image/jpeg',
    } as any);

    const cloud_name = 'djlhfgzbw';
    const upload_preset = 'chatapp';
    formData.append('upload_preset', upload_preset);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        {
          method: 'POST',
          body: formData,
        },
      );

      const json = await res.json();

      if (json.secure_url) {
        await firestore()
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .add({
            from: userId,
            to: toUserId,
            imageUrl: json.secure_url,
            timestamp: firestore.FieldValue.serverTimestamp(),
          });

        await firestore()
          .collection('chats')
          .doc(chatId)
          .set(
            {
              lastMessage: '📷 Photo',
              lastMessageTime: firestore.FieldValue.serverTimestamp(),
              lastSenderName: user?.name || user?.email,
              lastSender: userId,
              messageType: 'image',
            },
            {merge: true},
          );
      } else {
        Alert.alert('Upload Failed', json.error?.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  const groupMessagesByDate = (Messages: any[]) => {
    const grouped: any[] = [];
    let lastDate = '';

    Messages.forEach(msg => {
      const dateStr = moment(msg.timestamp?.toDate?.() || new Date()).format(
        'YYYY-MM-DD',
      );
      if (dateStr !== lastDate) {
        grouped.push({type: 'date', date: dateStr});
        lastDate = dateStr;
      }
      grouped.push({type: 'message', ...msg});
    });

    return grouped;
  };

  const formatDisplayDate = (dateStr: string) => {
    const today = moment().startOf('day');
    const target = moment(dateStr);

    if (target.isSame(today, 'day')) {
      return 'Today';
    }
    if (target.isSame(today.clone().subtract(1, 'day'), 'day')) {
      return 'Yesterday';
    }
    if (target.isAfter(today.clone().subtract(6, 'days'))) {
      return target.format('dddd');
    }
    return target.format('MMM D, YYYY');
  };

  const renderMessage = ({item}: any) => {
    if (item.type === 'date') {
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>{formatDisplayDate(item.date)}</Text>
          <View style={styles.dateLine} />
        </View>
      );
    }

    const isCurrentUser = item.from === userId;
    const messageAvatar = userAvatars[item.from] || '';
    const userName = userNames[item.from] || 'Unknown User';
    const isTranslated = translatedMessages[item.id];
    const isTranslating = translatingMessages[item.id];
    const showOriginal = showOriginalMessages[item.id];

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.sentContainer : styles.receivedContainer,
          {opacity: fadeAnim},
        ]}>
        {!isCurrentUser && (
          <AvatarStatus
            avatarUrl={messageAvatar}
            status={item?.status || 'offline'}
            size={36}
            style={styles.messageAvatar}
          />
        )}

        <View style={styles.messageContentContainer}>
          {!isCurrentUser && (
            <Text style={styles.messageSenderName}>{userName}</Text>
          )}

          {/* Text Message */}
          {item.text && (
            <View style={styles.messageWrapper}>
              <View
                style={[
                  styles.messageBubble,
                  isCurrentUser ? styles.sentBubble : styles.receivedBubble,
                ]}>
                <Text
                  style={isCurrentUser ? styles.sentText : styles.receivedText}>
                  {isTranslated && !showOriginal
                    ? translatedMessages[item.id]
                    : item.text}
                </Text>
              </View>

              {/* Translation Controls */}
              <View style={styles.translationControls}>
                <TouchableOpacity
                  style={styles.translateButton}
                  onPress={() => handleTranslateMessage(item.id, item.text)}
                  disabled={isTranslating}>
                  {isTranslating ? (
                    <View style={styles.translatingContainer}>
                      <ActivityIndicator size="small" color="#4AC6D0" />
                      <Text style={styles.translatingText}>
                        {t('chatScreen.translating')}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.translateButtonContent}>
                      <Icon
                        name="translate"
                        size={14}
                        color="#4AC6D0"
                        style={styles.translateIcon}
                      />
                      <Text style={styles.translateButtonText}>
                        {isTranslated && !showOriginal
                          ? t('chatScreen.showOriginal')
                          : isTranslated && showOriginal
                          ? t('chatScreen.showTranslation')
                          : t('chatScreen.translate')}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Translation indicator */}
                {isTranslated && !showOriginal && (
                  <View style={styles.translationIndicator}>
                    <Icon name="check" size={12} color="#10B981" />
                    <Text style={styles.translationIndicatorText}>
                      {t('chatScreen.translated')}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Image Message */}
          {item.imageUrl && (
            <TouchableOpacity
              onPress={() => setSelectedImage(item.imageUrl)}
              style={[
                styles.imageContainer,
                isCurrentUser
                  ? styles.sentImageContainer
                  : styles.receivedImageContainer,
              ]}>
              <Image
                source={{uri: item.imageUrl}}
                style={styles.imageMessage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Icon name="zoom-in" size={24} color="rgba(255,255,255,0.8)" />
              </View>
            </TouchableOpacity>
          )}

          {/* File Message */}
          {item.fileURL &&
            (() => {
              const fileInfo = getFileTypeInfo(item.fileName);
              return (
                <TouchableOpacity
                  onPress={() =>
                    handleFileDownload(item.fileURL, item.fileName)
                  }
                  style={[
                    styles.fileContainer,
                    isCurrentUser
                      ? styles.sentFileContainer
                      : styles.receivedFileContainer,
                  ]}
                  activeOpacity={0.7}>
                  <View
                    style={[
                      styles.fileIconContainer,
                      {backgroundColor: fileInfo.bgColor},
                    ]}>
                    <Icon
                      name={fileInfo.icon}
                      size={22}
                      color={fileInfo.color}
                    />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text
                      style={styles.fileName}
                      numberOfLines={2}
                      ellipsizeMode="middle">
                      {item.fileName || 'Unknown File'}
                    </Text>
                    <Text style={styles.fileAction}>Tap to download</Text>
                  </View>
                  <View style={styles.fileDownloadIcon}>
                    <Icon name="download" size={18} color="#4AC6D0" />
                  </View>
                </TouchableOpacity>
              );
            })()}

          <Text
            style={[
              styles.timeStamp,
              {alignSelf: isCurrentUser ? 'flex-end' : 'flex-start'},
            ]}>
            {item.timestamp
              ? moment(item.timestamp.toDate()).format('HH:mm')
              : ''}
          </Text>
        </View>

        {isCurrentUser && (
          <AvatarStatus
            avatarUrl={user?.avatar?.url}
            status={user?.userStatus?.status}
            size={36}
            style={styles.currentUserAvatar}
          />
        )}
      </Animated.View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.header}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            onPress={() => navigation.navigate('ChatList')}
            style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerProfile}
            onPress={() =>
              navigation.navigate('ChatMembers', {
                chatId: chatId,
                currentUserId: userId,
              })
            }>
            <Image
              source={
                avatar ? {uri: avatar} : require('../assets/default-avatar.png')
              }
              style={styles.avatar}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName}>{name}</Text>
              {/* <Text style={styles.headerStatus}>Online</Text> */}
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.headerRight}>
          <CallStarter user={user} chatId={chatId} />
          {/* <TouchableOpacity style={styles.headerAction}>
            <Icon name="more-vert" size={24} color="#fff" />
          </TouchableOpacity> */}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}>
        <View style={styles.chatContainer}>
          {/* Messages List */}
          <FlatList
            data={groupMessagesByDate(messages)}
            ref={flatListRef}
            keyExtractor={(item, index) => item.id || index.toString()}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => {
              if (messages.length > 0) {
                flatListRef.current?.scrollToEnd({animated: true});
              }
            }}
            renderItem={renderMessage}
          />

          {/* Input Area */}
          <View style={styles.inputSection}>
            <View style={styles.inputContainer}>
              <View style={styles.inputActions}>
                <FileUpload
                  onFileUploaded={(url: any, fileName: any) =>
                    uploadFile(url, fileName)
                  }
                />
                <TouchableOpacity
                  onPress={handlePickImage}
                  style={styles.actionButton}>
                  <Icon name="photo-camera" size={20} color="#4AC6D0" />
                </TouchableOpacity>
              </View>

              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={t('chatScreen.typeYourMessage')}
                placeholderTextColor="#9CA3AF"
                style={styles.input}
                multiline
                maxLength={1000}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
              />

              <TouchableOpacity
                onPress={handleSend}
                style={[
                  styles.sendButton,
                  message.trim() === ''
                    ? styles.sendButtonDisabled
                    : styles.sendButtonActive,
                ]}
                disabled={message.trim() === ''}>
                <LinearGradient
                  colors={
                    message.trim() === ''
                      ? ['#BDC3C7', '#BDC3C7']
                      : ['#4AC6D0', '#3BB8C3']
                  }
                  style={styles.sendButtonGradient}>
                  <Icon name="send" size={20} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Image Modal */}
      <ImageModal
        visible={!!selectedImage}
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 30,
    marginLeft: 18,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E9EDF5',
  },
  headerAvatar: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  headerStatus: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAction: {
    padding: 8,
    marginLeft: 8,
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  messagesList: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 12,
    fontWeight: '500',
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 4,
    alignItems: 'flex-end',
  },
  sentContainer: {
    justifyContent: 'flex-end',
  },
  receivedContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    marginRight: 8,
  },
  currentUserAvatar: {
    marginLeft: 8,
  },
  messageContentContainer: {
    maxWidth: '75%',
    marginHorizontal: 4,
  },
  messageSenderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 4,
    marginLeft: 12,
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageWrapper: {
    width: '100%',
  },
  translationControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    paddingHorizontal: 4,
  },
  translateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  translateButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  translateIcon: {
    marginRight: 4,
  },
  translateButtonText: {
    fontSize: 12,
    color: '#4AC6D0',
    fontWeight: '600',
  },
  translatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  translatingText: {
    fontSize: 12,
    color: '#4AC6D0',
    marginLeft: 6,
    fontStyle: 'italic',
  },
  translationIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  translationIndicatorText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
    marginLeft: 4,
  },
  sentBubble: {
    backgroundColor: '#4AC6D0',
    borderBottomRightRadius: 6,
    alignSelf: 'flex-end',
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sentText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
  },
  receivedText: {
    color: '#1E293B',
    fontSize: 15,
    lineHeight: 20,
  },

  // Fixed file container styles
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    maxWidth: '100%', // Ensure it doesn't overflow
    minWidth: 200, // Minimum width for better appearance
  },

  sentFileContainer: {
    alignSelf: 'flex-end',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    borderColor: '#4AC6D0',
  },

  receivedFileContainer: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
  },

  fileIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0, // Prevent icon from shrinking
  },

  fileInfo: {
    flex: 1,
    minWidth: 0, // Allow text to shrink and wrap properly
  },

  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 4,
    lineHeight: 18,
  },

  fileAction: {
    fontSize: 12,
    color: '#4AC6D0',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  fileDownloadIcon: {
    marginLeft: 8,
    padding: 4,
    flexShrink: 0,
  },

  // Optional: Add different file type icons
  fileTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    flexShrink: 0,
  },

  // Different colors for different file types
  fileTypePdf: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },

  fileTypeDoc: {
    backgroundColor: 'rgba(59, 130, 246, 0.15)',
  },

  fileTypeDefault: {
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
  },

  // Enhanced image container styles for consistency
  imageContainer: {
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
    position: 'relative',
    maxWidth: '100%', // Ensure consistency
  },

  sentImageContainer: {
    alignSelf: 'flex-end',
  },

  receivedImageContainer: {
    alignSelf: 'flex-start',
  },

  imageMessage: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  imageOverlay: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    padding: 6,
  },
  // fileContainer: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   backgroundColor: '#FFFFFF',
  //   padding: 12,
  //   borderRadius: 16,
  //   marginVertical: 4,
  //   borderWidth: 1,
  //   borderColor: '#E2E8F0',
  //   elevation: 1,
  // },
  // sentFileContainer: {
  //   alignSelf: 'flex-end',
  //   backgroundColor: '#E0F7FA',
  //   borderColor: '#4AC6D0',
  // },
  // receivedFileContainer: {
  //   alignSelf: 'flex-start',
  // },
  // fileIconContainer: {
  //   width: 40,
  //   height: 40,
  //   borderRadius: 20,
  //   backgroundColor: '#F0FDFF',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   marginRight: 12,
  // },
  // fileInfo: {
  //   flex: 1,
  // },
  // fileName: {
  //   fontSize: 14,
  //   fontWeight: '600',
  //   color: '#1E293B',
  //   marginBottom: 2,
  // },
  // fileAction: {
  //   fontSize: 12,
  //   color: '#4AC6D0',
  //   fontWeight: '500',
  // },
  timeStamp: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 6,
    marginHorizontal: 12,
  },
  inputSection: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderRadius: 24,
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  actionButton: {
    padding: 8,
    marginHorizontal: 2,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 12,
    maxHeight: 100,
    lineHeight: 20,
  },
  sendButton: {
    marginLeft: 8,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonActive: {
    transform: [{scale: 1}],
  },
  sendButtonDisabled: {
    transform: [{scale: 0.9}],
    opacity: 0.6,
  },
});

export default ChatScreen;
