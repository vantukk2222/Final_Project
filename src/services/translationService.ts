import AsyncStorage from '@react-native-async-storage/async-storage';
import lanEn from '../locales/lan_en.json';

// Types
interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  azureCode: string;
}

interface TranslationCache {
  data: TranslationData;
  timestamp: number;
  version: string;
}

interface BatchTranslationRequest {
  text: string;
}

interface BatchTranslationResponse {
  translations: Array<{
    text: string;
    to: string;
  }>;
}

interface CacheStats {
  currentLanguage: string;
  cachedLanguages: string[];
  totalCachedLanguages: number;
  cacheSize: number;
  lastUpdate: number;
}

interface TranslationServiceConfig {
  batchSize: number;
  retryAttempts: number;
  retryDelay: number;
  cacheVersion: string;
  cacheExpiry: number;
  requestTimeout: number;
}

// Enums for better type safety
enum StorageKeys {
  LANGUAGE = '@selected_language',
  FIRST_LAUNCH = '@first_launch_done',
  TRANSLATION_DATA = '@translation_data',
  CACHE_METADATA = '@cache_metadata',
}

enum TranslationStatus {
  IDLE = 'idle',
  LOADING = 'loading',
  TRANSLATING = 'translating',
  ERROR = 'error',
  SUCCESS = 'success',
}

// Constants
export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = Object.freeze([
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
    azureCode: 'zh-Hans',
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
] as const);

type TranslationData = typeof lanEn;
type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

// Default configuration
const DEFAULT_CONFIG: TranslationServiceConfig = Object.freeze({
  batchSize: 100,
  retryAttempts: 3,
  retryDelay: 1000,
  cacheVersion: '1.0.0',
  cacheExpiry: 7 * 24 * 60 * 60 * 1000, // 7 days
  requestTimeout: 30000, // 30 seconds
});

// Utility functions
const createRetryableFunction = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxRetries: number,
  delay: number,
) => {
  return async (...args: T): Promise<R> => {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn(...args);
      } catch (error) {
        lastError = error as Error;

        if (attempt === maxRetries) {
          throw lastError;
        }

        // Exponential backoff
        const retryDelay = delay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    throw lastError!;
  };
};

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), timeoutMs),
    ),
  ]);
};

class TranslationService {
  // Private properties
  private currentLanguage: LanguageCode = 'en';
  private translationData: TranslationData = lanEn;
  private azureKey: string = '';
  private azureRegion: string = '';
  private status: TranslationStatus = TranslationStatus.IDLE;
  private config: TranslationServiceConfig = DEFAULT_CONFIG;
  private cache: Map<string, TranslationCache> = new Map();
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private translationPromises: Map<string, Promise<TranslationData>> =
    new Map();

  // Event listeners for status changes
  private statusListeners: Set<(status: TranslationStatus) => void> = new Set();

  constructor(config?: Partial<TranslationServiceConfig>) {
    this.config = {...DEFAULT_CONFIG, ...config};
    this.initializeAsync();
  }

  // Public API Methods

  /**
   * Initialize with Azure credentials
   */
  async initialize(azureKey: string, azureRegion: string): Promise<void> {
    if (
      this.isInitialized &&
      this.azureKey === azureKey &&
      this.azureRegion === azureRegion
    ) {
      return; // Already initialized with same credentials
    }

    this.azureKey = azureKey;
    this.azureRegion = azureRegion;

    this.validateCredentials();
    await this.loadSettings();

    this.isInitialized = true;
    // console.log('🌐 Translation Service initialized successfully');
  }

  /**
   * Check if this is first app launch
   */
  async isFirstLaunch(): Promise<boolean> {
    try {
      const firstLaunchDone = await AsyncStorage.getItem(
        StorageKeys.FIRST_LAUNCH,
      );
      return firstLaunchDone === null;
    } catch (error) {
      console.error('❌ Error checking first launch:', error);
      return true; // Default to first launch on error
    }
  }

