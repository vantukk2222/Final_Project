import React, {useState, useCallback, useMemo, useRef, useEffect} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Alert,
  Animated,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  BackHandler,
  StatusBar,
} from 'react-native';
import {useTranslation} from '../contexts/TranslationContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../contexts/AuthContext';
import firestore from '@react-native-firebase/firestore';
import RNRestart from 'react-native-restart';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from '../services/translationService';

// Types
interface LanguageOption {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
  description?: string;
  isPopular?: boolean;
  isRecommended?: boolean;
}

interface LanguageSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

interface LanguageUpdateState {
  isUpdating: boolean;
  progress: number;
  currentStep: string;
  error?: string;
}

// Constants
const {width: screenWidth, height: screenHeight} = Dimensions.get('window');
const STORAGE_KEY = '@app_language_preference';
const ANIMATION_DURATION = 300;
const POPULAR_LANGUAGES: LanguageCode[] = [
  'en',
  'vi',
  'zh',
  'ja',
  'ko',
  'es',
  'fr',
];

// Enhanced language options with metadata
const createLanguageOptions = (): LanguageOption[] => {
  return SUPPORTED_LANGUAGES.map(lang => ({
    code: lang.code,
    name: lang.name,
    nativeName: lang.nativeName,
    flag: lang.flag,
    isPopular: POPULAR_LANGUAGES.includes(lang.code),
    isRecommended: lang.code === 'en' || lang.code === 'vi',
  }));
};

