// src/components/ChatMembersList.tsx
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
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import {useAuth} from '../contexts/AuthContext';
import AvatarStatus from './AvatarStatus';

const ChatMembersList = ({route}: any) => {
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any>({});
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [chatName, setChatName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false); // Để kiểm tra xem có đang chỉnh sửa tên nhóm không
  const navigation = useNavigation<any>();
  const {user} = useAuth();
  const {chatId, currentUserId} = route.params;

  useEffect(() => {
    const unsubscribeChat = firestore()
      .collection('chats')
      .doc(chatId)
      .onSnapshot(
        async chatDoc => {
          const chatData = chatDoc.data();
          if (!chatData || !chatData.members || chatData.members.length === 0) {
            return;
          }

          setChatName(chatData.name || 'Untitled Group');
          setRoles(chatData.roles || {});

          try {
            const membersSnapshot = await firestore()
              .collection('users')
              .where(firestore.FieldPath.documentId(), 'in', chatData.members)
              .get();

            const membersList: any[] = [];
            membersSnapshot.forEach(doc => {
              membersList.push({id: doc.id, ...doc.data()});
            });
            setMembers(membersList);
          } catch (error) {
            console.error('Error fetching members:', error);
          }
        },
        error => {
          console.error('Error in chat snapshot:', error);
        },
      );
    return () => unsubscribeChat();
  }, [chatId]);

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
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.groupNameContainer}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Icon name="chevron-left" size={24} color="#5B72EF" />
          </TouchableOpacity>
          {isEditingName ? (
            <TextInput
              value={chatName}
              onChangeText={setChatName}
              style={styles.nameInput}
              autoFocus
            />
          ) : (
            <Text style={styles.groupNameText}>{chatName}</Text>
          )}
          <TouchableOpacity
            onPress={handleEditGroupName}
            style={styles.editButton}>
            <Icon
              name={isEditingName ? 'check' : 'pencil-alt'}
              size={18}
              color="#5B72EF"
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Group Info Card */}
      <View style={styles.infoCard}>
        <View style={styles.memberCountRow}>
          <Icon name="users" size={16} color="#5B72EF" />
          <Text style={styles.memberCountText}>
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </Text>
          {roles[currentUserId] === 'owner' && (
            <View style={styles.ownerBadge}>
              <Text style={styles.ownerBadgeText}>Owner</Text>
            </View>
          )}
        </View>
      </View>

      {/* Add member section */}
      {user.role == 'tour_guide' && (
        <View style={styles.addMemberContainer}>
          <TextInput
            value={newMemberEmail}
            onChangeText={setNewMemberEmail}
            placeholder="Enter email to add member"
            style={styles.input}
            placeholderTextColor="#999"
          />
          <TouchableOpacity style={styles.addButton} onPress={handleAddMember}>
            <Icon name="user-plus" size={16} color="#FFF" />
            <Text style={styles.addButtonText}>Add</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Members list header */}
      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>Members</Text>
      </View>

      {/* Member list */}
      <FlatList
        data={members}
        keyExtractor={item => item.id}
        style={styles.memberList}
        renderItem={({item}) => (
          <View style={styles.memberItem}>
            <TouchableOpacity
              onPress={() =>
                navigation.navigate('UserProfile', {userId: item.id})
              }
              style={styles.memberDetails}>
              <AvatarStatus
                avatarUrl={item.avatarUrl}
                size={44}
                status={item.status}
                style={styles.avatar}
              />
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.name || item.email}</Text>
                {roles[item.id] && (
                  <Text style={styles.memberRole}>{roles[item.id]}</Text>
                )}
              </View>
            </TouchableOpacity>

            {/* Show actions for admins/owners */}
            {(roles[currentUserId] === 'owner' ||
              roles[currentUserId] === 'admin') &&
              item.id !== currentUserId && (
                <TouchableOpacity
                  onPress={() => handleRemoveMember(item.id)}
                  style={styles.removeButton}>
                  <Icon name="user-minus" size={14} color="#FFF" />
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              )}

            {/* Badge for current user */}
            {item.id === currentUserId && (
              <View style={styles.youBadge}>
                <Text style={styles.youBadgeText}>You</Text>
              </View>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#F9FAFC',
    flex: 1,
  },
  header: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDF5',
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  groupNameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    flex: 1,
  },
  nameInput: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    borderBottomWidth: 1,
    borderBottomColor: '#5B72EF',
    padding: 4,
  },
  editButton: {
    padding: 8,
  },
  infoCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  memberCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberCountText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#444',
  },
  ownerBadge: {
    marginLeft: 'auto',
    backgroundColor: '#E3E7FF',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  ownerBadgeText: {
    color: '#5B72EF',
    fontSize: 12,
    fontWeight: '600',
  },
  addMemberContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E1E5EB',
    color: '#333',
    backgroundColor: '#FFF',
    padding: 12,
    height: 48,
    borderRadius: 8,
    marginRight: 8,
    fontSize: 14,
  },
  addButton: {
    flexDirection: 'row',
    backgroundColor: '#5B72EF',
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 6,
  },
  listHeader: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  listHeaderText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
  memberList: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E9EDF5',
  },
  memberItem: {
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F2F5',
    justifyContent: 'space-between',
  },
  memberDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  memberRole: {
    fontSize: 13,
    color: '#777',
    marginTop: 2,
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#FF4D4D',
    borderRadius: 8,
  },
  removeText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
    marginLeft: 4,
  },
  youBadge: {
    backgroundColor: '#F0F2F5',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  youBadgeText: {
    color: '#777',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default ChatMembersList;
