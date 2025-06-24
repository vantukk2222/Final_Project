import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
  useReducer,
} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  StyleSheet,
  StatusBar,
  SafeAreaView,
  Modal,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {useNavigation} from '@react-navigation/native';
import {useAuth} from '../contexts/AuthContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Loading from './../components/Loading';
import ChatOptionsModal from '../components/ChatOptionsModal';
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from '../contexts/TranslationContext';

// Types
type ChatTabType = 'groups' | 'private';

interface ChatData {
  id: string;
  name?: string;
  isGroup: boolean;
  members: string[];
  memberEmails?: string[];
  avatar?: string;
  lastMessage?: string;
  lastSenderName?: string;
  lastMessageTime?: Date;
  formattedTime?: string;
  pinned: string[];
  muted: string[];
  unreadCount: number;
  roles: Record<string, string>;
  createdAt: Date;
}

interface UserProfile {
  avatarUrl: string;
}

// State types
type StateAction =
  | {type: 'SET_LOADING'; payload: boolean}
  | {type: 'SET_CHATS'; payload: ChatData[]}
  | {type: 'SET_GROUP_CHATS'; payload: ChatData[]}
  | {type: 'SET_PRIVATE_CHATS'; payload: ChatData[]}
  | {type: 'SET_FILTERED_GROUPS'; payload: ChatData[]}
  | {type: 'SET_FILTERED_PRIVATE'; payload: ChatData[]}
  | {type: 'SET_USER_PROFILE'; payload: UserProfile}
  | {type: 'SET_SEARCH_QUERY'; payload: string}
  | {type: 'SET_SEARCH_VISIBLE'; payload: boolean}
  | {type: 'SET_MODAL_VISIBLE'; payload: boolean}
  | {type: 'SET_GROUP_MODAL_VISIBLE'; payload: boolean}
  | {type: 'SET_JOIN_CHAT_CODE_MODAL_VISIBLE'; payload: boolean}
  | {type: 'SET_SELECTED_CHAT'; payload: ChatData | null}
  | {type: 'SET_ACTIVE_TAB'; payload: ChatTabType}
  | {type: 'SET_GROUP_NAME'; payload: string}
  | {type: 'SET_INPUT_EMAILS'; payload: string}
  | {type: 'SET_BUBBLE_MENU_VISIBLE'; payload: boolean}
  | {type: 'RESET_FORM'};

interface ChatListState {
  chats: ChatData[];
  groupChats: ChatData[];
  privateChats: ChatData[];
  filteredGroupChats: ChatData[];
  filteredPrivateChats: ChatData[];
  userProfile: UserProfile;
  loading: boolean;
  searchQuery: string;
  searchVisible: boolean;
  modalVisible: boolean;
  groupModalVisible: boolean;
  joinChatCodeModalVisible: boolean;
  selectedChat: ChatData | null;
  activeTab: ChatTabType;
  groupName: string;
  inputEmails: string;
  bubbleMenuVisible: boolean;
}

const initialState: ChatListState = {
  chats: [],
  groupChats: [],
  privateChats: [],
  filteredGroupChats: [],
  filteredPrivateChats: [],
  userProfile: {avatarUrl: ''},
  loading: false,
  searchQuery: '',
  searchVisible: false,
  modalVisible: false,
  groupModalVisible: false,
  joinChatCodeModalVisible: false,
  selectedChat: null,
  activeTab: 'groups',
  groupName: '',
  inputEmails: '',
  bubbleMenuVisible: false,
};

// Atomic state reducer
const chatListReducer = (
  state: ChatListState,
  action: StateAction,
): ChatListState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {...state, loading: action.payload};
    case 'SET_CHATS':
      return {...state, chats: action.payload};
    case 'SET_GROUP_CHATS':
      return {...state, groupChats: action.payload};
    case 'SET_PRIVATE_CHATS':
      return {...state, privateChats: action.payload};
    case 'SET_FILTERED_GROUPS':
      return {...state, filteredGroupChats: action.payload};
    case 'SET_FILTERED_PRIVATE':
      return {...state, filteredPrivateChats: action.payload};
    case 'SET_USER_PROFILE':
      return {...state, userProfile: action.payload};
    case 'SET_SEARCH_QUERY':
      return {...state, searchQuery: action.payload};
    case 'SET_SEARCH_VISIBLE':
      return {...state, searchVisible: action.payload};
    case 'SET_MODAL_VISIBLE':
      return {...state, modalVisible: action.payload};
    case 'SET_GROUP_MODAL_VISIBLE':
      return {...state, groupModalVisible: action.payload};
    case 'SET_JOIN_CHAT_CODE_MODAL_VISIBLE':
      return {...state, joinChatCodeModalVisible: action.payload};
    case 'SET_SELECTED_CHAT':
      return {...state, selectedChat: action.payload};
    case 'SET_ACTIVE_TAB':
      return {...state, activeTab: action.payload};
    case 'SET_GROUP_NAME':
      return {...state, groupName: action.payload};
    case 'SET_INPUT_EMAILS':
      return {...state, inputEmails: action.payload};
    case 'SET_BUBBLE_MENU_VISIBLE':
      return {...state, bubbleMenuVisible: action.payload};
    case 'RESET_FORM':
      return {
        ...state,
        groupName: '',
        inputEmails: '',
        groupModalVisible: false,
        joinChatCodeModalVisible: false,
      };
    default:
      return state;
  }
};

// Constants
const {width} = Dimensions.get('window');
const ANIMATION_DURATION = 500;
const BATCH_SIZE = 10;