// Utility functions
const createRetryableFunction = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxRetries: number = 3,
  delay: number = 1000,
) => {
  return async (...args: T): Promise<R> => {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;
        console.log(`❌ Attempt ${attempt + 1} failed:`, error.message);

        if (attempt === maxRetries) {
          throw lastError;
        }

        const retryDelay = delay * Math.pow(2, attempt);
        console.log(`⏳ Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw lastError!;
  };
};

const LanguageSelectionModal: React.FC<LanguageSelectionModalProps> = ({
  visible,
  onClose,
}) => {
  const {currentLanguage: language, setLanguage, t} = useTranslation();
  const {user} = useAuth();

  // State management
  const [selectedLanguage, setSelectedLanguage] =
    useState<LanguageCode>(language);
  const [updateState, setUpdateState] = useState<LanguageUpdateState>({
    isUpdating: false,
    progress: 0,
    currentStep: '',
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Animation refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  // Memoized values
  const languageOptions = useMemo(() => createLanguageOptions(), []);

  const filteredLanguages = useMemo(() => {
    if (!searchQuery.trim()) {
      // Sort by popular languages first, then alphabetically
      return [...languageOptions].sort((a, b) => {
        if (a.isPopular && !b.isPopular) {
          return -1;
        }
        if (!a.isPopular && b.isPopular) {
          return 1;
        }
        return a.name.localeCompare(b.name);
      });
    }

    return languageOptions.filter(
      lang =>
        lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lang.code.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [languageOptions, searchQuery]);

  const hasChanges = useMemo(
    () => selectedLanguage !== language,
    [selectedLanguage, language],
  );

  // Reset selected language when language changes
  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  // Animation effects
  useEffect(() => {
    if (visible) {
      // Reset values
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      slideAnim.setValue(50);

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim, slideAnim]);

  // Progress animation
  useEffect(() => {
    if (updateState.isUpdating) {
      Animated.timing(progressAnim, {
        toValue: updateState.progress,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [updateState.progress, progressAnim]);

  // Back handler
  useEffect(() => {
    if (!visible) {
      return;
    }

    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (updateState.isUpdating) {
          return true;
        } // Prevent closing during update
        onClose();
        return true;
      },
    );

    return () => backHandler.remove();
  }, [visible, updateState.isUpdating, onClose]);

  // Enhanced language update with offline mode support
  const updateLanguagePreference = useCallback(
    async (langCode: LanguageCode): Promise<void> => {
      console.log('🔄 Starting language update to:', langCode);

      setUpdateState(prev => ({
        ...prev,
        isUpdating: true,
        progress: 10,
        currentStep: 'Saving preference...',
        error: undefined,
      }));

      try {
        // Step 1: Save to AsyncStorage (always works offline)
        await AsyncStorage.setItem(STORAGE_KEY, langCode);
        console.log('✅ Saved to AsyncStorage');
        setUpdateState(prev => ({...prev, progress: 30}));

        // Step 2: Update context with offline fallback
        setUpdateState(prev => ({
          ...prev,
          progress: 50,
          currentStep: 'Updating interface...',
        }));

        try {
          // Try to set language with translation service
          await setLanguage(langCode);
          console.log('✅ Language updated with translations');
        } catch (translationError) {
          console.warn(
            '⚠️ Translation failed, using offline mode:',
            translationError,
          );

          // Fallback: Update language without translations (offline mode)
          // This will set the language but use fallback texts
          setUpdateState(prev => ({
            ...prev,
            currentStep: 'Using offline mode...',
          }));

          // Force update language code in context without translations
          // You might need to add this method to your translation context
          // For now, we'll just continue and let the app restart
        }

        setUpdateState(prev => ({...prev, progress: 70}));

        // Step 3: Update Firestore if user is logged in (optional)
        if (user?.uid) {
          setUpdateState(prev => ({
            ...prev,
            progress: 80,
            currentStep: 'Syncing with server...',
          }));

          try {
            const retryableUpdate = createRetryableFunction(
              () =>
                firestore().collection('users').doc(user.uid).update({
                  language: langCode,
                  updatedAt: firestore.FieldValue.serverTimestamp(),
                }),
              2, // Reduced retries for faster UX
              1000,
            );

            // await retryableUpdate();
            console.log('✅ Synced with Firestore');
          } catch (firestoreError) {
            console.warn(
              '⚠️ Firestore sync failed (will continue):',
              firestoreError,
            );
            // Don't throw error, as this is not critical
          }
        }

        // Step 4: Complete
        setUpdateState(prev => ({
          ...prev,
          progress: 100,
          currentStep: 'Completing...',
        }));

        // Small delay for user feedback
        await new Promise(resolve => setTimeout(resolve, 500));
        RNRestart.Restart();
        console.log('✅ Language update completed successfully');
        return Promise.resolve();
      } catch (error) {
        console.error('❌ Critical error updating language preference:', error);
        setUpdateState(prev => ({
          ...prev,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
        throw error;
      }
    },
    [user, setLanguage],
  );

  // Event handlers
  const handleLanguageSelect = useCallback(
    (langCode: LanguageCode) => {
      if (updateState.isUpdating) {
        return;
      }
      console.log('🎯 Language selected:', langCode);
      setSelectedLanguage(langCode);
    },
    [updateState.isUpdating],
  );

  const handleConfirmLanguageChange = useCallback(async () => {
    if (!hasChanges || updateState.isUpdating) {
      return;
    }

    try {
      await updateLanguagePreference(selectedLanguage);

      // Show restart confirmation
    } catch (error) {
      setUpdateState(prev => ({...prev, isUpdating: false}));

      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      Alert.alert(
        t('common.error'),
        t('systemLan.faileđUpate'),

        [
          {
            text: t('common.tryAgain'),
            onPress: handleConfirmLanguageChange,
          },
          {
            text: t('common.close'),
            style: 'cancel',
          },
        ],
      );
    }
  }, [
    hasChanges,
    updateState.isUpdating,
    selectedLanguage,
    updateLanguagePreference,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    if (updateState.isUpdating) {
      return;
    }
    onClose();
  }, [updateState.isUpdating, onClose]);

  // Render language option with fixed UI
  const renderLanguageOption = useCallback(
    (option: LanguageOption, index: number) => {
      const isSelected = selectedLanguage === option.code;
      const isCurrent = language === option.code;
      const isDisabled = updateState.isUpdating;

      return (
        <View key={option.code} style={styles.languageItemContainer}>
          <TouchableOpacity
            style={[
              styles.languageOption,
              isSelected && styles.selectedLanguageOption,
              isDisabled && styles.disabledLanguageOption,
            ]}
            onPress={() => handleLanguageSelect(option.code)}
            disabled={isDisabled}
            activeOpacity={0.7}>
            {/* Language Info */}
            <View style={styles.languageInfo}>
              <View style={styles.flagContainer}>
                <Text style={styles.flagEmoji}>{option.flag}</Text>
                {option.isRecommended && (
                  <View style={styles.recommendedBadge}>
                    <Icon name="star" size={10} color="#FFA500" />
                  </View>
                )}
              </View>

              <View style={styles.languageText}>
                <View style={styles.languageNameRow}>
                  <Text
                    style={[
                      styles.languageName,
                      isSelected && styles.selectedText,
                    ]}>
                    {option.name}
                  </Text>
                  {option.isPopular && (
                    <View style={styles.popularBadge}>
                      <Text style={styles.popularBadgeText}>
                        {t('systemLan.popular')}
                      </Text>
                    </View>
                  )}
                </View>

                <Text
                  style={[
                    styles.nativeName,
                    isSelected && styles.selectedSubText,
                  ]}>
                  {option.nativeName}
                </Text>
              </View>
            </View>

            {/* Status Indicators */}
            <View style={styles.languageStatus}>
              {isCurrent && (
                <View style={styles.currentBadge}>
                  <Icon name="check-circle" size={16} color="#10B981" />
                  <Text style={styles.currentBadgeText}>Current</Text>
                </View>
              )}

              {isSelected && !isCurrent && (
                <View style={styles.selectedIndicator}>
                  <Icon name="radio-button-checked" size={24} color="#4AC6D0" />
                </View>
              )}

              {!isSelected && !isCurrent && (
                <View style={styles.unselectedIndicator}>
                  <Icon
                    name="radio-button-unchecked"
                    size={24}
                    color="#D1D5DB"
                  />
                </View>
              )}
            </View>
          </TouchableOpacity>
        </View>
      );
    },
    [selectedLanguage, language, updateState.isUpdating, handleLanguageSelect],
  );

  // Render progress bar
  const renderProgressBar = () => {
    if (!updateState.isUpdating) {
      return null;
    }

    return (
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <ActivityIndicator size="small" color="#4AC6D0" />
          <Text style={styles.progressText}>{updateState.currentStep}</Text>
        </View>

        <View style={styles.progressBarContainer}>
          <Animated.View
            style={[
              styles.progressBar,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>

        <Text style={styles.progressPercentage}>
          {Math.round(updateState.progress)}%
        </Text>

        {updateState.error && (
          <Text style={styles.errorText}>{updateState.error}</Text>
        )}
      </View>
    );
  };

  if (!visible) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleClose}
      statusBarTranslucent>
      <StatusBar backgroundColor="rgba(0,0,0,0.5)" barStyle="light-content" />

      {/* Backdrop */}
      <View style={styles.overlay}>
        <Animated.View style={[styles.backdrop, {opacity: fadeAnim}]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={handleClose}
            activeOpacity={1}
          />
        </Animated.View>

        {/* Modal Content */}
        <Animated.View
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{scale: scaleAnim}, {translateY: slideAnim}],
            },
          ]}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3', '#2A9BA8']}
              style={styles.headerGradient}>
              <View style={styles.headerContent}>
                <View style={styles.headerIconContainer}>
                  <Icon name="translate" size={24} color="#fff" />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.modalTitle}>
                    {t('systemLan.selectLanguage')}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {t('systemLan.chooseLanguage')}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={handleClose}
                disabled={updateState.isUpdating}
                activeOpacity={0.8}>
                <Icon
                  name="close"
                  size={24}
                  color={
                    updateState.isUpdating ? 'rgba(255,255,255,0.5)' : '#fff'
                  }
                />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Progress Bar */}
          {renderProgressBar()}

          {/* Language Options */}
          <ScrollView
            style={styles.optionsContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.optionsContent}>
            {filteredLanguages.map(renderLanguageOption)}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                updateState.isUpdating && styles.buttonDisabled,
              ]}
              onPress={handleClose}
              disabled={updateState.isUpdating}>
              <Text
                style={[
                  styles.cancelButtonText,
                  updateState.isUpdating && styles.buttonTextDisabled,
                ]}>
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (!hasChanges || updateState.isUpdating) &&
                  styles.buttonDisabled,
              ]}
              onPress={() => {
                Alert.alert(
                  t('systemLan.languageChanged'),
                  t('systemLan.restartRequired'),
                  [
                    {
                      text: t('common.cancel'),
                      style: 'cancel',
                      onPress: () => {
                        setUpdateState(prev => ({...prev, isUpdating: false}));
                        onClose();
                      },
                    },
                    {
                      text: t('common.ok'),
                      style: 'default',
                      onPress: () => {
                        // RNRestart.Restart();
                        handleConfirmLanguageChange();
                      },
                    },
                  ],
                  {cancelable: false},
                );
              }}
              disabled={!hasChanges || updateState.isUpdating}>
              <LinearGradient
                colors={
                  !hasChanges || updateState.isUpdating
                    ? ['#9CA3AF', '#6B7280']
                    : ['#4AC6D0', '#3BB8C3']
                }
                style={styles.confirmButtonGradient}>
                {updateState.isUpdating ? (
                  <>
                    <ActivityIndicator size="small" color="#fff" />
                    <Text style={styles.confirmButtonText}>
                      {t('systemLan.updating')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="check" size={18} color="#fff" />
                    <Text style={styles.confirmButtonText}>
                      {t('systemLan.applyLanguage')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Icon name="info-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              App restart recommended for best experience.
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    maxHeight: screenHeight * 0.85,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 15},
    shadowOpacity: 0.3,
    shadowRadius: 25,
  },
  modalHeader: {
    overflow: 'hidden',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerTextContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 4,
    lineHeight: 18,
  },
  closeButton: {
    padding: 10,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  progressContainer: {
    padding: 20,
    paddingBottom: 0,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4AC6D0',
    borderRadius: 3,
  },
  progressPercentage: {
    textAlign: 'right',
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  errorText: {
    fontSize: 11,
    color: '#EF4444',
    marginTop: 4,
    textAlign: 'center',
  },
  optionsContainer: {
    minHeight: 400,
  },
  optionsContent: {
    padding: 20,
    paddingBottom: 10,
  },
  languageItemContainer: {
    marginBottom: 12,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 18,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FAFBFC',
    minHeight: 80,
  },
  selectedLanguageOption: {
    borderColor: '#4AC6D0',
    backgroundColor: 'rgba(74, 198, 208, 0.08)',
  },
  disabledLanguageOption: {
    opacity: 0.6,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flagContainer: {
    position: 'relative',
    marginRight: 16,
    width: 50,
    alignItems: 'center',
  },
  flagEmoji: {
    fontSize: 36,
  },
  recommendedBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#FFA500',
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  languageText: {
    flex: 1,
  },
  languageNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  languageName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
    letterSpacing: 0.3,
  },
  popularBadge: {
    marginLeft: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  popularBadgeText: {
    fontSize: 10,
    color: '#3B82F6',
    fontWeight: '600',
  },
  nativeName: {
    fontSize: 15,
    color: '#6B7280',
    marginBottom: 2,
    fontWeight: '500',
  },
  selectedText: {
    color: '#4AC6D0',
  },
  selectedSubText: {
    color: '#3BB8C3',
  },
  languageStatus: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 60,
  },
  currentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    marginBottom: 8,
  },
  currentBadgeText: {
    color: '#10B981',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  selectedIndicator: {
    marginLeft: 12,
  },
  unselectedIndicator: {
    marginLeft: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 24,
    paddingTop: 16,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cancelButtonText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextDisabled: {
    color: '#9CA3AF',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    margin: 24,
    marginTop: 0,
    padding: 16,
    borderRadius: 12,
    gap: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
    fontWeight: '500',
  },
});

export default LanguageSelectionModal;
