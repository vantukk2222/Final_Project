import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useTranslation} from '../contexts/TranslationContext';

interface LanguageSelectionScreenProps {
  onLanguageSelected: () => void;
}

const LanguageSelectionScreen: React.FC<LanguageSelectionScreenProps> = ({
  onLanguageSelected,
}) => {
  const {completeFirstLaunch, supportedLanguages, isTranslating} =
    useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState('en');

  const handleLanguageSelect = (langCode: string) => {
    setSelectedLanguage(langCode);
  };

  const handleContinue = async () => {
    try {
      console.log(
        '🌐 Completing first launch with language:',
        selectedLanguage,
      );

      if (selectedLanguage !== 'en') {
        // Show loading message for translation
        // Alert.alert(
        //   'Setting up your language',
        //   'Please wait while we prepare the app in your selected language. This may take a moment...',
        //   [{text: 'OK'}],
        // );
      }

      await completeFirstLaunch(selectedLanguage);
      onLanguageSelected();
    } catch (error) {
      console.error('❌ Error setting up language:', error);
      Alert.alert(
        'Setup Error',
        'There was an error setting up your language. Please try again or select English.',
        [
          {text: 'Try Again', onPress: handleContinue},
          {
            text: 'Use English',
            onPress: () => {
              setSelectedLanguage('en');
              setTimeout(handleContinue, 100);
            },
          },
        ],
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={['#4AC6D0', '#36B7C1', '#2AA8B3']}
        style={styles.background}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Icon name="language" size={60} color="#FFFFFF" />
          </View>
          <Text style={styles.title}>Choose Your Language</Text>
          <Text style={styles.subtitle}>
            Select your preferred language for the app interface
          </Text>
        </View>

        {/* Language List */}
        <ScrollView
          style={styles.languageList}
          showsVerticalScrollIndicator={false}>
          {supportedLanguages.map(language => (
            <TouchableOpacity
              key={language.code}
              style={[
                styles.languageItem,
                selectedLanguage === language.code &&
                  styles.selectedLanguageItem,
              ]}
              onPress={() => handleLanguageSelect(language.code)}
              activeOpacity={0.8}
              disabled={isTranslating}>
              <View style={styles.languageInfo}>
                <Text style={styles.flag}>{language.flag}</Text>
                <View style={styles.languageText}>
                  <Text style={styles.languageName}>{language.name}</Text>
                  <Text style={styles.nativeName}>{language.nativeName}</Text>
                </View>
              </View>

              <View
                style={[
                  styles.radioButton,
                  selectedLanguage === language.code &&
                    styles.radioButtonSelected,
                ]}>
                {selectedLanguage === language.code && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.continueButton,
              isTranslating && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={isTranslating}
            activeOpacity={0.9}>
            <LinearGradient
              colors={['#FFFFFF', '#F8FAFC']}
              style={styles.continueButtonGradient}>
              {isTranslating ? (
                <>
                  <ActivityIndicator size="small" color="#4AC6D0" />
                  <Text style={[styles.continueButtonText, {marginLeft: 8}]}>
                    {selectedLanguage === 'en'
                      ? 'Setting up...'
                      : 'Translating...'}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.continueButtonText}>Continue</Text>
                  <Icon name="arrow-forward" size={24} color="#4AC6D0" />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            You can change this later in Settings
          </Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 32,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  languageList: {
    flex: 1,
    paddingHorizontal: 24,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  selectedLanguageItem: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
    elevation: 4,
  },
  languageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  flag: {
    fontSize: 32,
    marginRight: 16,
  },
  languageText: {
    flex: 1,
  },
  languageName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  nativeName: {
    fontSize: 14,
    color: '#6B7280',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#4AC6D0',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#4AC6D0',
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 16,
  },
  continueButton: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 6,
    marginBottom: 16,
  },
  continueButtonDisabled: {
    opacity: 0.7,
  },
  continueButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 16,
    gap: 12,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#4AC6D0',
  },
  footerNote: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
  },
});

export default LanguageSelectionScreen;
