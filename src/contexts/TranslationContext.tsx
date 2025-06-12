import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useMemo,
  memo,
  useReducer,
  useEffect,
} from 'react';
import {
  translationService,
  SUPPORTED_LANGUAGES,
} from '../services/translationService';
import {TranslationKey} from '../types/translation';

// Types
interface TranslationContextType {
  t: (key: TranslationKey) => string;
  currentLanguage: string;
  setLanguage: (lang: string) => Promise<void>;
  isFirstLaunch: boolean;
  completeFirstLaunch: (lang: string) => Promise<void>;
  supportedLanguages: typeof SUPPORTED_LANGUAGES;
  isLoading: boolean;
  isTranslating: boolean;
  error: string | null;
  retryInitialization: () => Promise<void>;
}

interface TranslationProviderProps {
  children: React.ReactNode;
  azureKey: string;
  azureRegion: string;
}

// State management with reducer
type StateAction =
  | {type: 'SET_LOADING'; payload: boolean}
  | {type: 'SET_TRANSLATING'; payload: boolean}
  | {type: 'SET_CURRENT_LANGUAGE'; payload: string}
  | {type: 'SET_FIRST_LAUNCH'; payload: boolean}
  | {type: 'SET_ERROR'; payload: string | null}
  | {
      type: 'INITIALIZATION_SUCCESS';
      payload: {language: string; isFirstLaunch: boolean};
    }
  | {type: 'LANGUAGE_CHANGED'; payload: string}
  | {type: 'FIRST_LAUNCH_COMPLETED'; payload: string}
  | {type: 'RESET_STATE'};

interface TranslationState {
  currentLanguage: string;
  isFirstLaunch: boolean;
  isLoading: boolean;
  isTranslating: boolean;
  error: string | null;
}

const initialState: TranslationState = {
  currentLanguage: 'en',
  isFirstLaunch: false,
  isLoading: true,
  isTranslating: false,
  error: null,
};

// Atomic state reducer
const translationReducer = (
  state: TranslationState,
  action: StateAction,
): TranslationState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
        error: action.payload ? null : state.error,
      };
    case 'SET_TRANSLATING':
      return {
        ...state,
        isTranslating: action.payload,
        error: action.payload ? null : state.error,
      };
    case 'SET_CURRENT_LANGUAGE':
      return {...state, currentLanguage: action.payload};
    case 'SET_FIRST_LAUNCH':
      return {...state, isFirstLaunch: action.payload};
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isTranslating: false,
      };
    case 'INITIALIZATION_SUCCESS':
      return {
        ...state,
        currentLanguage: action.payload.language,
        isFirstLaunch: action.payload.isFirstLaunch,
        isLoading: false,
        error: null,
      };
    case 'LANGUAGE_CHANGED':
      return {
        ...state,
        currentLanguage: action.payload,
        isTranslating: false,
        error: null,
      };
    case 'FIRST_LAUNCH_COMPLETED':
      return {
        ...state,
        currentLanguage: action.payload,
        isFirstLaunch: false,
        isTranslating: false,
        error: null,
      };
    case 'RESET_STATE':
      return {...initialState, isLoading: true};
    default:
      return state;
  }
};

// Constants
const RETRY_DELAY = 2000;
const MAX_RETRY_ATTEMPTS = 3;
const INITIALIZATION_TIMEOUT = 10000;

// Create context
const TranslationContext = createContext<TranslationContextType | undefined>(
  undefined,
);

// Custom hooks
const useStableRefs = () => {
  const refs = useRef({
    isInitialized: false,
    initializationPromise: null as Promise<void> | null,
    retryCount: 0,
    translationCache: new Map<string, string>(),
    lastLanguageHash: '',
    initializationTimeout: null as NodeJS.Timeout | null,
  });

  return refs.current;
};

const useTranslationCache = () => {
  const cache = useRef(new Map<string, string>());

  const getCachedTranslation = useCallback(
    (key: string, language: string): string | null => {
      const cacheKey = `${language}:${key}`;
      return cache.current.get(cacheKey) || null;
    },
    [],
  );

  const setCachedTranslation = useCallback(
    (key: string, language: string, translation: string) => {
      const cacheKey = `${language}:${key}`;
      cache.current.set(cacheKey, translation);

      // Prevent memory leaks - limit cache size
      if (cache.current.size > 1000) {
        const firstKey = cache.current.keys().next().value;
        cache.current.delete(firstKey);
      }
    },
    [],
  );

  const clearCache = useCallback(() => {
    cache.current.clear();
  }, []);

  return {getCachedTranslation, setCachedTranslation, clearCache};
};

// Memoized utility functions
const createRetryableFunction = <T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  maxRetries: number = MAX_RETRY_ATTEMPTS,
  delay: number = RETRY_DELAY,
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

// Create timeout wrapper
const withTimeout = <T,>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs),
    ),
  ]);
};