  /**
   * Mark first launch as completed and set language
   */
  async completeFirstLaunch(selectedLanguage: LanguageCode): Promise<void> {
    this.validateLanguageCode(selectedLanguage);

    try {
      // console.log(
      //   '🚀 Completing first launch with language:',
      //   selectedLanguage,
      // );

      // Mark first launch as done
      await AsyncStorage.setItem(StorageKeys.FIRST_LAUNCH, 'true');

      // Set language and translate if needed
      await this.setLanguage(selectedLanguage);

      // console.log('✅ First launch completed successfully');
    } catch (error) {
      console.error('❌ Error completing first launch:', error);
      throw new Error(
        `Failed to complete first launch: ${(error as Error).message}`,
      );
    }
  }

  /**
   * Set language and translate all texts if needed
   */
  async setLanguage(languageCode: LanguageCode): Promise<void> {
    this.validateLanguageCode(languageCode);

    if (languageCode === this.currentLanguage) {
      // console.log('🔄 Language already set to:', languageCode);
      return;
    }

    try {
      // console.log('🌐 Setting language to:', languageCode);
      this.setStatus(TranslationStatus.LOADING);

      this.currentLanguage = languageCode;
      await AsyncStorage.setItem(StorageKeys.LANGUAGE, languageCode);

      if (languageCode === 'en') {
        // Use original English data
        this.translationData = lanEn;
        // console.log('📝 Using original English data');
      } else {
        await this.loadOrTranslateLanguage(languageCode);
      }

      this.setStatus(TranslationStatus.SUCCESS);
      // console.log('✅ Language set successfully to:', languageCode);
    } catch (error) {
      console.error('❌ Error setting language:', error);
      this.setStatus(TranslationStatus.ERROR);

      // Fallback to English on error
      this.currentLanguage = 'en';
      this.translationData = lanEn;

      throw new Error(`Failed to set language: ${(error as Error).message}`);
    }
  }

  /**
   * Get current language
   */
  getCurrentLanguage(): LanguageCode {
    return this.currentLanguage;
  }

  /**
   * Get translation for a key path with enhanced error handling
   */
  t(keyPath: string): string {
    if (!keyPath || typeof keyPath !== 'string') {
      console.warn('🔍 Invalid key path provided:', keyPath);
      return this.createFallbackText(String(keyPath));
    }

    try {
      const keys = keyPath.split('.');
      let value: any = this.translationData;

      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          // Key not found - show warning in development
          if (__DEV__) {
            console.warn(`🔍 Translation key not found: ${keyPath}`);
          }

          return this.createFallbackText(keyPath);
        }
      }

