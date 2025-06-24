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
  const {user} = useAuth();
  const {emit} = useSocket();
  const {t} = useTranslation();
  const [chatGroups, setChatGroups] = useState<ChatGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [alreadySharedGroups, setAlreadySharedGroups] = useState<string[]>([]);

  const loadChatGroups = useCallback(async () => {
    if (!tour?.guideId || !user?.uid) {
      return;
    }

    setLoading(true);
    try {
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('members', 'array-contains', tour?.guideId[0] || tour?.guideId)
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

      // Set already shared groups and pre-select them
      const sharedWith = tour?.sharedWith || [];
      setAlreadySharedGroups(sharedWith);
      setSelectedGroups(
        sharedWith.filter(groupId =>
          groups.some(group => group.id === groupId),
        ),
      );
    } catch (error) {
      console.error('Error loading chat groups:', error);
      Alert.alert(t('common.error'), t('tour.sharing.failedToLoadGroups'));
    } finally {
      setLoading(false);
    }
  }, [user?.uid, tour?.sharedWith, t]);
  useEffect(() => {
    if (visible && user?.uid) {
      loadChatGroups();
    }
  }, [visible, user?.uid, loadChatGroups]);

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups(prev => {
      if (prev.includes(groupId)) {
        return prev.filter(id => id !== groupId);
      }
      return [...prev, groupId];
    });
  };

  const selectAllGroups = () => {
    if (selectedGroups.length === chatGroups.length) {
      setSelectedGroups([]);
    } else {
      setSelectedGroups(chatGroups.map(group => group.id));
    }
  };

  const shareTourToGroups = async () => {
    if (!tour || !user?.uid) {
      return;
    }

    const newGroupsToShare = selectedGroups.filter(
      groupId => !alreadySharedGroups.includes(groupId),
    );

    const groupsToUnshare = alreadySharedGroups.filter(
      groupId => !selectedGroups.includes(groupId),
    );

    if (newGroupsToShare.length === 0 && groupsToUnshare.length === 0) {
      Alert.alert(t('common.error'), t('tour.sharing.noChangesToMake'));
      return;
    }

    setSharing(true);
    try {
      const tourRef = firestore().collection('tours').doc(tour.id);
      const tourDoc = await tourRef.get();

      if (!tourDoc.exists) {
        throw new Error('Tour not found');
      }

      const tourData = tourDoc.data();
      const currentSharedWith: string[] = tourData?.sharedWith || [];

      // Calculate new shared groups (add new ones, remove unshared ones)
      const finalSharedWith = selectedGroups.filter(groupId =>
        chatGroups.some(group => group.id === groupId),
      );

      let totalParticipantChange = 0;

      // Process newly selected groups (sharing)
      for (const groupId of newGroupsToShare) {
        const chatDoc = await firestore().collection('chats').doc(groupId);

        if (chatDoc.exists) {
          const chatData = chatDoc.data();
          if (chatData) {
            const recipientIds = chatData.members.filter(
              (member: string) => member !== user.uid,
            );

            totalParticipantChange += recipientIds.length;

            // Send notification message to group
            emit('send_message', {
              chatId: groupId,
              senderId: user.uid,
              message: `${t('tour.sharing.newTourShared')}: ${tour.title}`,
              messageType: 'tour_notification',
              tourData: {
                id: tour.id,
                title: tour.title,
                tourDate: tour.tourDate,
                startTime: tour.startTime,
                endTime: tour.endTime,
                price: tour.price,
                groupSize: tour.groupSize,
              },
              memberIds: recipientIds,
            });
          }
        }
      }

      // Process unshared groups (removing)
      for (const groupId of groupsToUnshare) {
        const chatDoc = await firestore().collection('chats').doc(groupId);

        if (chatDoc.exists) {
          const chatData = chatDoc.data();
          if (chatData) {
            const recipientIds = chatData.members.filter(
              (member: string) => member !== user.uid,
            );

            totalParticipantChange -= recipientIds.length;

            // Send notification message about tour removal
            emit('send_message', {
              chatId: groupId,
              senderId: user.uid,
              message: `${t('tour.sharing.tourUnshared')}: ${tour.title}`,
              messageType: 'tour_unshare_notification',
              tourData: {
                id: tour.id,
                title: tour.title,
              },
              memberIds: recipientIds,
            });
          }
        }
      }

      // Update tour with new shared groups and participant count
      const newParticipantCount = Math.max(
        0,
        (tourData?.currentParticipants || 0) + totalParticipantChange,
      );

      await tourRef.update({
        sharedWith: finalSharedWith,
        currentParticipants: newParticipantCount,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });

      let alertMessage = '';
      if (newGroupsToShare.length > 0 && groupsToUnshare.length > 0) {
        alertMessage = `${t('tour.sharing.tourSharedTo')} ${
          newGroupsToShare.length
        } ${t('tour.sharing.groupsAndUnsharedFrom')} ${
          groupsToUnshare.length
        } ${t('tour.sharing.groups')}`;
      } else if (newGroupsToShare.length > 0) {
        alertMessage = `${t('tour.sharing.tourSharedTo')} ${
          newGroupsToShare.length
        } ${
          newGroupsToShare.length === 1
            ? t('tour.sharing.group')
            : t('tour.sharing.groups')
        }`;
      } else if (groupsToUnshare.length > 0) {
        alertMessage = `${t('tour.sharing.tourUnsharedFrom')} ${
          groupsToUnshare.length
        } ${
          groupsToUnshare.length === 1
            ? t('tour.sharing.group')
            : t('tour.sharing.groups')
        }`;
      }

      Alert.alert(t('common.success'), alertMessage, [
        {
          text: t('common.ok'),
          onPress: () => {
            setAlreadySharedGroups(finalSharedWith);
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error('Error updating tour sharing:', error);
      Alert.alert(
        t('common.error'),
        t('tour.sharing.failedToUpdateTourSharing'),
      );
    } finally {
      setSharing(false);
    }
  };

  const renderChatGroup = ({item}: {item: ChatGroup}) => {
    const isSelected = selectedGroups.includes(item.id);
    const isAlreadyShared = alreadySharedGroups.includes(item.id);
    const willBeUnshared = isAlreadyShared && !isSelected;

    return (
      <TouchableOpacity
        style={[
          styles.groupItem,
          isSelected && styles.groupItemSelected,
          isAlreadyShared && !willBeUnshared && styles.groupItemShared,
          willBeUnshared && styles.groupItemUnsharing,
        ]}
        onPress={() => toggleGroupSelection(item.id)}
        disabled={sharing}>
        <View style={styles.groupInfo}>
          <View style={styles.groupAvatar}>
            <Icon name="group" size={24} color="#3B82F6" />
          </View>
          <View style={styles.groupDetails}>
            <Text style={styles.groupName} numberOfLines={1}>
              {item.name}
              {isAlreadyShared && !willBeUnshared && (
                <Text style={styles.sharedLabel}>
                  {' '}
                  • {t('tour.sharing.shared')}
                </Text>
              )}
              {willBeUnshared && (
                <Text style={styles.unshareLabel}>
                  {' '}
                  • {t('tour.sharing.willUnshare')}
                </Text>
              )}
            </Text>
            <Text style={styles.memberCount}>
              {item.memberCount} {t('chatMembers.memberCount')}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.checkbox,
            isSelected && styles.checkboxSelected,
            isAlreadyShared && !willBeUnshared && styles.checkboxShared,
            willBeUnshared && styles.checkboxUnsharing,
          ]}>
          {isSelected && (
            <Icon
              name={isAlreadyShared ? 'done-all' : 'check'}
              size={16}
              color="#FFFFFF"
            />
          )}
          {willBeUnshared && <Icon name="remove" size={16} color="#FFFFFF" />}
        </View>
      </TouchableOpacity>
    );
  };

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
                ` (${t('tour.form.children')} ${tour.price.child} ${
                  tour.price.currency || 'USD'
                })`}
            </Text>
          </View>

          {/* Groups List */}
          <View style={styles.content}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {t('tour.sharing.selectGroupToShare')}
              </Text>
              {chatGroups.length > 0 && (
                <TouchableOpacity
                  onPress={selectAllGroups}
                  style={styles.selectAllButton}
                  disabled={sharing}>
                  <Text style={styles.selectAllText}>
                    {selectedGroups.length === chatGroups.length
                      ? t('common.deselectAll')
                      : t('common.selectAll')}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

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
              <>
                <FlatList
                  data={chatGroups}
                  renderItem={renderChatGroup}
                  keyExtractor={item => item.id}
                  showsVerticalScrollIndicator={false}
                  style={styles.groupsList}
                />

                {/* Selected Count and Share Button */}
                <View style={styles.actionContainer}>
                  <Text style={styles.selectedCount}>
                    {`${selectedGroups.length} ${t('tour.sharing.of')} ${
                      chatGroups.length
                    } ${t('tour.sharing.groupsSelected')}`}
                    {alreadySharedGroups.length > 0 && (
                      <Text style={styles.sharedCount}>
                        {` (${alreadySharedGroups.length} ${t(
                          'tour.sharing.alreadyShared',
                        )})`}
                      </Text>
                    )}
                  </Text>

                  <TouchableOpacity
                    style={[
                      styles.shareButton,
                      sharing && styles.shareButtonDisabled,
                    ]}
                    onPress={shareTourToGroups}
                    disabled={sharing}>
                    {sharing ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Icon name="update" size={20} color="#FFFFFF" />
                    )}
                    <Text style={styles.shareButtonText}>
                      {sharing
                        ? t('tour.sharing.updating')
                        : t('tour.sharing.updateSharing')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
  },
  selectAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#3B82F6',
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
  groupItemSelected: {
    backgroundColor: '#EBF4FF',
    borderColor: '#3B82F6',
  },
  groupItemShared: {
    backgroundColor: '#F0FDF4',
    borderColor: '#10B981',
    opacity: 0.8,
  },
  groupItemUnsharing: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
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
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  checkboxShared: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkboxUnsharing: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  actionContainer: {
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 16,
  },
  selectedCount: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 12,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#3B82F6',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  shareButtonDisabled: {
    backgroundColor: '#9CA3AF',
    elevation: 0,
    shadowOpacity: 0,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginLeft: 8,
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
  sharedLabel: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  unshareLabel: {
    fontSize: 12,
    color: '#EF4444',
    fontWeight: '500',
  },
  sharedCount: {
    fontSize: 12,
    color: '#10B981',
    fontStyle: 'italic',
  },
});

export default ShareTourModal;
