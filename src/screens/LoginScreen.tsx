import React, {useCallback, useEffect, useMemo, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import {useForm, Controller} from 'react-hook-form';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from '../contexts/TranslationContext';

// Types
interface LoginFormData {
  email: string;
  password: string;
}

interface AnimationRefs {
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  logoAnim: Animated.Value;
}

// Constants
const {width, height} = Dimensions.get('window');
const HEADER_HEIGHT = height * 0.4;
const LOGO_SIZE = 90;

// Validation patterns
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const MIN_PASSWORD_LENGTH = 6;

// Custom hooks
const useAnimations = (): AnimationRefs => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  const startAnimations = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(logoAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, slideAnim, logoAnim]);

  useEffect(() => {
    startAnimations();
  }, [startAnimations]);

  return {fadeAnim, slideAnim, logoAnim};
};

const useKeyboardHandler = () => {
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const keyboardWillShow = (event: any) => {
      Animated.timing(keyboardHeight, {
        duration: event.duration || 250,
        toValue: event.endCoordinates.height,
        useNativeDriver: false,
      }).start();
    };

    const keyboardWillHide = (event: any) => {
      Animated.timing(keyboardHeight, {
        duration: event.duration || 250,
        toValue: 0,
        useNativeDriver: false,
      }).start();
    };

    const showSubscription = Keyboard.addListener(
      'keyboardDidShow',
      keyboardWillShow,
    );
    const hideSubscription = Keyboard.addListener(
      'keyboardDidHide',
      keyboardWillHide,
    );

    return () => {
      showSubscription?.remove();
      hideSubscription?.remove();
    };
  }, [keyboardHeight]);

  return keyboardHeight;
};

// Components
const DecorativeElements = React.memo(() => (
  <>
    <View style={styles.decorativeCircle1} />
    <View style={styles.decorativeCircle2} />
    <View style={styles.decorativeCircle3} />
  </>
));

const BannerImage = React.memo(({logoAnim}: {logoAnim: Animated.Value}) => (
  <Animated.View
    style={[
      styles.bannerContainer,
      {
        opacity: logoAnim,
        transform: [
          {
            scale: logoAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            }),
          },
        ],
      },
    ]}>
    <Image
      source={{
        uri: 'https://images.unsplash.com/photo-1503220317375-aaad61436b1b?ixlib=rb-1.2.1&auto=format&fit=crop&w=750&q=80',
      }}
      style={styles.bannerImage}
      resizeMode="cover"
      // Performance optimization
      loadingIndicatorSource={{
        uri: 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==',
      }}
      fadeDuration={300}
    />
    <AppLogo />
  </Animated.View>
));

const AppLogo = React.memo(() => {
  const {t} = useTranslation();

  return (
    <View style={styles.bannerOverlay}>
      <View style={styles.logoContainer}>
        <View style={styles.logoCircle}>
          <Icon name="globe-americas" size={50} color="#fff" solid />
        </View>
        <Text style={styles.appTitle}>{t('app.name')}</Text>
        <Text style={styles.appSubtitle}>{t('app.subtitle')}</Text>
      </View>
    </View>
  );
});

const CustomInput = React.memo(
  ({
    control,
    name,
    rules,
    placeholder,
    iconName,
    secureTextEntry = false,
    keyboardType = 'default',
    autoCapitalize = 'none',
    autoComplete,
    error,
    showPasswordToggle = false,
    onTogglePassword,
    showPassword,
  }: any) => (
    <View style={styles.inputWrapper}>
      <Text style={styles.inputLabel}>{placeholder}</Text>
      <View style={[styles.inputContainer, error && styles.inputError]}>
        <View style={styles.inputIconContainer}>
          <Icon name={iconName} size={16} color="#4AC6D0" />
        </View>
        <Controller
          control={control}
          name={name}
          rules={rules}
          render={({field: {onChange, value}}) => (
            <TextInput
              placeholder={placeholder}
              placeholderTextColor="#94A3B8"
              style={styles.input}
              onChangeText={onChange}
              value={value}
              secureTextEntry={secureTextEntry && !showPassword}
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              autoComplete={autoComplete}
              autoCorrect={false}
              textContentType={
                name === 'password' ? 'password' : 'emailAddress'
              }
            />
          )}
        />
        {showPasswordToggle && (
          <TouchableOpacity
            style={styles.passwordToggle}
            onPress={onTogglePassword}
            hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon
              name={showPassword ? 'eye-slash' : 'eye'}
              size={16}
              color="#64748B"
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Animated.View style={styles.errorContainer}>
          <Icon name="exclamation-circle" size={12} color="#EF4444" />
          <Text style={styles.errorText}>{error.message}</Text>
        </Animated.View>
      )}
    </View>
  ),
);

