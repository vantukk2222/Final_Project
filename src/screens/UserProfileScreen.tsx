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
import {handleImageUpload} from '../utils/imageUpload';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Loading from '../components/Loading';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';

const {width} = Dimensions.get('window');

const UserProfileScreen = () => {
  const {user, signOut} = useAuth();
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
      Alert.alert('Error', 'Name cannot be empty');
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
      Alert.alert('Success', 'Your profile has been updated!');
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to update profile');
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
        Alert.alert('Success', 'Profile picture updated successfully');
      })
      .catch(error => {
        console.error('Image upload error:', error);
        Alert.alert('Error', 'Failed to upload image');
      })
      .finally(() => {
        setUploading(false);
      });
  };

  const reauthenticateUser = async (password: string) => {
    const currentUser = auth().currentUser;
    if (!currentUser || !currentUser.email) {
      throw new Error('No authenticated user found');
    }

    const credential = auth.EmailAuthProvider.credential(
      currentUser.email,
      password,
    );

    await currentUser.reauthenticateWithCredential(credential);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all password fields');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters');
      return;
    }

    if (currentPassword === newPassword) {
      Alert.alert(
        'Error',
        'New password must be different from current password',
      );
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

        Alert.alert('Success', 'Password changed successfully!', [
          {
            text: 'OK',
            onPress: () => {
              setShowPasswordModal(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error('Password change error:', error);

      let errorMessage = 'Failed to change password';
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'New password is too weak';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log back in, then try again';
      }

      Alert.alert('Error', errorMessage);
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
            <Text style={styles.modalTitle}>Change Password</Text>
            <TouchableOpacity
              onPress={() => setShowPasswordModal(false)}
              style={styles.modalCloseButton}>
              <Icon name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.modalLabel}>Current Password</Text>
            {renderPasswordInput(
              currentPassword,
              setCurrentPassword,
              'Enter current password',
              showCurrentPassword,
              () => setShowCurrentPassword(!showCurrentPassword),
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.modalLabel}>New Password</Text>
            {renderPasswordInput(
              newPassword,
              setNewPassword,
              'Enter new password (min 6 characters)',
              showNewPassword,
              () => setShowNewPassword(!showNewPassword),
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.modalLabel}>Confirm New Password</Text>
            {renderPasswordInput(
              confirmPassword,
              setConfirmPassword,
              'Confirm new password',
              showConfirmPassword,
              () => setShowConfirmPassword(!showConfirmPassword),
            )}
          </View>

          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowPasswordModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
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
                <Text style={styles.modalSaveText}>Update Password</Text>
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
        <Text style={styles.headerTitle}>Profile</Text>
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
          <Text style={styles.avatarHint}>Tap to change photo</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Email Field (Read-only) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address</Text>
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
            <Text style={styles.label}>Full Name</Text>
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
                placeholder="Enter your full name"
                placeholderTextColor="#9CA3AF"
              />
            </View>
          </View>

          {/* Bio Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Bio</Text>
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
                placeholder="Tell others about yourself..."
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
                <Text style={styles.actionTitle}>Change Password</Text>
                <Text style={styles.actionSubtitle}>
                  Update your account password
                </Text>
              </View>
              <Icon name="chevron-right" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Security Info */}
            <View style={styles.securityInfo}>
              <Icon name="security" size={16} color="#10B981" />
              <Text style={styles.securityText}>Your account is secure</Text>
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
                    <Text style={styles.saveButtonText}>Save Changes</Text>
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
              <Text style={styles.logoutText}>Sign Out</Text>
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
    paddingHorizontal: 20,
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
