import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
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
interface ForgotPasswordFormData {
  email: string;
}

interface AnimationRefs {
  fadeAnim: Animated.Value;
  slideAnim: Animated.Value;
  iconAnim: Animated.Value;
}

// Constants
const {width, height} = Dimensions.get('window');
const HEADER_HEIGHT = height * 0.35;
const ICON_SIZE = 80;

// Validation patterns
const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

// Custom hooks
const useAnimations = (): AnimationRefs => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const iconAnim = useRef(new Animated.Value(0)).current;

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
        Animated.timing(iconAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [fadeAnim, slideAnim, iconAnim]);

  useEffect(() => {
    startAnimations();
  }, [startAnimations]);

  return {fadeAnim, slideAnim, iconAnim};
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

const HeaderIcon = React.memo(({iconAnim}: {iconAnim: Animated.Value}) => {
  const {t} = useTranslation();

  return (
    <Animated.View
      style={[
        styles.headerIconContainer,
        {
          opacity: iconAnim,
          transform: [
            {
              scale: iconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
            {
              rotate: iconAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0deg', '360deg'],
              }),
            },
          ],
        },
      ]}>
      <View style={styles.iconCircle}>
        <Icon name="key" size={40} color="#fff" solid />
      </View>
      <Text style={styles.headerTitle}>{t('auth.resetPassword')}</Text>
      <Text style={styles.headerSubtitle}>
        {t('auth.resetPasswordSubtitle')}
      </Text>
    </Animated.View>
  );
});

const CustomInput = React.memo(
  ({
    control,
    name,
    rules,
    placeholder,
    iconName,
    keyboardType = 'default',
    autoCapitalize = 'none',
    autoComplete,
    error,
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
              keyboardType={keyboardType}
              autoCapitalize={autoCapitalize}
              autoComplete={autoComplete}
              autoCorrect={false}
              textContentType="emailAddress"
            />
          )}
        />
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

const ResetButton = React.memo(({onPress, loading, t}: any) => (
  <TouchableOpacity
    style={[styles.resetButton, loading && styles.resetButtonDisabled]}
    onPress={onPress}
    disabled={loading}
    activeOpacity={0.8}>
    <LinearGradient
      colors={
        loading ? ['#94A3B8', '#64748B'] : ['#4AC6D0', '#3BB8C3', '#2DA5B0']
      }
      style={styles.resetButtonGradient}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color="#fff" size="small" />
          <Text style={styles.loadingText}>{t('auth.sending')}</Text>
        </View>
      ) : (
        <View style={styles.buttonContent}>
          <Text style={styles.resetButtonText}>{t('auth.sendResetEmail')}</Text>
          <Icon name="paper-plane" size={16} color="#fff" />
        </View>
      )}
    </LinearGradient>
  </TouchableOpacity>
));

const InstructionCard = React.memo(({t}: {t: (key: string) => string}) => (
  <View style={styles.instructionCard}>
    <View style={styles.instructionHeader}>
      <Icon name="info-circle" size={20} color="#4AC6D0" />
      <Text style={styles.instructionTitle}>{t('auth.howItWorks')}</Text>
    </View>
    <View style={styles.instructionSteps}>
      <View style={styles.instructionStep}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>1</Text>
        </View>
        <Text style={styles.stepText}>{t('auth.step1')}</Text>
      </View>
      <View style={styles.instructionStep}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>2</Text>
        </View>
        <Text style={styles.stepText}>{t('auth.step2')}</Text>
      </View>
      <View style={styles.instructionStep}>
        <View style={styles.stepNumber}>
          <Text style={styles.stepNumberText}>3</Text>
        </View>
        <Text style={styles.stepText}>{t('auth.step3')}</Text>
      </View>
    </View>
  </View>
));

