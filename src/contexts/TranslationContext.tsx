import React, {createContext, useContext, useState, useEffect} from 'react';
import {
  translationService,
  SUPPORTED_LANGUAGES,
} from '../services/translationService';
import {TranslationKey} from '../types/translation';

interface TranslationContextType {
  t: (key: TranslationKey) => string; // Type-safe key parameter
  currentLanguage: string;
  setLanguage: (lang: string) => Promise<void>;
  isFirstLaunch: boolean;
  completeFirstLaunch: (lang: string) => Promise<void>;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  isLoading: boolean;
  isTranslating: boolean;
}

const TranslationContext = createContext<TranslationContextType | undefined>(
  undefined,
);

export const TranslationProvider: React.FC<{
  children: React.ReactNode;
  azureKey: string;
  azureRegion: string;
}> = ({children, azureKey, azureRegion}) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isTranslating, setIsTranslating] = useState(false);

  useEffect(() => {
    initializeTranslationService();
  }, []);

  const initializeTranslationService = async () => {
    try {
      setIsLoading(true);
      console.log('🌐 Initializing Translation Context...');
      console.log('🔑 Using Azure Key:', azureKey);
      console.log('🌍 Using Azure Region:', azureRegion);

      // Initialize with Azure credentials
      await translationService.initialize(azureKey, azureRegion);

      // Check if first launch
      const firstLaunch = await translationService.isFirstLaunch();
      setIsFirstLaunch(firstLaunch);

      if (!firstLaunch) {
        // Load existing language settings
        const currentLang = translationService.getCurrentLanguage();
        setCurrentLanguage(currentLang);

        // Load cached translations if available
        if (currentLang !== 'en') {
          await translationService.setLanguage(currentLang);
        }
      }

      console.log('🌐 Translation Context initialized');
      console.log('📱 Is first launch:', firstLaunch);
      console.log(
        '🗣️ Current language:',
        translationService.getCurrentLanguage(),
      );
    } catch (error) {
      console.error('❌ Translation Context initialization error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const t = (key: string): string => {
    console.log('🔍 Translating key:', key);
    return translationService.t(key);
  };

  const setLanguage = async (lang: string) => {
    try {
      setIsTranslating(true);
      await translationService.setLanguage(lang);
      setCurrentLanguage(lang);
      console.log('✅ Language changed to:', lang);
    } catch (error) {
      console.error('❌ Error changing language:', error);
      throw error;
    } finally {
      setIsTranslating(false);
    }
  };

  const completeFirstLaunch = async (lang: string) => {
    try {
      setIsTranslating(true);
      await translationService.completeFirstLaunch(lang);
      setCurrentLanguage(lang);
      setIsFirstLaunch(false);
      console.log('✅ First launch completed with language:', lang);
    } catch (error) {
      console.error('❌ Error completing first launch:', error);
      throw error;
    } finally {
      setIsTranslating(false);
    }
  };

  const value = {
    t,
    currentLanguage,
    setLanguage,
    isFirstLaunch,
    completeFirstLaunch,
    supportedLanguages: SUPPORTED_LANGUAGES,
    isLoading,
    isTranslating,
  };

  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};

export const useTranslation = () => {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
};
