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
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {useNavigation} from '@react-navigation/native';
import {useAuth} from '../contexts/AuthContext';
import AvatarButton from '../components/AvatarButton';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Loading from './../components/Loading';
import ChatOptionsModal from '../components/ChatOptionsModal';
import LinearGradient from 'react-native-linear-gradient';

const {width} = Dimensions.get('window');

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
const ChatListScreen = () => {
  const navigation = useNavigation<any>();
  const {user, signOut, role} = useAuth();
  const [chats, setChats] = useState<any[]>([]);
  const [filteredChats, setFilteredChats] = useState<any[]>([]);
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

  // ... existing useEffect code for data loading ...
  // ...existing code...

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
      .orderBy('lastMessageTime', 'desc') // Sắp xếp theo thời gian
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
                  ? formatMessageTime(data.lastMessageTime.toDate())
                  : '',
                updatedAt: data.updatedAt?.toDate
                  ? data.updatedAt.toDate()
                  : data.updatedAt,
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
                };
              });

              setChats(enrichedChats);
              setFilteredChats(enrichedChats);
            } else {
              setChats([]);
              setFilteredChats([]);
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

  // ...existing code...
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const query = searchQuery.toLowerCase();
      const result = chats.filter(
        chat =>
          chat.name?.toLowerCase().includes(query) ||
          chat.memberEmails?.some(email => email.toLowerCase().includes(query)),
      );
      setFilteredChats(result);
    }
  }, [searchQuery, chats]);

  const handleCreateChat = async () => {
    setLoading(true);
    const emails = inputEmails
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length === 0) {
      setLoading(false);

      Alert.alert('Error', 'Please enter at least one email.');
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
        Alert.alert('Error', `Emails not found: ${notFound.join(', ')}`);
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

      if (role == 'tourist') {
        const chatId = [memberIds[0], memberIds[1]].sort().join('_');
        await firestore().collection('chats').doc(chatId).set(
          {
            isGroup: false,
            members: memberIds,
            roles,
            createdAt: firestore.FieldValue.serverTimestamp(),
            createdBy: user?.uid,
          },
          {merge: true},
        );
      } else {
        const chatRef = await firestore().collection('chats').add({
          isGroup: true,
          members: memberIds,
          roles,
          name: groupName,
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
      Alert.alert('Error', 'Failed to create chat. Check that emails exist.');
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

  const deleteChat = id => {
    setModalVisible(false);
    Alert.alert('Delete Chat', 'Are you sure you want to delete this chat?', [
      {text: 'Cancel', style: 'cancel'},
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => console.log('Delete chat:', id),
      },
    ]);
  };

  const renderItem = ({item, index}) => {
    const otherEmails = item.memberEmails?.filter(
      (email, emailIndex) => item.members[emailIndex] !== user?.uid,
    );
    const chatName = item.isGroup
      ? item.name || 'Group Chat'
      : `${otherEmails?.join(', ')}`;

    let firstLetter = '';
    if (
      item.lastSenderName &&
      (user?.email == item?.lastSenderName ||
        user?.name == item?.lastSenderName)
    ) {
      firstLetter = 'You: ' + item?.lastMessage;
    } else if (item.lastSenderName) {
      firstLetter = item?.lastSenderName + ': ' + item?.lastMessage;
    } else {
      firstLetter = "Let's explore together!";
    }

    return (
      <Animated.View
        style={[
          styles.chatItemWrapper,
          // {
          //   opacity: fadeAnim,
          //   transform: [
          //     {
          //       translateY: slideAnim.interpolate({
          //         inputRange: [0, 50],
          //         outputRange: [0, 50],
          //       }),
          //     },
          //   ],
          // },
        ]}>
        <TouchableOpacity
          style={styles.chatItem}
          onPress={() =>
            navigation.navigate('Chat', {
              chatId: item.id,
              toUserId: item.members.find(id => id !== user?.uid),
              name: chatName,
              avatar: item.avatar,
              currentAvatar: avatarUrl,
            })
          }
          onLongPress={() => onLongPressItem(item)}
          delayLongPress={300}
          activeOpacity={0.7}>
          <View style={styles.chatAvatarContainer}>
            <AvatarButton
              imageUrl={item.avatar}
              size={60}
              style={styles.chatAvatar}
            />
            {item.isGroup && (
              <View style={styles.groupBadge}>
                <Icon name="group" size={12} color="#4AC6D0" />
              </View>
            )}
          </View>

          <View style={styles.chatInfo}>
            <View style={styles.chatHeader}>
              <Text style={styles.chatName} numberOfLines={1}>
                {chatName}
              </Text>
            </View>

            <Text style={styles.lastMessage} numberOfLines={2}>
              {firstLetter}
            </Text>
            {item.unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadCount}>
                  {item.unreadCount > 99 ? '99+' : item.unreadCount}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.chatActions}>
            <Icon name="chevron-right" size={20} color="#C1C7CD" />
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderEmptyList = () => (
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
          <Icon name="forum" size={80} color="#4AC6D0" />
        </View>
        <Text style={styles.emptyText}>No conversations yet</Text>
        <Text style={styles.emptySubText}>
          Start your journey by creating a new chat
        </Text>
        {user.role === 'tour_guide' && (
          <TouchableOpacity
            style={styles.startChatButton}
            onPress={() => setShowGroupModal(true)}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.startChatGradient}>
              <Icon name="add" size={20} color="#FFF" />
              <Text style={styles.startChatText}>Start New Chat</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </LinearGradient>
    </Animated.View>
  );

  const renderCreateModal = () => (
    <Modal visible={showGroupModal} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{scale: fadeAnim}],
            },
          ]}>
          <LinearGradient
            colors={['#4AC6D0', '#3BB8C3']}
            style={styles.modalHeader}>
            <Icon name="add-circle" size={24} color="#FFF" />
            <Text style={styles.modalHeaderText}>Create New Chat</Text>
          </LinearGradient>

          <View style={styles.modalContent}>
            <View style={styles.inputWrapper}>
              <Icon name="label" size={20} color="#4AC6D0" />
              <TextInput
                placeholder="Group name (optional)"
                value={groupName}
                onChangeText={setGroupName}
                style={styles.inputField}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Icon name="email" size={20} color="#4AC6D0" />
              <TextInput
                placeholder="Enter email addresses (comma separated)"
                value={inputEmails}
                onChangeText={setInputEmails}
                style={styles.inputField}
                placeholderTextColor="#94A3B8"
                multiline
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
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleCreateChat}>
                <LinearGradient
                  colors={['#4AC6D0', '#3BB8C3']}
                  style={styles.confirmButtonGradient}>
                  <Icon name="check" size={18} color="#FFF" />
                  <Text style={styles.confirmButtonText}>Create</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.header}>
        {!searchVisible ? (
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Travel Chats</Text>
              <Text style={styles.headerSubtitle}>
                {filteredChats.length} conversation
                {filteredChats.length !== 1 ? 's' : ''}
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
                <AvatarButton
                  imageUrl={avatarUrl}
                  size={40}
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
                placeholder="Search conversations..."
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

      {/* Chat List */}
      <View style={styles.chatListContainer}>
        <FlatList
          data={filteredChats}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyList}
          renderItem={renderItem}
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
        onViewInfo={() => {
          setModalVisible(false);
          navigation.navigate('ChatInfo', {chatId: selectedChat?.id});
        }}
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
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  chatAvatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  chatAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 30,
    marginLeft: 15,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  groupBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 4,
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  chatInfo: {
    flex: 1,
    marginRight: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },
  messageTime: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  lastMessage: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  unreadBadge: {
    position: 'absolute',
    top: 0,
    right: -8,
    backgroundColor: '#4AC6D0',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
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
