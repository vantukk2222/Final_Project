import React, {useEffect, useRef, useState} from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {combinedLanguages} from '../contains/lan_code';
import firestore from '@react-native-firebase/firestore';
import {useAuth} from '../contexts/AuthContext';
import {Member} from '../contains/type';
import {useNavigation} from '@react-navigation/native';

const LanguageModal = ({
  visible,
  chatId,
  onDone,
  setLoading,
  fromChatScreen = false,
}) => {
  const {user} = useAuth();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredLanguages, setFilteredLanguages] = useState(combinedLanguages);
  const [selectedLang, setSelectedLang] = useState(null);
  const socketRef = useRef(null);

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(doc => {
        const data = doc.data();
        if (data) {
          // if (data.language && data.translateCode && fromChatScreen && !visible) {
          //   navigation.navigate('VoiceCall', {
          //     meetingId: chatId,
          //   });
          //   onDone(false);
          // }
          setSelectedLang({
            code: data.language,
            transCode: data.translateCode,
            name:
              combinedLanguages.find(lang => lang.code === data.language)
                ?.name || 'Unknown',
          });
        }
      });

    return () => unsubscribe();
  }, [chatId]);

  useEffect(() => {
    async function setupSocket() {
      // Lấy token FCM
      const fcmToken = await messaging().getToken();
      console.log('FCM Token ne:', fcmToken);

      // Kết nối socket
      socketRef.current = io(SOCKET_SERVER_URL);

      socketRef.current.on('connect', () => {
        console.log('Socket connected:', socketRef.current.id);

        socketRef.current.emit('register', {
          userId: user.uid,
          fcmToken,
          from: 'voiceStart',
        });
      });

      socketRef.current.on('connect_error', error => {
        console.error('Socket connection error:', error);
      });
    }

    if (user?.uid) {
      setupSocket();
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [user]);

  // Filter khi search
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredLanguages(combinedLanguages);
    } else {
      setFilteredLanguages(
        combinedLanguages.filter(lang =>
          lang.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ),
      );
    }
  }, [searchQuery]);

  // Đóng modal
  const handleCancel = () => {
    setSelectedLang(null);
    setSearchQuery('');
    setFilteredLanguages(combinedLanguages);
    onDone(null);
  };

  // Xác nhận chọn ngôn ngữ
  const handleConfirm = () => {
    onDone(selectedLang);
    setSearchQuery('');
    setFilteredLanguages(combinedLanguages);
    confirmLanguageAndNavigate();
  };
  async function getChatMembers(meetingId) {
    try {
      const chatRef = firestore().collection('chats').doc(meetingId);
      const chatDoc = await chatRef.get();

      if (!chatDoc.exists) {
        console.warn('Chat not found:', meetingId);
        return;
      }

      const chatData = chatDoc.data();
      const members = chatData?.members || [];

      console.log('Members in this chat:', members);
      return members;
    } catch (error) {
      console.error('Error fetching chat members:', error);
    }
  }

  const confirmLanguageAndNavigate = async () => {
    setLoading(true);
    if (!selectedLang) {
      setLoading(false);
      return;
    }

    onDone(false);
    const updatedUser: Member = {
      uid: user.uid || user._user?.uid || '',
      email: user.email || user._user?.email || '',
      displayName: user.displayName || user._user?.displayName || '',
      photoURL: user.photoURL || user._user?.photoURL || '',
      language: selectedLang.code,
      translateCode: selectedLang.transCode,
      role: 'member',
    };

    const meetingRef = firestore().collection('meetings').doc(chatId);
    const chatMembers = await getChatMembers(chatId);

    console.log('chatMembers: ', chatMembers);
    let updatedMembers: Member[];

    try {
      const doc = await meetingRef.get();
      if (!doc.exists) {
        updatedUser.role = 'admin';
        await meetingRef.set({
          createdAt: firestore.Timestamp.now(),
          createdBy: updatedUser.uid,
          members: [updatedUser],
        });
        updatedMembers = [updatedUser];
      } else {
        const currentMembers = doc.data()?.members || [];
        const alreadyExists = currentMembers.find(
          (m: Member) => m.uid === updatedUser.uid,
        );

        if (alreadyExists) {
          updatedMembers = currentMembers.map((m: Member) =>
            m.uid === updatedUser.uid ? updatedUser : m,
          );
        } else {
          updatedMembers = [...currentMembers, updatedUser];
        }
        await meetingRef.update({members: updatedMembers});
      }

      if (user.uid) {
        await firestore().collection('users').doc(user.uid).update({
          language: selectedLang.code,
          translateCode: selectedLang.transCode,
        });
        await firestore().collection('meetings').doc(chatId).set(
          {
            updatedAt: Date.now(),
          },
          {merge: true},
        );
      }

      // Gửi sự kiện start_call qua socket
      console.log(
        'memberids_ne: ',
        updatedMembers.map(m => m.uid),
      );
      if (socketRef.current) {
        socketRef.current.emit('start_call', {
          meetingId: chatId,
          fromUserId: user.uid,
          memberIds: chatMembers,
        });
        console.log('Đã gửi start_call qua socket');
      } else {
        console.warn('Socket chưa kết nối');
      }

      setLoading(false);

      navigation.navigate('VoiceCall', {
        meetingId: chatId,
      });
    } catch (err) {
      setLoading(false);
      console.error('Lỗi khi cập nhật Firestore:', err);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Your Language</Text>
          <View style={styles.separator} />
          <TextInput
            style={styles.searchInput}
            placeholderTextColor="#A0A3BD"
            placeholder="Search language..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            clearButtonMode="while-editing"
          />
          <FlatList
            data={filteredLanguages}
            keyExtractor={item => item.code}
            style={styles.languageList}
            showsVerticalScrollIndicator={false}
            initialScrollIndex={
              selectedLang
                ? Math.max(
                    0,
                    filteredLanguages.findIndex(
                      lang => lang.code === selectedLang.code,
                    ),
                  )
                : 0
            }
            getItemLayout={(_, index) => ({
              length: 53,
              offset: 57 * index,
              index,
            })}
            onScrollToIndexFailed={info => {
              setTimeout(() => {
                if (filteredLanguages.length > 0 && this.flatListRef) {
                  this.flatListRef.scrollToOffset({
                    offset: info.averageItemLength * info.index,
                    animated: true,
                  });
                }
              }, 100);
            }}
            ref={ref => {
              this.flatListRef = ref;
            }}
            renderItem={({item}) => (
              <Pressable
                style={[
                  styles.languageItem,
                  selectedLang?.code === item.code && styles.selectedLanguage,
                ]}
                onPress={() => setSelectedLang(item)}>
                <Text
                  style={[
                    styles.languageText,
                    selectedLang?.code === item.code &&
                      styles.selectedLanguageText,
                  ]}>
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.cancelButton}>
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              style={[
                styles.confirmButton,
                !selectedLang && styles.disabledButton,
              ]}
              disabled={!selectedLang}>
              <Text style={styles.buttonText}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 24,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  separator: {
    height: 2,
    backgroundColor: '#E0E0E0',
    marginBottom: 20,
    borderRadius: 1,
  },
  searchInput: {
    backgroundColor: '#F5F7FF',
    color: 'black',
    borderWidth: 1,
    borderColor: '#E6E8F0',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  languageList: {
    marginBottom: 20,
    maxHeight: 300,
  },
  languageItem: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: '#F5F7FF',
    borderWidth: 1,
    borderColor: '#E6E8F0',
  },
  selectedLanguage: {
    backgroundColor: '#E7EFFF',
    borderColor: '#4361EE',
    borderWidth: 2,
  },
  languageText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  selectedLanguageText: {
    color: '#4361EE',
    fontWeight: 'bold',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  confirmButton: {
    backgroundColor: '#4361EE',
    padding: 16,
    borderRadius: 16,
    flex: 1,
    marginLeft: 10,
    elevation: 4,
    shadowColor: '#4361EE',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  cancelButton: {
    backgroundColor: 'red',
    padding: 16,
    borderRadius: 16,
    flex: 1,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E6E8F0',
  },
  disabledButton: {
    backgroundColor: '#A8B8FF',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default LanguageModal;
