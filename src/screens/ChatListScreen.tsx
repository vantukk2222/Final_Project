// src/screens/ChatListScreen.tsx
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
  Image,
  SafeAreaView,
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import AvatarButton from "../components/AvatarButton";
import Icon from "react-native-vector-icons/FontAwesome5";

const ChatListScreen = () => {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const userId = user?.uid;
  const [chats, setChats] = useState<any[]>([]);
  const [inputEmails, setInputEmails] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!userId) return;
    const loadProfile = async () => {
      setLoading(true);
      try {
        const doc = await firestore().collection('users').doc(userId).get();
        const data = doc.data();
        if (data) {
          setAvatarUrl(data?.avatar?.url || '');
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadProfile();

    const unsubscribe = firestore()
      .collection("chats")
      .where("members", "array-contains", userId)
      .onSnapshot(async (querySnapshot) => {
        const chatData: any[] = [];
        const userIdsSet = new Set<string>();

        querySnapshot.forEach((doc) => {
          const data = doc.data();
          chatData.push({ id: doc.id, ...data });
          data.members?.forEach((id: string) => userIdsSet.add(id));
        });

        // Fetch user information
        const userIds = Array.from(userIdsSet);
        const usersSnapshot = await firestore()
          .collection("users")
          .where(firestore.FieldPath.documentId(), "in", userIds)
          .get();
        const userMap: Record<string, {name:string, email: string; avatar?: string }> = {};
        usersSnapshot.forEach((doc) => {
          userMap[doc.id] = {name:doc.data()?.name || doc.data().email, email: doc.data().email, avatar: doc.data()?.avatar?.url};
        });

        // Add user info to each chat
        const enrichedChats = chatData.map((chat) => {
          // Find first non-current user to get their avatar
          const otherMemberId = chat.members.find((id: string) => id !== userId);
          
          return {
            ...chat,
            memberEmails: chat.members.map((id: string) => userMap[id]?.name || userMap[id]?.email || id),
            avatar: otherMemberId ? userMap[otherMemberId]?.avatar : null
          };
        });

        setChats(enrichedChats);
      });

    return () => unsubscribe();
  }, [userId]);
  const handleCreateChat = async () => {
    const emails = inputEmails
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
  
    if (emails.length === 0) {
      Alert.alert("Error", "Please enter at least one email.");
      return;
    }
  
    if (emails.length > 10) {
      Alert.alert("Error", "You can only enter up to 10 emails.");
      return;
    }
  
    try {
      const usersSnapshot = await firestore()
        .collection("users")
        .where("email", "in", emails)
        .get();
  
      const users = usersSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
  
      const foundEmails = users.map((u) => u.email?.toLowerCase());
      const notFound = emails.filter((email) => !foundEmails.includes(email));
      if (notFound.length > 0) {
        Alert.alert("Error", `Emails not found: ${notFound.join(", ")}`);
        return;
      }
  
      const memberIds = users.map((u) => u.id);
      if (!memberIds.includes(userId)) memberIds.push(userId);
  
      // Nếu là nhóm, thêm quyền "admin" cho người tạo
      const roles = memberIds.reduce((acc, memberId, index) => {
        if (memberId === userId) {
          acc[memberId] = "owner"; // Người tạo nhóm sẽ là trưởng nhóm (owner)
        } else {
          acc[memberId] = "member"; // Các thành viên khác sẽ là "member"
        }
        return acc;
      }, {} as Record<string, string>);
  
      if (memberIds.length === 2) {
        const chatId = [memberIds[0], memberIds[1]].sort().join("_");
        await firestore().collection("chats").doc(chatId).set(
          {
            isGroup: false,
            members: memberIds,
            roles: roles, // Thêm roles
            createdAt: firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
          },
          { merge: true }
        );
  
        const toUser = users.find((u) => u.id !== userId);
        navigation.navigate("Chat", { chatId, toUserId: toUser?.id });
      } else {
        const chatRef = await firestore().collection("chats").add({
          isGroup: true,
          members: memberIds,
          roles: roles, // Thêm roles
          name: "Group Chat",
          createdAt: firestore.FieldValue.serverTimestamp(),
          createdBy: userId,
        });
        navigation.navigate("Chat", { chatId: chatRef.id });
      }
  
      setInputEmails("");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to create chat. Check that emails exist.");
    }
  };
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Icon name="chatbubble-ellipses-outline" size={80} color="#ccc" />
      <Text style={styles.emptyText}>No conversations yet</Text>
      <Text style={styles.emptySubText}>Start a new chat below</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#ffffff" barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Chats</Text>
          <TouchableOpacity onPress={() => navigation.navigate("Translate")}>
            <Icon name="language" size={20} color="#0084FF" style={{ marginTop: 4 }} />
            <Text style={styles.headerSubtitle}>Translatation</Text>
          </TouchableOpacity>
        </View>
        <AvatarButton 
          onPress={() => navigation.navigate("UserProfile")} 
          imageUrl={avatarUrl} 
          size={40}
          style={styles.profileAvatar}
        />
      </View>

      {/* Chat List */}
      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyList}
        renderItem={({ item }) => {
          const otherEmails = item.memberEmails?.filter(
            (email: string, index: number) => item.members[index] !== userId
          );
          const chatName = item.isGroup
            ? item.name || "Group Chat"
            : `${otherEmails?.join(", ")}`;
            
          return (
            <TouchableOpacity
              style={styles.chatItem}
              activeOpacity={0.7}
              onPress={() => {
                navigation.navigate("Chat", {
                  chatId: item.id,
                  toUserId: item.members.find((id: string) => id !== userId),
                  name: chatName,
                  avatar: item.avatar,
                });
              }}
            >
              <AvatarButton 
                imageUrl={item.avatar} 
                size={56}
                style={styles.chatAvatar}
                placeholder={<View style={[styles.placeholderAvatar, {backgroundColor: getColorFromName(chatName)}]}>
                  <Text style={styles.placeholderText}>{chatName.charAt(0).toUpperCase()}</Text>
                </View>}
              />
              <View style={styles.chatInfo}>
                <Text style={styles.chatName} numberOfLines={1}>
                  {chatName}
                </Text>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage?.text || "Start a new conversation"}
                </Text>
              </View>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>
                    {item.unreadCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        }}
      />

      {/* New Chat Input */}
      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Email addresses, comma separated"
          value={inputEmails}
          onChangeText={setInputEmails}
          style={styles.input}
          placeholderTextColor="#aaa"
        />
        <TouchableOpacity 
          style={styles.createButton} 
          onPress={handleCreateChat}
          activeOpacity={0.8}
        >
          <Icon name="paper-plane" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Icon name="log-out-outline" size={18} color="#ff5252" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

// Helper function to generate colors from names
const getColorFromName = (name: string) => {
  const colors = ['#4CAF50', '#2196F3', '#9C27B0', '#FF9800', '#795548', '#607D8B'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  return colors[hash % colors.length];
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  profileAvatar: {
    borderWidth: 2,
    borderColor: '#e0e0e0',
  },
  listContent: {
    flexGrow: 1,
    paddingBottom: 16,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  chatAvatar: {
    marginRight: 16,
  },
  placeholderAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#777',
  },
  unreadBadge: {
    backgroundColor: '#2196F3',
    borderRadius: 14,
    minWidth: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  unreadText: {
    color: 'white',
    fontSize: 13,
    fontWeight: 'bold',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    height: 50,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 20,
    fontSize: 15,
    color: '#333',
  },
  createButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    elevation: 2,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff5252',
  },
  logoutText: {
    color: '#ff5252',
    fontWeight: '600',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#777',
    marginTop: 20,
    fontWeight: '600',
  },
  emptySubText: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 8,
  },
});

export default ChatListScreen;
