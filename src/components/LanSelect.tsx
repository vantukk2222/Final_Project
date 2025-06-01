import React, {useEffect, useRef, useState, useCallback, useMemo} from 'react';
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
import {useSocket} from '../contexts/SocketContext';
import {Member} from '../contains/type';
import {useNavigation} from '@react-navigation/native';

// Optimized Language Item Component
const LanguageItem = React.memo(
  ({
    item,
    isSelected,
    onPress,
  }: {
    item: any;
    isSelected: boolean;
    onPress: (item: any) => void;
  }) => {
    const handlePress = useCallback(() => {
      onPress(item);
    }, [item, onPress]);

    return (
      <Pressable
        style={[styles.languageItem, isSelected && styles.selectedLanguage]}
        onPress={handlePress}>
        <Text
          style={[
            styles.languageText,
            isSelected && styles.selectedLanguageText,
          ]}>
          {item.name}
        </Text>
      </Pressable>
    );
  },
);

const LanguageModal = ({
  visible,
  chatId,
  onDone,
  setLoading,
  fromChatScreen = false,
}) => {
  const {user} = useAuth();
  const {isConnected, emit, waitForConnection} = useSocket();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState(null);
  const flatListRef = useRef(null);

  // Memoize filtered languages để tránh re-calculate không cần thiết
  const filteredLanguages = useMemo(() => {
    if (searchQuery.trim() === '') {
      return combinedLanguages;
    }
    return combinedLanguages.filter(lang =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

  // Memoize keyExtractor
  const keyExtractor = useCallback(item => item.code, []);

  // Memoize getItemLayout for better performance
  const getItemLayout = useCallback(
    (data, index) => ({
      length: 57, // item height + margin
      offset: 57 * index,
      index,
    }),
    [],
  );

  // Optimized renderItem with useCallback
  const renderItem = useCallback(
    ({item}) => (
      <LanguageItem
        item={item}
        isSelected={selectedLang?.code === item.code}
        onPress={setSelectedLang}
      />
    ),
    [selectedLang?.code],
  );

  useEffect(() => {
    const unsubscribe = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(doc => {
        const data = doc.data();
        if (data) {
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
  }, [chatId, user.uid]);

  // Debounced search để giảm số lần re-render
  const handleSearchChange = useCallback(text => {
    setSearchQuery(text);
  }, []);

  // Đóng modal
  const handleCancel = useCallback(() => {
    setSelectedLang(null);
    setSearchQuery('');
    onDone(null);
  }, [onDone]);

  const getChatMembers = useCallback(async meetingId => {
    try {
      const chatRef = firestore().collection('chats').doc(meetingId);
      const chatDoc = await chatRef.get();

      if (!chatDoc.exists) {
        console.warn('Chat not found:', meetingId);
        return [];
      }

      const chatData = chatDoc.data();
      const members = chatData?.members || [];
      console.log('Members in this chat:', members);
      return members;
    } catch (error) {
      console.error('Error fetching chat members:', error);
      return [];
    }
  }, []);

  const confirmLanguageAndNavigate = useCallback(async () => {
    if (!selectedLang) {
      return;
    }

    setLoading(true);
    onDone(false);

    try {
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

      let updatedMembers: Member[];

      const doc = await meetingRef.get();
      if (!doc.exists) {
        updatedUser.role = 'admin';
        await meetingRef.set(
          {
            createdAt: firestore.Timestamp.now(),
            createdBy: updatedUser.uid,
            members: [updatedUser],
          },
          {merge: true},
        );
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

      // Update user language preference
      await Promise.all([
        firestore().collection('users').doc(user.uid).update({
          language: selectedLang.code,
          translateCode: selectedLang.transCode,
        }),
        firestore().collection('meetings').doc(chatId).set(
          {
            updatedAt: Date.now(),
          },
          {merge: true},
        ),
      ]);

      // Wait for socket connection before sending start_call
      console.log('LanSelect: Waiting for socket connection...');
      const socketReady = await waitForConnection(5000);

      if (socketReady) {
        console.log('LanSelect: Socket is ready, sending start_call event');
        emit('start_call', {
          meetingId: chatId,
          fromUserId: user.uid,
          memberIds: chatMembers,
        });
        console.log('LanSelect: Đã gửi start_call qua socket');
      } else {
        console.warn(
          'LanSelect: Socket not ready, proceeding without start_call event',
        );
      }

      // Navigate regardless of socket status
      navigation.navigate('VoiceCall', {
        meetingId: chatId,
      });
    } catch (err) {
      console.error('LanSelect: Lỗi khi cập nhật Firestore:', err);
    } finally {
      setLoading(false);
    }
  }, [
    selectedLang,
    user,
    chatId,
    getChatMembers,
    navigation,
    setLoading,
    onDone,
    waitForConnection,
    emit,
  ]);

  // Xác nhận chọn ngôn ngữ
  const handleConfirm = useCallback(() => {
    if (selectedLang) {
      onDone(selectedLang);
      setSearchQuery('');
      confirmLanguageAndNavigate();
    }
  }, [selectedLang, onDone, confirmLanguageAndNavigate]);

  // Scroll to selected language when modal opens
  useEffect(() => {
    if (
      visible &&
      selectedLang &&
      flatListRef.current &&
      filteredLanguages.length > 0
    ) {
      const index = filteredLanguages.findIndex(
        lang => lang.code === selectedLang.code,
      );
      if (index >= 0) {
        // Use setTimeout to ensure FlatList is rendered
        setTimeout(() => {
          flatListRef.current?.scrollToIndex({
            index,
            animated: true,
            viewPosition: 0.5,
          });
        }, 100);
      }
    }
  }, [visible, selectedLang, filteredLanguages]);

  // Don't render if not visible to save performance
  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Select Your Language</Text>
          <View style={styles.separator} />

          {/* Socket connection status indicator */}
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIndicator,
                {backgroundColor: isConnected ? '#10B981' : '#EF4444'},
              ]}
            />
            <Text style={styles.statusText}>
              {isConnected ? 'Connected' : 'Connecting...'}
            </Text>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholderTextColor="#A0A3BD"
            placeholder="Search language..."
            value={searchQuery}
            onChangeText={handleSearchChange}
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />

          <FlatList
            ref={flatListRef}
            data={filteredLanguages}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.languageList}
            showsVerticalScrollIndicator={false}
            getItemLayout={getItemLayout}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            windowSize={10}
            initialNumToRender={15}
            onScrollToIndexFailed={info => {
              setTimeout(() => {
                if (filteredLanguages.length > 0 && flatListRef.current) {
                  flatListRef.current.scrollToOffset({
                    offset: info.averageItemLength * info.index,
                    animated: true,
                  });
                }
              }, 100);
            }}
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

// ...existing styles...
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
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
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
    marginBottom: 4,
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
