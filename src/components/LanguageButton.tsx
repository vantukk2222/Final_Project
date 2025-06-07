import {StyleSheet, Text, View, TouchableOpacity} from 'react-native';
import {useTranslation} from '../contexts/TranslationContext';
import {useNavigation} from '@react-navigation/native';
import {useState} from 'react';
import LanguageSelectionModal from './SystemLan';

// Language Settings Button Component
export const LanguageButton = () => {
  const navigation = useNavigation();
  const {currentLanguage, supportedLanguages} = useTranslation();

  const currentLangData = supportedLanguages.find(
    lang => lang.code === currentLanguage,
  );
  const [modalLan, setModalLan] = useState();
  return (
    <>
      <View style={{flex: 1}}>
        <TouchableOpacity
          style={styles.languageButton}
          onPress={() => navigation.navigate('LanguageSettings')}
          activeOpacity={0.8}>
          <Text style={styles.languageButtonFlag}>{currentLangData?.flag}</Text>
          <Text style={styles.languageButtonText}>
            {currentLangData?.code.toUpperCase()}
          </Text>
        </TouchableOpacity>
        <LanguageSelectionModal
          visible={!!modalLan}
          onClose={() => setModalLan(undefined)}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  languageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  languageButtonFlag: {
    fontSize: 16,
  },
  languageButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