// Memoized utility functions - outside component
const formatMessageTime = (date: Date): string => {
  if (!date) {
    return '';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'now';
  }
  if (diffInSeconds < 3600) {
    return `${Math.floor(diffInSeconds / 60)}m`;
  }
  if (diffInSeconds < 86400) {
    return `${Math.floor(diffInSeconds / 3600)}h`;
  }
  if (diffInSeconds < 604800) {
    return `${Math.floor(diffInSeconds / 86400)}d`;
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const sortChatsWithPinned = (
  chats: ChatData[],
  currentUserId: string,
): ChatData[] => {
  return [...chats].sort((a, b) => {
    const aIsPinned = a.pinned?.includes(currentUserId);
    const bIsPinned = b.pinned?.includes(currentUserId);

    if (aIsPinned && !bIsPinned) {
      return -1;
    }
    if (!aIsPinned && bIsPinned) {
      return 1;
    }

    if (a.lastMessageTime && b.lastMessageTime) {
      return b.lastMessageTime.getTime() - a.lastMessageTime.getTime();
    }
    if (a.lastMessageTime) {
      return -1;
    }
    if (b.lastMessageTime) {
      return 1;
    }

    return b.createdAt && a.createdAt
      ? b.createdAt.getTime() - a.createdAt.getTime()
      : 0;
  });
};

// Custom hooks
const useStableRefs = () => {
  const refs = useRef({
    fadeAnim: new Animated.Value(0),
    slideAnim: new Animated.Value(50),
    unsubscribeChats: null as (() => void) | null,
    unsubscribeProfile: null as (() => void) | null,
    isInitialized: false,
    lastChatsHash: '',
  });

  return refs.current;
};

const useAnimations = (refs: ReturnType<typeof useStableRefs>) => {
  const startEntranceAnimation = useCallback(() => {
    if (!refs.isInitialized) {
      Animated.parallel([
        Animated.timing(refs.fadeAnim, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(refs.slideAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
      refs.isInitialized = true;
    }
  }, [refs]);

  return {startEntranceAnimation};
};

// Memoized Components
const ChatTabNavigation = memo(
  ({
    activeTab,
    onTabChange,
    groupCount,
    privateCount,
    t,
  }: {
    activeTab: ChatTabType;
    onTabChange: (tab: ChatTabType) => void;
    groupCount: number;
    privateCount: number;
    t: (key: string) => string;
  }) => {
    const tabs = useMemo(
      () => [
        {
          key: 'groups' as const,
          label: t('chat.travel'),
          shortLabel: t('chat.travel'),
          icon: 'group',
          count: groupCount,
          colors: ['#4AC6D0', '#3BB8C3'],
        },
        {
          key: 'private' as const,
          label: t('chat.chats'),
          shortLabel: t('chat.chats'),
          icon: 'chat',
          count: privateCount,
          colors: ['#10B981', '#059669'],
        },
      ],
      [groupCount, privateCount, t],
    );

    const handleTabPress = useCallback(
      (tabKey: ChatTabType) => {
        onTabChange(tabKey);
      },
      [onTabChange],
    );

    return (
      <View style={styles.tabContainer}>
        <View style={styles.tabsWrapper}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabButtonContainer}
              onPress={() => handleTabPress(tab.key)}
              activeOpacity={0.8}>
              {activeTab === tab.key ? (
                <LinearGradient
                  colors={tab.colors}
                  style={[styles.tabButton, styles.tabButtonActive]}>
                  <View style={styles.tabContent}>
                    <View style={styles.activeIconContainer}>
                      <Icon name={tab.icon} size={18} color="#fff" />
                    </View>
                    <Text style={styles.tabButtonTextActive}>
                      {tab.label} ({tab.count})
                    </Text>
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.tabButton}>
                  <View style={styles.tabContent}>
                    <Icon name={tab.icon} size={16} color="#64748B" />
                    <Text style={styles.tabButtonText}>
                      {tab.shortLabel} ({tab.count})
                    </Text>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.activeTab === nextProps.activeTab &&
      prevProps.groupCount === nextProps.groupCount &&
      prevProps.privateCount === nextProps.privateCount
    );
  },
);

const HeaderComponent = memo(
  ({
    searchVisible,
    searchQuery,
    avatarUrl,
    conversationCount,
    onSearchToggle,
    onSearchChange,
    onSearchClose,
    onProfilePress,
    t,
  }: {
    searchVisible: boolean;
    searchQuery: string;
    avatarUrl: string;
    conversationCount: number;
    onSearchToggle: () => void;
    onSearchChange: (query: string) => void;
    onSearchClose: () => void;
    onProfilePress: () => void;
    t: (key: string) => string;
  }) => (
    <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.header}>
      {!searchVisible ? (
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerTitle}>{t('chat.travelChats')}</Text>
            <Text style={styles.headerSubtitle}>
              {conversationCount} {t('chat.conversation').toUpperCase()}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerButton}
              onPress={onSearchToggle}>
              <Icon name="search" size={22} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.profileContainer}
              onPress={onProfilePress}>
              <Image
                source={
                  avatarUrl
                    ? {uri: avatarUrl}
                    : require('../assets/default-avatar.png')
                }
                style={styles.profileAvatar}
              />
              <View style={styles.onlineIndicator} />
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Icon name="search" size={20} color="rgba(255,255,255,0.7)" />
            <TextInput
              style={styles.searchInput}
              placeholder={t('chat.searchConversations')}
              placeholderTextColor="rgba(255,255,255,0.7)"
              value={searchQuery}
              onChangeText={onSearchChange}
              autoFocus
            />
          </View>
          <TouchableOpacity
            style={styles.searchCloseButton}
            onPress={onSearchClose}>
            <Icon name="close" size={22} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.searchVisible === nextProps.searchVisible &&
      prevProps.searchQuery === nextProps.searchQuery &&
      prevProps.avatarUrl === nextProps.avatarUrl &&
      prevProps.conversationCount === nextProps.conversationCount
    );
  },
);

const GroupChatItem = memo(
  ({
    item,
    userId,
    onPress,
    onLongPress,
    t,
  }: {
    item: ChatData;
    userId: string;
    onPress: () => void;
    onLongPress: () => void;
    t: (key: string) => string;
  }) => {
    const chatName = item.name || t('chat.defaultGroupName');
    const memberCount = item.members?.length || 0;
    const isPinned = item.pinned?.includes(userId);
    const isMuted = item.muted?.includes(userId);

    const lastMessagePreview = useMemo(() => {
      if (item.lastSenderName && userId === item.lastSenderName) {
        return t('chat.you') + ': ' + (item.lastMessage || '');
      } else if (item.lastSenderName) {
        return item.lastSenderName + ': ' + (item.lastMessage || '');
      }
      return t('chat.readyForAdventure');
    }, [item.lastSenderName, item.lastMessage, userId, t]);

    return (
      <Animated.View style={styles.chatItemWrapper}>
        <TouchableOpacity
          style={[
            styles.chatItem,
            styles.groupChatItem,
            isPinned && styles.pinnedChatItem,
          ]}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={300}
          activeOpacity={0.7}>
          {isPinned && (
            <View style={styles.pinnedIndicator}>
              <Icon name="push-pin" size={16} color="#F59E0B" />
            </View>
          )}

          <View style={styles.chatAvatarContainer}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.groupAvatarGradient}>
              <Icon name="group" size={28} color="#fff" />
            </LinearGradient>
            <View style={styles.memberCountBadge}>
              <Text style={styles.memberCountText}>{memberCount}</Text>
            </View>
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <View style={styles.chatTitleContainer}>
                <Text style={styles.chatName} numberOfLines={1}>
                  {chatName}
                </Text>
                {isPinned && (
                  <Icon
                    name="push-pin"
                    size={14}
                    color="#F59E0B"
                    style={styles.pinnedIcon}
                  />
                )}
              </View>
              <View style={styles.chatMeta}>
                {item.formattedTime && (
                  <Text style={styles.timeText}>{item.formattedTime}</Text>
                )}
                <View style={styles.groupTypeBadge}>
                  <Text style={styles.groupTypeBadgeText}>GROUP</Text>
                </View>
              </View>
            </View>

            <View style={styles.messageContainer}>
              <Text style={styles.lastMessage} numberOfLines={2}>
                {isMuted && (
                  <Icon name="notifications-off" size={14} color="#94A3B8" />
                )}
                {lastMessagePreview}
              </Text>

              {item.unreadCount > 0 && !isMuted && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.chatActions}>
            <Icon name="chevron-right" size={20} color="#C1C7CD" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.name === nextProps.item.name &&
      prevProps.item.lastMessage === nextProps.item.lastMessage &&
      prevProps.item.lastSenderName === nextProps.item.lastSenderName &&
      prevProps.item.formattedTime === nextProps.item.formattedTime &&
      prevProps.item.unreadCount === nextProps.item.unreadCount &&
      JSON.stringify(prevProps.item.pinned) ===
        JSON.stringify(nextProps.item.pinned) &&
      JSON.stringify(prevProps.item.muted) ===
        JSON.stringify(nextProps.item.muted)
    );
  },
);

const PrivateChatItem = memo(
  ({
    item,
    userId,
    onPress,
    onLongPress,
    t,
  }: {
    item: ChatData;
    userId: string;
    onPress: () => void;
    onLongPress: () => void;
    t: (key: string) => string;
  }) => {
    const otherEmails = item.memberEmails?.filter(
      (email, emailIndex) => item.members[emailIndex] !== userId,
    );
    const chatName = otherEmails?.join(', ') || t('chat.privateChat');
    const isPinned = item.pinned?.includes(userId);
    const isMuted = item.muted?.includes(userId);

    const lastMessagePreview = useMemo(() => {
      if (item.lastSenderName && userId === item.lastSenderName) {
        return t('chat.you') + ': ' + (item.lastMessage || '');
      } else if (item.lastSenderName) {
        return item.lastSenderName + ': ' + (item.lastMessage || '');
      }
      return t('chat.letsExploreTogether');
    }, [item.lastSenderName, item.lastMessage, userId, t]);

    return (
      <Animated.View style={styles.chatItemWrapper}>
        <TouchableOpacity
          style={[
            styles.chatItem,
            styles.privateChatItem,
            isPinned && styles.pinnedChatItem,
          ]}
          onPress={onPress}
          onLongPress={onLongPress}
          delayLongPress={300}
          activeOpacity={0.7}>
          {isPinned && (
            <View style={styles.pinnedIndicator}>
              <Icon name="push-pin" size={16} color="#F59E0B" />
            </View>
          )}

          <View style={styles.chatAvatarContainer}>
            <Image
              source={
                item.avatar
                  ? {uri: item.avatar}
                  : require('../assets/default-avatar.png')
              }
              style={styles.chatAvatar}
            />
            <View style={styles.onlineIndicator} />
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <View style={styles.chatTitleContainer}>
                <Text style={styles.chatName} numberOfLines={1}>
                  {chatName}
                </Text>
                {isPinned && (
                  <Icon
                    name="push-pin"
                    size={14}
                    color="#F59E0B"
                    style={styles.pinnedIcon}
                  />
                )}
              </View>
              <View style={styles.chatMeta}>
                {item.formattedTime && (
                  <Text style={styles.timeText}>{item.formattedTime}</Text>
                )}
                <View style={styles.privateTypeBadge}>
                  <Text style={styles.privateTypeBadgeText}>PRIVATE</Text>
                </View>
              </View>
            </View>

            <View style={styles.messageContainer}>
              <Text style={styles.lastMessage} numberOfLines={2}>
                {isMuted && (
                  <Icon name="volume-off" size={14} color="#94A3B8" />
                )}
                {lastMessagePreview}
              </Text>

              {item.unreadCount > 0 && !isMuted && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>
                    {item.unreadCount > 99 ? '99+' : item.unreadCount}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.chatActions}>
            <Icon name="chevron-right" size={20} color="#C1C7CD" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.avatar === nextProps.item.avatar &&
      prevProps.item.lastMessage === nextProps.item.lastMessage &&
      prevProps.item.lastSenderName === nextProps.item.lastSenderName &&
      prevProps.item.formattedTime === nextProps.item.formattedTime &&
      prevProps.item.unreadCount === nextProps.item.unreadCount &&
      JSON.stringify(prevProps.item.memberEmails) ===
        JSON.stringify(nextProps.item.memberEmails) &&
      JSON.stringify(prevProps.item.pinned) ===
        JSON.stringify(nextProps.item.pinned) &&
      JSON.stringify(prevProps.item.muted) ===
        JSON.stringify(nextProps.item.muted)
    );
  },
);

const EmptyListComponent = memo(
  ({
    type,
    userRole,
    fadeAnim,
    slideAnim,
    onCreatePress,
    t,
  }: {
    type: ChatTabType;
    userRole: string;
    fadeAnim: Animated.Value;
    slideAnim: Animated.Value;
    onCreatePress: () => void;
    t: (key: string) => string;
  }) => (
    <Animated.View
      style={[
        styles.emptyContainer,
        {
          opacity: fadeAnim,
          transform: [{translateY: slideAnim}],
        },
      ]}>
      <LinearGradient
        colors={['rgba(74, 198, 208, 0.1)', 'rgba(74, 198, 208, 0.05)']}
        style={styles.emptyGradient}>
        <View style={styles.emptyIconContainer}>
          <Icon
            name={type === 'groups' ? 'group' : 'chat'}
            size={80}
            color="#4AC6D0"
          />
        </View>
        <Text style={styles.emptyText}>
          {type === 'groups'
            ? t('chat.noTravelGroupsYet')
            : t('chat.noPrivateChatsYet')}
        </Text>
        <Text style={styles.emptySubText}>
          {type === 'groups'
            ? t('chat.createGroupToPlant')
            : t('chat.startPrivateConversation')}
        </Text>
        {userRole === 'tour_guide' && (
          <TouchableOpacity
            style={styles.startChatButton}
            onPress={onCreatePress}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.startChatGradient}>
              <Icon name="add" size={20} color="#FFF" />
              <Text style={styles.startChatText}>
                {type === 'groups'
                  ? t('chat.createGroup')
                  : t('chat.startChat')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Animated.View>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.type === nextProps.type &&
      prevProps.userRole === nextProps.userRole
    );
  },
);

const CreateChatModal = memo(
  ({
    visible,
    userRole,
    groupName,
    inputEmails,
    onClose,
    onGroupNameChange,
    onEmailsChange,
    onSubmit,
    t,
  }: {
    visible: boolean;
    userRole: string;
    groupName: string;
    inputEmails: string;
    onClose: () => void;
    onGroupNameChange: (text: string) => void;
    onEmailsChange: (text: string) => void;
    onSubmit: () => void;
    t: (key: string) => string;
  }) => (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Animated.View style={styles.modalContainer}>
          <LinearGradient
            colors={['#4AC6D0', '#3BB8C3']}
            style={styles.modalHeader}>
            <Icon name="add-circle" size={24} color="#FFF" />
            <Text style={styles.modalHeaderText}>
              {userRole === 'tour_guide'
                ? t('chat.createTravelGroup')
                : t('chat.startNewChat')}
            </Text>
          </LinearGradient>

          <View style={styles.modalContent}>
            {userRole === 'tour_guide' && (
              <View style={styles.inputWrapper}>
                <Icon name="label" size={20} color="#4AC6D0" />
                <TextInput
                  placeholder={t('chat.groupNameOptional')}
                  value={groupName}
                  onChangeText={onGroupNameChange}
                  style={styles.inputField}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Icon name="email" size={20} color="#4AC6D0" />
              <TextInput
                placeholder={
                  userRole === 'tour_guide'
                    ? t('chat.enterEmailsCommaSeparated')
                    : t('chat.enterEmailAddress')
                }
                value={inputEmails}
                onChangeText={onEmailsChange}
                style={styles.inputField}
                placeholderTextColor="#94A3B8"
                multiline={userRole === 'tour_guide'}
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                <Text style={styles.cancelButtonText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.confirmButton} onPress={onSubmit}>
                <LinearGradient
                  colors={['#4AC6D0', '#3BB8C3']}
                  style={styles.confirmButtonGradient}>
                  <Icon name="check" size={18} color="#FFF" />
                  <Text style={styles.confirmButtonText}>
                    {t('common.create')}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.visible === nextProps.visible &&
      prevProps.groupName === nextProps.groupName &&
      prevProps.inputEmails === nextProps.inputEmails &&
      prevProps.userRole === nextProps.userRole
    );
  },
);
const JoinChatByCodeModal = memo(
  ({
    visible,
    onClose,
    onJoin,
    t,
  }: {
    visible: boolean;
    onClose: () => void;
    onJoin: (code: string) => void;
    t: (key: string) => string;
  }) => {
    const [code, setCode] = useState('');

    return (
      <Modal visible={visible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={styles.modalContainer}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.modalHeader}>
              <Icon name="code" size={24} color="#FFF" />
              <Text style={styles.modalHeaderText}>
                {t('chat.usecodetojoin')}
              </Text>
            </LinearGradient>

            <View style={styles.modalContent}>
              <View style={styles.inputWrapper}>
                <Icon name="vpn-key" size={20} color="#4AC6D0" />
                <TextInput
                  placeholder={t('chat.enterChatCode')}
                  value={code}
                  onChangeText={setCode}
                  style={styles.inputField}
                  placeholderTextColor="#94A3B8"
                />
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    onClose();
                    setCode('');
                  }}>
                  <Text style={styles.cancelButtonText}>
                    {t('common.cancel')}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.confirmButton}
                  onPress={() => {
                    if (code.trim() === '') {
                      Alert.alert(t('common.error'), t('chat.enterChatCode'));
                      return;
                    }
                    onJoin(code.trim());
                    setCode('');
                  }}>
                  <LinearGradient
                    colors={['#4AC6D0', '#3BB8C3']}
                    style={styles.confirmButtonGradient}>
                    <Icon name="check" size={18} color="#FFF" />
                    <Text style={styles.confirmButtonText}>
                      {t('call.join')}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>
        </View>
      </Modal>
    );
  },
);

// Bubble menu component
const BubbleMenu = memo(
  ({
    visible,
    onCreateGroup,
    onTourManagement,
    onClose,
    t,
  }: {
    visible: boolean;
    onCreateGroup: () => void;
    onTourManagement: () => void;
    onClose: () => void;
    t: (key: string) => string;
  }) => {
    if (!visible) {
      return null;
    }

    return (
      <>
        <TouchableOpacity
          style={styles.bubbleOverlay}
          onPress={onClose}
          activeOpacity={1}
        />
        <Animated.View style={styles.bubbleMenu}>
          <TouchableOpacity
            style={styles.bubbleOption}
            onPress={onCreateGroup}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.bubbleOptionGradient}>
              <Icon name="group-add" size={20} color="#FFF" />
              <Text style={styles.bubbleOptionText}>
                {t('chat.createGroup')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.bubbleOption}
            onPress={onTourManagement}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#10B981', '#059669']}
              style={styles.bubbleOptionGradient}>
              <Icon name="tour" size={20} color="#FFF" />
              <Text style={styles.bubbleOptionText}>
                {t('tour.management.title')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>
      </>
    );
  },
);

// Main Component
const ChatListScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const {user, role} = useAuth();
  const {t} = useTranslation();
  const [state, dispatch] = useReducer(chatListReducer, initialState);
  const refs = useStableRefs();
  const {startEntranceAnimation} = useAnimations(refs);

  // Memoized computed values
  const computedValues = useMemo(() => {
    const currentData =
      state.activeTab === 'groups'
        ? state.filteredGroupChats
        : state.filteredPrivateChats;
    return {
      currentData,
      conversationCount: currentData.length,
      canCreateChat: role === 'tour_guide',
    };
  }, [
    state.activeTab,
    state.filteredGroupChats,
    state.filteredPrivateChats,
    role,
  ]);

  // Stable navigation handlers
  const navigationHandlers = useMemo(
    () => ({
      handleChatPress: (item: ChatData) => {
        navigation.navigate('Chat', {
          chatId: item.id,
          toUserId: item.members.find(id => id !== user?.uid),
          name: item.isGroup
            ? item.name || t('chat.defaultGroupName')
            : item.memberEmails
                ?.filter((email, index) => item.members[index] !== user?.uid)
                ?.join(', ') || t('chat.privateChat'),
          avatar: item.avatar,
          currentAvatar: state.userProfile.avatarUrl,
          isGroup: item.isGroup,
        });
      },
      handleProfilePress: () => navigation.navigate('UserProfile'),
      handleChatMembersPress: (chatId: string) => {
        navigation.navigate('ChatMembers', {
          chatId,
          currentUserId: user?.uid,
        });
      },
    }),
    [navigation, user?.uid, state.userProfile.avatarUrl, t],
  );

  // Form handlers - memoized
  const formHandlers = useMemo(
    () => ({
      handleSearchToggle: () =>
        dispatch({type: 'SET_SEARCH_VISIBLE', payload: true}),
      handleSearchChange: (query: string) =>
        dispatch({type: 'SET_SEARCH_QUERY', payload: query}),
      handleSearchClose: () => {
        dispatch({type: 'SET_SEARCH_VISIBLE', payload: false});
        dispatch({type: 'SET_SEARCH_QUERY', payload: ''});
      },
      handleTabChange: (tab: ChatTabType) =>
        dispatch({type: 'SET_ACTIVE_TAB', payload: tab}),
      handleModalToggle: () =>
        dispatch({
          type: 'SET_GROUP_MODAL_VISIBLE',
          payload: !state.groupModalVisible,
        }),
      handleJoinChatCodeModalToggle: () =>
        dispatch({
          type: 'SET_JOIN_CHAT_CODE_MODAL_VISIBLE',
          payload: !state.joinChatCodeModalVisible,
        }),
      handleFabPress: () => {
        dispatch({
          type: 'SET_BUBBLE_MENU_VISIBLE',
          payload: !state.bubbleMenuVisible,
        });
      },
      handleBubbleMenuClose: () => {
        dispatch({type: 'SET_BUBBLE_MENU_VISIBLE', payload: false});
      },
      handleCreateGroupFromBubble: () => {
        dispatch({type: 'SET_BUBBLE_MENU_VISIBLE', payload: false});
        dispatch({type: 'SET_GROUP_MODAL_VISIBLE', payload: true});
      },
      handleTourManagement: () => {
        dispatch({type: 'SET_BUBBLE_MENU_VISIBLE', payload: false});
        navigation.navigate('TourManagement');
      },
      handleJoinChatByCode: async (code: string) => {
        dispatch({type: 'SET_LOADING', payload: true});
        try {
          if (!code) {
            dispatch({type: 'SET_LOADING', payload: false});
            Alert.alert(t('common.error'), t('chat.enterChatCode'));
            return;
          }
          // chats là 1 collections, và mỗi chat là 1 document trong collection đó, trong đó mỗi document có field  là code,
          // và code này là duy nhất cho mỗi chat
          const chatDoc = await firestore().collection('codes').doc(code).get();
          if (!chatDoc || !chatDoc.exists) {
            dispatch({type: 'SET_LOADING', payload: false});
            Alert.alert(t('common.error'), t('chat.chatNotFound'));
            return;
          }
          // Check if chat exists and user is not already a member

          if (!chatDoc.exists) {
            Alert.alert(t('common.error'), t('chat.chatNotFound'));
            return;
          }

          const codeData = chatDoc.data();
          if (!codeData) {
            Alert.alert(t('common.error'), t('chat.chatNotFound'));
            return;
          }

          const chatId = codeData.chatId || '';
          if (chatId === '') {
            Alert.alert(t('common.error'), t('chat.chatNotFound'));
            return;
          }
          const chatSnapshot = await firestore()
            .collection('chats')
            .doc(chatId)
            .get();
          if (!chatSnapshot.exists) {
            Alert.alert(t('common.error'), t('chat.chatNotFound'));
            return;
          }
          const chatData = chatSnapshot.data() as ChatData;

          // Add user to chat members
          const memberIds = chatData.members || [];
          if (memberIds.includes(user?.uid)) {
            dispatch({type: 'SET_LOADING', payload: false});
            Alert.alert(t('common.error'), t('chat.alreadyMember'));
            return;
          }

          memberIds.push(user?.uid);
          await firestore()
            .collection('chats')
            .doc(chatId)
            .update({
              members: memberIds,
              roles: {
                ...chatData.roles,
                [user?.uid]: 'member',
              },
            });

          dispatch({type: 'SET_LOADING', payload: false});
          dispatch({type: 'SET_JOIN_CHAT_CODE_MODAL_VISIBLE', payload: false});
        } catch (error) {
          console.error('Error joining chat by code:', error);
          dispatch({type: 'SET_LOADING', payload: false});
          Alert.alert(t('common.error'), t('chat.joinChatError'));
        } finally {
          dispatch({type: 'RESET_FORM'});
        }
      },
      handleModalClose: () => dispatch({type: 'RESET_FORM'}),
      handleGroupNameChange: (text: string) =>
        dispatch({type: 'SET_GROUP_NAME', payload: text}),
      handleEmailsChange: (text: string) =>
        dispatch({type: 'SET_INPUT_EMAILS', payload: text}),
    }),
    [
      state.groupModalVisible,
      state.joinChatCodeModalVisible,
      state.bubbleMenuVisible,
      user?.uid,
      navigation,
      t,
    ],
  );

  // Chat interaction handlers - memoized
  const chatHandlers = useMemo(
    () => ({
      handleLongPress: (item: ChatData) => {
        dispatch({type: 'SET_SELECTED_CHAT', payload: item});
        dispatch({type: 'SET_MODAL_VISIBLE', payload: true});
      },
      handleCloseModal: () =>
        dispatch({type: 'SET_MODAL_VISIBLE', payload: false}),
    }),
    [],
  );

  // Data processing functions - optimized
  const processChatsData = useCallback(
    async (querySnapshot: any): Promise<ChatData[]> => {
      const chatData: ChatData[] = [];
      const userIdsSet = new Set<string>();

      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        const processedData: ChatData = {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate
            ? data.createdAt.toDate()
            : data.createdAt,
          lastMessageTime: data.lastMessageTime?.toDate
            ? data.lastMessageTime.toDate()
            : null,
          pinned: data.pinned || [],
          muted: data.muted || [],
          unreadCount: data.unreadCount || 0,
        };

        chatData.push(processedData);
        data.members?.forEach((id: string) => userIdsSet.add(id));
      });

      const userIds = Array.from(userIdsSet);
      if (userIds.length === 0) {
        return [];
      }

      // Process users in batches - optimized
      const userMap: Record<
        string,
        {name: string; email: string; avatar?: string}
      > = {};

      for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
        const batch = userIds.slice(i, i + BATCH_SIZE);
        const usersSnapshot = await firestore()
          .collection('users')
          .where(firestore.FieldPath.documentId(), 'in', batch)
          .get();

        usersSnapshot.forEach(doc => {
          const userData = doc.data();
          userMap[doc.id] = {
            name: userData?.name || userData.email,
            email: userData.email,
            avatar: userData?.avatar?.secure_url || userData?.avatar?.url,
          };
        });
      }

      return chatData.map(chat => {
        const otherMemberId = chat.members.find(
          (id: string) => id !== user?.uid,
        );
        return {
          ...chat,
          memberEmails: chat.members.map(
            (id: string) => userMap[id]?.name || userMap[id]?.email || id,
          ),
          avatar: otherMemberId ? userMap[otherMemberId]?.avatar : null,
          formattedTime: chat.lastMessageTime
            ? formatMessageTime(chat.lastMessageTime)
            : '',
        };
      });
    },
    [user?.uid],
  );

  // Business logic handlers - memoized
  const businessHandlers = useMemo(
    () => ({
      handleCreateChat: async () => {
        dispatch({type: 'SET_LOADING', payload: true});

        const emails = state.inputEmails
          .split(',')
          .map(e => e.trim().toLowerCase())
          .filter(Boolean);

        if (emails.length === 0) {
          dispatch({type: 'SET_LOADING', payload: false});
          Alert.alert(t('common.error'), t('chat.enterAtLeastOneEmail'));
          return;
        }

        try {
          const usersSnapshot = await firestore()
            .collection('users')
            .where('email', 'in', emails)
            .get();

          const users = usersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          }));
          const foundEmails = users.map(u => u.email?.toLowerCase());
          const notFound = emails.filter(email => !foundEmails.includes(email));

          if (notFound.length > 0) {
            // dispatch({type: 'RESET_FORM'});
            // dispatch({type: 'SET_LOADING', payload: false});
            Alert.alert(
              t('common.error'),
              `${t('chat.emailsNotFound')}: ${notFound.join(', ')}`,
            );
            return;
          }

          const memberIds = users.map(u => u.id);
          if (!memberIds.includes(user?.uid)) {
            memberIds.push(user?.uid);
          }

          const roles = memberIds.reduce((acc, memberId) => {
            acc[memberId] = memberId === user?.uid ? 'owner' : 'member';
            return acc;
          }, {} as Record<string, string>);

          if (role === 'tourist' && emails.length === 1) {
            // Create private chat for tourists
            const chatId = [memberIds[0], memberIds[1]].sort().join('_');
            await firestore().collection('chats').doc(chatId).set(
              {
                isGroup: false,
                members: memberIds,
                roles,
                pinned: [],
                muted: [],
                createdAt: firestore.FieldValue.serverTimestamp(),
                createdBy: user?.uid,
              },
              {merge: true},
            );
          } else {
            // Create group chat for tour guides or multiple members
            await firestore()
              .collection('chats')
              .add({
                isGroup: true,
                members: memberIds,
                roles,
                name: state.groupName || t('chat.defaultGroupName'),
                pinned: [],
                muted: [],
                createdAt: firestore.FieldValue.serverTimestamp(),
                createdBy: user?.uid,
              });
          }

          dispatch({type: 'RESET_FORM'});
        } catch (err) {
          console.error(err);
          Alert.alert(t('common.error'), t('chat.failedToCreateChat'));
          dispatch({type: 'RESET_FORM'});
        } finally {
          dispatch({type: 'SET_LOADING', payload: false});
        }
      },

      handlePin: async (id: string) => {
        dispatch({type: 'SET_MODAL_VISIBLE', payload: false});
        try {
          dispatch({type: 'SET_LOADING', payload: true});
          const chatRef = firestore().collection('chats').doc(id);
          const chatDoc = await chatRef.get();

          if (!chatDoc.exists) {
            Alert.alert(t('common.error'), t('chat.chatNotFound'));
            return;
          }

          const chatData = chatDoc.data();
          const pinnedUsers = chatData?.pinned || [];

          if (pinnedUsers.includes(user?.uid)) {
            const updatedPinned = pinnedUsers.filter(
              (uid: string) => uid !== user?.uid,
            );
            await chatRef.update({pinned: updatedPinned});
          } else {
            pinnedUsers.push(user?.uid);
            await chatRef.update({pinned: pinnedUsers});
          }
        } catch (error) {
          console.error('Error pinning/unpinning chat:', error);
          Alert.alert(t('common.error'), t('chat.failedToUpdatePinStatus'));
        } finally {
          dispatch({type: 'SET_LOADING', payload: false});
        }
      },

      handleMute: async (id: string) => {
        dispatch({type: 'SET_MODAL_VISIBLE', payload: false});
        try {
          dispatch({type: 'SET_LOADING', payload: true});
          const chatRef = firestore().collection('chats').doc(id);
          const chatDoc = await chatRef.get();

          if (!chatDoc.exists) {
            Alert.alert(t('common.error'), t('chat.chatNotFound'));
            return;
          }

          const chatData = chatDoc.data();
          const mutedUsers = chatData?.muted || [];

          if (mutedUsers.includes(user?.uid)) {
            const updatedMuted = mutedUsers.filter(
              (uid: string) => uid !== user?.uid,
            );
            await chatRef.update({muted: updatedMuted});
          } else {
            mutedUsers.push(user?.uid);
            await chatRef.update({muted: mutedUsers});
          }
        } catch (error) {
          console.error('Error muting/unmuting chat:', error);
          Alert.alert(t('common.error'), t('chat.failedToUpdateMuteStatus'));
        } finally {
          dispatch({type: 'SET_LOADING', payload: false});
        }
      },

      handleDelete: async (id: string) => {
        dispatch({type: 'SET_MODAL_VISIBLE', payload: false});
        Alert.alert(t('chat.deleteChat'), t('chat.deleteChatConfirmation'), [
          {text: t('common.cancel'), style: 'cancel'},
          {
            text: t('common.delete'),
            style: 'destructive',
            onPress: async () => {
              try {
                dispatch({type: 'SET_LOADING', payload: true});
                await firestore().collection('chats').doc(id).delete();
              } catch (error) {
                console.error('Error deleting chat:', error);
                Alert.alert(t('common.error'), t('chat.failedToDeleteChat'));
              } finally {
                dispatch({type: 'SET_LOADING', payload: false});
              }
            },
          },
        ]);
      },
    }),
    [state.inputEmails, state.groupName, user?.uid, role, t],
  );

  // Render functions - memoized
  const renderFunctions = useMemo(
    () => ({
      renderGroupItem: ({item}: {item: ChatData}) => (
        <GroupChatItem
          item={item}
          userId={user?.uid || ''}
          onPress={() => navigationHandlers.handleChatPress(item)}
          onLongPress={() => chatHandlers.handleLongPress(item)}
          t={t}
        />
      ),
      renderPrivateItem: ({item}: {item: ChatData}) => (
        <PrivateChatItem
          item={item}
          userId={user?.uid || ''}
          onPress={() => navigationHandlers.handleChatPress(item)}
          onLongPress={() => chatHandlers.handleLongPress(item)}
          t={t}
        />
      ),
    }),
    [user?.uid, navigationHandlers, chatHandlers, t],
  );

  const keyExtractor = useCallback((item: ChatData) => item.id, []);
  const ItemSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  // Effects
  useEffect(() => {
    startEntranceAnimation();
  }, [startEntranceAnimation]);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }

    dispatch({type: 'SET_LOADING', payload: true});

    // Profile listener
    refs.unsubscribeProfile = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        doc => {
          const data = doc.data();
          if (data) {
            dispatch({
              type: 'SET_USER_PROFILE',
              payload: {
                avatarUrl: data?.avatar?.secure_url || data?.avatar?.url || '',
              },
            });
          }
        },
        error => console.error('Profile snapshot error:', error),
      );

    // Chats listener
    refs.unsubscribeChats = firestore()
      .collection('chats')
      .where('members', 'array-contains', user.uid)
      .onSnapshot(
        async querySnapshot => {
          try {
            const enrichedChats = await processChatsData(querySnapshot);

            // Hash comparison to prevent unnecessary updates
            const chatsHash = JSON.stringify(
              enrichedChats.map(c => ({
                id: c.id,
                lastMessageTime: c.lastMessageTime,
              })),
            );
            if (refs.lastChatsHash !== chatsHash) {
              refs.lastChatsHash = chatsHash;

              const groups = sortChatsWithPinned(
                enrichedChats.filter(chat => chat.isGroup === true),
                user.uid,
              );
              const privates = sortChatsWithPinned(
                enrichedChats.filter(chat => chat.isGroup === false),
                user.uid,
              );

              dispatch({type: 'SET_CHATS', payload: enrichedChats});
              dispatch({type: 'SET_GROUP_CHATS', payload: groups});
              dispatch({type: 'SET_PRIVATE_CHATS', payload: privates});
              dispatch({type: 'SET_FILTERED_GROUPS', payload: groups});
              dispatch({type: 'SET_FILTERED_PRIVATE', payload: privates});
            }
          } catch (error) {
            console.error('Error loading chats:', error);
            // Alert.alert('Error', 'Failed to load chat list. Please try again.');
          } finally {
            dispatch({type: 'SET_LOADING', payload: false});
          }
        },
        error => {
          console.error('Firestore snapshot error:', error);
          dispatch({type: 'SET_LOADING', payload: false});
          Alert.alert('Error', 'Failed to listen for chat updates.');
        },
      );

    return () => {
      if (refs.unsubscribeChats) {
        refs.unsubscribeChats();
      }
      if (refs.unsubscribeProfile) {
        refs.unsubscribeProfile();
      }
    };
  }, [user?.uid, processChatsData, refs]);

  // Search functionality with memoized filtering
  useEffect(() => {
    if (!state.searchQuery.trim()) {
      dispatch({type: 'SET_FILTERED_GROUPS', payload: state.groupChats});
      dispatch({type: 'SET_FILTERED_PRIVATE', payload: state.privateChats});
    } else {
      const query = state.searchQuery.toLowerCase();

      const filteredGroups = state.groupChats.filter(
        chat =>
          chat.name?.toLowerCase().includes(query) ||
          chat.memberEmails?.some(email => email.toLowerCase().includes(query)),
      );

      const filteredPrivate = state.privateChats.filter(
        chat =>
          chat.name?.toLowerCase().includes(query) ||
          chat.memberEmails?.some(email => email.toLowerCase().includes(query)),
      );

      dispatch({
        type: 'SET_FILTERED_GROUPS',
        payload: sortChatsWithPinned(filteredGroups, user?.uid || ''),
      });
      dispatch({
        type: 'SET_FILTERED_PRIVATE',
        payload: sortChatsWithPinned(filteredPrivate, user?.uid || ''),
      });
    }
  }, [state.searchQuery, state.groupChats, state.privateChats, user?.uid]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

      <HeaderComponent
        searchVisible={state.searchVisible}
        searchQuery={state.searchQuery}
        avatarUrl={state.userProfile.avatarUrl}
        conversationCount={computedValues.conversationCount}
        onSearchToggle={formHandlers.handleSearchToggle}
        onSearchChange={formHandlers.handleSearchChange}
        onSearchClose={formHandlers.handleSearchClose}
        onProfilePress={navigationHandlers.handleProfilePress}
        t={t}
      />

      <ChatTabNavigation
        activeTab={state.activeTab}
        onTabChange={formHandlers.handleTabChange}
        groupCount={state.filteredGroupChats.length}
        privateCount={state.filteredPrivateChats.length}
        t={t}
      />

      <View style={styles.chatListContainer}>
        <FlatList
          data={computedValues.currentData}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => (
            <EmptyListComponent
              type={state.activeTab}
              userRole={role || ''}
              fadeAnim={refs.fadeAnim}
              slideAnim={refs.slideAnim}
              onCreatePress={formHandlers.handleModalToggle}
              t={t}
            />
          )}
          renderItem={
            state.activeTab === 'groups'
              ? renderFunctions.renderGroupItem
              : renderFunctions.renderPrivateItem
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ItemSeparator}
          removeClippedSubviews
          initialNumToRender={BATCH_SIZE}
          maxToRenderPerBatch={BATCH_SIZE}
          updateCellsBatchingPeriod={50}
          windowSize={21}
          getItemLayout={(data, index) => ({
            length: 80, // Approximate item height
            offset: 80 * index,
            index,
          })}
        />
      </View>

      {computedValues.canCreateChat && (
        <>
          <TouchableOpacity
            style={styles.fab}
            onPress={formHandlers.handleFabPress}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.fabGradient}>
              <Icon
                name={state.bubbleMenuVisible ? 'close' : 'add'}
                size={24}
                color="#FFF"
              />
            </LinearGradient>
          </TouchableOpacity>

          <BubbleMenu
            visible={state.bubbleMenuVisible}
            onCreateGroup={formHandlers.handleCreateGroupFromBubble}
            onTourManagement={formHandlers.handleTourManagement}
            onClose={formHandlers.handleBubbleMenuClose}
            t={t}
          />
        </>
      )}
      {!computedValues.canCreateChat && (
        <TouchableOpacity
          style={styles.fab}
          onPress={formHandlers.handleJoinChatCodeModalToggle}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['#4AC6D0', '#3BB8C3']}
            style={styles.fabGradient}>
            <Icon name="back-hand" size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      <JoinChatByCodeModal
        visible={state.joinChatCodeModalVisible}
        onClose={formHandlers.handleJoinChatCodeModalToggle}
        onJoin={formHandlers.handleJoinChatByCode}
        t={t}
      />

      <CreateChatModal
        visible={state.groupModalVisible}
        userRole={role || ''}
        groupName={state.groupName}
        inputEmails={state.inputEmails}
        onClose={formHandlers.handleModalClose}
        onGroupNameChange={formHandlers.handleGroupNameChange}
        onEmailsChange={formHandlers.handleEmailsChange}
        onSubmit={businessHandlers.handleCreateChat}
        t={t}
      />

      <Loading isLoading={state.loading} />

      <ChatOptionsModal
        visible={state.modalVisible}
        onClose={chatHandlers.handleCloseModal}
        onDelete={() =>
          businessHandlers.handleDelete(state.selectedChat?.id || '')
        }
        onPin={() => businessHandlers.handlePin(state.selectedChat?.id || '')}
        onMute={() => businessHandlers.handleMute(state.selectedChat?.id || '')}
        onViewInfo={() => {
          chatHandlers.handleCloseModal();
          navigationHandlers.handleChatMembersPress(
            state.selectedChat?.id || '',
          );
        }}
        chatName={state.selectedChat?.name || t('chat.chat')}
        isGroup={state.selectedChat?.isGroup || false}
        isPinned={
          state.selectedChat?.pinned?.includes(user?.uid || '') || false
        }
        isMuted={state.selectedChat?.muted?.includes(user?.uid || '') || false}
        canDelete={
          state.selectedChat?.isGroup
            ? state.selectedChat?.roles[user?.uid || ''] === 'owner'
            : true
        }
      />
      {computedValues.canCreateChat && (
        <View style={styles.navigationBottom}>
          <TouchableOpacity style={[styles.bottomButton, styles.channelButton]}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.activeButtonGradient}>
              <Icon name="forum" size={18} color="#FFF" />
              <Text style={styles.activeButtonText}>
                {t('chatScreen.channel')}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomButton, styles.toursButton]}
            onPress={() => {
              navigation.navigate('TourManagement');
            }}>
            <View style={styles.inactiveButtonContainer}>
              <Icon name="map" size={18} color="#64748B" />
              <Text style={styles.inactiveButtonText}>
                {t('chatScreen.tours')}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.bottomButton, styles.toursButton]}
            onPress={() => {
              navigation.navigate('UserProfile');
            }}>
            <View style={styles.inactiveButtonContainer}>
              <Icon name="settings" size={18} color="#64748B" />
              <Text style={styles.inactiveButtonText}>
                {t('common.settings')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
};

