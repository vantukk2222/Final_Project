import React, {useEffect, useState} from 'react';
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

const {width} = Dimensions.get('window');

// Tab Navigation Component for ChatListScreen
type ChatTabType = 'groups' | 'private';

interface ChatTabNavigationProps {
  activeTab: ChatTabType;
  onTabChange: (tab: ChatTabType) => void;
  groupCount: number;
  privateCount: number;
}

const ChatTabNavigation: React.FC<ChatTabNavigationProps> = ({
  activeTab,
  onTabChange,
  groupCount,
  privateCount,
}) => {
  const {t} = useTranslation();

  const tabs = [
    {
      key: 'groups',
      label: t('chat.travel'),
      shortLabel: t('chat.travel'),
      icon: 'group',
      count: groupCount,
      color: '#4AC6D0',
    },
    {
      key: 'private',
      label: t('chat.chats'),
      shortLabel: t('chat.chats'),
      icon: 'chat',
      count: privateCount,
      color: '#10B981',
    },
  ] as const;

  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabsWrapper}>
        {tabs.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tabButtonContainer}
            onPress={() => onTabChange(tab.key as ChatTabType)}
            activeOpacity={0.8}>
            {activeTab === tab.key ? (
              <LinearGradient
                colors={
                  tab.key === 'groups'
                    ? ['#4AC6D0', '#3BB8C3']
                    : ['#10B981', '#059669']
                }
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
};

export const formatMessageTime = (date: Date): string => {
  if (!date) {
    return '';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return 'now';
  } else if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes}m`;
  } else if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours}h`;
  } else if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days}d`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
};

// Helper function to sort chats with pinned ones first
const sortChatsWithPinned = (chats: any[], currentUserId: string) => {
  return chats.sort((a, b) => {
    const aIsPinned = a.pinned?.includes(currentUserId);
    const bIsPinned = b.pinned?.includes(currentUserId);

    // If one is pinned and the other isn't, prioritize pinned
    if (aIsPinned && !bIsPinned) {
      return -1;
    }
    if (!aIsPinned && bIsPinned) {
      return 1;
    }

    // If both are pinned or both are not pinned, sort by lastMessageTime
    if (a.lastMessageTime && b.lastMessageTime) {
      return b.lastMessageTime - a.lastMessageTime;
    } else if (a.lastMessageTime) {
      return -1;
    } else if (b.lastMessageTime) {
      return 1;
    } else {
      return b.createdAt && a.createdAt ? b.createdAt - a.createdAt : 0;
    }
  });
};

const ChatListScreen = () => {
  const navigation = useNavigation<any>();
  const {user, signOut, role} = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [groupChats, setGroupChats] = useState<any[]>([]);
  const [privateChats, setPrivateChats] = useState<any[]>([]);
  const [filteredGroupChats, setFilteredGroupChats] = useState<any[]>([]);
  const [filteredPrivateChats, setFilteredPrivateChats] = useState<any[]>([]);
  const [inputEmails, setInputEmails] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [activeTab, setActiveTab] = useState<ChatTabType>('groups');
  const {t} = useTranslation();

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      return;
    }
    setLoading(true);

    let unsubscribeProfile: () => void;

    const loadProfile = () => {
      unsubscribeProfile = firestore()
        .collection('users')
        .doc(user?.uid)
        .onSnapshot(
          doc => {
            const data = doc.data();
            if (data) {
              setAvatarUrl(data?.avatar?.secure_url || data?.avatar?.url || '');
            }
          },
          error => {
            console.error('Profile snapshot error:', error);
          },
        );
    };

    loadProfile();

    const unsubscribe = firestore()
      .collection('chats')
      .where('members', 'array-contains', user?.uid)
      .onSnapshot(
        async querySnapshot => {
          try {
            const chatData: any[] = [];
            const userIdsSet = new Set<string>();

            querySnapshot.forEach(doc => {
              const data = doc.data();

              // Convert Firestore timestamps to readable format
              const processedData = {
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate
                  ? data.createdAt.toDate()
                  : data.createdAt,
                lastMessageTime: data.lastMessageTime?.toDate
                  ? data.lastMessageTime.toDate()
                  : null,
                updatedAt: data.updatedAt?.toDate
                  ? data.updatedAt.toDate()
                  : data.updatedAt,
                // Keep pinned as array
                pinned: data.pinned || [],
                muted: data.muted || [],
              };

              chatData.push(processedData);
              data.members?.forEach((id: string) => userIdsSet.add(id));
            });

            const userIds = Array.from(userIdsSet);
            if (userIds.length > 0) {
              const userMap: Record<
                string,
                {name: string; email: string; avatar?: string}
              > = {};

              // Process users in batches of 10 (Firestore 'in' clause limit)
              for (let i = 0; i < userIds.length; i += 10) {
                const batch = userIds.slice(i, i + 10);
                const usersSnapshot = await firestore()
                  .collection('users')
                  .where(firestore.FieldPath.documentId(), 'in', batch)
                  .get();

                usersSnapshot.forEach(doc => {
                  const userData = doc.data();
                  userMap[doc.id] = {
                    name: userData?.name || userData.email,
                    email: userData.email,
                    avatar:
                      userData?.avatar?.secure_url || userData?.avatar?.url,
                  };
                });
              }

              const enrichedChats = chatData.map(chat => {
                const otherMemberId = chat.members.find(
                  (id: string) => id !== user?.uid,
                );
                return {
                  ...chat,
                  memberEmails: chat.members.map(
                    (id: string) =>
                      userMap[id]?.name || userMap[id]?.email || id,
                  ),
                  avatar: otherMemberId ? userMap[otherMemberId]?.avatar : null,
                  // Add formatted time string for display
                  formattedTime: chat.lastMessageTime
                    ? formatMessageTime(chat.lastMessageTime)
                    : '',
                };
              });

              // Separate group chats and private chats, then sort with pinned first
              const groups = sortChatsWithPinned(
                enrichedChats.filter(chat => chat.isGroup === true),
                user.uid,
              );
              const privates = sortChatsWithPinned(
                enrichedChats.filter(chat => chat.isGroup === false),
                user.uid,
              );

              const allSorted = sortChatsWithPinned(enrichedChats, user.uid);

              setChats(allSorted);
              setGroupChats(groups);
              setPrivateChats(privates);
              setFilteredGroupChats(groups);
              setFilteredPrivateChats(privates);
            } else {
              setChats([]);
              setGroupChats([]);
              setPrivateChats([]);
              setFilteredGroupChats([]);
              setFilteredPrivateChats([]);
            }
          } catch (error) {
            console.error('Error loading chats:', error);
            Alert.alert('Error', 'Failed to load chat list. Please try again.');
          } finally {
            setLoading(false);
          }
        },
        error => {
          console.error('Firestore snapshot error:', error);
          setLoading(false);
          Alert.alert('Error', 'Failed to listen for chat updates.');
        },
      );

    return () => {
      unsubscribe();
      if (unsubscribeProfile) {
        unsubscribeProfile();
      }
    };
  }, [user?.uid]);

  // Search functionality with pinned sorting
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredGroupChats(groupChats);
      setFilteredPrivateChats(privateChats);
    } else {
      const query = searchQuery.toLowerCase();

      const filteredGroups = groupChats.filter(
        chat =>
          chat.name?.toLowerCase().includes(query) ||
          chat.memberEmails?.some(email => email.toLowerCase().includes(query)),
      );

      const filteredPrivate = privateChats.filter(
        chat =>
          chat.name?.toLowerCase().includes(query) ||
          chat.memberEmails?.some(email => email.toLowerCase().includes(query)),
      );

      // Re-sort filtered results with pinned first
      setFilteredGroupChats(sortChatsWithPinned(filteredGroups, user.uid));
      setFilteredPrivateChats(sortChatsWithPinned(filteredPrivate, user.uid));
    }
  }, [searchQuery, groupChats, privateChats, user.uid]);

  const handleCreateChat = async () => {
    setLoading(true);
    const emails = inputEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length === 0) {
      setLoading(false);
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
        setGroupName('');
        setInputEmails('');
        setLoading(false);
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
            name: groupName || t('chat.defaultGroupName'),
            pinned: [],
            muted: [],
            createdAt: firestore.FieldValue.serverTimestamp(),
            createdBy: user?.uid,
          });
      }

      setGroupName('');
      setInputEmails('');
      setShowGroupModal(false);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setGroupName('');
      setInputEmails('');
      Alert.alert(t('common.error'), t('chat.failedToCreateChat'));
    } finally {
      setLoading(false);
      setGroupName('');
      setInputEmails('');
    }
  };

  const onLongPressItem = item => {
    setSelectedChat(item);
    setModalVisible(true);
  };

  const onPin = async (id: string) => {
    setModalVisible(false);
    try {
      setLoading(true);
      const chatRef = firestore().collection('chats').doc(id);
      const chatDoc = await chatRef.get();
      if (!chatDoc.exists) {
        Alert.alert(t('common.error'), t('chat.chatNotFound'));
        return;
      }
      const chatData = chatDoc.data();
      const pinnedUsers = chatData.pinned || [];

      if (pinnedUsers.includes(user?.uid)) {
        // Unpin: remove user from pinned array
        const updatedPinned = pinnedUsers.filter(uid => uid !== user?.uid);
        await chatRef.update({pinned: updatedPinned});
      } else {
        // Pin: add user to pinned array
        pinnedUsers.push(user?.uid);
        await chatRef.update({pinned: pinnedUsers});
      }
    } catch (error) {
      console.error('Error pinning/unpinning chat:', error);
      Alert.alert(t('common.error'), t('chat.failedToUpdatePinStatus'));
    } finally {
      setLoading(false);
    }
  };

  const onMute = async (id: string) => {
    setModalVisible(false);
    try {
      setLoading(true);
      const chatRef = firestore().collection('chats').doc(id);
      const chatDoc = await chatRef.get();
      if (!chatDoc.exists) {
        Alert.alert(t('common.error'), t('chat.chatNotFound'));
        return;
      }
      const chatData = chatDoc.data();
      const mutedUsers = chatData.muted || [];

      if (mutedUsers.includes(user?.uid)) {
        // Unmute: remove user from muted array
        const updatedMuted = mutedUsers.filter(uid => uid !== user?.uid);
        await chatRef.update({muted: updatedMuted});
      } else {
        // Mute: add user to muted array
        mutedUsers.push(user?.uid);
        await chatRef.update({muted: updatedMuted});
      }
    } catch (error) {
      console.error('Error muting/unmuting chat:', error);
      Alert.alert(t('common.error'), t('chat.failedToUpdateMuteStatus'));
    } finally {
      setLoading(false);
    }
  };

  const deleteChat = async (id: string) => {
    setModalVisible(false);
    Alert.alert(t('chat.deleteChat'), t('chat.deleteChatConfirmation'), [
      {
        text: t('common.cancel'),
        style: 'cancel',
      },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            await firestore().collection('chats').doc(id).delete();
          } catch (error) {
            console.error('Error deleting chat:', error);
            Alert.alert(t('common.error'), t('chat.failedToDeleteChat'));
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  const renderGroupItem = ({item, index}) => {
    const chatName = item.name || t('chat.defaultGroupName');
    const memberCount = item.members?.length || 0;
    const isPinned = item.pinned?.includes(user?.uid);
    const isMuted = item.muted?.includes(user?.uid);

    let lastMessagePreview = '';
    if (
      item.lastSenderName &&
      (user?.email === item?.lastSenderName ||
        user?.name === item?.lastSenderName)
    ) {
      lastMessagePreview = t('chat.you') + ': ' + (item?.lastMessage || '');
    } else if (item.lastSenderName) {
      lastMessagePreview =
        item?.lastSenderName + ': ' + (item?.lastMessage || '');
    } else {
      lastMessagePreview = t('chat.readyForAdventure');
    }

    return (
      <Animated.View style={styles.chatItemWrapper}>
        <TouchableOpacity
          style={[
            styles.chatItem,
            styles.groupChatItem,
            isPinned && styles.pinnedChatItem,
          ]}
          onPress={() =>
            navigation.navigate('Chat', {
              chatId: item.id,
              toUserId: item.members.find(id => id !== user?.uid),
              name: chatName,
              avatar: item.avatar,
              currentAvatar: avatarUrl,
              isGroup: true,
            })
          }
          onLongPress={() => onLongPressItem(item)}
          delayLongPress={300}
          activeOpacity={0.7}>
          {/* Pinned indicator */}
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
  };

  const renderPrivateItem = ({item, index}) => {
    const otherEmails = item.memberEmails?.filter(
      (email, emailIndex) => item.members[emailIndex] !== user?.uid,
    );
    const chatName = otherEmails?.join(', ') || t('chat.privateChat');
    const isPinned = item.pinned?.includes(user?.uid);
    const isMuted = item.muted?.includes(user?.uid);

    let lastMessagePreview = '';
    if (
      item.lastSenderName &&
      (user?.email === item?.lastSenderName ||
        user?.name === item?.lastSenderName)
    ) {
      lastMessagePreview = t('chat.you') + ': ' + (item?.lastMessage || '');
    } else if (item.lastSenderName) {
      lastMessagePreview =
        item?.lastSenderName + ': ' + (item?.lastMessage || '');
    } else {
      lastMessagePreview = t('chat.letsExploreTogether');
    }
    return (
      <Animated.View style={styles.chatItemWrapper}>
        <TouchableOpacity
          style={[
            styles.chatItem,
            styles.privateChatItem,
            isPinned && styles.pinnedChatItem,
          ]}
          onPress={() =>
            navigation.navigate('Chat', {
              chatId: item.id,
              toUserId: item.members.find(id => id !== user?.uid),
              name: chatName,
              avatar: item.avatar,
              currentAvatar: avatarUrl,
              isGroup: false,
            })
          }
          onLongPress={() => onLongPressItem(item)}
          delayLongPress={300}
          activeOpacity={0.7}>
          {/* Pinned indicator */}
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
  };

  const renderEmptyList = (type: ChatTabType) => (
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
        {user.role === 'tour_guide' && (
          <TouchableOpacity
            style={styles.startChatButton}
            onPress={() => setShowGroupModal(true)}>
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
  );

  const renderCreateModal = () => (
    <Modal visible={showGroupModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Animated.View style={[styles.modalContainer]}>
          <LinearGradient
            colors={['#4AC6D0', '#3BB8C3']}
            style={styles.modalHeader}>
            <Icon name="add-circle" size={24} color="#FFF" />
            <Text style={styles.modalHeaderText}>
              {user.role === 'tour_guide'
                ? t('chat.createTravelGroup')
                : t('chat.startNewChat')}
            </Text>
          </LinearGradient>

          <View style={styles.modalContent}>
            {user.role === 'tour_guide' && (
              <View style={styles.inputWrapper}>
                <Icon name="label" size={20} color="#4AC6D0" />
                <TextInput
                  placeholder={t('chat.groupNameOptional')}
                  value={groupName}
                  onChangeText={setGroupName}
                  style={styles.inputField}
                  placeholderTextColor="#94A3B8"
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Icon name="email" size={20} color="#4AC6D0" />
              <TextInput
                placeholder={
                  user.role === 'tour_guide'
                    ? t('chat.enterEmailsCommaSeparated')
                    : t('chat.enterEmailAddress')
                }
                value={inputEmails}
                onChangeText={setInputEmails}
                style={styles.inputField}
                placeholderTextColor="#94A3B8"
                multiline={user.role === 'tour_guide'}
              />
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setShowGroupModal(false);
                  setGroupName('');
                  setInputEmails('');
                }}>
                <Text style={styles.cancelButtonText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleCreateChat}>
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
  );

  const getCurrentData = () => {
    return activeTab === 'groups' ? filteredGroupChats : filteredPrivateChats;
  };

  const getCurrentRenderItem = () => {
    return activeTab === 'groups' ? renderGroupItem : renderPrivateItem;
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.header}>
        {!searchVisible ? (
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>{t('chat.travelChats')}</Text>
              <Text style={styles.headerSubtitle}>
                {getCurrentData().length} {t('chat.conversation').toUpperCase()}
              </Text>
            </View>
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.headerButton}
                onPress={() => setSearchVisible(true)}>
                <Icon name="search" size={22} color="#FFF" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.profileContainer}
                onPress={() => navigation.navigate('UserProfile')}>
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
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>
            <TouchableOpacity
              style={styles.searchCloseButton}
              onPress={() => {
                setSearchVisible(false);
                setSearchQuery('');
              }}>
              <Icon name="close" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>

      {/* Chat Tab Navigation */}
      <ChatTabNavigation
        activeTab={activeTab}
        onTabChange={setActiveTab}
        groupCount={filteredGroupChats.length}
        privateCount={filteredPrivateChats.length}
      />

      {/* Chat List */}
      <View style={styles.chatListContainer}>
        <FlatList
          data={getCurrentData()}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={() => renderEmptyList(activeTab)}
          renderItem={getCurrentRenderItem()}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </View>

      {/* Floating Action Button */}
      {user.role === 'tour_guide' && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowGroupModal(true)}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['#4AC6D0', '#3BB8C3']}
            style={styles.fabGradient}>
            <Icon name="add" size={24} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Modals */}
      {renderCreateModal()}
      <Loading isLoading={loading} />
      <ChatOptionsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onDelete={() => deleteChat(selectedChat?.id)}
        onPin={() => onPin(selectedChat?.id)}
        onMute={() => onMute(selectedChat?.id)}
        onViewInfo={() => {
          setModalVisible(false);
          navigation.navigate('ChatMembers', {
            chatId: selectedChat?.id,
            currentUserId: user?.uid,
          });
        }}
        chatName={selectedChat?.name || t('chat.chat')}
        isGroup={selectedChat?.isGroup || false}
        isPinned={selectedChat?.pinned?.includes(user?.uid)}
        isMuted={selectedChat?.muted?.includes(user?.uid)}
        canDelete={
          selectedChat?.isGroup
            ? selectedChat?.roles[user?.uid] === 'owner'
            : true
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },

  // Header styles
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

  // Tab Navigation Styles
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

  // Chat List
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
  fab: {
    position: 'absolute',
    bottom: 24,
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
});

export default ChatListScreen;