const LoginButton = React.memo(({onPress, loading, t}: any) => (
  <TouchableOpacity
    style={[styles.loginButton, loading && styles.loginButtonDisabled]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}>
    <LinearGradient
      colors={
        loading ? ['#94A3B8', '#64748B'] : ['#4AC6D0', '#3BB8C3', '#2DA5B0']
      }
      style={styles.loginButtonGradient}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.loadingText}>{t('auth.signingIn')}</Text>
        </View>
      ) : (
        <View style={styles.buttonContent}>
          <Text style={styles.loginButtonText}>{t('auth.signIn')}</Text>
          <Icon name="arrow-right" size={16} color="#fff" />
        </View>
      )}
    </LinearGradient>
  </TouchableOpacity>
));

const SocialLoginSection = React.memo(({t}: {t: (key: string) => string}) => (
  <>
    <View style={styles.dividerContainer}>
      <View style={styles.dividerLine} />
      <Text style={styles.dividerText}>{t('common.or')}</Text>
      <View style={styles.dividerLine} />
    </View>
    {/* Commented out social login for now */}
    {/* <View style={styles.socialContainer}>
      <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
        <Icon name="google" size={20} color="#DB4437" />
        <Text style={styles.socialButtonText}>{t('social.google')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
        <Icon name="facebook-f" size={20} color="#4267B2" />
        <Text style={styles.socialButtonText}>{t('social.facebook')}</Text>
      </TouchableOpacity>
    </View> */}
  </>
));

