import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
  Button,
  SafeAreaView,
  ScrollView,
  Animated,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAuth} from '../contexts/AuthContext';
import AvatarStatus from './AvatarStatus';
import LinearGradient from 'react-native-linear-gradient';
import Loading from './Loading';

const ChatMembersList = ({route}: any) => {
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any>({});
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [chatName, setChatName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [loading, setLoading] = useState(true);

  const navigation = useNavigation<any>();
  const {user} = useAuth();
  const {chatId, currentUserId} = route.params;

  const fadeAnim = new Animated.Value(1);

  useEffect(() => {
    fadeAnim.setValue(0);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    console.log('ChatMembersList mounted with chatId:', chatId); // Debug log

    if (!chatId) {
      console.error('No chatId provided');
      return;
    }
    const unsubscribeChat = firestore()
      .collection('chats')
      .doc(chatId)
      .onSnapshot(
        async chatDoc => {
          setLoading(true);
          const chatData = chatDoc.data();
          if (!chatData || !chatData.members || chatData.members.length === 0) {
            console.log('No chat data or members found'); // Thêm log để debug
            return;
          }

          setChatName(chatData.name || 'Untitled Group');
          setRoles(chatData.roles || {});

          try {
            console.log('Members array:', chatData.members); // Debug log

            // Kiểm tra members array có hợp lệ không
            if (
              !Array.isArray(chatData.members) ||
              chatData.members.length === 0
            ) {
              console.log('Invalid members array');
              return;
            }

            // Firestore 'in' query có giới hạn 10 items
            if (chatData.members.length > 10) {
              // Chia thành nhiều batch nếu > 10 members
              const batches = [];
              for (let i = 0; i < chatData.members.length; i += 10) {
                batches.push(chatData.members.slice(i, i + 10));
              }

              const allMembers = [];
              for (const batch of batches) {
                const batchSnapshot = await firestore()
                  .collection('users')
                  .where(firestore.FieldPath.documentId(), 'in', batch)
                  .get();

                batchSnapshot.forEach(doc => {
                  allMembers.push({id: doc.id, ...doc.data()});
                });
              }
              console.log('Fetched members in batches:', allMembers.length); // Debug log
              setMembers(allMembers);
            } else {
              const membersSnapshot = await firestore()
                .collection('users')
                .where(firestore.FieldPath.documentId(), 'in', chatData.members)
                .get();

              const membersList: any[] = [];
              membersSnapshot.forEach(doc => {
                membersList.push({id: doc.id, ...doc.data()});
              });

              console.log('Fetched members:', membersList.length); // Debug log
              setMembers(membersList);
            }
            setLoading(false);
          } catch (error) {
            console.error('Error fetching members:', error);
            setLoading(false);
          }
        },
        error => {
          setLoading(false);
          console.error('Error in chat snapshot:', error);
        },
      );
    return () => unsubscribeChat();
  }, [chatId]);
  useEffect(() => {
    console.log('ChatMembersList re-rendered'); // Debug log
  }, [members]);
  // Handle remove member
  const handleRemoveMember = async (memberId: string) => {
    if (memberId === currentUserId) {
      Alert.alert('Error', 'You cannot remove yourself from the group.');
      return;
    }

    Alert.alert(
      'Remove Member',
      'Are you sure you want to remove this member from the chat?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await firestore()
                .collection('chats')
                .doc(chatId)
                .update({
                  members: firestore.FieldValue.arrayRemove(memberId),
                });

              const updatedRoles = {...roles};
              delete updatedRoles[memberId];
              setMembers(prevMembers =>
                prevMembers.filter(member => member.id !== memberId),
              );
              await firestore().collection('chats').doc(chatId).update({
                roles: updatedRoles,
              });

              if (memberId === currentUserId) {
                navigation.goBack();
              }
            } catch (error) {
              console.error('Error removing member:', error);
              Alert.alert('Error', 'Failed to remove member.');
            }
          },
        },
      ],
    );
  };

  // Handle add member to chat
  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      Alert.alert('Error', 'Please enter a valid email.');
      return;
    }

    try {
      const userSnapshot = await firestore()
        .collection('users')
        .where('email', '==', newMemberEmail.trim())
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        Alert.alert('Error', 'User not found.');
        return;
      }

      const userId = userSnapshot.docs[0].id;
      const userData = userSnapshot.docs[0].data();

      if (members.some(member => member.id === userId)) {
        Alert.alert('Error', 'User is already a member of the group.');
        return;
      }

      await firestore()
        .collection('chats')
        .doc(chatId)
        .update({
          members: firestore.FieldValue.arrayUnion(userId),
        });

      const updatedRoles = {...roles, [userId]: 'member'};
      await firestore().collection('chats').doc(chatId).update({
        roles: updatedRoles,
      });

      setMembers(prevMembers => [...prevMembers, {id: userId, ...userData}]);
      setNewMemberEmail('');
      Alert.alert('Success', `${userData.name} added to the group.`);
    } catch (error) {
      console.error('Error adding member:', error);
      Alert.alert('Error', 'Failed to add member.');
    }
  };

  // Handle edit group name
  const handleEditGroupName = async () => {
    if (isEditingName) {
      try {
        await firestore().collection('chats').doc(chatId).update({
          name: chatName,
        });
      } catch (error) {
        console.error('Error updating group name:', error);
        Alert.alert('Error', 'Failed to update group name.');
      }
    }
    setIsEditingName(!isEditingName);
  };

  const renderMemberItem = ({item, index}) => (
    <Animated.View
      style={[
        styles.memberItem,
        {
          opacity: fadeAnim,
          transform: [
            {
              translateY: fadeAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [20, 0],
              }),
            },
          ],
        },
      ]}>
      <TouchableOpacity
        onPress={() => navigation.navigate('UserProfile', {userId: item.id})}
        style={styles.memberDetails}>
        <View style={styles.avatarContainer}>
          <AvatarStatus
            avatarUrl={item.avatarUrl}
            size={52}
            status={item?.userStatus?.status || 'offline'}
            style={styles.avatar}
          />
          {item.id === currentUserId && (
            <View style={styles.currentUserBadge}>
              <Icon name="star" size={12} color="#4AC6D0" />
            </View>
          )}
        </View>

        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.name || item.email}</Text>
          {roles[item.id] && (
            <View style={styles.roleBadge}>
              <Icon
                name={
                  roles[item.id] === 'owner' ? 'admin-panel-settings' : 'person'
                }
                size={14}
                color="#4AC6D0"
              />
              <Text style={styles.memberRole}>{roles[item.id]}</Text>
            </View>
          )}
          <Text style={styles.memberEmail}>{item.email}</Text>
        </View>
      </TouchableOpacity>

      <View style={styles.memberActions}>
        {/* You Badge */}
        {item.id === currentUserId && (
          <View style={styles.youBadge}>
            <Text style={styles.youBadgeText}>You</Text>
          </View>
        )}

        {/* Remove Button */}
        {(roles[currentUserId] === 'owner' ||
          roles[currentUserId] === 'admin') &&
          item.id !== currentUserId && (
            <TouchableOpacity
              onPress={() => handleRemoveMember(item.id)}
              style={styles.removeButton}>
              <Icon name="person-remove" size={18} color="#FFF" />
            </TouchableOpacity>
          )}
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Loading isLoading={loading} />
      {/* Header */}
      <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Icon name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleContainer}>
            {isEditingName ? (
              <TextInput
                value={chatName}
                onChangeText={setChatName}
                style={styles.nameInput}
                autoFocus
                placeholderTextColor="rgba(255,255,255,0.7)"
              />
            ) : (
              <Text style={styles.headerTitle} numberOfLines={1}>
                {chatName}
              </Text>
            )}
            <Text style={styles.headerSubtitle}>
              {members.length} {members.length === 1 ? 'member' : 'members'}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleEditGroupName}
            style={styles.editButton}>
            <Icon
              name={isEditingName ? 'check' : 'edit'}
              size={20}
              color="#FFF"
            />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Group Info Card */}
        <View style={styles.infoCard}>
          <LinearGradient
            colors={['rgba(74, 198, 208, 0.1)', 'rgba(74, 198, 208, 0.05)']}
            style={styles.infoCardGradient}>
            <View style={styles.infoRow}>
              <View style={styles.infoIconContainer}>
                <Icon name="group" size={24} color="#4AC6D0" />
              </View>
              <View style={styles.infoTextContainer}>
                <Text style={styles.infoTitle}>Group Members</Text>
                <Text style={styles.infoSubtitle}>
                  Manage group members and permissions
                </Text>
              </View>
              {roles[currentUserId] === 'owner' && (
                <View style={styles.ownerBadge}>
                  <Icon name="admin-panel-settings" size={16} color="#4AC6D0" />
                  <Text style={styles.ownerBadgeText}>Owner</Text>
                </View>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Add Member Section */}
        {user.role === 'tour_guide' && (
          <View style={styles.addMemberCard}>
            <View style={styles.addMemberHeader}>
              <Icon name="person-add" size={20} color="#4AC6D0" />
              <Text style={styles.addMemberTitle}>Add New Member</Text>
            </View>
            <View style={styles.addMemberForm}>
              <View style={styles.inputContainer}>
                <Icon name="email" size={16} color="#4AC6D0" />
                <TextInput
                  value={newMemberEmail}
                  onChangeText={setNewMemberEmail}
                  placeholder="Enter email address"
                  style={styles.input}
                  placeholderTextColor="#94A3B8"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>
              <TouchableOpacity
                style={styles.addButton}
                onPress={handleAddMember}>
                <LinearGradient
                  colors={['#4AC6D0', '#3BB8C3']}
                  style={styles.addButtonGradient}>
                  <Icon name="add" size={18} color="#FFF" />
                  <Text style={styles.addButtonText}>Add</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Members List */}
        <View style={styles.membersCard}>
          <View style={styles.membersHeader}>
            <Icon name="people" size={20} color="#4AC6D0" />
            <Text style={styles.membersTitle}>All Members</Text>
          </View>

          <FlatList
            data={members}
            keyExtractor={item => item.id}
            renderItem={renderMemberItem}
            scrollEnabled={false}
            showsVerticalScrollIndicator={false} // Thêm dòng này
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            // Thêm các props sau để debug
            removeClippedSubviews={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            windowSize={21}
            ListEmptyComponent={() => (
              <View style={{padding: 20, alignItems: 'center'}}>
                <Text style={{color: '#64748B'}}>No members found</Text>
              </View>
            )}
            onLayout={() => console.log('FlatList layout')}
            onContentSizeChange={(width, height) =>
              console.log('FlatList content size:', width, height)
            }
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F8FAFC',
    flex: 1,
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
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
    paddingVertical: 4,
    marginBottom: 2,
  },
  editButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoCard: {
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoCardGradient: {
    padding: 20,
    backgroundColor: '#FFF',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  ownerBadgeText: {
    color: '#4AC6D0',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  addMemberCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addMemberTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 8,
  },
  addMemberForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 12,
    marginLeft: 8,
  },
  addButton: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 4,
  },
  membersCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  memberDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  currentUserBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 3,
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#4AC6D0',
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  memberEmail: {
    fontSize: 13,
    color: '#64748B',
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  youBadge: {
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  youBadgeText: {
    color: '#4AC6D0',
    fontSize: 12,
    fontWeight: '700',
  },
  removeButton: {
    backgroundColor: '#EF4444',
    padding: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#EF4444',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
});

export default ChatMembersList;
