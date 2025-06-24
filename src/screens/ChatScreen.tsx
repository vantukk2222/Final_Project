import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
} from 'react';
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
  StatusBar,
  Animated,
  ActivityIndicator,
  Dimensions,
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
import {TourItinerary} from '../types/tour';

// Types
interface Message {
  id: string;
  from: string;
  to: string;
  text?: string;
  imageUrl?: string;
  fileURL?: string;
  fileName?: string;
  timestamp?: any;
  type?: 'message' | 'date';
  date?: string;
}

interface TranslationState {
  [messageId: string]: {
    translatedText: string;
    isTranslating: boolean;
    showOriginal: boolean;
  };
}

interface UserData {
  [userId: string]: {
    name: string;
    avatar: string;
  };
}

interface TourData {
  id: string;
  title: string;
  location: string;
  price: number;
  image?: string;
  status: string;
}

// Constants
const {width} = Dimensions.get('window');
const CLOUD_CONFIG = {
  name: 'djlhfgzbw',
  uploadPreset: 'chatapp',
};

const FILE_TYPE_MAP = Object.freeze({
  pdf: {
    icon: 'picture-as-pdf',
    color: '#EF4444',
    bgColor: 'rgba(239, 68, 68, 0.15)',
  },
  doc: {
    icon: 'description',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
  },
  docx: {
    icon: 'description',
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
  },
  xls: {icon: 'grid-on', color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.15)'},
  xlsx: {
    icon: 'grid-on',
    color: '#10B981',
    bgColor: 'rgba(16, 185, 129, 0.15)',
  },
  ppt: {
    icon: 'slideshow',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
  pptx: {
    icon: 'slideshow',
    color: '#F59E0B',
    bgColor: 'rgba(245, 158, 11, 0.15)',
  },
  zip: {icon: 'archive', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)'},
  rar: {icon: 'archive', color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.15)'},
});

// Utility functions - memoized
const getFileTypeInfo = (fileName: string) => {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  return (
    FILE_TYPE_MAP[extension as keyof typeof FILE_TYPE_MAP] || {
      icon: 'attach-file',
      color: '#4AC6D0',
      bgColor: 'rgba(74, 198, 208, 0.15)',
    }
  );
};

const formatDisplayDate = (dateStr: string) => {
  console.log('dateStr:', dateStr);
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

// Memoized Components
const DateSeparator = memo(
  ({date}: {date: string}) => (
    console.log('Rendering DateSeparator:', date),
    (
      <View style={styles.dateSeparator}>
        <View style={styles.dateLine} />
        <Text style={styles.dateText}>{formatDisplayDate(date)}</Text>
        <View style={styles.dateLine} />
      </View>
    )
  ),
);

const TranslationControls = memo(
  ({
    messageId,
    messageText,
    isTranslated,
    isTranslating,
    showOriginal,
    onTranslate,
    t,
  }: {
    messageId: string;
    messageText: string;
    isTranslated: boolean;
    isTranslating: boolean;
    showOriginal: boolean;
    onTranslate: (id: string, text: string) => void;
    t: (key: string) => string;
  }) => {
    const handlePress = useCallback(() => {
      onTranslate(messageId, messageText);
    }, [messageId, messageText, onTranslate]);

    const buttonText = useMemo(() => {
      if (isTranslated && !showOriginal) {
        return t('chatScreen.showOriginal');
      }
      if (isTranslated && showOriginal) {
        return t('chatScreen.showTranslation');
      }
      return t('chatScreen.translate');
    }, [isTranslated, showOriginal, t]);

    return (
      <View style={styles.translationControls}>
        <TouchableOpacity
          style={styles.translateButton}
          onPress={handlePress}
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
              <Text style={styles.translateButtonText}>{buttonText}</Text>
            </View>
          )}
        </TouchableOpacity>

        {isTranslated && !showOriginal && (
          <View style={styles.translationIndicator}>
            <Icon name="check" size={12} color="#10B981" />
            <Text style={styles.translationIndicatorText}>
              {t('chatScreen.translated')}
            </Text>
          </View>
        )}
      </View>
    );
  },
);

