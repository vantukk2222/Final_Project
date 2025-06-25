import axios from 'axios';

// Azure Translator configuration
const AZURE_TRANSLATOR_CONFIG = {
  endpoint: 'https://api.cognitive.microsofttranslator.com',
  subscriptionKey:
    'CM9T6m7rgYNegLOVQyQllWwGbl6yrLmftrYyQDYJoKD0DlWMzVF7JQQJ99BEACYeBjFXJ3w3AAAbACOGF9m3',
  region: 'eastus',
  version: '3.0',
};

interface TranslationResult {
  translations: Array<{
    text: string;
    to: string;
  }>;
  detectedLanguage?: {
    language: string;
    score: number;
  };
}

interface TranslationResponse {
  originalText: string;
  translatedText: string;
  fromLanguage: string;
  toLanguage: string;
  detectedLanguage?: string;
}

class TranslationTextService {
  private baseURL: string;
  private headers: any;

  constructor() {
    // ✅ Fixed: Remove duplicate path components
    this.baseURL = AZURE_TRANSLATOR_CONFIG.endpoint;
    this.headers = {
      'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_CONFIG.subscriptionKey,
      'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_CONFIG.region,
      'Content-Type': 'application/json',
    };
  }

  /**
   * Translate text from one language to another
   * @param text - Text to translate
   * @param toLanguage - Target language code (e.g., 'en', 'vi', 'ja')
   * @param fromLanguage - Source language code (optional, will auto-detect if not provided)
   */
  async translateText(
    text: string,
    toLanguage: string,
    fromLanguage?: string,
  ): Promise<TranslationResponse> {
    try {
      if (!text.trim()) {
        throw new Error('Text cannot be empty');
      }

      // ✅ Fixed: Correct URL construction
      let url = `${this.baseURL}/translate?api-version=${AZURE_TRANSLATOR_CONFIG.version}&to=${toLanguage}`;

      if (fromLanguage) {
        url += `&from=${fromLanguage}`;
      }

      const requestBody = [
        {
          text: text.trim(),
        },
      ];

      console.log('Translation request:', {
        url,
        requestBody,
        headers: this.headers,
      });

      const response = await axios.post(url, requestBody, {
        headers: this.headers,
        timeout: 15000, // Increased timeout
      });

      // console.log('Translation response:', response.data);

      if (
        !response.data ||
        !Array.isArray(response.data) ||
        response.data.length === 0
      ) {
        throw new Error('Invalid response from translation service');
      }

      const result: TranslationResult = response.data[0];

      if (!result.translations || result.translations.length === 0) {
        throw new Error('No translation found');
      }

      const translation = result.translations[0];

      const translationResponse = {
        originalText: text,
        translatedText: translation.text,
        fromLanguage:
          result.detectedLanguage?.language || fromLanguage || 'auto',
        toLanguage: translation.to,
        detectedLanguage: result.detectedLanguage?.language,
      };

      console.log('Translation result:', translationResponse);

      return translationResponse;
    } catch (error: any) {
      console.error('Translation error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: error.config?.url,
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error(
            'Authentication failed. Please check your Azure Translator key.',
          );
        } else if (error.response?.status === 403) {
          throw new Error(
            'Access denied. Please check your subscription and region.',
          );
        } else if (error.response?.status === 404) {
          throw new Error(
            'Translation service endpoint not found. Please check the URL.',
          );
        } else if (error.response?.status === 429) {
          throw new Error(
            'Translation quota exceeded. Please try again later.',
          );
        } else if (error.response?.status === 500) {
          throw new Error('Translation service is temporarily unavailable.');
        } else if (error.code === 'ECONNABORTED') {
          throw new Error('Translation request timed out. Please try again.');
        } else if (
          error.code === 'NETWORK_ERROR' ||
          error.code === 'ENOTFOUND'
        ) {
          throw new Error(
            'Network error. Please check your internet connection.',
          );
        }
      }

      throw new Error(error.message || 'Translation failed. Please try again.');
    }
  }

  /**
   * Detect language of text
   * @param text - Text to detect language for
   */
  async detectLanguage(
    text: string,
  ): Promise<{language: string; score: number}> {
    try {
      // ✅ Fixed: Correct detect endpoint
      const url = `${this.baseURL}/detect?api-version=${AZURE_TRANSLATOR_CONFIG.version}`;
      const requestBody = [
        {
          text: text.trim(),
        },
      ];

      console.log('Language detection request:', {url, requestBody});

      const response = await axios.post(url, requestBody, {
        headers: this.headers,
        timeout: 10000,
      });

      if (
        !response.data ||
        !Array.isArray(response.data) ||
        response.data.length === 0
      ) {
        throw new Error('Invalid response from language detection service');
      }

      return response.data[0];
    } catch (error) {
      console.error('Language detection error:', error);
      throw new Error('Failed to detect language');
    }
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<any> {
    try {
      // ✅ Fixed: Correct languages endpoint
      const url = `${this.baseURL}/languages?api-version=${AZURE_TRANSLATOR_CONFIG.version}&scope=translation`;

      console.log('Get languages request:', {url});

      const response = await axios.get(url, {
        timeout: 10000,
      });

      return response.data;
    } catch (error) {
      console.error('Get supported languages error:', error);
      throw new Error('Failed to get supported languages');
    }
  }

  /**
   * Test connection to translation service
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.translateText('Hello', 'vi', 'en');
      return !!result.translatedText;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * Map language codes to display names
   */
  getLanguageDisplayName(langCode: string): string {
    const languageMap: {[key: string]: string} = {
      en: 'English',
      vi: 'Tiếng Việt',
      ja: '日本語',
      ko: '한국어',
      zh: '中文',
      fr: 'Français',
      de: 'Deutsch',
      es: 'Español',
      pt: 'Português',
      ru: 'Русский',
      ar: 'العربية',
      hi: 'हिन्दी',
      th: 'ไทย',
      auto: 'Auto-detect',
    };

    return languageMap[langCode] || langCode.toUpperCase();
  }
}

// Create singleton instance
export const translationTextService = new TranslationTextService();

// Language codes supported by the app
export const SUPPORTED_LANGUAGES = [
  {code: 'en', name: 'English', flag: '🇺🇸'},
  {code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳'},
  {code: 'ja', name: '日本語', flag: '🇯🇵'},
  {code: 'ko', name: '한국어', flag: '🇰🇷'},
  {code: 'zh', name: '中文', flag: '🇨🇳'},
  {code: 'fr', name: 'Français', flag: '🇫🇷'},
  {code: 'de', name: 'Deutsch', flag: '🇩🇪'},
  {code: 'es', name: 'Español', flag: '🇪🇸'},
];

export default translationTextService;
