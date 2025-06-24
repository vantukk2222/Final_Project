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
  ActivityIndicator,
  Animated,
} from 'react-native';
import {combinedLanguages} from '../contains/lan_code';
import firestore from '@react-native-firebase/firestore';
import {useAuth} from '../contexts/AuthContext';
import {useSocket} from '../contexts/SocketContext';
import {useTranslation} from '../contexts/TranslationContext'; // ✅ Thêm hook translation
import {Member} from '../contains/type';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';

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

    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(animatedValue, {
        toValue: isSelected ? 1 : 0,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }, [isSelected, animatedValue]);

    const backgroundColor = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#F8FAFC', '#E0F7FA'],
    });

    const borderColor = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['#E2E8F0', '#4AC6D0'],
    });

    return (
      <Pressable onPress={handlePress}>
        <Animated.View
          style={[
            styles.languageItem,
            {
              backgroundColor,
              borderColor,
              borderWidth: isSelected ? 2 : 1,
            },
          ]}>
          <View style={styles.languageItemContent}>
            <Text style={styles.languageFlag}>{item.flag}</Text>
            <Text
              style={[
                styles.languageText,
                isSelected && styles.selectedLanguageText,
              ]}>
              {item.name}
            </Text>
          </View>
          {isSelected && (
            <Icon
              name="check-circle"
              size={22}
              color="#4AC6D0"
              style={styles.checkIcon}
            />
          )}
        </Animated.View>
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
  const {t} = useTranslation();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLang, setSelectedLang] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasScrolledToSelected, setHasScrolledToSelected] = useState(false);
  const [error, setError] = useState(null); // ✅ Thêm error state
  const flatListRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animate modal entrance
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
      setHasScrolledToSelected(false);
      setError(null);
    } else {
      fadeAnim.setValue(0);
    }
  }, [visible, fadeAnim]);

  // Memoize filtered languages
  const filteredLanguages = useMemo(() => {
    if (searchQuery.trim() === '') {
      return combinedLanguages;
    }
    return combinedLanguages.filter(lang =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

  const keyExtractor = useCallback(item => item.code, []);

  const getItemLayout = useCallback(
    (data, index) => ({
      length: 48, // Updated to match actual item height
      offset: 48 * index,
      index,
    }),
    [],
  );

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

  // Load user's current language from Firestore
  useEffect(() => {
    if (!visible || !user?.uid) {
      return;
    }

    const unsubscribe = firestore()
      .collection('users')
      .doc(user.uid)
      .onSnapshot(
        doc => {
          const data = doc.data();
          if (data && data.language) {
            const foundLang = combinedLanguages.find(
              lang => lang.code === data.language,
            );
            if (foundLang) {
              setSelectedLang({
                code: data.language,
                transCode: data.translateCode || data.language,
                name: foundLang.name,
                flag: foundLang.flag,
              });
            }
          } else {
            // Set default to English if no language is set
            const defaultLang = combinedLanguages.find(
              lang => lang.code === 'en',
            );
            if (defaultLang) {
              setSelectedLang({
                code: 'en',
                transCode: 'en',
                name: defaultLang.name,
                flag: defaultLang.flag,
              });
            }
          }
        },
        error => {
          console.error('Error loading user language:', error);
          setError(t('lanSelect.networkError'));
        },
      );

    return () => unsubscribe();
  }, [visible, user?.uid, t]);

  const handleSearchChange = useCallback(text => {
    setSearchQuery(text);
    setHasScrolledToSelected(false); // Reset scroll state when searching
  }, []);

  const handleCancel = useCallback(() => {
    setSelectedLang(null);
    setSearchQuery('');
    setHasScrolledToSelected(false);
    setError(null);
    onDone(null);
  }, [onDone]);

  // Scroll to selected language with improved logic
  const scrollToSelectedLanguage = useCallback(() => {
    if (
      !flatListRef.current ||
      !selectedLang ||
      hasScrolledToSelected ||
      filteredLanguages.length === 0
    ) {
      return;
    }

    const selectedIndex = filteredLanguages.findIndex(
      lang => lang.code === selectedLang.code,
    );

    if (selectedIndex >= 0) {
      setTimeout(() => {
        try {
          flatListRef.current?.scrollToIndex({
            index: selectedIndex,
            animated: true,
            viewPosition: 0.5, // Center the item
          });
          setHasScrolledToSelected(true);
        } catch (error) {
          // Fallback to scroll to offset if scrollToIndex fails
          console.log('ScrollToIndex failed, using scrollToOffset');
          flatListRef.current?.scrollToOffset({
            offset: selectedIndex * 48,
            animated: true,
          });
          setHasScrolledToSelected(true);
        }
      }, 300); // Give time for modal animation to complete
    }
  }, [selectedLang, filteredLanguages, hasScrolledToSelected]);

  // Trigger scroll when modal is visible and data is ready
  useEffect(() => {
    if (
      visible &&
      selectedLang &&
      filteredLanguages.length > 0 &&
      !hasScrolledToSelected
    ) {
      scrollToSelectedLanguage();
    }
  }, [
    visible,
    selectedLang,
    filteredLanguages,
    hasScrolledToSelected,
    scrollToSelectedLanguage,
  ]);

  // Reset scroll state when search query changes
  useEffect(() => {
    if (searchQuery === '' && selectedLang && !hasScrolledToSelected) {
      // When clearing search, scroll to selected item after a delay
      setTimeout(() => {
        scrollToSelectedLanguage();
      }, 100);
    }
  }, [
    searchQuery,
    selectedLang,
    hasScrolledToSelected,
    scrollToSelectedLanguage,
  ]);

  const getChatMembers = useCallback(
    async meetingId => {
      try {
        const chatRef = firestore().collection('chats').doc(meetingId);
        const chatDoc = await chatRef.get();

        if (!chatDoc.exists) {
          console.warn('Chat not found:', meetingId);
          return [];
        }

        const chatData = chatDoc.data();
        const members = chatData?.members || [];
        return members;
      } catch (error) {
        console.error('Error fetching chat members:', error);
        throw new Error(t('lanSelect.networkError'));
      }
    },
    [t],
  );

  const confirmLanguageAndNavigate = useCallback(async () => {
    if (!selectedLang) {
      setError(t('lanSelect.languageRequired'));
      return;
    }

    setIsProcessing(true);
    setLoading(true);
    setError(null);

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
      console.log('Language updated successfully:', selectedLang);

      const socketReady = await waitForConnection(5000);
      console.log('Socket ready:', socketReady);
      if (socketReady) {
        console.log(
          'user lang and transCode',
          selectedLang.code,
          selectedLang.transCode,
        );
        emit('start_call', {
          meetingId: chatId,
          fromUserId: user.uid,
          memberIds: chatMembers.filter(uid => uid !== user.uid),
          user: {
            uid: user.uid,
            language: selectedLang.code, // 'vi-Vn'
            translateCode: selectedLang.transCode, // 'vi'
          },
        });
        // emit('join_meeting', {
        //   meetingId: chatId,
        //   user: {
        //     uid: user.uid,
        //     language: selectedLang.code, // 'vi-VN'
        //     translateCode: selectedLang.transCode, // 'en-US'
        //   },
        // });
      }

      navigation.navigate('VoiceCall', {
        meetingId: chatId,
      });

      onDone(false);
    } catch (err) {
      console.error('Error updating language:', err);
      setError(t('lanSelect.failedToStartCall'));
    } finally {
      setIsProcessing(false);
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
    t,
  ]);

  const handleConfirm = useCallback(() => {
    if (selectedLang && !isProcessing) {
      confirmLanguageAndNavigate();
    }
  }, [selectedLang, isProcessing, confirmLanguageAndNavigate]);

  // Handle scroll to index failed
  const handleScrollToIndexFailed = useCallback(
    info => {
      console.log('ScrollToIndex failed:', info);
      // Fallback to scroll to offset
      setTimeout(() => {
        if (flatListRef.current && filteredLanguages.length > 0) {
          const offset =
            Math.min(info.index, filteredLanguages.length - 1) * 48;
          flatListRef.current.scrollToOffset({
            offset,
            animated: true,
          });
          setHasScrolledToSelected(true);
        }
      }, 100);
    },
    [filteredLanguages.length],
  );

  // ✅ Render empty state
  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Icon name="search-off" size={48} color="#9CA3AF" />
      <Text style={styles.emptyStateText}>
        {t('lanSelect.noLanguagesFound')}
      </Text>
    </View>
  );

  // ✅ Render error state
  const renderError = () => {
    if (!error) {
      return null;
    }

    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={20} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              opacity: fadeAnim,
              transform: [
                {
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                },
              ],
            },
          ]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.modalIcon}>
              <Icon name="translate" size={24} color="#fff" />
            </LinearGradient>
            <Text style={styles.modalTitle}>{t('lanSelect.title')}</Text>
            <Text style={styles.modalSubtitle}>{t('lanSelect.subtitle')}</Text>
          </View>

          {/* Error Display */}
          {renderError()}

          {/* Search Input */}
          <View style={styles.searchContainer}>
            <Icon
              name="search"
              size={16}
              color="#6B7280"
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholderTextColor="#9CA3AF"
              placeholder={t('lanSelect.searchPlaceholder')}
              value={searchQuery}
              onChangeText={handleSearchChange}
              clearButtonMode="while-editing"
              autoCorrect={false}
              autoCapitalize="none"
              editable={!isProcessing}
            />
          </View>

          {/* Language List */}
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
            onScrollToIndexFailed={handleScrollToIndexFailed}
            ListEmptyComponent={renderEmptyState}
            scrollEnabled={!isProcessing}
          />

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              onPress={handleCancel}
              style={[
                styles.cancelButton,
                isProcessing && styles.disabledButton,
              ]}
              disabled={isProcessing}>
              <Text
                style={[
                  styles.cancelButtonText,
                  isProcessing && styles.disabledButtonText,
                ]}>
                {t('lanSelect.cancel')}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleConfirm}
              style={[
                styles.confirmButton,
                (!selectedLang || isProcessing) && styles.disabledButton,
              ]}
              disabled={!selectedLang || isProcessing}>
              <LinearGradient
                colors={
                  !selectedLang || isProcessing
                    ? ['#BDC3C7', '#BDC3C7']
                    : ['#4AC6D0', '#3BB8C3']
                }
                style={styles.confirmButtonGradient}>
                {isProcessing ? (
                  <>
                    <ActivityIndicator color="#fff" size="small" />
                    <Text style={styles.confirmButtonText}>
                      {t('lanSelect.processing')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon
                      name="call"
                      size={18}
                      color="#fff"
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.confirmButtonText}>
                      {t('lanSelect.startCall')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Processing Status */}
          {isProcessing && (
            <View style={styles.processingContainer}>
              <Text style={styles.processingText}>
                {t('lanSelect.preparingCall')}
              </Text>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    maxHeight: '90%',
    elevation: 16,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 12},
    shadowOpacity: 0.3,
    shadowRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 198, 208, 0.1)',
  },
  modalHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  modalIcon: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  modalSubtitle: {
    fontSize: 15,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  errorText: {
    fontSize: 14,
    color: '#DC2626',
    marginLeft: 10,
    flex: 1,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    paddingHorizontal: 18,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingVertical: 14,
    fontWeight: '500',
  },
  languageList: {
    marginBottom: 24,
    maxHeight: 360,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginBottom: 8,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  languageItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  languageFlag: {
    fontSize: 24,
    marginRight: 14,
  },
  languageText: {
    fontSize: 15,
    color: '#374151',
    fontWeight: '600',
  },
  selectedLanguageText: {
    color: '#4AC6D0',
    fontWeight: '800',
  },
  checkIcon: {
    marginLeft: 10,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    marginTop: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 16,
  },
  confirmButton: {
    flex: 1,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    borderRadius: 16,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    marginLeft: 6,
    letterSpacing: 0.3,
  },
  disabledButton: {
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#9CA3AF',
  },
  buttonIcon: {
    marginRight: 6,
  },
  processingContainer: {
    alignItems: 'center',
    marginTop: 16,
  },
  processingText: {
    fontSize: 14,
    color: '#64748B',
    fontStyle: 'italic',
    fontWeight: '500',
  },
});

export default LanguageModal;
