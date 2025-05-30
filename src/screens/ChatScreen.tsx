// src/screens/ChatScreen.tsx
import React, { useEffect, useState, useRef } from "react";
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
  Platform,
  PermissionsAndroid
} from "react-native";
import firestore from "@react-native-firebase/firestore";
import { launchImageLibrary } from "react-native-image-picker";
import { useAuth } from "../contexts/AuthContext";
import ImageModal from "../components/ImageModal";
import AvatarButton from "../components/AvatarButton";
import { useNavigation } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome5";
import CallStarter from "../components/VoiceStarter";
import moment  from 'moment';
import Loading from './../components/Loading';
import FileUpload from "../components/UploadFile";
import RNFS from 'react-native-fs';

const ChatScreen = ({ route }: any) => {
  const { user } = useAuth();
  const userId = user?.uid;
  const { chatId, toUserId, avatar, currentAvatar } = route.params || {};
  const [name, setName] = useState(route.params?.name || '');
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isJoined, setIsJoined] = useState(false); // Track if the user has joined the channel
  const [localUid, setLocalUid] = useState(0);
  const [remoteUid, setRemoteUid] = useState(0);
  const agoraEngineRef = useRef<IRtcEngine>();
  const [userAvatars, setUserAvatars] = useState<any>({});
  const [userNames, setUserNames] = useState<any>({});
  const flatListRef = useRef<FlatList>(null);

  const navigation = useNavigation<any>();
  
  // Add this useEffect to scroll to the bottom when messages are loaded
  useEffect(() => {
    if (messages.length > 0 && flatListRef.current) {
      // Small timeout to ensure the list is fully rendered
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: false });
      }, 100);
    }
  }, [messages]);

  // Initialize Agora SDK
  useEffect(() => {
    const setupAgora = async () => {
      if (Platform.OS === "android") {
        await requestPermissions(); // Ensure permissions are granted for Android
      }
      // agoraEngineRef.current = createAgoraRtcEngine();
      // await agoraEngineRef.current.initialize({ appId: '65c90bc59da34b07a2f1027f0f2004c9' }); // Replace with your Agora App ID
      // await agoraEngineRef.current.setChannelProfile(ChannelProfileType.ChannelProfileCommunication);
      // await agoraEngineRef.current.enableAudio();
    };

    setupAgora();

    // return () => {
    //   if (agoraEngineRef.current) {
    //     agoraEngineRef.current.release();
    //   }
    // };
  }, []);

  // Request permissions on Android
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        PermissionsAndroid.PERMISSIONS.CAMERA,
      ]);
      if (granted['android.permission.RECORD_AUDIO'] !== 'granted' || granted['android.permission.CAMERA'] !== 'granted') {
        Alert.alert('Permission Denied', 'Audio and Camera permissions are required for the call');
        return;
      }
    }
  };
  const uploadFile = async (url: string, fileName: string) => {
    await firestore()
      .collection('chats')
      .doc(chatId)
      .collection('messages')
      .add({
        from: userId,
        to: toUserId,
        fileURL: url,
        fileName: fileName,
        timestamp: firestore.FieldValue.serverTimestamp(),
      });
    // add last message to the chat
    await firestore()
      .collection('chats')
      .doc(chatId)
      .set({
        lastMessage: fileName,
        lastMessageTime: firestore.FieldValue.serverTimestamp(),
        lastSender: userId,
        lastSenderName: user?.name || user?.email,
        messageType: 'file',
      }, { merge: true });
  }

  // // Join Agora channel
  // const joinChannel = async () => {
  //   if (isJoined) return;
  //   try {
  //     await agoraEngineRef.current?.joinChannel(null, chatId, null, {
  //       channelProfile: ChannelProfileType.ChannelProfileCommunication,
  //       clientRoleType: ClientRoleType.ClientRoleBroadcaster,
  //       publishMicrophoneTrack: true,
  //       autoSubscribeAudio: true,
  //     });
  //     setIsJoined(true);
  //     console.log("Joined the channel:", chatId);
  //   } catch (error) {
  //     console.error("Error joining channel:", error);
  //     Alert.alert("Error", "Failed to join the channel.");
  //   }
  // };

  // // Leave Agora channel
  // const leaveChannel = () => {
  //   if (!isJoined) return;
  //   try {
  //     agoraEngineRef.current?.leaveChannel();
  //     setIsJoined(false);
  //     setRemoteUid(0);
  //     console.log("Left the channel");
  //   } catch (error) {
  //     console.error("Error leaving channel:", error);
  //     Alert.alert("Error", "Failed to leave the channel.");
  //   }
  // };

  const startVoiceCall = () => {
    console.log("Starting voice call...");
    console.log("user", user);
    console.log("uid: ", user.uid);
    navigation.navigate('VoiceCall', {
      // chatId: chatId,
      // localUid: userId,
      // remoteUid: toUserId,
      user: user,
      meetingId: chatId,
    });
  };

  useEffect(() => {
    const unsubscribeChat = firestore()
      .collection("chats")
      .doc(chatId)
      .onSnapshot(async (chatDoc) => {
        const chatData = chatDoc.data();
        if (!chatData || !chatData.members || chatData.members.length === 0) return;
        
        setName(chatData.name || 'Untitled Group');
        
      });
    
    return () => unsubscribeChat();
  }, [chatId]);


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

  useEffect(() => {
    const fetchUserNames = async () => {
      const userIds = [...new Set(messages.map((msg) => msg.from))];
      const usersSnapshot = await firestore()
        .collection("users")
        .where(firestore.FieldPath.documentId(), "in", userIds)
        .get();

      const names: any = {};
      const avatars: any = {};
      usersSnapshot.forEach((doc) => {
        names[doc.id] = doc.data()?.name || doc.data().email;
        avatars[doc.id] = doc.data()?.avatar?.url || null; // Store avatar URL
      });
      setUserNames(names);
      setUserAvatars(avatars); // Set user avatars
    };

    fetchUserNames();
  }, [messages]);

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
    // add last message to the chat
    await firestore()
      .collection("chats")
      .doc(chatId)
      .set({
        lastMessage: message,
        lastMessageTime: firestore.FieldValue.serverTimestamp(),
        lastSenderName: user?.name || user?.email,
        lastSender: userId,
        messageType: "text",
      }, { merge: true });


    setMessage("");
  };

  const handleFileDownload = async (fileURL: string, fileName: string) => {
    try {
      const downloadDest =
        Platform.OS === 'android'
          ? `${RNFS.DownloadDirectoryPath}/${fileName}`
          : `${RNFS.DocumentDirectoryPath}/${fileName}`;

      const res = await RNFS.downloadFile({
        fromUrl: fileURL,
        toFile: downloadDest,
      }).promise;

      if (res.statusCode === 200) {
        Alert.alert('Download success', `File in: ${downloadDest}`);
      } else {
        Alert.alert('Error', `Code: ${res.statusCode}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert('Download error', 'Can not download file.');
    }
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
        // add last message to the chat
        await firestore()
          .collection('chats')
          .doc(chatId)
          .set({
            lastMessage: 'Image',
            lastMessageTime: firestore.FieldValue.serverTimestamp(),
            lastSenderName: user?.name || user?.email,
            lastSender: userId,
            messageType: 'image',
          }, { merge: true });
      } else {
        console.error('Upload failed:', json);
        Alert.alert('Upload failed', json.error?.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Image upload error:', err);
      Alert.alert('Error', 'Failed to upload image');
    }
  };
   const groupMessagesByDate = (messages: any[]) => {
    const grouped: any[] = [];
    let lastDate = '';
  
    messages.forEach((msg) => {
      const dateStr = moment(msg.timestamp?.toDate?.() || new Date()).format('YYYY-MM-DD');
      if (dateStr !== lastDate) {
        grouped.push({ type: 'date', date: dateStr });
        lastDate = dateStr;
      }
      grouped.push({ type: 'message', ...msg });
    });
  
    return grouped;
  };
  
  const formatDisplayDate = (dateStr: string) => {
    const today = moment().startOf('day');
    const target = moment(dateStr);
  
    if (target.isSame(today, 'day')) return 'Today';
    if (target.isSame(today.clone().subtract(1, 'day'), 'day')) return 'Yesterday';
    if (target.isAfter(today.clone().subtract(6, 'days')))
      return target.format('dddd').charAt(0).toUpperCase() + target.format('dddd').slice(1); 
    return target.format('D MMMM'); 
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        // behavior={Platform.OS === "ios" ? "padding" : "padding"}
        // keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0} // iOS: tùy chỉnh offset theo header

        style={styles.keyboardAvoid}
      >
        <View style={{ flex: 1 }}>
          
        {/* Header */}
        <View style={styles.header}>
          {/* <CallStarter user={user} chatId={chatId}/> */}
        <View style={{flexDirection:'row', alignItems: 'center'}}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Icon name="chevron-left" size={24} color="#5B72EF" />
          </TouchableOpacity>
          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => navigation.navigate('ChatMembers', {chatId: chatId, currentUserId: userId })}>
          <Image  source={
              avatar
                ? { uri: avatar }
                : require('../assets/default-avatar.png') 
            } style={styles.avatar} />
          <Text style={styles.headerName}>{name}</Text>


          </TouchableOpacity>
          
        </View>
            {/* Buttons for voice call */}
            <View style={styles.callButtons}>
              <CallStarter user={user} chatId={chatId}/>

            {/* <TouchableOpacity onPress={startVoiceCall} style={styles.voiceCallButton}>
              <Text style={styles.voiceCallButtonText}>Voice call</Text>
            </TouchableOpacity> */}
            </View>
        </View>
        
        {/* Messages */}
        <FlatList
          data={groupMessagesByDate(messages)}
          ref={flatListRef}
          keyExtractor={(_, index) => index.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          onLayout={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: false });
            }
          }}
          renderItem={({ item }) => {
            if (item.type === 'date') {
              return (
                <View style={{ alignItems: 'center', marginVertical: 10 }}>
                  <Text style={{ fontSize: 12, color: '#7F8C9D' }}>
                    {formatDisplayDate(item.date)}
                  </Text>
                </View>
              );
            }

            const isCurrentUser = item.from === userId;
            const avatar = userAvatars[item.from] || '';
            const userName = userNames[item.from] || "Unknown User";

            return (
              <View style={[
                styles.messageContainer,
                isCurrentUser ? styles.sentContainer : styles.receivedContainer
              ]}>
                {!isCurrentUser && (
                  <Image
                    source={avatar ? { uri: avatar } : require('../assets/default-avatar.png')}
                    style={styles.messageAvatar}
                  />
                )}
                <View style={styles.messageContentContainer}>
                  {!isCurrentUser && (
                    <Text style={styles.messageSenderName}>{userName}</Text>
                  )}
                  {item.text && (
                    <View style={[
                      styles.messageBubble,
                      isCurrentUser ? styles.sentBubble : styles.receivedBubble
                    ]}>
                      <Text style={isCurrentUser ? styles.sentText : styles.receivedText}>
                        {item.text}
                      </Text>
                    </View>
                  )}
                  {item.imageUrl && (
                    <TouchableOpacity
                      onPress={() => setSelectedImage(item.imageUrl)}
                      style={[
                        styles.imageContainer,
                        isCurrentUser ? styles.sentImageContainer : styles.receivedImageContainer
                      ]}
                    >
                      <Image source={{ uri: item.imageUrl }} style={styles.imageMessage} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                  {item.fileURL && (
                    <TouchableOpacity
                      onPress={() => handleFileDownload(item.fileURL, item.fileName)}
                      style={[
                        styles.fileContainer,
                        isCurrentUser ? styles.sentFileContainer : styles.receivedFileContainer
                      ]}
                    >
                      <View style={styles.fileIconContainer}>
                        <Icon name="file" size={24} color="#4285F4" />
                      </View>
                      <Text style={styles.fileName} numberOfLines={1} ellipsizeMode="middle">
                        {item.fileName || 'File'}
                      </Text>
                    </TouchableOpacity>
                  )}
                  <Text style={[
                    styles.timeStamp,
                    { alignSelf: isCurrentUser ? 'flex-end' : 'flex-start' }
                  ]}>
                    {item.timestamp ? moment(item.timestamp.toDate()).format('HH:mm') : ''}
                  </Text>
                </View>
                {isCurrentUser && (
                  <Image source = {user?.avatar?.url ? { uri: user?.avatar?.url } : require('../assets/default-avatar.png')} style={styles.messageAvatar} />
                )}
              </View>
            );
          }}
        />


        {/* Input Area */}
        <View style={styles.inputContainer}>
          <FileUpload onFileUploaded={(url, fileName) => uploadFile(url, fileName)} />

          <TouchableOpacity onPress={handlePickImage} style={styles.attachButton}>
            <Icon name="file-image" size={18} color="#5B72EF" />
          </TouchableOpacity>
          
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Type a message..."
            placeholderTextColor="#9DA3B4"
            style={styles.input}
            multiline
          />
          
          <TouchableOpacity 
            onPress={handleSend} 
            style={[
              styles.sendButton,
              message.trim() === "" ? styles.sendButtonDisabled : styles.sendButtonActive
            ]}
            disabled={message.trim() === ""}
          >
            <Icon name="paper-plane" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <ImageModal visible={!!selectedImage} imageUrl={selectedImage} onClose={() => setSelectedImage(null)} />
     
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  callButtons: {
    // marginTop: 10,
    flexDirection: 'row',
    // marginLeft: 90,
    // justifyContent: 'space-between',
    // backgroundColor:'red',
    paddingHorizontal: 20,
  },
  voiceCallButton: {
    backgroundColor: '#5B72EF',
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceCallButtonText: {
    padding:2,
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff'
  },
  keyboardAvoid: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    // padding: ,
    borderBottomWidth: 1,
    borderBottomColor: '#E9EDF5',
    backgroundColor: '#FFFFFF',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  backButton: {
    marginHorizontal: 12,
    // padding: 4
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginLeft: 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#E9EDF5'
  },
  headerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C3E50'
  },
  messagesList: {
    paddingVertical: 16,
    paddingHorizontal: 16
  },
  messageContainer: {
    flexDirection: 'row',
    marginVertical: 8,
    alignItems: 'flex-end',
  },
  sentContainer: {
    justifyContent: 'flex-end',
  },
  receivedContainer: {
    justifyContent: 'flex-start',
  },
  messageContentContainer: {
    maxWidth: '70%',
    marginHorizontal: 8,
  },
  messageBubble: {
    padding: 12,
    borderRadius: 18,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 1,
  },
  sentBubble: {
    backgroundColor: '#5B72EF',
    borderBottomRightRadius: 4,
    alignSelf: 'flex-end'
  },
  receivedBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#E9EDF5'
  },
  sentText: {
    color: '#FFFFFF',
    fontSize: 13
  },
  receivedText: {
    color: '#2C3E50',
    fontSize: 13
  },
  messageAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E9EDF5'
  },
  messageSenderName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#7F8C9D',
    marginBottom: 4
  },
  imageContainer: {
    marginVertical: 4,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3
  },
  sentImageContainer: {
    alignSelf: 'flex-end'
  },
  receivedImageContainer: {
    alignSelf: 'flex-start'
  },
  imageMessage: {
    width: 220,
    height: 220,
    borderRadius: 16
  },
  timeStamp: {
    fontSize: 11,
    color: '#95A5A6',
    marginTop: 4,
    marginHorizontal: 4
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    marginBottom: 5,
    maxWidth: '80%',
  },
  sentFileContainer: {
    backgroundColor: '#DCF8C6',
    alignSelf: 'flex-end',
    width: 140,
  },
  receivedFileContainer: {
    backgroundColor: '#ECECEC',
    alignSelf: 'flex-start',
    width: 'auto',
    maxWidth: '80%',
  },
  fileIconContainer: {
    marginRight: 10,
  },
  fileName: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E9EDF5',
    alignItems: 'center'
  },
  attachButton: {
    marginRight: 10,
    padding: 4,
    borderRadius: 20,
    backgroundColor: '#F7F9FC'
  },
  input: {
    flex: 1,
    backgroundColor: '#F7F9FC',
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: '#2C3E50',
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#E9EDF5'
  },
  sendButton: {
    marginLeft: 10,
    width: 34,
    height: 34,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center'
  },
  sendButtonActive: {
    backgroundColor: '#5B72EF',
  },
  sendButtonDisabled: {
    backgroundColor: '#BDC3C7',
  }
});

export default ChatScreen;