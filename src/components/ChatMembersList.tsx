// src/components/ChatMembersList.tsx
import React, { useEffect, useState } from "react";
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
  SafeAreaView
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";

const ChatMembersList = ({ route }: any) => {
  const [members, setMembers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any>({});
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [chatName, setChatName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false); // Để kiểm tra xem có đang chỉnh sửa tên nhóm không
  const navigation = useNavigation<any>();
  const { chatId, currentUserId } = route.params;

  // Fetch members and their roles
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const chatDoc = await firestore().collection("chats").doc(chatId).get();
        const chatData = chatDoc.data();
        if (chatData && chatData.members) {
          const membersSnapshot = await firestore()
            .collection("users")
            .where(firestore.FieldPath.documentId(), "in", chatData.members)
            .get();
          const membersList: any[] = [];
          membersSnapshot.forEach((doc) => {
            membersList.push({ id: doc.id, ...doc.data() });
          });

          setRoles(chatData.roles || {});
          setMembers(membersList);
          setChatName(chatData.name || 'Untitled Group');
        }
      } catch (error) {
        console.error("Error fetching members:", error);
      }
    };
    fetchMembers();
  }, [chatId]);

  // Handle remove member
  const handleRemoveMember = async (memberId: string) => {
    if (memberId === currentUserId) {
      Alert.alert("Error", "You cannot remove yourself from the group.");
      return;
    }

    Alert.alert(
      "Remove Member",
      "Are you sure you want to remove this member from the chat?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await firestore()
                .collection("chats")
                .doc(chatId)
                .update({
                  members: firestore.FieldValue.arrayRemove(memberId),
                });

              const updatedRoles = { ...roles };
              delete updatedRoles[memberId];
              setMembers((prevMembers) => prevMembers.filter((member) => member.id !== memberId));
              await firestore()
                .collection("chats")
                .doc(chatId)
                .update({
                  roles: updatedRoles,
                });

              if (memberId === currentUserId) {
                navigation.goBack();
              }
            } catch (error) {
              console.error("Error removing member:", error);
              Alert.alert("Error", "Failed to remove member.");
            }
          },
        },
      ]
    );
  };

  // Handle add member to chat
  const handleAddMember = async () => {
    if (!newMemberEmail.trim()) {
      Alert.alert("Error", "Please enter a valid email.");
      return;
    }

    try {
      const userSnapshot = await firestore()
        .collection("users")
        .where("email", "==", newMemberEmail.trim())
        .limit(1)
        .get();

      if (userSnapshot.empty) {
        Alert.alert("Error", "User not found.");
        return;
      }

      const userId = userSnapshot.docs[0].id;
      const userData = userSnapshot.docs[0].data();

      if (members.some((member) => member.id === userId)) {
        Alert.alert("Error", "User is already a member of the group.");
        return;
      }

      await firestore()
        .collection("chats")
        .doc(chatId)
        .update({
          members: firestore.FieldValue.arrayUnion(userId),
        });

      const updatedRoles = { ...roles, [userId]: "member" };
      await firestore()
        .collection("chats")
        .doc(chatId)
        .update({
          roles: updatedRoles,
        });

      setMembers((prevMembers) => [...prevMembers, { id: userId, ...userData }]);
      setNewMemberEmail('');
      Alert.alert("Success", `${userData.name} added to the group.`);
    } catch (error) {
      console.error("Error adding member:", error);
      Alert.alert("Error", "Failed to add member.");
    }
  };

  // Handle edit group name
  const handleEditGroupName = async () => {
    if (isEditingName) {
      try {
        await firestore()
          .collection("chats")
          .doc(chatId)
          .update({
            name: chatName,
          });
      } catch (error) {
        console.error("Error updating group name:", error);
        Alert.alert("Error", "Failed to update group name.");
      }
    }
    setIsEditingName(!isEditingName); 
  };
  console.log("Members:", members);
  console.log("Roles:", roles);
  return (
    <SafeAreaView style={styles.container}>
      
      {/* Group Name */}
      <View style={styles.groupNameContainer}>
        {/* back button */}
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ marginRight: 12 }}>
          <Text style={{ color: '#5B72EF', fontSize: 16 }}>Back</Text>
        </TouchableOpacity>
        <Text style={styles.groupNameLabel}>Group Name:</Text>
        {isEditingName ? (
          <TextInput
            value={chatName}
            onChangeText={setChatName}
            style={styles.input}
          />
        ) : (
          <Text style={styles.groupNameText}>{chatName}</Text>
        )}
        <TouchableOpacity onPress={handleEditGroupName} style={styles.editButton}>
          <Text style={styles.editButtonText}>{isEditingName ? "Save" : "Edit"}</Text>
        </TouchableOpacity>
      </View>
      <View style={{ height: 40, flexDirection: 'row' }} >
        <Text style={{ color: 'gray', marginBottom: 12, marginRight: 12 }}>
          {members.length} members 
        </Text>
        <Text style={{ color: 'gray', marginBottom: 12 }}>
          {roles[currentUserId] === "owner" ? "You are the owner" : "You are a member"}
        </Text>
        
      </View>


      {/* Add member */}
      <View style={styles.addMemberContainer}>
        <TextInput
          value={newMemberEmail}
          onChangeText={setNewMemberEmail}
          placeholder="Enter email to add member"
          style={styles.input}
        />
        <Button title="Add Member" onPress={handleAddMember} />
      </View>

      {/* Member list */}
      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.memberItem}>
            <TouchableOpacity
              onPress={() => navigation.navigate("UserProfile", { userId: item.id })}
              style={styles.memberDetails}
            >
              <Image
                source={
                  item.avatar?.url
                    ? { uri: item.avatar.url }
                    : require('../assets/default-avatar.png')
                }
                style={styles.avatar}
              />
              <Text style={styles.memberName}>{item.name || item.email}</Text>
            </TouchableOpacity>

            {/* Show "Remove" button for owner/admin */}
            {(roles[currentUserId] === "owner" || roles[currentUserId] === "admin") && item.id !== currentUserId && (
              <TouchableOpacity
                onPress={() => handleRemoveMember(item.id)}
                style={styles.removeButton}
              >
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            )}
            {(roles[currentUserId] === "owner" || roles[currentUserId] === "admin") && item.id === currentUserId && (
              <TouchableOpacity style={{ backgroundColor: 'white', padding: 8, borderRadius: 12 }}>
                <Text style={{ color: 'gray' }}>Admin</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  groupNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  groupNameLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  groupNameText: {
    fontSize: 16,
    color: '#333',
  },
  editButton: {
    marginLeft: 8,
  },
  editButtonText: {
    fontSize: 14,
    color: '#5B72EF',
  },
  addMemberContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    color: 'black',
    backgroundColor: '#F8F8F8',
    padding: 8,
    borderRadius: 8,
    marginRight: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
    justifyContent: 'space-between',
  },
  memberDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  memberName: {
    fontSize: 16,
    color: '#333',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FF4D4D',
    borderRadius: 12,
  },
  removeText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});

export default ChatMembersList;