export const TranslationProvider: React.FC<TranslationProviderProps> = memo(
  ({children, azureKey, azureRegion}) => {
    const [state, dispatch] = useReducer(translationReducer, initialState);
    const refs = useStableRefs();
    const {getCachedTranslation, setCachedTranslation, clearCache} =
      useTranslationCache();

    // Memoized stable values
    const stableValues = useMemo(
      () => ({
        azureKey,
        azureRegion,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }),
      [azureKey, azureRegion],
    );

    // Enhanced initialization with retry logic
    const initializeTranslationService = useCallback(
      createRetryableFunction(async () => {
        console.log('🌐 Initializing Translation Service...');
        console.log('🔑 Azure Key:', azureKey?.substring(0, 8) + '...');
        console.log('🌍 Azure Region:', azureRegion);

        // Validate inputs
        if (!azureKey || !azureRegion) {
          throw new Error('Azure credentials are required');
        }

        // Initialize service with timeout
        await withTimeout(
          translationService.initialize(azureKey, azureRegion),
          INITIALIZATION_TIMEOUT,
        );

        // Check first launch status
        const firstLaunch = await translationService.isFirstLaunch();
        let currentLang = 'en';

        if (!firstLaunch) {
          // Load existing language settings
          currentLang = translationService.getCurrentLanguage();

          // Preload translations for non-English languages
          if (currentLang !== 'en') {
            await withTimeout(
              translationService.setLanguage(currentLang),
              INITIALIZATION_TIMEOUT,
            );
          }
        }

        // Success dispatch
        dispatch({
          type: 'INITIALIZATION_SUCCESS',
          payload: {
            language: currentLang,
            isFirstLaunch: firstLaunch,
          },
        });

        console.log('✅ Translation Service initialized successfully');
        console.log('📱 First launch:', firstLaunch);
        console.log('🗣️ Current language:', currentLang);

        refs.isInitialized = true;
        refs.retryCount = 0;
      }),
      [azureKey, azureRegion, refs],
    );

    // Memoized translation function with caching
    const t = useCallback(
      (key: string): string => {
        try {
          // Check cache first
          const cached = getCachedTranslation(key, state.currentLanguage);
          if (cached) {
            return cached;
          }

          // Get translation from service
          const translation = translationService.t(key);

          // Cache the result
          setCachedTranslation(key, state.currentLanguage, translation);

          return translation;
        } catch (error) {
          console.warn('⚠️ Translation error for key:', key, error);
          return key; // Fallback to key itself
        }
      },
      [state.currentLanguage, getCachedTranslation, setCachedTranslation],
    );

    // Enhanced language setting with optimistic updates
    const setLanguage = useCallback(
      async (lang: string): Promise<void> => {
        if (lang === state.currentLanguage) {
          console.log('🔄 Language already set to:', lang);
          return;
        }

        try {
          dispatch({type: 'SET_TRANSLATING', payload: true});

          // Optimistic update
          dispatch({type: 'SET_CURRENT_LANGUAGE', payload: lang});

          // Set language in service
          await withTimeout(
            translationService.setLanguage(lang),
            INITIALIZATION_TIMEOUT,
          );

          // Clear cache for new language
          clearCache();

          dispatch({type: 'LANGUAGE_CHANGED', payload: lang});
          console.log('✅ Language changed to:', lang);
        } catch (error) {
          console.error('❌ Error changing language:', error);

          // Revert optimistic update
          dispatch({
            type: 'SET_CURRENT_LANGUAGE',
            payload: state.currentLanguage,
          });
          dispatch({type: 'SET_ERROR', payload: (error as Error).message});

          throw error;
        }
      },
      [state.currentLanguage, clearCache],
    );

    // Enhanced first launch completion
    const completeFirstLaunch = useCallback(
      async (lang: string): Promise<void> => {
        try {
          dispatch({type: 'SET_TRANSLATING', payload: true});

          await withTimeout(
            translationService.completeFirstLaunch(lang),
            INITIALIZATION_TIMEOUT,
          );

          // Clear cache for new language
          clearCache();

          dispatch({type: 'FIRST_LAUNCH_COMPLETED', payload: lang});
          console.log('✅ First launch completed with language:', lang);
        } catch (error) {
          console.error('❌ Error completing first launch:', error);
          dispatch({type: 'SET_ERROR', payload: (error as Error).message});
          throw error;
        }
      },
      [clearCache],
    );

    // Retry initialization function
    const retryInitialization = useCallback(async (): Promise<void> => {
      if (refs.retryCount >= MAX_RETRY_ATTEMPTS) {
        dispatch({
          type: 'SET_ERROR',
          payload: `Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) exceeded`,
        });
        return;
      }

      refs.retryCount++;
      dispatch({type: 'RESET_STATE'});

      try {
        await initializeTranslationService();
      } catch (error) {
        console.error(`❌ Retry attempt ${refs.retryCount} failed:`, error);
        dispatch({type: 'SET_ERROR', payload: (error as Error).message});
      }
    }, [initializeTranslationService, refs]);

    // Memoized context value
    const contextValue = useMemo(
      (): TranslationContextType => ({
        t,
        currentLanguage: state.currentLanguage,
        setLanguage,
        isFirstLaunch: state.isFirstLaunch,
        completeFirstLaunch,
        supportedLanguages: stableValues.supportedLanguages,
        isLoading: state.isLoading,
        isTranslating: state.isTranslating,
        error: state.error,
        retryInitialization,
      }),
      [
        t,
        state.currentLanguage,
        state.isFirstLaunch,
        state.isLoading,
        state.isTranslating,
        state.error,
        setLanguage,
        completeFirstLaunch,
        stableValues.supportedLanguages,
        retryInitialization,
      ],
    );

    // Initialization effect
    useEffect(() => {
      if (!refs.isInitialized && !refs.initializationPromise) {
        refs.initializationPromise = initializeTranslationService().catch(
          error => {
            console.error(
              '❌ Initial translation service setup failed:',
              error,
            );
            dispatch({type: 'SET_ERROR', payload: error.message});
          },
        );
      }

      // Cleanup timeout on unmount
      return () => {
        if (refs.initializationTimeout) {
          clearTimeout(refs.initializationTimeout);
          refs.initializationTimeout = null;
        }
      };
    }, [initializeTranslationService, refs]);

    // Credentials change effect
    useEffect(() => {
      const credentialsHash = `${azureKey}-${azureRegion}`;
      if (refs.lastLanguageHash && refs.lastLanguageHash !== credentialsHash) {
        console.log('🔄 Azure credentials changed, reinitializing...');
        refs.isInitialized = false;
        refs.initializationPromise = null;
        refs.retryCount = 0;
        clearCache();
        dispatch({type: 'RESET_STATE'});

        // Reinitialize with new credentials
        initializeTranslationService().catch(error => {
          console.error('❌ Reinitialization failed:', error);
          dispatch({type: 'SET_ERROR', payload: error.message});
        });
      }
      refs.lastLanguageHash = credentialsHash;
    }, [azureKey, azureRegion, initializeTranslationService, clearCache, refs]);

    return (
      <TranslationContext.Provider value={contextValue}>
        {children}
      </TranslationContext.Provider>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.azureKey === nextProps.azureKey &&
      prevProps.azureRegion === nextProps.azureRegion
    );
  },
);

