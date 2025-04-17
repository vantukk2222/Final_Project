// src/screens/ChatScreen.tsx
import React, { useEffect, useState } from "react";
import { 
  View, 
  Text, 
  TextInput, 
  FlatList, 
  TouchableOpacity, 
  Image, 
  Alert, 
  StyleSheet, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform 
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { launchImageLibrary } from "react-native-image-picker";
import { useAuth } from "../contexts/AuthContext";
import ImageModal from "../components/ImageModal";
import AvatarButton from "../components/AvatarButton";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/Ionicons";

const ChatScreen = ({ route }: any) => {
  const { user } = useAuth();
  const userId = user?.uid;
  const { chatId, toUserId, name, avatar } = route.params || {};
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const navigation = useNavigation<any>();

  useEffect(() => {
    const unsubscribe = firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .orderBy("timestamp", "asc")
      .onSnapshot((querySnapshot) => {
        const msgs: any[] = [];
        querySnapshot.forEach((doc) => {
          msgs.push(doc.data());
        });
        setMessages(msgs);
      });

    return () => unsubscribe();
  }, [chatId]);

  const handleSend = async () => {
    if (message.trim() === "") return;

    await firestore()
      .collection("chats")
      .doc(chatId)
      .collection("messages")
      .add({
        from: userId,
        to: toUserId,
        text: message,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });

    setMessage("");
  };

  const handlePickImage = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo' });

    if (result.didCancel) return;
    const asset = result.assets?.[0];
    if (!asset || !asset.uri) return;

    const uri = asset.uri;

    const formData = new FormData();
    formData.append('file', {
      uri,
      name: 'chat-image.jpg',
      type: 'image/jpeg',
    } as any);

    const cloud_name = 'djlhfgzbw';
    const upload_preset = 'chatapp';

    formData.append('upload_preset', upload_preset);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (json.secure_url) {
        await firestore()
          .collection('chats')
          .doc(chatId)
          .collection('messages')
          .add({
            from: userId,
            to: toUserId,
            imageUrl: json.secure_url,
            timestamp: firestore.FieldValue.serverTimestamp(),
          });
      } else {
        console.error('Upload failed:', json);
        Alert.alert('Upload failed', json.error?.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      Alert.alert('Error', 'Failed to upload image');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevron-back" size={24} color="#0084FF" />
          </TouchableOpacity>
          <AvatarButton imageUrl={avatar} style={styles.avatar} />
          <Text style={styles.headerName}>{name}</Text>
        </View>
        
        {/* Messages */}
        <FlatList
          data={messages}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.messagesList}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubbleContainer,
              { alignSelf: item.from === userId ? "flex-end" : "flex-start" }
            ]}>
              {item.text && (
                <View style={[
                  styles.messageBubble,
                  item.from === userId ? styles.sentBubble : styles.receivedBubble
                ]}>
                  <Text style={item.from === userId ? styles.sentText : styles.receivedText}>
                    {item.text}
                  </Text>
                </View>
              )}
              
              {item.imageUrl && (
                <TouchableOpacity 
                  onPress={() => setSelectedImage(item.imageUrl)}
                  style={styles.imageContainer}
                >
                  <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.imageMessage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
              )}
              
              <Text style={[
                styles.timeStamp,
                { textAlign: item.from === userId ? 'right' : 'left' }
              ]}>
                {item.timestamp ? new Date(item.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
              </Text>
            </View>
          )}
        />

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TouchableOpacity onPress={handlePickImage} style={styles.attachButton}>
            <Icon name="image-outline" size={24} color="#0084FF" />
          </TouchableOpacity>
          
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            style={styles.input}
          />
          
          <TouchableOpacity 
            onPress={handleSend} 
            style={styles.sendButton}
            disabled={message.trim() === ""}
          >
            <Icon 
              name="send" 
              size={20} 
              color={message.trim() === "" ? "#CCCCCC" : "#FFFFFF"} 
            />
          </TouchableOpacity>
        </View>

        <ImageModal
          visible={!!selectedImage}
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA'
  },
  keyboardAvoid: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E6EB',
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1
  },
  backButton: {
    marginRight: 12
  },
  avatar: {
    marginRight: 12
  },
  headerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333'
  },
  messagesList: {
    paddingVertical: 12,
    paddingHorizontal: 16
  },
  messageBubbleContainer: {
    maxWidth: '80%',
    marginVertical: 6
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1
  },
  sentBubble: {
    backgroundColor: '#0084FF',
    borderBottomRightRadius: 4
  },
  receivedBubble: {
    backgroundColor: '#E4E6EB',
    borderBottomLeftRadius: 4
  },
  sentText: {
    color: '#FFFFFF'
  },
  receivedText: {
    color: '#333333'
  },
  imageContainer: {
    marginVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  imageMessage: {
    width: 220,
    height: 220,
    borderRadius: 12
  },
  timeStamp: {
    fontSize: 10,
    color: '#999999',
    marginTop: 4
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E4E6EB',
    alignItems: 'center'
  },
  attachButton: {
    marginRight: 10,
    padding: 6
  },
  input: {
    flex: 1,
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333333'
  },
  sendButton: {
    marginLeft: 10,
    backgroundColor: '#0084FF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  }
});

export default ChatScreen;