const MessageBubble = memo(
  ({
    message,
    isCurrentUser,
    userName,
    messageAvatar,
    translationState,
    onTranslate,
    onImagePress,
    onFileDownload,
    t,
  }: {
    message: Message;
    isCurrentUser: boolean;
    userName: string;
    messageAvatar: string;
    translationState: TranslationState[string];
    onTranslate: (id: string, text: string) => void;
    onImagePress: (url: string) => void;
    onFileDownload: (url: string, fileName: string) => void;
    t: (key: string) => string;
  }) => {
    const handleImagePress = useCallback(() => {
      if (message.imageUrl) {
        onImagePress(message.imageUrl);
      }
    }, [message.imageUrl, onImagePress]);

    const handleFilePress = useCallback(() => {
      if (message.fileURL && message.fileName) {
        onFileDownload(message.fileURL, message.fileName);
      }
    }, [message.fileURL, message.fileName, onFileDownload]);

    const displayText = useMemo(() => {
      if (!message.text) {
        return '';
      }
      if (translationState?.translatedText && !translationState.showOriginal) {
        return translationState.translatedText;
      }
      return message.text;
    }, [message.text, translationState]);

    const fileInfo = useMemo(() => {
      return message.fileName ? getFileTypeInfo(message.fileName) : null;
    }, [message.fileName]);

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          isCurrentUser ? styles.sentContainer : styles.receivedContainer,
        ]}>
        {!isCurrentUser && (
          <AvatarStatus
            avatarUrl={messageAvatar}
            size={36}
            style={styles.messageAvatar}
          />
        )}

        <View style={styles.messageContentContainer}>
          {!isCurrentUser && (
            <Text style={styles.messageSenderName}>{userName}</Text>
          )}

          {/* Text Message */}
          {message.text && (
            <View style={styles.messageWrapper}>
              <View
                style={[
                  styles.messageBubble,
                  isCurrentUser ? styles.sentBubble : styles.receivedBubble,
                ]}>
                <Text
                  style={isCurrentUser ? styles.sentText : styles.receivedText}>
                  {displayText}
                </Text>
              </View>

              <TranslationControls
                messageId={message.id}
                messageText={message.text}
                isTranslated={!!translationState?.translatedText}
                isTranslating={translationState?.isTranslating || false}
                showOriginal={translationState?.showOriginal || false}
                onTranslate={onTranslate}
                t={t}
              />
            </View>
          )}

          {/* Image Message */}
          {message.imageUrl && (
            <TouchableOpacity
              onPress={handleImagePress}
              style={[
                styles.imageContainer,
                isCurrentUser
                  ? styles.sentImageContainer
                  : styles.receivedImageContainer,
              ]}>
              <Image
                source={{uri: message.imageUrl}}
                style={styles.imageMessage}
                resizeMode="cover"
              />
              <View style={styles.imageOverlay}>
                <Icon name="zoom-in" size={24} color="rgba(255,255,255,0.8)" />
              </View>
            </TouchableOpacity>
          )}

          {/* File Message */}
          {message.fileURL && fileInfo && (
            <TouchableOpacity
              onPress={handleFilePress}
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
                <Icon name={fileInfo.icon} size={22} color={fileInfo.color} />
              </View>
              <View style={styles.fileInfo}>
                <Text
                  style={styles.fileName}
                  numberOfLines={2}
                  ellipsizeMode="middle">
                  {message.fileName || 'Unknown File'}
                </Text>
                <Text style={styles.fileAction}>Tap to download</Text>
              </View>
              <View style={styles.fileDownloadIcon}>
                <Icon name="download" size={18} color="#4AC6D0" />
              </View>
            </TouchableOpacity>
          )}

          <Text
            style={[
              styles.timeStamp,
              {alignSelf: isCurrentUser ? 'flex-end' : 'flex-start'},
            ]}>
            {message.timestamp
              ? moment(message.timestamp.toDate()).format('HH:mm')
              : ''}
          </Text>
        </View>

        {isCurrentUser && (
          <AvatarStatus
            avatarUrl={messageAvatar}
            size={36}
            style={styles.currentUserAvatar}
          />
        )}
      </Animated.View>
    );
  },
);

