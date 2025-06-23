import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import firestore from '@react-native-firebase/firestore';
import {useAuth} from '../../contexts/AuthContext';
import {useTranslation} from '../../contexts/TranslationContext';
import {TourItinerary} from '../../types/tour';
import {useSocket} from '../../contexts/SocketContext';

interface ChatGroup {
  id: string;
  name: string;
  memberCount: number;
  avatar?: string;
}

interface ShareTourModalProps {
  visible: boolean;
  tour: TourItinerary | null;
  onClose: () => void;
}

const ShareTourModal: React.FC<ShareTourModalProps> = ({
  visible,
  tour,
  onClose,
}) => {
  console.log('ShareTourModal rendered with tour:', tour);
  const {user} = useAuth();
  const {emit} = useSocket();
  const {t} = useTranslation();
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);

  const loadChatGroups = useCallback(async () => {
    if (!user?.uid) {
      return;
    }

    setLoading(true);
    try {
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('members', 'array-contains', user.uid)
        .where('isGroup', '==', true)
        .get();

      const groups: ChatGroup[] = [];
      chatsSnapshot.forEach(doc => {
        const data = doc.data();
        groups.push({
          id: doc.id,
          name: data.name || t('chat.defaultGroupName'),
          memberCount: data.members?.length || 0,
          avatar: data.avatar?.url,
        });
      });

      setChatGroups(groups);
    } catch (error) {
      console.error('Error loading chat groups:', error);
      Alert.alert(t('common.error'), t('tour.sharing.failedToLoadGroups'));
    } finally {
      setLoading(false);
    }
  }, [user?.uid, t]);
  useEffect(() => {
    if (visible && user?.uid) {
      loadChatGroups();
    }
  }, [visible, user?.uid, loadChatGroups]);

  const shareTourToGroup = async (groupId: string) => {
    if (!tour || !user?.uid) {
      return;
    }

    setSharing(groupId);
    try {
      // const tourMessage = formatTourMessage(tour);
      // add groupId to tour
      firestore()
        .collection('tours')
        .doc(tour.id)
        .onSnapshot(async tourDoc => {
          if (tourDoc.exists) {
            const tourData = tourDoc.data();
            const sharedWith: string[] = tourData?.sharedWith || [];

            if (!sharedWith.includes(groupId)) {
              sharedWith.push(groupId);
              await firestore()
                .collection('tours')
                .doc(tour.id)
                .update({sharedWith});

              firestore()
                .collection('chats')
                .doc(groupId)
                .onSnapshot(snapshot => {
                  if (snapshot.exists) {
                    const chatData = snapshot.data();
                    if (chatData) {
                      const recipientIds = chatData.members.filter(
                        (member: string) => member !== user.uid,
                      );

                      emit('send_message', {
                        chatId: groupId,
                        senderId: user.uid,
                        message: t('tour.sharing.newTourShared'),
                        memberIds: recipientIds,
                      });
                    }
                  }
                });
            }
          }
        });

      // // Send the tour message to the group
      // await firestore()
      //   .collection('chats')
      //   .doc(groupId)
      //   .collection('messages')
      //   .add({
      //     from: user.uid,
      //     text: tourMessage,
      //     timestamp: firestore.FieldValue.serverTimestamp(),
      //     type: 'tour_share',
      //     tourId: tour.id,
      //     tourData: {
      //       title: tour.title,
      //       tourDate: tour.tourDate,
      //       startTime: tour.startTime,
      //       endTime: tour.endTime,
      //       price: tour.price,
      //       groupSize: tour.groupSize,
      //     },
      //   });

      // // Update the chat's last message
      // await firestore()
      //   .collection('chats')
      //   .doc(groupId)
      //   .update({
      //     lastMessage: `${t('tour.sharing.sharedTour')}: ${tour.title}`,
      //     lastMessageTime: firestore.FieldValue.serverTimestamp(),
      //     lastSender: user.uid,
      //     lastSenderName: user.name || user.email,
      //     messageType: 'tour_share',
      //   });

      Alert.alert(
        t('common.success'),
        t('tour.sharing.tourSharedSuccessfully'),
        [
          {
            text: t('common.ok'),
            onPress: onClose,
          },
        ],
      );
    } catch (error) {
      console.error('Error sharing tour:', error);
      Alert.alert(t('common.error'), t('tour.sharing.failedToShareTour'));
    } finally {
      setSharing(null);
    }
  };

  const renderChatGroup = ({item}: {item: ChatGroup}) => (
    <TouchableOpacity
      style={styles.groupItem}
      onPress={() => shareTourToGroup(item.id)}
      disabled={sharing === item.id}>
      <View style={styles.groupInfo}>
        <View style={styles.groupAvatar}>
          <Icon name="group" size={24} color="#3B82F6" />
        </View>
        <View style={styles.groupDetails}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.memberCount}>
            {item.memberCount} {t('chatMembers.memberCount')}
          </Text>
        </View>
      </View>
      {sharing === item.id ? (
        <ActivityIndicator size="small" color="#3B82F6" />
      ) : (
        <Icon name="chevron-right" size={20} color="#9CA3AF" />
      )}
    </TouchableOpacity>
  );

  if (!tour) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {t('tour.sharing.shareToChat')}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Tour Info */}
          <View style={styles.tourInfo}>
            <Text style={styles.tourTitle} numberOfLines={2}>
              {tour.title}
            </Text>
            <Text style={styles.tourSubtitle}>
              {tour.stops?.length} {t('tour.management.stops')} •{' '}
              {tour.price.adult} {tour.price.currency || 'USD'}
              {tour.price.child !== undefined &&
                ` (Child: ${tour.price.child} ${tour.price.currency || 'USD'})`}
            </Text>
          </View>

          {/* Groups List */}
          <View style={styles.content}>
            <Text style={styles.sectionTitle}>
              {t('tour.sharing.selectGroupToShare')}
            </Text>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>
                  {t('tour.sharing.loadingGroups')}
                </Text>
              </View>
            ) : chatGroups?.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Icon name="group" size={48} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>
                  {t('tour.sharing.noGroupsFound')}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {t('tour.sharing.createGroupFirst')}
                </Text>
              </View>
            ) : (
              <FlatList
                data={chatGroups}
                renderItem={renderChatGroup}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                style={styles.groupsList}
              />
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  tourInfo: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#F9FAFB',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tourTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  tourSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  groupsList: {
    flex: 1,
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  groupInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  groupDetails: {
    flex: 1,
  },
  groupName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1F2937',
    marginBottom: 2,
  },
  memberCount: {
    fontSize: 14,
    color: '#6B7280',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});

export default ShareTourModal;