// Styles remain the same as before
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 20,
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  navigationBottom: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 5,
    gap: 12,
  },
  bottomButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  channelButton: {
    // Active state styles handled by gradient
  },
  toursButton: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  activeButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  inactiveButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  activeButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  inactiveButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#64748B',
  },
  profileContainer: {
    position: 'relative',
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 30,
    marginLeft: 15,
    borderWidth: 2,
    borderColor: '#fff',
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 25,
    paddingHorizontal: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFF',
    marginLeft: 8,
  },
  searchCloseButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  tabContainer: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabsWrapper: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabButtonContainer: {
    flex: 1,
    marginHorizontal: 2,
  },
  tabButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  tabButtonActive: {
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  tabContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 48,
  },
  activeIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginLeft: 6,
    textAlign: 'center',
  },
  tabButtonTextActive: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 2,
  },
  chatListContainer: {
    flex: 1,
  },
  listContent: {
    paddingTop: 16,
    paddingBottom: 100,
  },
  chatItemWrapper: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  chatItem: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    position: 'relative',
  },
  groupChatItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#4AC6D0',
  },
  privateChatItem: {
    borderLeftWidth: 4,
    borderLeftColor: '#10B981',
  },
  pinnedChatItem: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
    elevation: 4,
    shadowColor: '#F59E0B',
    shadowOpacity: 0.1,
  },
  pinnedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 4,
    zIndex: 1,
  },
  chatAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  chatAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  groupAvatarGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberCountBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    borderRadius: 12,
    minWidth: 24,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  memberCountText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4AC6D0',
  },
  chatInfo: {
    flex: 1,
    marginRight: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  chatTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  pinnedIcon: {
    marginLeft: 6,
    transform: [{rotate: '45deg'}],
  },
  chatMeta: {
    alignItems: 'flex-end',
    gap: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  groupTypeBadge: {
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  groupTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#4AC6D0',
  },
  privateTypeBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  privateTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#10B981',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  lastMessage: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#4AC6D0',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadCount: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  chatActions: {
    justifyContent: 'center',
    alignItems: 'center',
  },

  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginHorizontal: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    marginTop: 60,
  },
  emptyGradient: {
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    width: '100%',
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  startChatButton: {
    borderRadius: 25,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  startChatGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  startChatText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  fabTour: {
    position: 'absolute',
    bottom: 24,
    right: 92,
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fab: {
    position: 'absolute',
    bottom: 92,
    right: 24,
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContainer: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
    elevation: 15,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.25,
    shadowRadius: 15,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  modalHeaderText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginLeft: 12,
  },
  modalContent: {
    padding: 24,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  inputField: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    paddingVertical: 12,
    marginLeft: 12,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 16,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
  },
  confirmButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 6,
  },
  bubbleOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  bubbleMenu: {
    position: 'absolute',
    bottom: 95,
    right: 24,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 8,
    elevation: 12,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.25,
    shadowRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: 180,
  },
  bubbleOption: {
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  bubbleOptionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  bubbleOptionText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 10,
  },
});

export default ChatListScreen;
