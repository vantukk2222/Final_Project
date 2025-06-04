import lanEn from '../locales/lan_en.json';

type TranslationKeys = {
  [K in keyof typeof lanEn]: (typeof lanEn)[K] extends object
    ? {
        [P in keyof (typeof lanEn)[K]]: `${K}.${P & string}`;
      }[keyof (typeof lanEn)[K]]
    : K;
}[keyof typeof lanEn];

// Type-safe translation key checker
export const isValidTranslationKey = (key: string): key is TranslationKeys => {
  const keys = key.split('.');
  let value: any = lanEn;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return false;
    }
  }

  return typeof value === 'string';
};

// Development helper to find missing keys
export const validateTranslationKeys = (usedKeys: string[]) => {
  const missingKeys: string[] = [];
  const validKeys: string[] = [];

  usedKeys.forEach(key => {
    if (isValidTranslationKey(key)) {
      validKeys.push(key);
    } else {
      missingKeys.push(key);
    }
  });

  if (__DEV__ && missingKeys.length > 0) {
    console.group('🔍 Translation Validation Report');
    console.log('✅ Valid keys:', validKeys.length);
    console.log('❌ Missing keys:', missingKeys.length);
    console.log('Missing keys:', missingKeys);
    console.groupEnd();
  }

  return {validKeys, missingKeys};
};

// Helper to extract all translation keys from lan_en.json
export const getAllTranslationKeys = (): string[] => {
  const keys: string[] = [];

  const extractKeys = (obj: any, prefix = '') => {
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof obj[key] === 'object' && obj[key] !== null) {
        extractKeys(obj[key], fullKey);
      } else {
        keys.push(fullKey);
      }
    });
  };

  extractKeys(lanEn);
  return keys;
};