const ChatHeader = memo(
  ({
    name,
    avatar,
    onBack,
    onMembersPress,
    user,
    chatId,
  }: {
    name: string;
    avatar: string;
    onBack: () => void;
    onMembersPress: () => void;
    user: any;
    chatId: string;
  }) => (
    <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.header}>
      <View style={styles.headerLeft}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerProfile} onPress={onMembersPress}>
          <Image
            source={
              avatar ? {uri: avatar} : require('../assets/default-avatar.png')
            }
            style={styles.avatar}
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{name}</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.headerRight}>
        <CallStarter user={user} chatId={chatId} />
      </View>
    </LinearGradient>
  ),
);

const MessageInput = memo(
  ({
    message,
    onChangeText,
    onSend,
    onPickImage,
    onFileUpload,
    t,
  }: {
    message: string;
    onChangeText: (text: string) => void;
    onSend: () => void;
    onPickImage: () => void;
    onFileUpload: (url: string, fileName: string) => void;
    t: (key: string) => string;
  }) => {
    const canSend = message.trim() !== '';

    return (
      <View style={styles.inputSection}>
        <View style={styles.inputContainer}>
          <View style={styles.inputActions}>
            <FileUpload onFileUploaded={onFileUpload} />
            <TouchableOpacity onPress={onPickImage} style={styles.actionButton}>
              <Icon name="photo-camera" size={20} color="#4AC6D0" />
            </TouchableOpacity>
          </View>

          <TextInput
            value={message}
            onChangeText={onChangeText}
            placeholder={t('chatScreen.typeYourMessage')}
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            multiline
            maxLength={1000}
          />

          <TouchableOpacity
            onPress={onSend}
            style={[
              styles.sendButton,
              canSend ? styles.sendButtonActive : styles.sendButtonDisabled,
            ]}
            disabled={!canSend}>
            <LinearGradient
              colors={canSend ? ['#4AC6D0', '#3BB8C3'] : ['#BDC3C7', '#BDC3C7']}
              style={styles.sendButtonGradient}>
              <Icon name="send" size={20} color="#FFFFFF" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
);

// Pinned Tour Banner Component
const PinnedTourBanner = memo(
  ({
    tour,
    userRole,
    onTourPress,
    onClose,
    t,
  }: {
    tour: TourItinerary;
    userRole: string;
    onTourPress: (tourId: string) => void;
    onClose: () => void;
    t: (key: string) => string;
  }) => {
    const handleTourPress = useCallback(() => {
      onTourPress(tour.id);
    }, [tour.id, onTourPress]);

    return (
      <View style={styles.pinnedTourContainer}>
        <LinearGradient
          colors={['rgba(74, 198, 208, 0.1)', 'rgba(74, 198, 208, 0.05)']}
          style={styles.pinnedTourGradient}>
          <View style={styles.pinnedTourHeader}>
            <View style={styles.pinnedTourIconContainer}>
              <Icon name="push-pin" size={16} color="#4AC6D0" />
            </View>
            <Text style={styles.pinnedTourHeaderText}>
              {t('chatScreen.associatedTour')}
            </Text>
            <TouchableOpacity
              style={styles.pinnedTourCloseButton}
              onPress={onClose}>
              <Icon name="close" size={16} color="#64748B" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.pinnedTourContent}
            onPress={handleTourPress}
            activeOpacity={0.7}>
            <View style={styles.tourImageContainer}>
              {tour.images ? (
                <Image
                  source={{uri: tour.images[0]}}
                  style={styles.tourImage}
                />
              ) : (
                <View style={styles.tourImagePlaceholder}>
                  <Icon name="landscape" size={24} color="#4AC6D0" />
                </View>
              )}
            </View>

            <View style={styles.tourInfo}>
              <Text style={styles.tourTitle} numberOfLines={1}>
                {tour.title}
              </Text>
              <View style={styles.tourDetails}>
                <Icon name="location-on" size={14} color="#64748B" />
                <Text style={styles.tourLocation} numberOfLines={1}>
                  {tour?.stops[0]?.destination?.address}
                </Text>
              </View>
              <View style={styles.tourMeta}>
                <Text style={styles.tourPrice}>${tour.price?.adult}</Text>
                <View
                  style={[
                    styles.tourStatusBadge,
                    tour.status === 'active' && styles.tourStatusActive,
                    tour.status === 'completed' && styles.tourStatusCompleted,
                  ]}>
                  <Text
                    style={[
                      styles.tourStatusText,
                      tour.status === 'active' && styles.tourStatusTextActive,
                      tour.status === 'completed' &&
                        styles.tourStatusTextCompleted,
                    ]}>
                    {t(`tour.management.${tour.status}`)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.tourAction}>
              <Icon
                name={userRole === 'tour_guide' ? 'edit' : 'visibility'}
                size={20}
                color="#4AC6D0"
              />
              {/* <Text style={styles.tourActionText}>
                {userRole === 'tour_guide' ? t('tour.edit') : t('tour.view')}
              </Text> */}
            </View>
          </TouchableOpacity>
        </LinearGradient>
      </View>
    );
  },
);

// Main Component
const ChatScreen: React.FC<{route: any}> = ({route}) => {
  const {user} = useAuth();
  const {emit} = useSocket();
  const {t, currentLanguage: language} = useTranslation();
  const navigation = useNavigation<any>();

  // Route params
  const {chatId, toUserId, avatar: avt, isGroup} = route.params || {};
  const userId = user?.uid;
  const [avatar, setAvatar] = useState(avt || '');

  // State
  const [name, setName] = useState(route.params?.name || '');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData>({});
  const [translationState, setTranslationState] = useState<TranslationState>(
    {},
  );
  const [associatedTour, setAssociatedTour] = useState<TourItinerary | null>(
    null,
  );
  const [showTourBanner, setShowTourBanner] = useState(true);

  useEffect(() => {
    if (!chatId || !userId) {
      Alert.alert('Error', 'Chat ID or User ID is missing');
      return;
    }
    const isExistInChat = async () => {
      const unsubscribeExistCheck = firestore()
        .collection('chats')
        .doc(chatId)
        .onSnapshot(
          chatDoc => {
            if (!chatDoc.exists) {
              Alert.alert('Error', 'Chat does not exist');
              navigation.navigate('ChatList');
              return;
            }
            const chatData = chatDoc.data();
            if (!chatData?.members?.includes(userId)) {
              navigation.navigate('ChatList');
            }
          },
          error => {
            console.error('Error checking chat membership:', error);
            Alert.alert('Error', 'Failed to verify chat access');
          },
        );

      return () => unsubscribeExistCheck();
    };
    isExistInChat();
  }, [userId, chatId]);

  // Refs
  const flatListRef = useRef<FlatList>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Memoized grouped messages
  const groupedMessages = useMemo(() => {
    const grouped: Message[] = [];
    let lastDate = '';

    messages.forEach(msg => {
      const dateStr = moment(msg.timestamp?.toDate?.() || new Date()).format(
        'YYYY-MM-DD',
      );
      if (dateStr !== lastDate) {
        grouped.push({
          type: 'date',
          date: dateStr,
          id: `date-${dateStr}`,
        } as Message);
        lastDate = dateStr;
      }
      grouped.push({type: 'message', ...msg} as Message);
    });

    return grouped;
  }, [messages]);

  // Translation handler - optimized
  const handleTranslateMessage = useCallback(
    async (messageId: string, messageText: string) => {
      const currentState = translationState[messageId];

      try {
        // Toggle states
        if (currentState?.translatedText && !currentState.showOriginal) {
          setTranslationState(prev => ({
            ...prev,
            [messageId]: {...prev[messageId], showOriginal: true},
          }));
          return;
        }

        if (currentState?.showOriginal) {
          setTranslationState(prev => ({
            ...prev,
            [messageId]: {...prev[messageId], showOriginal: false},
          }));
          return;
        }

        // Start translation
        setTranslationState(prev => ({
          ...prev,
          [messageId]: {
            translatedText: '',
            isTranslating: true,
            showOriginal: false,
          },
        }));

        const result = await translationService.translateText(
          messageText,
          language,
        );

        setTranslationState(prev => ({
          ...prev,
          [messageId]: {
            translatedText: result.translatedText,
            isTranslating: false,
            showOriginal: false,
          },
        }));
      } catch (error: any) {
        console.error('Translation error:', error);
        Alert.alert(
          t('chatScreen.translationError'),
          error.message || t('chatScreen.translationFailed'),
        );

        setTranslationState(prev => ({
          ...prev,
          [messageId]: {
            ...prev[messageId],
            isTranslating: false,
          },
        }));
      }
    },
    [translationState, language, t],
  );

  // Send message handler - optimized
  const handleSend = useCallback(async () => {
    if (message.trim() === '') {
      return;
    }

    const messageText = message.trim();
    setMessage('');

    try {
      const messageData = {
        from: userId,
        to: toUserId,
        text: messageText,
        timestamp: firestore.FieldValue.serverTimestamp(),
      };

      await firestore()
        .collection('chats')
        .doc(chatId)
        .collection('messages')
        .add(messageData);

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

      // Socket notification
      const chatDoc = await firestore().collection('chats').doc(chatId).get();
      if (chatDoc.exists) {
        const chatData = chatDoc.data();
        const recipientIds = (chatData?.members || []).filter(
          (id: string) => id !== userId,
        );

        emit('send_message', {
          chatId,
          senderId: userId,
          message: messageText,
          memberIds: recipientIds,
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message. Please try again.');
    }
  }, [message, userId, toUserId, chatId, user, emit]);

  // Image picker handler - optimized
  const handlePickImage = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.didCancel || !result.assets?.[0]?.uri) {
      return;
    }

    const uri = result.assets[0].uri;
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: 'chat-image.jpg',
      type: 'image/jpeg',
    } as any);
    formData.append('upload_preset', CLOUD_CONFIG.uploadPreset);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_CONFIG.name}/image/upload`,
        {method: 'POST', body: formData},
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
      }
    } catch (err) {
      console.error('Image upload error:', err);
      Alert.alert('Error', 'Failed to upload image');
    }
  }, [chatId, userId, toUserId, user]);

  // File upload handler - optimized
  const uploadFile = useCallback(
    async (url: string, fileName: string) => {
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
    },
    [chatId, userId, toUserId, user],
  );

  // File download handler - optimized
  const handleFileDownload = useCallback(
    async (fileURL: string, fileName: string) => {
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
        }
      } catch (error) {
        console.error('Download error:', error);
        Alert.alert('Download Error', 'Unable to download file.');
      }
    },
    [],
  );

  // Navigation handlers - memoized
  const handleBack = useCallback(() => {
    navigation.navigate('ChatList');
  }, [navigation]);

  const handleMembersPress = useCallback(() => {
    navigation.navigate('ChatMembers', {
      chatId: chatId,
      currentUserId: userId,
    });
  }, [navigation, chatId, userId]);

  const handleImagePress = useCallback((imageUrl: string) => {
    setSelectedImage(imageUrl);
  }, []);

  const handleImageModalClose = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // Tour handlers - memoized
  const tourHandlers = useMemo(
    () => ({
      handleTourPress: (tourId: string) => {
        const {role} = user || {};
        if (role === 'tour_guide') {
          navigation.navigate('EditTour', {tourId});
        } else {
          navigation.navigate('TourDetail', {tourId});
        }
      },
      handleCloseTourBanner: () => {
        setShowTourBanner(false);
      },
    }),
    [user, navigation],
  );

  // Render item function - memoized
  const renderMessage = useCallback(
    ({item}: {item: Message}) => {
      if (item.type === 'date') {
        return <DateSeparator date={item.date!} />;
      }

      const isCurrentUser = item.from === userId;
      const userInfo = userData[item.from] || {
        name: 'Unknown User',
        avatar: '',
      };

      return (
        <MessageBubble
          message={item}
          isCurrentUser={isCurrentUser}
          userName={userInfo.name}
          messageAvatar={
            isCurrentUser ? user?.avatar?.url || '' : userInfo.avatar
          }
          translationState={translationState[item.id]}
          onTranslate={handleTranslateMessage}
          onImagePress={handleImagePress}
          onFileDownload={handleFileDownload}
          t={t}
        />
      );
    },
    [
      userId,
      userData,
      user,
      translationState,
      handleTranslateMessage,
      handleImagePress,
      handleFileDownload,
      t,
    ],
  );

  // Key extractor - memoized
  const keyExtractor = useCallback((item: Message) => item.id, []);

  // Effects
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // Auto scroll effect
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({animated: true});
      }, 800);
    }
  }, [messages]);

  // Chat data listener
  useEffect(() => {
    const unsubscribeChat = firestore()
      .collection('chats')
      .doc(chatId)
      .onSnapshot(chatDoc => {
        console.log('chatId', chatId);
        const chatData = chatDoc.data();
        if (!chatData) {
          setName('Untitled Group');
        } else if (!chatData.members || chatData.members.length === 0) {
          setName(chatData.name || 'Untitled Group');
        } else if (chatData.members.length === 1) {
          const member = chatData.members.find((id: string) => id !== userId);
          if (member) {
            firestore()
              .collection('users')
              .doc(member)
              .get()
              .then(userDoc => {
                const userData = userDoc.data();
                setName(userData?.name || 'Unknown User');
                setAvatar(userData?.avatar?.url || '');
              });
          } else {
            setName(chatData.name || 'Untitled Group');
            setAvatar(chatData.avatar?.url || '');
          }
        } else {
          setName(chatData.name || 'Untitled Chat');
          setAvatar(chatData.avatar?.url || '');
        }
      });

    return () => unsubscribeChat();
  }, [chatId]);

  // Messages listener
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .orderBy('timestamp', 'asc')
      .onSnapshot(querySnapshot => {
        const msgs: Message[] = [];
        querySnapshot.forEach(doc => {
          msgs.push({id: doc.id, ...doc.data()} as Message);
        });
        setMessages(msgs);
      });

    return () => unsubscribe();
  }, [chatId]);

  // User data fetcher
  useEffect(() => {
    const fetchUserData = async () => {
      const userIds = [...new Set(messages.map(msg => msg.from))];
      if (userIds.length === 0) {
        return;
      }

      const usersSnapshot = await firestore()
        .collection('users')
        .where(firestore.FieldPath.documentId(), 'in', userIds)
        .get();

      const newUserData: UserData = {};
      usersSnapshot.forEach(doc => {
        const data = doc.data();
        newUserData[doc.id] = {
          name: data?.name || data.email || 'Unknown User',
          avatar: data?.avatar?.url || '',
        };
      });

      setUserData(newUserData);
    };

    fetchUserData();
  }, [messages]);

  // Associated tour listener
  useEffect(() => {
    if (!isGroup || !chatId) {
      return;
    }

    console.log('Fetching tours shared with chatId:', chatId);

    const unsubscribe = firestore()
      .collection('tours')
      .where('sharedWith', 'array-contains', chatId)
      .onSnapshot(
        toursSnapshot => {
          console.log('Tours snapshot:', toursSnapshot);

          const tours = toursSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          console.log('Fetched tours:', tours);
          setAssociatedTour(tours[0] || null);
        },
        error => {
          console.error('Error fetching tours:', error);
        },
      );

    // ❗ Trả về hàm unsubscribe để dọn dẹp listener khi component unmount hoặc deps thay đổi
    return () => {
      unsubscribe();
    };
  }, [chatId, isGroup]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

      <ChatHeader
        name={name}
        avatar={avatar}
        onBack={handleBack}
        onMembersPress={handleMembersPress}
        user={user}
        chatId={chatId}
      />

      {/* Pinned Tour Banner */}
      {associatedTour && showTourBanner && (
        <PinnedTourBanner
          tour={associatedTour}
          userRole={user?.role || 'tourist'}
          onTourPress={tourHandlers.handleTourPress}
          onClose={tourHandlers.handleCloseTourBanner}
          t={t}
        />
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}>
        <View style={styles.chatContainer}>
          <FlatList
            ref={flatListRef}
            data={groupedMessages}
            keyExtractor={keyExtractor}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={10}
            initialNumToRender={20}
            getItemLayout={undefined}
          />

          <MessageInput
            message={message}
            onChangeText={setMessage}
            onSend={handleSend}
            onPickImage={handlePickImage}
            onFileUpload={uploadFile}
            t={t}
          />
        </View>
      </KeyboardAvoidingView>

      <ImageModal
        visible={!!selectedImage}
        imageUrl={selectedImage}
        onClose={handleImageModalClose}
      />
    </SafeAreaView>
  );
};

// Same styles as before but organized
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  backButton: {
    padding: 10,
    marginRight: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginLeft: 8,
    marginRight: 14,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  keyboardAvoid: {
    flex: 1,
  },
  chatContainer: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  messagesList: {
    paddingVertical: 20,
    paddingHorizontal: 16,
  },
  dateSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#CBD5E1',
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 6,
    alignItems: 'flex-end',
  },
  sentContainer: {
    justifyContent: 'flex-end',
  },
  receivedContainer: {
    justifyContent: 'flex-start',
  },
  messageAvatar: {
    marginRight: 10,
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  currentUserAvatar: {
    marginLeft: 10,
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  messageContentContainer: {
    maxWidth: '75%',
    marginHorizontal: 4,
  },
  messageSenderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 6,
    marginLeft: 16,
  },
  messageBubble: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    borderBottomRightRadius: 8,
    alignSelf: 'flex-end',
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  sentText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  receivedText: {
    color: '#1E293B',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
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
    maxWidth: '100%',
    minWidth: 200,
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
    flexShrink: 0,
  },
  fileInfo: {
    flex: 1,
    minWidth: 0,
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
    maxWidth: '100%',
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
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8FAFC',
    borderRadius: 28,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    elevation: 1,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
  },
  actionButton: {
    padding: 10,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 120,
    lineHeight: 22,
    fontWeight: '500',
  },
  sendButton: {
    marginLeft: 8,
  },
  sendButtonGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  pinnedTourContainer: {
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  pinnedTourGradient: {
    borderWidth: 2,
    borderColor: 'rgba(74, 198, 208, 0.2)',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
  },
  pinnedTourHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(74, 198, 208, 0.1)',
    backgroundColor: 'rgba(74, 198, 208, 0.05)',
  },
  pinnedTourIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#4AC6D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  pinnedTourHeaderText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#4AC6D0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pinnedTourCloseButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
  },
  pinnedTourContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  tourImageContainer: {
    width: 64,
    height: 64,
    borderRadius: 12,
    overflow: 'hidden',
    marginRight: 16,
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tourImage: {
    width: '100%',
    height: '100%',
  },
  tourImagePlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tourInfo: {
    flex: 1,
    marginRight: 12,
  },
  tourTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  tourDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  tourLocation: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 6,
    flex: 1,
    fontWeight: '500',
  },
  tourMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tourPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4AC6D0',
  },
  tourStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
  },
  tourStatusActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  tourStatusCompleted: {
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  tourStatusText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tourStatusTextActive: {
    color: '#10B981',
  },
  tourStatusTextCompleted: {
    color: '#6366F1',
  },
  tourAction: {
    alignItems: 'center',
    paddingLeft: 12,
  },
  tourActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4AC6D0',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default memo(ChatScreen);