      if (typeof value === 'string') {
        return value;
      } else {
        console.warn(
          `🔍 Translation value is not a string for key: ${keyPath}`,
        );
        return this.createFallbackText(keyPath);
      }
    } catch (error) {
      console.error('❌ Error getting translation:', error);
      return this.createFallbackText(keyPath);
    }
  }

  /**
   * Get translation with interpolation support
   */
  tInterpolate(
    keyPath: string,
    variables: Record<string, string | number>,
  ): string {
    let translation = this.t(keyPath);

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
      translation = translation.replace(regex, String(value));
    });

    return translation;
  }

  /**
   * Check if translation exists for a key
   */
  hasTranslation(keyPath: string): boolean {
    try {
      const translation = this.t(keyPath);
      return translation !== this.createFallbackText(keyPath);
    } catch {
      return false;
    }
  }

  /**
   * Get all translation data
   */
  getAllTranslations(): Readonly<TranslationData> {
    return Object.freeze({...this.translationData});
  }

  /**
   * Get current status
   */
  getStatus(): TranslationStatus {
    return this.status;
  }

  /**
   * Add status listener
   */
  addStatusListener(listener: (status: TranslationStatus) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  /**
   * Clear all cached translations
   */
  async clearCache(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const translationKeys = keys.filter(
        key =>
          key.startsWith(StorageKeys.TRANSLATION_DATA) ||
          key === StorageKeys.CACHE_METADATA,
      );

      await AsyncStorage.multiRemove(translationKeys);
      this.cache.clear();

      // console.log('🗑️ Translation cache cleared');
    } catch (error) {
      console.error('❌ Error clearing cache:', error);
      throw new Error(`Failed to clear cache: ${(error as Error).message}`);
    }
  }

  /**
   * Get cache statistics with enhanced information
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const translationKeys = keys.filter(key =>
        key.startsWith(StorageKeys.TRANSLATION_DATA),
      );

      const cachedLanguages = translationKeys.map(key =>
        key.replace(`${StorageKeys.TRANSLATION_DATA}_`, ''),
      );

      // Calculate cache size
      let cacheSize = 0;
      for (const key of translationKeys) {
        try {
          const data = await AsyncStorage.getItem(key);
          if (data) {
            cacheSize += new Blob([data]).size;
          }
        } catch {
          // Ignore individual errors
        }
      }

      return {
        currentLanguage: this.currentLanguage,
        cachedLanguages,
        totalCachedLanguages: translationKeys.length,
        cacheSize,
        lastUpdate: Date.now(),
      };
    } catch (error) {
      console.error('❌ Error getting cache stats:', error);
      return {
        currentLanguage: this.currentLanguage,
        cachedLanguages: [],
        totalCachedLanguages: 0,
        cacheSize: 0,
        lastUpdate: 0,
      };
    }
  }

  /**
   * Force refresh translation for current language
   */
  async refreshCurrentLanguage(): Promise<void> {
    if (this.currentLanguage === 'en') {
      this.translationData = lanEn;
      return;
    }

    try {
      // Clear cache for current language
      await this.clearLanguageCache(this.currentLanguage);

      // Retranslate
      await this.translateAndCacheLanguage(this.currentLanguage);
    } catch (error) {
      console.error('❌ Error refreshing current language:', error);
      throw new Error(
        `Failed to refresh language: ${(error as Error).message}`,
      );
    }
  }

  // Private Methods

  /**
   * Initialize service asynchronously
   */
  private async initializeAsync(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.loadSettings().catch(error => {
      console.error('❌ Error during async initialization:', error);
    });

    return this.initializationPromise;
  }

  /**
   * Validate Azure credentials
   */
  private validateCredentials(): void {
    if (!this.azureKey || !this.azureRegion) {
      throw new Error('Azure credentials are required');
    }

    if (this.azureKey.length < 10) {
      throw new Error('Invalid Azure key format');
    }

    if (!/^[a-z0-9-]+$/.test(this.azureRegion)) {
      throw new Error('Invalid Azure region format');
    }
  }

  /**
   * Validate language code
   */
  private validateLanguageCode(
    languageCode: string,
  ): asserts languageCode is LanguageCode {
    const validCodes = SUPPORTED_LANGUAGES.map(lang => lang.code);
    if (!validCodes.includes(languageCode as LanguageCode)) {
      throw new Error(`Unsupported language code: ${languageCode}`);
    }
  }

  /**
   * Set status and notify listeners
   */
  private setStatus(status: TranslationStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.statusListeners.forEach(listener => {
        try {
          listener(status);
        } catch (error) {
          console.error('❌ Error in status listener:', error);
        }
      });
    }
  }

  /**
   * Load or translate language with optimizations
   */
  private async loadOrTranslateLanguage(
    languageCode: LanguageCode,
  ): Promise<void> {
    // Check if translation is already in progress
    const existingPromise = this.translationPromises.get(languageCode);
    if (existingPromise) {
      // console.log('🔄 Translation already in progress for:', languageCode);
      this.translationData = await existingPromise;
      return;
    }

    // Check cache first
    const cachedTranslation = await this.getCachedTranslation(languageCode);
    if (cachedTranslation && this.isCacheValid(cachedTranslation)) {
      // console.log('📋 Using cached translation for:', languageCode);
      this.translationData = cachedTranslation.data;
      return;
    }

    // Create translation promise
    const translationPromise = this.translateAndCacheLanguage(languageCode);
    this.translationPromises.set(languageCode, translationPromise);

    try {
      this.translationData = await translationPromise;
    } finally {
      // Clean up promise
      this.translationPromises.delete(languageCode);
    }
  }

  /**
   * Translate entire language file using Azure Translator with enhanced error handling
   */
  private async translateAndCacheLanguage(
    targetLanguage: LanguageCode,
  ): Promise<TranslationData> {
    const azureLangCode = this.getAzureLanguageCode(targetLanguage);
    // console.log(
    //   `🔄 Starting translation to ${targetLanguage} (Azure: ${azureLangCode})`,
    // );

    this.setStatus(TranslationStatus.TRANSLATING);

    try {
      // Flatten all texts for translation
      const flatTexts = this.flattenTranslationObject(lanEn);
      const textsToTranslate = Object.values(flatTexts);

      // console.log(`📝 Translating ${textsToTranslate.length} texts...`);

      // Translate in batches with retry logic
      const translatedTexts: string[] = [];
      const batchCount = Math.ceil(
        textsToTranslate.length / this.config.batchSize,
      );

      for (let i = 0; i < textsToTranslate.length; i += this.config.batchSize) {
        const batch = textsToTranslate.slice(i, i + this.config.batchSize);
        const batchIndex = Math.floor(i / this.config.batchSize) + 1;

        console.log(`🔄 Translating batch ${batchIndex}/${batchCount}`);

        const retryableTranslate = createRetryableFunction(
          (texts: string[]) => this.translateBatch(texts, azureLangCode),
          this.config.retryAttempts,
          this.config.retryDelay,
        );

        const batchTranslations = await retryableTranslate(batch);
        translatedTexts.push(...batchTranslations);
      }

      // Reconstruct translation object
      const translatedData = this.reconstructTranslationObject(
        flatTexts,
        translatedTexts,
      );

      // Cache the translated data
      await this.cacheTranslation(targetLanguage, translatedData);

      // console.log('✅ Translation completed and cached successfully');
      return translatedData;
    } catch (error) {
      console.error('❌ Error translating language:', error);
      throw new Error(`Translation failed: ${(error as Error).message}`);
    }
  }

  /**
   * Translate batch of texts using Azure Translator with timeout
   */
  private async translateBatch(
    texts: string[],
    targetLang: string,
  ): Promise<string[]> {
    const url = `https://${this.azureRegion}.api.cognitive.microsoft.com/translator/text/v3.0/translate?api-version=3.0&to=${targetLang}`;

    const body: BatchTranslationRequest[] = texts.map(text => ({text}));

    const fetchPromise = fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.azureKey,
        'Ocp-Apim-Subscription-Region': this.azureRegion,
        'Content-Type': 'application/json',
        'X-ClientTraceId': this.generateTraceId(),
      },
      body: JSON.stringify(body),
    });

    const response = await withTimeout(
      fetchPromise,
      this.config.requestTimeout,
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(
        `Azure Translator API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const results: BatchTranslationResponse[] = await response.json();
    return results.map(result => result.translations[0]?.text || '');
  }

  /**
   * Flatten nested translation object to key-value pairs
   */
  private flattenTranslationObject(
    obj: any,
    prefix = '',
  ): Record<string, string> {
    const flattened: Record<string, string> = {};

    for (const [key, value] of Object.entries(obj)) {
      const newKey = prefix ? `${prefix}.${key}` : key;

      if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
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
      const keyParts = keyPath.split('.');
      let current = result;

      for (let i = 0; i < keyParts.length - 1; i++) {
        const key = keyParts[i];
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }

      const finalKey = keyParts[keyParts.length - 1];
      current[finalKey] = translatedTexts[index] || flatTexts[keyPath];
    });

    return result as TranslationData;
  }

  /**
   * Get cached translation from AsyncStorage with enhanced validation
   */
  private async getCachedTranslation(
    languageCode: LanguageCode,
  ): Promise<TranslationCache | null> {
    try {
      const cacheKey = `${StorageKeys.TRANSLATION_DATA}_${languageCode}`;
      const cachedData = await AsyncStorage.getItem(cacheKey);

      if (!cachedData) {
        return null;
      }

      const cache: TranslationCache = JSON.parse(cachedData);

      // Validate cache structure
      if (!cache.data || !cache.timestamp || !cache.version) {
        console.warn('🔍 Invalid cache structure for:', languageCode);
        await this.clearLanguageCache(languageCode);
        return null;
      }

      return cache;
    } catch (error) {
      console.error('❌ Error loading cached translation:', error);
      // Clear corrupted cache
      await this.clearLanguageCache(languageCode);
      return null;
    }
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(cache: TranslationCache): boolean {
    const isVersionValid = cache.version === this.config.cacheVersion;
    const isTimeValid = Date.now() - cache.timestamp < this.config.cacheExpiry;

    return isVersionValid && isTimeValid;
  }

  /**
   * Cache translation to AsyncStorage with metadata
   */
  private async cacheTranslation(
    languageCode: LanguageCode,
    translationData: TranslationData,
  ): Promise<void> {
    try {
      const cacheKey = `${StorageKeys.TRANSLATION_DATA}_${languageCode}`;
      const cache: TranslationCache = {
        data: translationData,
        timestamp: Date.now(),
        version: this.config.cacheVersion,
      };

      await AsyncStorage.setItem(cacheKey, JSON.stringify(cache));
      this.cache.set(languageCode, cache);

      // console.log('💾 Translation cached for:', languageCode);
    } catch (error) {
      console.error('❌ Error caching translation:', error);
      // Non-fatal error, don't throw
    }
  }

  /**
   * Clear cache for specific language
   */
  private async clearLanguageCache(languageCode: LanguageCode): Promise<void> {
    try {
      const cacheKey = `${StorageKeys.TRANSLATION_DATA}_${languageCode}`;
      await AsyncStorage.removeItem(cacheKey);
      this.cache.delete(languageCode);
    } catch (error) {
      console.error('❌ Error clearing language cache:', error);
    }
  }

  /**
   * Load settings from AsyncStorage with error recovery
   */
  private async loadSettings(): Promise<void> {
    try {
      const savedLanguage = await AsyncStorage.getItem(StorageKeys.LANGUAGE);

      if (savedLanguage && this.isValidLanguageCode(savedLanguage)) {
        this.currentLanguage = savedLanguage as LanguageCode;

        if (savedLanguage !== 'en') {
          const cachedTranslation = await this.getCachedTranslation(
            this.currentLanguage,
          );
          if (cachedTranslation && this.isCacheValid(cachedTranslation)) {
            this.translationData = cachedTranslation.data;
          }
        }
      }

      // console.log('📋 Translation settings loaded:', this.currentLanguage);
    } catch (error) {
      console.error('❌ Error loading translation settings:', error);
      // Reset to default on error
      this.currentLanguage = 'en';
      this.translationData = lanEn;
    }
  }

  /**
   * Check if language code is valid
   */
  private isValidLanguageCode(code: string): code is LanguageCode {
    return SUPPORTED_LANGUAGES.some(lang => lang.code === code);
  }

  /**
   * Get Azure language code from our language code
   */
  private getAzureLanguageCode(languageCode: LanguageCode): string {
    const language = SUPPORTED_LANGUAGES.find(
      lang => lang.code === languageCode,
    );
    if (!language) {
      throw new Error(`Unsupported language code: ${languageCode}`);
    }
    return language.azureCode;
  }

  /**
   * Create user-friendly fallback text from key
   */
  private createFallbackText(key: string): string {
    if (!key) {
      return 'Missing Translation';
    }

    // Convert camelCase/kebab-case to readable text
    return key
      .split(/[-_.]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\s+/g, ' ');
  }

  /**
   * Generate unique trace ID for API requests
   */
  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance with enhanced configuration
export const translationService = new TranslationService();

// Export types for external use
export type {
  SupportedLanguage,
  TranslationData,
  LanguageCode,
  CacheStats,
  TranslationServiceConfig,
};

export {TranslationStatus, StorageKeys};
