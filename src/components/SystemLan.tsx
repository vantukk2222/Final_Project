import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Image,
  Alert,
  Animated,
  ScrollView,
} from 'react-native';
import {useTranslation, Language} from '../contexts/TranslationContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import LinearGradient from 'react-native-linear-gradient';
import {useAuth} from '../contexts/AuthContext';
import firestore from '@react-native-firebase/firestore';
import RNRestart from 'react-native-restart';
import {SUPPORTED_LANGUAGES} from '../services/translationService';

interface LanguageOption {
  code: Language;
  name: string;
  nativeName: string;
  flag: string;
  description?: string;
}

interface LanguageSelectionModalProps {
  visible: boolean;
  onClose: () => void;
}

const LanguageSelectionModal: React.FC<LanguageSelectionModalProps> = ({
  visible,
  onClose,
}) => {
  const {currentLanguage: language, setLanguage, t} = useTranslation();
  const {user} = useAuth();
  const [selectedLanguage, setSelectedLanguage] = useState<Language>(language);
  const [loading, setLoading] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  const languageOptions: LanguageOption[] = SUPPORTED_LANGUAGES.map(lang => ({
    code: lang.code,
    name: lang.name,
    nativeName: lang.nativeName,
    flag: lang.flag,
    // description: lang.description,
  }));

  React.useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleLanguageSelect = (langCode: Language) => {
    setSelectedLanguage(langCode);
  };

  const handleConfirmLanguageChange = async () => {
    if (selectedLanguage === language) {
      onClose();
      return;
    }

    setLoading(true);

    try {
      // Update language in context
      setLanguage(selectedLanguage);

      // Update user language preference in Firestore if user is logged in
      if (user?.uid) {
        await firestore().collection('users').doc(user.uid).update({
          language: selectedLanguage,
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      // Store language preference locally
      // You might want to use AsyncStorage for persistence

      Alert.alert(
        t('languageModal.languageChanged'),
        t('languageModal.restartRequired'),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
            onPress: () => {
              setLoading(false);
              onClose();
            },
          },
          {
            text: t('languageModal.restartNow'),
            onPress: () => {
              // Restart the app
              RNRestart.Restart();
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error updating language:', error);
      Alert.alert(t('common.error'), t('languageModal.failedToUpdateLanguage'));
      setLoading(false);
    }
  };

  const renderLanguageOption = (option: LanguageOption) => {
    const isSelected = selectedLanguage === option.code;
    const isCurrent = language === option.code;

    return (
      <TouchableOpacity
        key={option.code}
        style={[
          styles.languageOption,
          isSelected && styles.selectedLanguageOption,
        ]}
        onPress={() => handleLanguageSelect(option.code)}
        activeOpacity={0.7}>
        <View style={styles.languageInfo}>
          <Text style={styles.flagEmoji}>{option.flag}</Text>
          <View style={styles.languageText}>
            <Text
              style={[styles.languageName, isSelected && styles.selectedText]}>
              {option.name}
            </Text>
            <Text
              style={[styles.nativeName, isSelected && styles.selectedSubText]}>
              {option.nativeName}
            </Text>
            {/* <Text
              style={[
                styles.languageDescription,
                isSelected && styles.selectedSubText,
              ]}>
              {option.description}
            </Text> */}
          </View>
        </View>

        <View style={styles.languageStatus}>
          {isCurrent && (
            <View style={styles.currentBadge}>
              <Text style={styles.currentBadgeText}>
                {t('languageModal.current')}
              </Text>
            </View>
          )}
          {isSelected && (
            <View style={styles.selectedIndicator}>
              <Icon name="check-circle" size={24} color="#4AC6D0" />
            </View>
          )}
        </View>
      </TouchableOpacity>
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
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim,
            },
          ]}>
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            onPress={onClose}
            activeOpacity={1}
          />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContainer,
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
              style={styles.headerGradient}>
              <View style={styles.headerContent}>
                <View style={styles.headerIconContainer}>
                  <Icon name="language" size={24} color="#fff" />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.modalTitle}>
                    {t('languageModal.selectLanguage')}
                  </Text>
                  <Text style={styles.modalSubtitle}>
                    {t('languageModal.choosePreferredLanguage')}
                  </Text>
                </View>
              </View>

              {/* Close Button */}
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.8}>
                <Icon name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </LinearGradient>
          </View>

          {/* Language Options */}
          <ScrollView style={styles.optionsContainer}>
            {languageOptions.map(renderLanguageOption)}
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={loading}>
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.confirmButton,
                (loading || selectedLanguage === language) &&
                  styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirmLanguageChange}
              disabled={loading || selectedLanguage === language}>
              <LinearGradient
                colors={
                  loading || selectedLanguage === language
                    ? ['#9CA3AF', '#6B7280']
                    : ['#4AC6D0', '#3BB8C3']
                }
                style={styles.confirmButtonGradient}>
                {loading ? (
                  <>
                    <Icon name="refresh" size={18} color="#fff" />
                    <Text style={styles.confirmButtonText}>
                      {t('languageModal.updating')}
                    </Text>
                  </>
                ) : (
                  <>
                    <Icon name="check" size={18} color="#fff" />
                    <Text style={styles.confirmButtonText}>
                      {t('languageModal.applyLanguage')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Info Note */}
          <View style={styles.infoNote}>
            <Icon name="info" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              {t('languageModal.restartNote')}
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
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 10},
    shadowOpacity: 0.25,
    shadowRadius: 20,
  },
  modalHeader: {
    overflow: 'hidden',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  headerGradient: {
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  optionsContainer: {
    marginVertical: 10,
    // marginBottom: ,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexGrow: 1,
    minHeight: 300,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  selectedLanguageOption: {
    borderColor: '#4AC6D0',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flagEmoji: {
    fontSize: 32,
    marginRight: 16,
  },
  languageText: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  nativeName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  languageDescription: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 1,
  },
  selectedText: {
    color: '#4AC6D0',
  },
  selectedSubText: {
    color: '#3BB8C3',
  },
  languageStatus: {
    alignItems: 'flex-end',
  },
  currentBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 8,
  },
  currentBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  selectedIndicator: {
    marginLeft: 12,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 0,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    margin: 20,
    marginTop: 0,
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: '#6B7280',
    lineHeight: 16,
  },
});

export default LanguageSelectionModal;
