import AsyncStorage from '@react-native-async-storage/async-storage';
import lanEn from '../locales/lan_en.json';

interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  azureCode: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    flag: '🇺🇸',
    azureCode: 'en',
  },
  {
    code: 'vi',
    name: 'Vietnamese',
    nativeName: 'Tiếng Việt',
    flag: '🇻🇳',
    azureCode: 'vi',
  },
  {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    flag: '🇯🇵',
    azureCode: 'ja',
  },
  {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    flag: '🇰🇷',
    azureCode: 'ko',
  },
  {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    flag: '🇨🇳',
    azureCode: 'zh',
  },
  {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    flag: '🇫🇷',
    azureCode: 'fr',
  },
  {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    flag: '🇩🇪',
    azureCode: 'de',
  },
  {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    flag: '🇪🇸',
    azureCode: 'es',
  },
];

type TranslationData = typeof lanEn;

class TranslationService {
  private currentLanguage: string = 'en';
  private translationData: TranslationData = lanEn;
  private azureKey: string = '';
  private azureRegion: string = '';

  // Storage keys
  private readonly LANGUAGE_KEY = '@selected_language';
  private readonly FIRST_LAUNCH_KEY = '@first_launch_done';
  private readonly TRANSLATION_DATA_KEY = '@translation_data';

  constructor() {
    this.loadSettings();
  }

  /**
   * Initialize with Azure credentials
   */
  async initialize(azureKey: string, azureRegion: string) {
    this.azureKey = azureKey;
    this.azureRegion = azureRegion;
    console.log('🌐 Translation Service initialized');
  }

  /**
   * Check if this is first app launch
   */
  async isFirstLaunch(): Promise<boolean> {
    try {
      const firstLaunchDone = await AsyncStorage.getItem(this.FIRST_LAUNCH_KEY);
      return firstLaunchDone === null;
    } catch (error) {
      console.error('Error checking first launch:', error);
      return true;
    }
  }

  /**
   * Mark first launch as completed and set language
   */
  async completeFirstLaunch(selectedLanguage: string) {
    try {
      console.log(
        '🚀 Completing first launch with language:',
        selectedLanguage,
      );

      // Mark first launch as done
      await AsyncStorage.setItem(this.FIRST_LAUNCH_KEY, 'true');

      // Set language and translate if needed
      await this.setLanguage(selectedLanguage);

      console.log('✅ First launch completed successfully');
    } catch (error) {
      console.error('❌ Error completing first launch:', error);
      throw error;
    }
  }

  /**
   * Set language and translate all texts if needed
   */
  async setLanguage(languageCode: string) {
    try {
      console.log('🌐 Setting language to:', languageCode);

      this.currentLanguage = languageCode;
      await AsyncStorage.setItem(this.LANGUAGE_KEY, languageCode);

      if (languageCode === 'en') {
        // Use original English data
        this.translationData = lanEn;
        console.log('📝 Using original English data');
      } else {
        // Check if we have cached translation for this language
        const cachedTranslation = await this.getCachedTranslation(languageCode);

        if (cachedTranslation) {
          console.log('📋 Using cached translation for:', languageCode);
          this.translationData = cachedTranslation;
        } else {
          console.log(
            '🔄 Translating to',
            languageCode,
            '- this may take a moment...',
          );
          await this.translateAndCacheLanguage(languageCode);
        }
      }

      console.log('✅ Language set successfully to:', languageCode);
    } catch (error) {
      console.error('❌ Error setting language:', error);
      // Fallback to English on error
      this.currentLanguage = 'en';
      this.translationData = lanEn;
      throw error;
    }
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): string {
    return this.currentLanguage;
  }

  /**
   * Get translation for a key path (e.g., 'common.ok')
   */
  // Cập nhật method t() để handle missing keys
  /**
   * Get translation for a key path (e.g., 'common.ok')
   */
  t(keyPath: string): string {
    try {
      const keys = keyPath.split('.');
      let value: any = this.translationData;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          // Key not found - show warning in development and return fallback
          if (__DEV__) {
            // console.warn(`🔍 Translation key not found: ${keyPath}`);
          }

          // Return a more user-friendly fallback
          const lastKey = keys[keys.length - 1];
          return this.createFallbackText(lastKey);
        }
      }

