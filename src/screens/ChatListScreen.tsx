
/* src/screens/ChatListScreen.tsx */

import React, { useEffect, useState } from "react";
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
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import AvatarButton from "../components/AvatarButton";
import Icon from "react-native-vector-icons/FontAwesome5";
import Loading from './../components/Loading';
import { set } from "react-hook-form";
import ChatOptionsModal from "../components/ChatOptionsModal";

const ChatListScreen = () => {
  const navigation = useNavigation<any>();
  const { user, signOut, role } = useAuth();
  // const user?.uid = ;
  const [chats, setChats] = useState<any[]>([]);
  const [filteredChats, setFilteredChats] = useState<any[]>([]);
  const [inputEmails, setInputEmails] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading ] = useState(false)
  const [showOptions, setShowOptions] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);


  useEffect(() => {
    if (!user?.uid) return;
      setLoading(true)
    const loadProfile = () => {
      const unsubscribeProfile = firestore()
        .collection('users')
        .doc(user?.uid)
        .onSnapshot(doc => {
          const data = doc.data();
          if (data) {
            setAvatarUrl(data?.avatar?.url || '');
          }
        }, error => {
          console.error('Profile snapshot error:', error);
        });
        
      return () => unsubscribeProfile();
      // setAvatarUrl(user?.avatar?.url || '');

    };
    loadProfile();
    const unsubscribe = firestore()
      .collection("chats")
      .where("members", "array-contains", user?.uid)
      .onSnapshot(async (querySnapshot) => {
      try {
        const chatData: any[] = [];
        const userIdsSet = new Set<string>();

        querySnapshot.forEach((doc) => {
        const data = doc.data();
        chatData.push({ id: doc.id, ...data });
        data.members?.forEach((id: string) => userIdsSet.add(id));
        });

        const userIds = Array.from(userIdsSet);
        if (userIds.length > 0) {
        const usersSnapshot = await firestore()
          .collection("users")
          .where(firestore.FieldPath.documentId(), "in", userIds)
          .get();

        const userMap: Record<string, { name: string; email: string; avatar?: string }> = {};
        usersSnapshot.forEach((doc) => {
          userMap[doc.id] = {
          name: doc.data()?.name || doc.data().email,
          email: doc.data().email,
          avatar: doc.data()?.avatar?.url,
          };
        });

        const enrichedChats = chatData.map((chat) => {
          const otherMemberId = chat.members.find((id: string) => id !== user?.uid);
          return {
          ...chat,
          memberEmails: chat.members.map((id: string) => userMap[id]?.name || userMap[id]?.email || id),
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
        console.error("Error loading chats:", error);
        Alert.alert("Error", "Failed to load chat list. Please try again.");
      } finally {
        setLoading(false);
      }
      }, (error) => {
        console.error("Firestore snapshot error:", error);
        setLoading(false);
        Alert.alert("Error", "Failed to listen for chat updates.");
      });

    return () => unsubscribe();
  }, [user?.uid]);
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats); 
    } else {
      const query = searchQuery.toLowerCase();
      const result = chats.filter(chat =>
        chat.name?.toLowerCase().includes(query) ||
        chat.memberEmails?.some(email => email.toLowerCase().includes(query))
      );
      setFilteredChats(result);
    }
  }, [searchQuery, chats]);

  const handleCreateChat = async () => {
    setLoading(true);
    const emails = inputEmails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (emails.length === 0) {
      setLoading(false);

      Alert.alert("Error", "Please enter at least one email.");
      return;
    }

    try {
      const usersSnapshot = await firestore()
        .collection("users")
        .where("email", "in", emails)
        .get();

      const users = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const foundEmails = users.map((u) => u.email?.toLowerCase());
      const notFound = emails.filter((email) => !foundEmails.includes(email));
  
      if (notFound.length > 0) {
        setGroupName("");
        setInputEmails("");
        setLoading(false);
        Alert.alert("Error", `Emails not found: ${notFound.join(", ")}`);
        return;
      }

      const memberIds = users.map((u) => u.id);
      if (!memberIds.includes(user?.uid)) memberIds.push(user?.uid);

      const roles = memberIds.reduce((acc, memberId) => {
        acc[memberId] = memberId === user?.uid ? "owner" : "member";
        return acc;
      }, {} as Record<string, string>);

      if (role == "tourist") {
        const chatId = [memberIds[0], memberIds[1]].sort().join("_");
        await firestore().collection("chats").doc(chatId).set(
          {
            isGroup: false,
            members: memberIds,
            roles,
            createdAt: firestore.FieldValue.serverTimestamp(),
            createdBy: user?.uid,
          },
          { merge: true }
        );
        const toUser = users.find((u) => u.id !== user?.uid);
        // navigation.navigate("Chat", { chatId, toUserId: toUser?.id });
      } else {
        const chatRef = await firestore().collection("chats").add({
          isGroup: true,
          members: memberIds,
          roles,
          name: groupName,
          createdAt: firestore.FieldValue.serverTimestamp(),
          createdBy: user?.uid,
        });
        // navigation.navigate("Chat", { chatId: chatRef.id });
      }
      setGroupName("");
      setInputEmails("");
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
      setGroupName("");
      setInputEmails("");

      Alert.alert("Error", "Failed to create chat. Check that emails exist.");
    }
    finally {
      setLoading(false);
      setGroupName("");
      setInputEmails("");
    }
     
  };
  
  const onLongPressItem = (item) => {
    setSelectedChat(item);
    setModalVisible(true);
  };

  const deleteChat = (id) => {
    setModalVisible(false);
    Alert.alert('Xoá', `Xoá chat có id: ${id}`);
  };

  const renderItem = ({ item }) => {
    const otherEmails = item.memberEmails?.filter(
      (email, index) => item.members[index] !== user?.uid
    );
    const chatName = item.isGroup ? item.name || 'Group Chat' : `${otherEmails?.join(', ')}`;
    let firstLetter = '';
    if(item.lastSenderName && (user?.email == item?.lastSenderName || user?.name == item?.lastSenderName))
    {
      firstLetter = 'You: ' + item?.lastMessage 
    }
    else if (item.lastSenderName) {
      firstLetter = item?.lastSenderName + ': ' + item?.lastMessage
    }
    else {
      firstLetter = "Let's explore together!";
    }
    return (
      <TouchableOpacity
        style={styles.chatItem}
        onPress={() => navigation.navigate('Chat', {
          chatId: item.id,
          toUserId: item.members.find(id => id !== user?.uid),
          name: chatName,
          avatar: item.avatar,
          currentAvatar: avatarUrl,
        })}
        onLongPress={() => onLongPressItem(item)}
        delayLongPress={300} 
      >
        <AvatarButton
          imageUrl={item.avatar}
          size={50}
          style={styles.chatAvatar}
        />
        <View style={styles.chatInfo}>
          <Text style={styles.chatName}>{chatName}</Text>
          <Text style={styles.lastMessage}>{ firstLetter}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Icon name="map-marked-alt" size={80} color="#B0BEC5" />
      <Text style={styles.emptyText}>No trips yet</Text>
      <Text style={styles.emptySubText}>Start your journey by creating a chat</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />
      <View style={styles.header}>
        {!searchVisible ? (
          <>
            <Text style={styles.headerTitle}>Travel Chats</Text>
            <View style={styles.headerActions}>
              <TouchableOpacity onPress={() => setSearchVisible(true)}>
                <Icon name="search" size={20} color="#fff" style={styles.iconButton} />
              </TouchableOpacity>
              <AvatarButton
                onPress={() => navigation.navigate("UserProfile")}
                imageUrl={avatarUrl}
                style={styles.profileAvatar}
              />
            </View>
          </>
        ) : (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search..."
              placeholderTextColor="#fff"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => {
              setSearchVisible(false);
              setSearchQuery('');
            }}>
              <Icon name="times" size={20} color="red" style={{ marginLeft: 10, padding:2 }} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Loading isLoading={loading} />
      <ChatOptionsModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onDelete={() => deleteChat(selectedChat?.id)}
        onViewInfo={() => {
          setModalVisible(false);
          navigation.navigate('ChatInfo', { chatId: selectedChat?.id });
        }}
      />
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyList}
        renderItem={renderItem}
      />

      {/* <View style={styles.inputContainer}> */}
        {/* <TextInput
          placeholder="Enter email(s)..."
          value={inputEmails}
          onChangeText={setInputEmails}
          style={styles.input}
          placeholderTextColor="#888"
        /> */}
        <View style={{ position: 'absolute', bottom: 30, right: 20 }}>
          <Modal visible={showGroupModal} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text style={styles.modalHeader}>Create New Chat</Text>

                <TextInput
                  placeholder="Group name"
                  value={groupName}
                  onChangeText={setGroupName}
                  style={styles.inputField}
                  placeholderTextColor="#888"
                />

                <TextInput
                  placeholder="Enter email(s)..."
                  value={inputEmails}
                  onChangeText={setInputEmails}
                  style={styles.inputField}
                  placeholderTextColor="#888"
                />

                <View style={styles.buttonContainer}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={() => {
                      handleCreateChat();
                      setShowGroupModal(false);
                    }}
                  >
                    <Text style={styles.modalButtonText}>Confirm</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() =>{
                      setShowGroupModal(false)
                      setGroupName("");
                      setInputEmails("");
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          <TouchableOpacity style={styles.createButton} onPress={() => setShowGroupModal(!showGroupModal)}>
            <Icon name="plus" size={20} color="#fff" />
          </TouchableOpacity>
        </View>


    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#E6F7FF",
  },
  header: {
    backgroundColor: "#4AC6D0",
    paddingHorizontal: 20,
    paddingVertical: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },

  iconButton: {
    marginLeft: 10,
  },
  profileAvatar: {
    width: 40,
    height: 40,
    borderRadius: 30,
    marginLeft: 15,
    borderWidth: 2,
    borderColor: "#fff",
  },
  listContent: {
    // marginTop: 30,
    paddingBottom: 100,
  },
  chatItem: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  chatAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 30,
    marginLeft: 15,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  lastMessage: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  inputContainer: {
    position: "absolute",
    bottom:80,
    right: 5,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 12,
    // backgroundColor: "red",
    // borderTopWidth: 1,
    borderColor: "#ddd",
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 45,
    fontSize: 15,
    color: "#000",
  },
  createButton: {
    marginLeft: 10,
    backgroundColor: "#4AC6D0",
    borderRadius: 25,
    width: 45,
    height: 45,
    alignItems: "center",
    justifyContent: "center",
  },

  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 60,
  },
  emptyText: {
    fontSize: 18,
    color: "#444",
    marginTop: 16,
    fontWeight: "bold",
  },
  emptySubText: {
    fontSize: 14,
    color: "#888",
    marginTop: 6,
  },
  optionContainer: {
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  optionButton: {
    backgroundColor: '#4AC6D0',
    padding: 10,
    borderRadius: 8,
    marginVertical: 4,
  },
  optionText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  inlineInput: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputModal: {
    height: 45,
    backgroundColor: '#f0f0f0',
    padding: 8,
    borderRadius: 6,
    flex: 1,
    marginRight: 8,
    color: '#000',
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
  },
  modalHeader: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputField: {
    fontSize: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 12,
    color: '#333',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  confirmButton: {
    backgroundColor: '#4AC6D0',
  },
  cancelButton: {
    backgroundColor: '#bbb',
  },
  modalButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4AC6D0',
    paddingHorizontal: 4,
    // paddingVertical: 3,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },

  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: '#ffffff22',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 16,
    
    color: '#fff',
  },

});

export default ChatListScreen;