// Enhanced error boundary component
const TranslationErrorBoundary: React.FC<{
  children: React.ReactNode;
  fallback?: React.ComponentType<{error: Error; retry: () => void}>;
}> = ({children, fallback: Fallback}) => {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = useCallback(() => {
    setError(null);
  }, []);

  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      if (event.error?.message?.includes('translation')) {
        setError(event.error);
      }
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (error && Fallback) {
    return <Fallback error={error} retry={resetError} />;
  }

  if (error) {
    return (
      <div style={{padding: 20, textAlign: 'center'}}>
        <h3>Translation Service Error</h3>
        <p>{error.message}</p>
        <button onClick={resetError}>Retry</button>
      </div>
    );
  }

  return <>{children}</>;
};

// Enhanced hook with additional utilities
export const useTranslation = () => {
  const context = useContext(TranslationContext);

  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }

  // Additional helper functions
  const helpers = useMemo(
    () => ({
      // Check if translation is available for a key
      hasTranslation: (key: string): boolean => {
        try {
          const translation = context.t(key);
          return translation !== key;
        } catch {
          return false;
        }
      },

      // Get translation with fallback
      tWithFallback: (key: string, fallback: string): string => {
        try {
          const translation = context.t(key);
          return translation === key ? fallback : translation;
        } catch {
          return fallback;
        }
      },

      // Interpolate variables in translation
      tInterpolate: (
        key: string,
        variables: Record<string, string>,
      ): string => {
        let translation = context.t(key);
        Object.entries(variables).forEach(([variable, value]) => {
          translation = translation.replace(
            new RegExp(`{{${variable}}}`, 'g'),
            value,
          );
        });
        return translation;
      },

      // Get language direction (LTR/RTL)
      getLanguageDirection: (): 'ltr' | 'rtl' => {
        const rtlLanguages = ['ar', 'he', 'fa', 'ur'];
        return rtlLanguages.includes(context.currentLanguage.split('-')[0])
          ? 'rtl'
          : 'ltr';
      },
    }),
    [context],
  );

  return {
    ...context,
    ...helpers,
  };
};

// Export error boundary for optional use
export {TranslationErrorBoundary};

// Export provider with display name for debugging
TranslationProvider.displayName = 'TranslationProvider';