      return typeof value === 'string'
        ? value
        : this.createFallbackText(keyPath);
    } catch (error) {
      console.error('❌ Error getting translation:', error);
      return this.createFallbackText(keyPath);
    }
  }

  /**
   * Create user-friendly fallback text from key
   */
  private createFallbackText(key: string): string {
    // Convert camelCase/kebab-case to readable text
    return key
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Get all translation data
   */
  getAllTranslations(): TranslationData {
    return this.translationData;
  }

  /**
   * Translate entire language file using Azure Translator
   */
  private async translateAndCacheLanguage(targetLanguage: string) {
    try {
      const azureLangCode = this.getAzureLanguageCode(targetLanguage);
      console.log(
        `🔄 Starting translation to ${targetLanguage} (Azure: ${azureLangCode})`,
      );

      // Flatten all texts for translation
      const flatTexts = this.flattenTranslationObject(lanEn);
      const textsToTranslate = Object.values(flatTexts);

      console.log(`📝 Translating ${textsToTranslate.length} texts...`);

      // Translate in batches (Azure has limits)
      const batchSize = 100;
      const translatedTexts: string[] = [];

      for (let i = 0; i < textsToTranslate.length; i += batchSize) {
        const batch = textsToTranslate.slice(i, i + batchSize);
        console.log(
          `🔄 Translating batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
            textsToTranslate.length / batchSize,
          )}`,
        );

        const batchTranslations = await this.translateBatch(
          batch,
          azureLangCode,
        );
        translatedTexts.push(...batchTranslations);
      }

      // Reconstruct translation object
      const translatedData = this.reconstructTranslationObject(
        flatTexts,
        translatedTexts,
      );

      // Cache the translated data
      await this.cacheTranslation(targetLanguage, translatedData);

      // Set as current translation data
      this.translationData = translatedData;

      console.log('✅ Translation completed and cached successfully');
    } catch (error) {
      console.error('❌ Error translating language:', error);
      throw error;
    }
  }

  /**
   * Translate batch of texts using Azure Translator
   */
  private async translateBatch(
    texts: string[],
    targetLang: string,
  ): Promise<string[]> {
    const url = `https://${this.azureRegion}.api.cognitive.microsoft.com/translator/text/v3.0/translate?api-version=3.0&to=${targetLang}`;

    const body = texts.map(text => ({text}));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.azureKey,
        'Ocp-Apim-Subscription-Region': this.azureRegion,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(
        `Azure Translator API error: ${response.status} ${response.statusText}`,
      );
    }

    const results = await response.json();
    return results.map((result: any) => result.translations[0]?.text || '');
  }

  /**
   * Flatten nested translation object to key-value pairs
   */
  private flattenTranslationObject(
    obj: any,
    prefix = '',
  ): Record<string, string> {
    let flattened: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object' && value !== null) {
        Object.assign(flattened, this.flattenTranslationObject(value, newKey));
      } else if (typeof value === 'string') {
        flattened[newKey] = value;
      }
    }

    return flattened;
  }

  /**
   * Reconstruct nested object from flattened key-value pairs
   */
  private reconstructTranslationObject(
    flatTexts: Record<string, string>,
    translatedTexts: string[],
  ): TranslationData {
    const result: any = {};
    const keys = Object.keys(flatTexts);

    keys.forEach((keyPath, index) => {
      const keys = keyPath.split('.');
      let current = result;

      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }

      current[keys[keys.length - 1]] =
        translatedTexts[index] || flatTexts[keyPath];
    });

    return result as TranslationData;
  }

  /**
   * Get cached translation from AsyncStorage
   */
  private async getCachedTranslation(
    languageCode: string,
  ): Promise<TranslationData | null> {
    try {
      const cacheKey = `${this.TRANSLATION_DATA_KEY}_${languageCode}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);

      if (cachedData) {
        return JSON.parse(cachedData);
      }

      return null;
    } catch (error) {
      console.error('Error loading cached translation:', error);
      return null;
    }
  }

  /**
   * Cache translation to AsyncStorage
   */
  private async cacheTranslation(
    languageCode: string,
    translationData: TranslationData,
  ) {
    try {
      const cacheKey = `${this.TRANSLATION_DATA_KEY}_${languageCode}`;
      await AsyncStorage.setItem(cacheKey, JSON.stringify(translationData));
      console.log('💾 Translation cached for:', languageCode);
    } catch (error) {
      console.error('Error caching translation:', error);
    }
  }

  /**
   * Load settings from AsyncStorage
   */
  private async loadSettings() {
    try {
      const savedLanguage = await AsyncStorage.getItem(this.LANGUAGE_KEY);

      if (savedLanguage) {
        this.currentLanguage = savedLanguage;

        if (savedLanguage !== 'en') {
          const cachedTranslation = await this.getCachedTranslation(
            savedLanguage,
          );
          if (cachedTranslation) {
            this.translationData = cachedTranslation;
          }
        }
      }

      console.log('📋 Translation settings loaded:', this.currentLanguage);
    } catch (error) {
      console.error('Error loading translation settings:', error);
    }
  }

  /**
   * Get Azure language code from our language code
   */
  private getAzureLanguageCode(languageCode: string): string {
    const language = SUPPORTED_LANGUAGES.find(
      lang => lang.code === languageCode,
    );
    return language?.azureCode || languageCode;
  }

  /**
   * Clear all cached translations
   */
  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const translationKeys = keys.filter(key =>
        key.startsWith(this.TRANSLATION_DATA_KEY),
      );

      await AsyncStorage.multiRemove(translationKeys);
      console.log('🗑️ Translation cache cleared');
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const translationKeys = keys.filter(key =>
        key.startsWith(this.TRANSLATION_DATA_KEY),
      );

      const stats = {
        currentLanguage: this.currentLanguage,
        cachedLanguages: translationKeys.map(key =>
          key.replace(this.TRANSLATION_DATA_KEY + '_', ''),
        ),
        totalCachedLanguages: translationKeys.length,
      };

      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {
        currentLanguage: this.currentLanguage,
        cachedLanguages: [],
        totalCachedLanguages: 0,
      };
    }
  }
}

// Export singleton instance
export const translationService = new TranslationService();
