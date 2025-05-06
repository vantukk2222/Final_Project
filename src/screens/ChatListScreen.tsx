
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
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { useNavigation } from "@react-navigation/native";
import { useAuth } from "../contexts/AuthContext";
import AvatarButton from "../components/AvatarButton";
import Icon from "react-native-vector-icons/FontAwesome5";
import Toast from "react-native-toast-message";

const ChatListScreen = () => {
  const navigation = useNavigation<any>();
  const { user, signOut } = useAuth();
  const userId = user?.uid;
  const [chats, setChats] = useState<any[]>([]);
  const [inputEmails, setInputEmails] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    if (!userId) return;
    const loadProfile = () => {
      const unsubscribeProfile = firestore()
        .collection('users')
        .doc(userId)
        .onSnapshot(doc => {
          const data = doc.data();
          if (data) {
            setAvatarUrl(data?.avatar?.url || '');
          }
        }, error => {
          console.error('Profile snapshot error:', error);
        });
        
      return () => unsubscribeProfile();
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

        const userIds = Array.from(userIdsSet);
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
          const otherMemberId = chat.members.find((id: string) => id !== userId);
          return {
            ...chat,
            memberEmails: chat.members.map((id: string) => userMap[id]?.name || userMap[id]?.email || id),
            avatar: otherMemberId ? userMap[otherMemberId]?.avatar : null,
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
      // Alert.alert("Error", "Please enter at least one email.");
      Toast.show({
        type: "error",
        text1: "Error",
        text2: "Please enter at least one email.",
        position: "top",
        visibilityTime: 2000,
      });

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
        // Alert.alert("Error", `Emails not found: ${notFound.join(", ")}`);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: `Emails not found!!`,
          position: "top",
          visibilityTime: 2000,
        });
        return;
      }

      const memberIds = users.map((u) => u.id);
      if (!memberIds.includes(userId)) memberIds.push(userId);

      const roles = memberIds.reduce((acc, memberId) => {
        acc[memberId] = memberId === userId ? "owner" : "member";
        return acc;
      }, {} as Record<string, string>);

      if (memberIds.length === 2) {
        const chatId = [memberIds[0], memberIds[1]].sort().join("_");
        await firestore().collection("chats").doc(chatId).set(
          {
            isGroup: false,
            members: memberIds,
            roles,
            createdAt: firestore.FieldValue.serverTimestamp(),
            createdBy: userId,
          },
          { merge: true }
        );
        // const toUser = users.find((u) => u.id !== userId);
        // navigation.navigate("Chat", { chatId, toUserId: toUser?.id });
      } else {
        const chatRef = await firestore().collection("chats").add({
          isGroup: true,
          members: memberIds,
          roles,
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
      <Icon name="map-marked-alt" size={80} color="#B0BEC5" />
      <Text style={styles.emptyText}>No trips yet</Text>
      <Text style={styles.emptySubText}>Start your journey by creating a chat</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Travel Chats</Text>
        <AvatarButton
          onPress={() => navigation.navigate("UserProfile")}
          imageUrl={avatarUrl}
          size={40}
          style={styles.profileAvatar}
        />
      </View>

      <FlatList
        data={chats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyList}
        renderItem={({ item }) => {
          const otherEmails = item.memberEmails?.filter(
            (email: string, index: number) => item.members[index] !== userId
          );
          const chatName = item.isGroup ? item.name || "Group Chat" : `${otherEmails?.join(", ")}`;

          return (
            <TouchableOpacity
              style={styles.chatItem}
              onPress={() => navigation.navigate("Chat", {
                chatId: item.id,
                toUserId: item.members.find((id: string) => id !== userId),
                // name: chatName,
                avatar: item.avatar,
                currentAvatar: avatarUrl,
              })}
            >
              <AvatarButton
                imageUrl={item.avatar}
                size={50}
                style={styles.chatAvatar}
              />
              <View style={styles.chatInfo}>
                <Text style={styles.chatName}>{chatName}</Text>
                <Text style={styles.lastMessage}>{item.lastMessage?.text || "Let's explore together!"}</Text>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <View style={styles.inputContainer}>
        <TextInput
          placeholder="Enter email(s)..."
          value={inputEmails}
          onChangeText={setInputEmails}
          style={styles.input}
          placeholderTextColor="#888"
        />
        <TouchableOpacity style={styles.createButton} onPress={handleCreateChat}>
          <Icon name="paper-plane" size={20} color="#fff" solid />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
        <Icon name="sign-out-alt" size={16} color="#fff" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
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
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  profileAvatar: {
    
    width: 60,
    height: 60,
    borderRadius: 30,
    marginLeft: 15,
    borderWidth: 2,
    borderColor: "#fff",
  },
  listContent: {
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
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#ddd",
  },
  input: {
    flex: 1,
    backgroundColor: "#f0f0f0",
    borderRadius: 25,
    paddingHorizontal: 16,
    height: 45,
    fontSize: 15,
    color: "#333",
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
  logoutButton: {
    backgroundColor: "#ff6b6b",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    padding: 12,
    margin: 16,
    borderRadius: 12,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "bold",
    marginLeft: 8,
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
});

export default ChatListScreen;