const SuccessModal = React.memo(({visible, onClose, email, t}: any) => {
  const [modalAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible) {
      Animated.spring(modalAnim, {
        toValue: 1,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();
    } else {
      Animated.timing(modalAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, modalAnim]);

  if (!visible) {
    return null;
  }

  return (
    <View style={styles.modalOverlay}>
      <Animated.View
        style={[
          styles.modalContainer,
          {
            opacity: modalAnim,
            transform: [
              {
                scale: modalAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
          },
        ]}>
        <View style={styles.modalIconContainer}>
          <Icon name="check-circle" size={60} color="#10B981" />
        </View>
        <Text style={styles.modalTitle}>{t('auth.emailSent')}</Text>
        <Text style={styles.modalMessage}>
          {t('auth.resetEmailSentTo')} {email}
        </Text>
        <Text style={styles.modalSubMessage}>{t('auth.checkSpamFolder')}</Text>
        <TouchableOpacity
          style={styles.modalButton}
          onPress={onClose}
          activeOpacity={0.8}>
          <LinearGradient
            colors={['#4AC6D0', '#3BB8C3']}
            style={styles.modalButtonGradient}>
            <Text style={styles.modalButtonText}>{t('common.ok')}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
});

// Main Component
const ForgotPasswordScreen: React.FC = () => {
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const {fadeAnim, slideAnim, iconAnim} = useAnimations();
  const keyboardHeight = useKeyboardHandler();

  // Form handling
  const {
    control,
    handleSubmit,
    formState: {errors, isSubmitting},
    setError,
    clearErrors,
    getValues,
  } = useForm<ForgotPasswordFormData>({
    mode: 'onChange',
    defaultValues: {
      email: '',
    },
  });

  // State
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
    }),
    [t],
  );

  // Handlers
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleGoToLogin = useCallback(() => {
    navigation.navigate('Login');
  }, [navigation]);

  const onSubmit = useCallback(
    async (data: ForgotPasswordFormData) => {
      if (loadingRef.current) {
        return;
      }

      loadingRef.current = true;
      clearErrors();

      try {
        await auth().sendPasswordResetEmail(data.email.trim());
        setShowSuccessModal(true);
      } catch (error: any) {
        console.error('Password reset error:', error);

        // Handle specific Firebase errors
        let errorMessage = t('auth.resetPasswordError');

        switch (error.code) {
          case 'auth/user-not-found':
            setError('email', {message: t('auth.emailNotFound')});
            return;
          case 'auth/invalid-email':
            setError('email', {message: t('auth.invalidEmailAddress')});
            return;
          case 'auth/too-many-requests':
            errorMessage = t('auth.tooManyRequests');
            break;
          case 'auth/network-request-failed':
            errorMessage = t('errors.networkError');
            break;
          default:
            errorMessage = error.message || t('auth.resetPasswordError');
        }

        Alert.alert(t('common.error'), errorMessage);
      } finally {
        loadingRef.current = false;
      }
    },
    [t, clearErrors, setError],
  );

  const handleSuccessModalClose = useCallback(() => {
    setShowSuccessModal(false);
    navigation.goBack();
  }, [navigation]);

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
                {/* Back Button */}
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={handleBack}
                  activeOpacity={0.8}>
                  <Icon name="arrow-left" size={20} color="#fff" />
                </TouchableOpacity>

                <DecorativeElements />
                <HeaderIcon iconAnim={iconAnim} />
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
                <Text style={styles.welcomeTitle}>
                  {t('auth.forgotPassword')}
                </Text>
                <Text style={styles.welcomeSubtitle}>
                  {t('auth.enterEmailToReset')}
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

                {/* Reset Button */}
                <ResetButton
                  onPress={handleSubmit(onSubmit)}
                  loading={isSubmitting}
                  t={t}
                />

                {/* Instruction Card */}
                <InstructionCard t={t} />
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {t('auth.rememberPassword')}{' '}
                </Text>
                <TouchableOpacity
                  onPress={handleGoToLogin}
                  activeOpacity={0.7}
                  hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
                  <Text style={styles.loginText}>{t('auth.backToLogin')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </Animated.View>

        {/* Success Modal */}
        <SuccessModal
          visible={showSuccessModal}
          onClose={handleSuccessModalClose}
          email={getValues('email')}
          t={t}
        />
      </KeyboardAvoidingView>
    </>
  );
};

// StyleSheet
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
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
  headerIconContainer: {
    alignItems: 'center',
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: {width: 0, height: 2},
    textShadowRadius: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
    paddingHorizontal: 40,
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
    paddingHorizontal: 20,
  },

  // Form styles
  formContainer: {
    gap: 24,
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
  resetButton: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginTop: 8,
  },
  resetButtonDisabled: {
    elevation: 2,
    shadowOpacity: 0.1,
  },
  resetButtonGradient: {
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
  resetButtonText: {
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

  // Instruction Card styles
  instructionCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  instructionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  instructionSteps: {
    gap: 12,
  },
  instructionStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4AC6D0',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },

  // Modal styles
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    maxWidth: width - 48,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  modalIconContainer: {
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  modalSubMessage: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  modalButton: {
    borderRadius: 12,
    minWidth: 120,
  },
  modalButtonGradient: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Footer styles
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
    paddingVertical: 8,
  },
  footerText: {
    color: '#64748B',
    fontSize: 16,
  },
  loginText: {
    color: '#4AC6D0',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default React.memo(ForgotPasswordScreen);
