import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  ActivityIndicator,
  Modal,
  ScrollView,
  SafeAreaView,
  Dimensions,
  StatusBar,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import {useAuth} from '../contexts/AuthContext';
import {useTranslation} from '../contexts/TranslationContext';
import {handleImageUpload} from '../utils/imageUpload';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Loading from '../components/Loading';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

const {width} = Dimensions.get('window');

const UserProfileScreen = () => {
  const {user, signOut} = useAuth();
  const {t} = useTranslation();
  const navigation = useNavigation();
  const userId = user?.uid;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Password change states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!userId) {
      return;
    }
    const loadProfile = async () => {
      setLoading(true);
      try {
        const doc = await firestore().collection('users').doc(userId).get();
        const data = doc.data();
        if (data) {
          setName(data?.name || '');
          setEmail(data?.email || '');
          setBio(data?.bio || '');
          setAvatarUrl(data?.avatar || '');
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadProfile();
  }, [userId]);

  const handleSave = async () => {
    if (!userId) {
      return;
    }
    if (!name.trim()) {
      Alert.alert(t('common.error'), t('profile.nameCannotBeEmpty'));
      return;
    }

    setLoading(true);
    try {
      await firestore().collection('users').doc(userId).update({
        name: name.trim(),
        bio: bio.trim(),
        avatar: avatarUrl,
        updatedAt: firestore.FieldValue.serverTimestamp(),
      });
      Alert.alert(t('common.success'), t('profile.profileUpdatedSuccessfully'));
    } catch (err) {
      console.error(err);
      Alert.alert(t('common.error'), t('profile.failedToUpdateProfile'));
    }
    setLoading(false);
  };

  const handlePickImage = async () => {
    setUploading(true);
    handleImageUpload()
      .then(async url => {
        if (!url) {
          setUploading(false);
          return;
        }
        setAvatarUrl(url);
        await firestore().collection('users').doc(userId).update({
          avatar: url,
        });
        Alert.alert(
          t('common.success'),
          t('profile.profilePictureUpdatedSuccessfully'),
        );
      })
      .catch(error => {
        console.error('Image upload error:', error);
        Alert.alert(t('common.error'), t('profile.failedToUploadImage'));
      })
      .finally(() => {
        setUploading(false);
      });
  };

  const reauthenticateUser = async (password: string) => {
    const currentUser = auth().currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error(t('profile.noAuthenticatedUserFound'));
    }

    const credential = auth.EmailAuthProvider.credential(
      currentUser.email,
      password,
    );

    await currentUser.reauthenticateWithCredential(credential);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('common.error'), t('profile.pleaseFillAllPasswordFields'));
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('profile.newPasswordsDoNotMatch'));
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert(t('common.error'), t('profile.newPasswordMinLength'));
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert(t('common.error'), t('profile.newPasswordMustBeDifferent'));
      return;
    }

    setPasswordLoading(true);

    try {
      await reauthenticateUser(currentPassword);

      const currentUser = auth().currentUser;
      if (currentUser) {
        await currentUser.updatePassword(newPassword);

        await firestore().collection('users').doc(userId).update({
          passwordChangedAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

        Alert.alert(
          t('common.success'),
          t('profile.passwordChangedSuccessfully'),
          [
            {
              text: t('common.ok'),
              onPress: () => {
                setShowPasswordModal(false);
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
              },
            },
          ],
        );
      }
    } catch (error: any) {
      console.error('Password change error:', error);

      let errorMessage = t('profile.failedToChangePassword');
      if (error.code === 'auth/wrong-password') {
        errorMessage = t('profile.currentPasswordIncorrect');
      } else if (error.code === 'auth/weak-password') {
        errorMessage = t('profile.newPasswordTooWeak');
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = t('profile.pleaseLogoutAndLoginAgain');
      }

      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  const renderPasswordInput = (
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    showPassword: boolean,
    toggleShow: () => void,
  ) => (
    <View style={styles.passwordInputContainer}>
      <TextInput
        style={styles.passwordInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        secureTextEntry={!showPassword}
      />
      <TouchableOpacity onPress={toggleShow} style={styles.eyeButton}>
        <Icon
          name={showPassword ? 'visibility' : 'visibility-off'}
          size={20}
          color="#6B7280"
        />
      </TouchableOpacity>
    </View>
  );

  const renderPasswordModal = () => (
    <Modal
      visible={showPasswordModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowPasswordModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('profile.changePassword')}</Text>
            <TouchableOpacity
              onPress={() => setShowPasswordModal(false)}
              style={styles.modalCloseButton}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.modalLabel}>
              {t('profile.currentPassword')}
            </Text>
            {renderPasswordInput(
              currentPassword,
              setCurrentPassword,
              t('profile.enterCurrentPassword'),
              showCurrentPassword,
              () => setShowCurrentPassword(!showCurrentPassword),
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.modalLabel}>{t('profile.newPassword')}</Text>
            {renderPasswordInput(
              newPassword,
              setNewPassword,
              t('profile.enterNewPasswordMinChars'),
              showNewPassword,
              () => setShowNewPassword(!showNewPassword),
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.modalLabel}>
              {t('profile.confirmNewPassword')}
            </Text>
            {renderPasswordInput(
              confirmPassword,
              setConfirmPassword,
              t('profile.confirmNewPasswordPlaceholder'),
              showConfirmPassword,
              () => setShowConfirmPassword(!showConfirmPassword),
            )}
          </View>

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowPasswordModal(false)}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.modalSaveButton,
                passwordLoading && styles.modalSaveButtonDisabled,
              ]}
              onPress={handleChangePassword}
              disabled={passwordLoading}>
              {passwordLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.modalSaveText}>
                  {t('profile.updatePassword')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return <Loading isLoading={true} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={['#4AC6D0', '#3BB8C3']}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 0}}
        style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.profile')}</Text>
        <View style={styles.settingsButton} />
      </LinearGradient>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={handlePickImage}
            style={styles.avatarContainer}
            disabled={uploading}>
            <Image
              source={
                avatarUrl
                  ? {uri: avatarUrl.url || avatarUrl}
                  : require('../assets/default-avatar.png')
              }
              style={styles.avatar}
            />
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.editIcon}>
              {uploading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Icon name="camera-alt" size={16} color="#fff" />
              )}
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.avatarHint}>{t('profile.tapToChangePhoto')}</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Email Field (Read-only) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.emailAddress')}</Text>
            <View style={styles.readOnlyInput}>
              <Icon
                name="email"
                size={20}
                color="#6B7280"
                style={styles.inputIcon}
              />
              <Text style={styles.readOnlyText}>{email}</Text>
              <Icon name="verified" size={20} color="#10B981" />
            </View>
          </View>

          {/* Name Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.fullName')}</Text>
            <View style={styles.inputContainer}>
              <Icon
                name="person"
                size={20}
                color="#6B7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder={t('profile.enterYourFullName')}
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Bio Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profile.bio')}</Text>
            <View style={styles.inputContainer}>
              <Icon
                name="info"
                size={20}
                color="#6B7280"
                style={styles.inputIcon}
              />
              <TextInput
                style={[styles.input, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder={t('profile.tellOthersAboutYourself')}
                placeholderTextColor="#9CA3AF"
                multiline
                textAlignVertical="top"
              />
            </View>
          </View>

          {/* Actions Section */}
          <View style={styles.actionsSection}>
            {/* Change Password Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setShowPasswordModal(true)}>
              <View style={styles.actionIconContainer}>
                <Icon name="lock" size={20} color="#4AC6D0" />
              </View>
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>
                  {t('profile.changePassword')}
                </Text>
                <Text style={styles.actionSubtitle}>
                  {t('profile.updateYourAccountPassword')}
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Security Info */}
            <View style={styles.securityInfo}>
              <Icon name="security" size={16} color="#10B981" />
              <Text style={styles.securityText}>
                {t('profile.yourAccountIsSecure')}
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonSection}>
            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}>
              <LinearGradient
                colors={
                  loading ? ['#9CA3AF', '#9CA3AF'] : ['#4AC6D0', '#3BB8C3']
                }
                style={styles.saveButtonGradient}>
                {loading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Icon
                      name="save"
                      size={18}
                      color="#fff"
                      style={styles.buttonIcon}
                    />
                    <Text style={styles.saveButtonText}>
                      {t('profile.saveChanges')}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
              <Icon
                name="logout"
                size={18}
                color="#EF4444"
                style={styles.buttonIcon}
              />
              <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {renderPasswordModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F0FDFD', // Light cyan background
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  settingsButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 30,
    backgroundColor: '#fff',
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  editIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 4,
  },
  avatarHint: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  formSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    paddingVertical: 12,
  },
  bioInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  readOnlyInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  readOnlyText: {
    flex: 1,
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 12,
  },
  actionsSection: {
    marginBottom: 24,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  actionIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E0F7FA', // Light cyan background for icon
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 2,
  },
  actionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  securityText: {
    fontSize: 14,
    color: '#166534',
    marginLeft: 8,
    fontWeight: '500',
  },
  buttonSection: {
    gap: 16,
  },
  saveButton: {
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 2,
  },
  saveButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF2F2',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonIcon: {
    marginRight: 4,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  passwordInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
  },
  passwordInput: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
    paddingVertical: 14,
  },
  eyeButton: {
    padding: 8,
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalCancelButton: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalCancelText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    backgroundColor: '#4AC6D0', // Primary color
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  modalSaveText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default UserProfileScreen;
