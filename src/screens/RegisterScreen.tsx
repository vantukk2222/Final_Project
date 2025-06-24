import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  Animated,
  Dimensions,
  Image,
} from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {useForm, Controller} from 'react-hook-form';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome5';
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from '../contexts/TranslationContext';
import {useAuth} from '../contexts/AuthContext';

const {width, height} = Dimensions.get('window');

const RegisterScreen = () => {
  const {t} = useTranslation();
  const {
    control,
    handleSubmit,
    watch,
    formState: {errors},
    reset,
    setError,
    clearErrors,
  } = useForm();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigation = useNavigation<any>();
  const watchPassword = watch('password');
  const {signUp, loading: authLoading} = useAuth();

  // Animation values
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(50);
  const headerAnim = new Animated.Value(0);

  useEffect(() => {
    // Entrance animations
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
        Animated.timing(headerAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  // Get validation rules with translations
  const getValidationRules = () => ({
    name: {
      required: t('auth.nameRequired'),
      minLength: {
        value: 2,
        message: t('auth.nameMinLength'),
      },
      pattern: {
        value: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s]+$/,
        message: t('auth.nameInvalid'),
      },
    },
    email: {
      required: t('auth.emailRequired'),
      pattern: {
        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
        message: t('auth.invalidEmailAddress'),
      },
    },
    password: {
      required: t('auth.passwordRequired'),
      minLength: {
        value: 6,
        message: t('auth.passwordMinLength'),
      },
      pattern: {
        value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        message: t('auth.passwordComplexity'),
      },
    },
    confirmPassword: {
      required: t('auth.confirmPasswordRequired'),
      validate: (value: string) =>
        value === watchPassword || t('auth.passwordsDoNotMatch'),
    },
    role: {
      required: t('auth.roleRequired'),
    },
  });

  const onRegister = async (data: any) => {
    if (loading || authLoading) {
      return;
    }

    setLoading(true);
    clearErrors();

    try {
      await signUp(
        data.email.trim(),
        data.password,
        data.role,
        data.name?.trim(),
      );

      // Reset form on success
      reset();

      // Show success message based on role (only for tourists, tour guides will show their own alert)
      if (data.role === 'tourist') {
        const successMessage = t('auth.registerSuccess');

        Alert.alert(t('auth.accountCreated'), successMessage, [
          {
            text: t('common.ok'),
            onPress: () => {
              // Navigation will be handled by AuthContext
            },
          },
        ]);
      }
      // For tour guides, the alert is shown in AuthContext
    } catch (error: any) {
      console.error('Registration error:', error);

      const errorMessage = error.message || t('auth.registrationFailed');

      Alert.alert(t('auth.registrationFailed'), errorMessage, [
        {
          text: t('common.ok'),
          style: 'default',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <ScrollView
            style={styles.scrollContainer}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {/* Header with Gradient */}
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3', '#2DA5B0']}
              style={styles.headerGradient}>
              <Animated.View
                style={[
                  styles.headerOverlay,
                  {
                    opacity: fadeAnim,
                  },
                ]}>
                {/* Top Row with Back Button and Language Button */}
                <View style={styles.headerTopRow}>
                  <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.8}>
                    <Icon name="arrow-left" size={20} color="#fff" />
                  </TouchableOpacity>
                  {/* <LanguageButton /> */}
                </View>

                {/* Decorative Elements */}
                <View style={styles.decorativeCircle1} />
                <View style={styles.decorativeCircle2} />

                {/* Header Content */}
                <Animated.View
                  style={[
                    styles.headerContent,
                    {
                      opacity: headerAnim,
                      transform: [
                        {
                          scale: headerAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.8, 1],
                          }),
                        },
                      ],
                    },
                  ]}>
                  <View style={styles.logoContainer}>
                    <View style={styles.logoCircle}>
                      <Icon name="user-plus" size={40} color="#fff" solid />
                    </View>
                    <Text style={styles.headerTitle}>
                      {t('auth.joinCommunity')}
                    </Text>
                    <Text style={styles.headerSubtitle}>
                      {t('auth.createAccountDescription')}
                    </Text>
                  </View>
                </Animated.View>
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
              {/* Form Container */}
              <View style={styles.formContainer}>
                {/* Name Input */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>{t('auth.fullName')}</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      errors.name && styles.inputError,
                    ]}>
                    <View style={styles.inputIconContainer}>
                      <Icon name="user" size={16} color="#4AC6D0" />
                    </View>
                    <Controller
                      control={control}
                      name="name"
                      rules={getValidationRules().name}
                      render={({field: {onChange, value}}) => (
                        <TextInput
                          placeholder={t('placeholders.enterName')}
                          placeholderTextColor="#94A3B8"
                          style={styles.input}
                          onChangeText={onChange}
                          value={value}
                          autoCapitalize="words"
                          autoComplete="name"
                        />
                      )}
                    />
                  </View>
                  {errors.name && (
                    <Animated.View style={styles.errorContainer}>
                      <Icon
                        name="exclamation-circle"
                        size={12}
                        color="#EF4444"
                      />
                      <Text style={styles.errorText}>
                        {errors.name.message}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {/* Email Input */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>
                    {t('auth.emailAddress')}
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      errors.email && styles.inputError,
                    ]}>
                    <View style={styles.inputIconContainer}>
                      <Icon name="envelope" size={16} color="#4AC6D0" />
                    </View>
                    <Controller
                      control={control}
                      name="email"
                      rules={getValidationRules().email}
                      render={({field: {onChange, value}}) => (
                        <TextInput
                          placeholder={t('placeholders.enterEmail')}
                          placeholderTextColor="#94A3B8"
                          style={styles.input}
                          onChangeText={onChange}
                          value={value}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoComplete="email"
                        />
                      )}
                    />
                  </View>
                  {errors.email && (
                    <Animated.View style={styles.errorContainer}>
                      <Icon
                        name="exclamation-circle"
                        size={12}
                        color="#EF4444"
                      />
                      <Text style={styles.errorText}>
                        {errors.email.message}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {/* Password Input */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>{t('auth.password')}</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      errors.password && styles.inputError,
                    ]}>
                    <View style={styles.inputIconContainer}>
                      <Icon name="lock" size={16} color="#4AC6D0" />
                    </View>
                    <Controller
                      control={control}
                      name="password"
                      rules={getValidationRules().password}
                      render={({field: {onChange, value}}) => (
                        <TextInput
                          placeholder={t('placeholders.createPassword')}
                          placeholderTextColor="#94A3B8"
                          secureTextEntry={!showPassword}
                          style={styles.input}
                          onChangeText={onChange}
                          value={value}
                          autoCapitalize="none"
                        />
                      )}
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() => setShowPassword(!showPassword)}>
                      <Icon
                        name={showPassword ? 'eye-slash' : 'eye'}
                        size={16}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.password && (
                    <Animated.View style={styles.errorContainer}>
                      <Icon
                        name="exclamation-circle"
                        size={12}
                        color="#EF4444"
                      />
                      <Text style={styles.errorText}>
                        {errors.password.message}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {/* Confirm Password Input */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>
                    {t('auth.confirmPassword')}
                  </Text>
                  <View
                    style={[
                      styles.inputContainer,
                      errors.confirmPassword && styles.inputError,
                    ]}>
                    <View style={styles.inputIconContainer}>
                      <Icon name="shield-alt" size={16} color="#4AC6D0" />
                    </View>
                    <Controller
                      control={control}
                      name="confirmPassword"
                      rules={getValidationRules().confirmPassword}
                      render={({field: {onChange, value}}) => (
                        <TextInput
                          placeholder={t('placeholders.confirmPassword')}
                          placeholderTextColor="#94A3B8"
                          secureTextEntry={!showConfirmPassword}
                          style={styles.input}
                          onChangeText={onChange}
                          value={value}
                          autoCapitalize="none"
                        />
                      )}
                    />
                    <TouchableOpacity
                      style={styles.passwordToggle}
                      onPress={() =>
                        setShowConfirmPassword(!showConfirmPassword)
                      }>
                      <Icon
                        name={showConfirmPassword ? 'eye-slash' : 'eye'}
                        size={16}
                        color="#64748B"
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword && (
                    <Animated.View style={styles.errorContainer}>
                      <Icon
                        name="exclamation-circle"
                        size={12}
                        color="#EF4444"
                      />
                      <Text style={styles.errorText}>
                        {errors.confirmPassword.message}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {/* Role Selection */}
                <View style={styles.inputWrapper}>
                  <Text style={styles.inputLabel}>{t('auth.chooseRole')}</Text>
                  <Text style={styles.roleSubtitle}>
                    {t('auth.roleSubtitle')}
                  </Text>

                  <Controller
                    control={control}
                    name="role"
                    rules={getValidationRules().role}
                    render={({field: {onChange, value}}) => (
                      <View style={styles.roleContainer}>
                        {/* Tourist Role */}
                        <TouchableOpacity
                          style={[
                            styles.roleCard,
                            value === 'tourist' && styles.roleCardSelected,
                          ]}
                          onPress={() => onChange('tourist')}
                          activeOpacity={0.8}>
                          <LinearGradient
                            colors={
                              value === 'tourist'
                                ? ['#4AC6D0', '#3BB8C3']
                                : ['#fff', '#fff']
                            }
                            style={[
                              styles.roleCardGradient,
                              value === 'tourist' && {borderColor: '#4AC6D0'},
                            ]}>
                            <View style={styles.roleIconContainer}>
                              <Icon
                                name="hiking"
                                size={24}
                                color={value === 'tourist' ? '#fff' : '#4AC6D0'}
                              />
                            </View>
                            <Text
                              style={[
                                styles.roleTitle,
                                value === 'tourist' && styles.roleTitleSelected,
                              ]}>
                              {t('roles.traveler')}
                            </Text>
                            <Text
                              style={[
                                styles.roleDescription,
                                value === 'tourist' &&
                                  styles.roleDescriptionSelected,
                              ]}>
                              {t('roles.travelerDescription')}
                            </Text>
                          </LinearGradient>
                        </TouchableOpacity>

                        {/* Tour Guide Role */}
                        <TouchableOpacity
                          style={[
                            styles.roleCard,
                            value === 'tour_guide' && styles.roleCardSelected,
                          ]}
                          onPress={() => onChange('tour_guide')}
                          activeOpacity={0.8}>
                          <LinearGradient
                            colors={
                              value === 'tour_guide'
                                ? ['#10B981', '#059669']
                                : ['#fff', '#fff']
                            }
                            style={[
                              styles.roleCardGradient,
                              value === 'tour_guide' && {
                                borderColor: '#10B981',
                              },
                            ]}>
                            <View style={styles.roleIconContainer}>
                              <Icon
                                name="map-signs"
                                size={24}
                                color={
                                  value === 'tour_guide' ? '#fff' : '#10B981'
                                }
                              />
                            </View>
                            <Text
                              style={[
                                styles.roleTitle,
                                value === 'tour_guide' &&
                                  styles.roleTitleSelected,
                              ]}>
                              {t('roles.tourGuide')}
                            </Text>
                            <Text
                              style={[
                                styles.roleDescription,
                                value === 'tour_guide' &&
                                  styles.roleDescriptionSelected,
                              ]}>
                              {t('roles.tourGuideDescription')}
                            </Text>
                            {value === 'tour_guide' && (
                              <View style={styles.pendingBadge}>
                                <Icon name="clock" size={12} color="#F59E0B" />
                                <Text style={styles.pendingText}>
                                  {t('roles.requiresReview')}
                                </Text>
                              </View>
                            )}
                          </LinearGradient>
                        </TouchableOpacity>
                      </View>
                    )}
                  />
                  {errors.role && (
                    <Animated.View style={styles.errorContainer}>
                      <Icon
                        name="exclamation-circle"
                        size={12}
                        color="#EF4444"
                      />
                      <Text style={styles.errorText}>
                        {errors.role.message}
                      </Text>
                    </Animated.View>
                  )}
                </View>

                {/* Register Button */}
                <TouchableOpacity
                  style={[
                    styles.registerButton,
                    (loading || authLoading) && styles.registerButtonDisabled,
                  ]}
                  onPress={handleSubmit(onRegister)}
                  disabled={loading || authLoading}
                  activeOpacity={0.8}>
                  <LinearGradient
                    colors={
                      loading || authLoading
                        ? ['#94A3B8', '#64748B']
                        : ['#4AC6D0', '#3BB8C3', '#2DA5B0']
                    }
                    style={styles.registerButtonGradient}>
                    {loading || authLoading ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator color="#fff" size="small" />
                        <Text style={styles.loadingText}>
                          {t('auth.creatingAccount')}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.buttonContent}>
                        <Text style={styles.registerButtonText}>
                          {t('auth.createAccount')}
                        </Text>
                        <Icon name="arrow-right" size={16} color="#fff" />
                      </View>
                    )}
                  </LinearGradient>
                </TouchableOpacity>

                {/* Terms & Conditions */}
                <Text style={styles.termsText}>
                  {t('auth.byCreatingAccount')}{' '}
                  <Text style={styles.termsLink}>
                    {t('auth.termsOfService')}
                  </Text>{' '}
                  {t('common.and')}{' '}
                  <Text style={styles.termsLink}>
                    {t('auth.privacyPolicy')}
                  </Text>
                </Text>
              </View>

              {/* Footer */}
              <View style={styles.footer}>
                <Text style={styles.footerText}>
                  {t('auth.alreadyHaveAccount')}{' '}
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate('Login')}
                  activeOpacity={0.7}>
                  <Text style={styles.loginText}>{t('auth.signIn')}</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Header Styles
  headerGradient: {
    height: height * 0.35,
    position: 'relative',
  },
  headerOverlay: {
    flex: 1,
    position: 'relative',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
  decorativeCircle1: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    fontWeight: '500',
  },

  // Content Styles
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

  // Form Styles
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

  // Role Selection
  roleSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginLeft: 4,
    marginTop: -4,
  },
  roleContainer: {
    gap: 12,
    marginTop: 8,
  },
  roleCard: {
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  roleCardSelected: {
    elevation: 6,
    shadowOpacity: 0.2,
  },
  roleCardGradient: {
    padding: 20,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 16,
  },
  roleIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  roleTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  roleTitleSelected: {
    color: '#fff',
  },
  roleDescription: {
    fontSize: 14,
    color: '#64748B',
    lineHeight: 20,
  },
  roleDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 8,
    gap: 4,
  },
  pendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#F59E0B',
  },

  // Button Styles
  registerButton: {
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    marginTop: 8,
  },
  registerButtonDisabled: {
    elevation: 2,
    shadowOpacity: 0.1,
  },
  registerButtonGradient: {
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
  registerButtonText: {
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

  // Terms & Footer
  termsText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 16,
  },
  termsLink: {
    color: '#4AC6D0',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
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

export default RegisterScreen;