// Main Component
const LoginScreen: React.FC = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const {fadeAnim, slideAnim, logoAnim} = useAnimations();
  const keyboardHeight = useKeyboardHandler();

  // Form handling
  const {
    control,
    handleSubmit,
    formState: {errors, isSubmitting},
    setError,
    clearErrors,
  } = useForm<LoginFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // State
  const [showPassword, setShowPassword] = React.useState(false);
  const loadingRef = useRef(false);

  // Validation rules (memoized for performance)
  const validationRules = useMemo(
    () => ({
      email: {
        required: t('auth.emailRequired'),
        pattern: {
          value: EMAIL_REGEX,
          message: t('auth.invalidEmailAddress'),
        },
      },
      password: {
        required: t('auth.passwordRequired'),
        minLength: {
          value: MIN_PASSWORD_LENGTH,
          message: t('auth.passwordMinLength'),
        },
      },
    }),
    [t],
  );

  // Handlers
  const handleTogglePassword = useCallback(() => {
    setShowPassword(prev => !prev);
  }, []);

  const handleForgotPassword = useCallback(() => {
    navigation.navigate('ForgotPassword');
  }, [navigation]);

  const handleRegister = useCallback(() => {
    navigation.navigate('Register');
  }, [navigation]);

  const onSubmit = useCallback(
    async (data: LoginFormData) => {
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;
      clearErrors();

      try {
        await auth().signInWithEmailAndPassword(
          data.email.trim(),
          data.password,
        );
        // Navigation will be handled by AuthContext
      } catch (error: any) {
        console.error('Login error:', error);

        // Handle specific Firebase errors
        let errorMessage = t('auth.loginError');

        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMessage = t('auth.invalidCredentials');
            break;
          case 'auth/invalid-email':
            setError('email', {message: t('auth.invalidEmailAddress')});
            return;
          case 'auth/user-disabled':
            errorMessage = t('auth.accountDisabled');
            break;
          case 'auth/too-many-requests':
            errorMessage = t('auth.tooManyAttempts');
            break;
          case 'auth/network-request-failed':
            errorMessage = t('auth.networkError');
            break;
          default:
            errorMessage = error.message || t('auth.loginError');
        }

        Alert.alert(t('auth.loginFailed'), errorMessage);
      } finally {
        loadingRef.current = false;
      }
    },
    [t, clearErrors, setError],
  );

  // Render
  return (
    <>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}>
        <Animated.View
          style={[
            styles.container,
            {
              paddingBottom: Platform.OS === 'ios' ? keyboardHeight : 0,
            },
          ]}>
          <ScrollView
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled">
            {/* Header with Gradient */}
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3', '#2DA5B0']}
              style={styles.headerGradient}>
              <Animated.View
                style={[styles.headerOverlay, {opacity: fadeAnim}]}>
                <DecorativeElements />
                <BannerImage logoAnim={logoAnim} />
              </Animated.View>
            </LinearGradient>

            {/* Main Content */}
            <Animated.View
              style={[
                styles.contentContainer,
                {
                  opacity: fadeAnim,
                  transform: [{translateY: slideAnim}],
                },
              ]}>
              {/* Welcome Section */}
              <View style={styles.welcomeSection}>
                <Text style={styles.welcomeTitle}>{t('auth.welcomeBack')}</Text>
                <Text style={styles.welcomeSubtitle}>
                  {t('auth.signInToContinue')}
                </Text>
              </View>

              {/* Form Container */}
              <View style={styles.formContainer}>
                {/* Email Input */}
                <CustomInput
                  control={control}
                  name="email"
                  rules={validationRules.email}
                  placeholder={t('auth.emailAddress')}
                  iconName="envelope"
                  keyboardType="email-address"
                  autoComplete="email"
                  error={errors.email}
                />

                {/* Password Input */}
                <CustomInput
                  control={control}
                  name="password"
                  rules={validationRules.password}
                  placeholder={t('auth.password')}
                  iconName="lock"
                  secureTextEntry
                  autoComplete="password"
                  error={errors.password}
                  showPasswordToggle
                  onTogglePassword={handleTogglePassword}
                  showPassword={showPassword}
                />

                {/* Forgot Password */}
                <TouchableOpacity
                  style={styles.forgotPasswordContainer}
                  onPress={handleForgotPassword}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Text style={styles.forgotPasswordText}>
                    {t('auth.forgotYourPassword')}
                  </Text>
                </TouchableOpacity>

                {/* Login Button */}
                <LoginButton
                  onPress={handleSubmit(onSubmit)}
                  loading={isSubmitting}
                  t={t}
                />

                {/* Social Login Section */}
                <SocialLoginSection t={t} />
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {t('auth.dontHaveAccount')}{' '}
                </Text>
                <TouchableOpacity
                  onPress={handleRegister}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Text style={styles.registerText}>
                    {t('auth.createAccount')}
                  </Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </>
  );
};

// Optimized StyleSheet (same styles as before but organized better)
const styles = StyleSheet.create({
  // Container styles
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header styles
  headerGradient: {
    height: HEADER_HEIGHT,
    position: 'relative',
  },
  headerOverlay: {
    flex: 1,
    position: 'relative',
  },
  decorativeCircle1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorativeCircle2: {
    position: 'absolute',
    top: 50,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  decorativeCircle3: {
    position: 'absolute',
    bottom: -30,
    right: 20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  bannerContainer: {
    flex: 1,
    margin: 20,
    borderRadius: 20,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    backgroundColor: 'rgba(74, 198, 208, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  appSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Content styles
  contentContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  welcomeSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },

  // Form styles
  formContainer: {
    gap: 20,
  },
  inputWrapper: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputError: {
    borderColor: '#EF4444',
  },
  inputIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  input: {
    flex: 1,
    height: 50,
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '500',
  },
  passwordToggle: {
    padding: 8,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 4,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '500',
  },

  // Button styles
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: -8,
    paddingVertical: 8,
  },
  forgotPasswordText: {
    color: '#4AC6D0',
    fontSize: 14,
    fontWeight: '600',
  },
  loginButton: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginTop: 8,
  },
  loginButtonDisabled: {
    elevation: 2,
    shadowOpacity: 0.1,
  },
  loginButtonGradient: {
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },

  // Divider & Social styles
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    paddingHorizontal: 16,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },

  // Footer styles
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 24,
    paddingVertical: 8,
  },
  footerText: {
    color: '#64748B',
    fontSize: 16,
  },
  registerText: {
    color: '#4AC6D0',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default React.memo(LoginScreen);
