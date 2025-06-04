import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Image,
  ScrollView,
  SafeAreaView,
  Dimensions,
  StatusBar,
  TouchableOpacity,
  Modal,
  Animated,
  TextInput,
  PermissionsAndroid,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Loading from './Loading';
import {useNavigation} from '@react-navigation/native';
import LinearGradient from 'react-native-linear-gradient';
import moment from 'moment';
import {useAuth} from '../contexts/AuthContext';
import {launchImageLibrary, launchCamera} from 'react-native-image-picker';
import {useTranslation} from '../contexts/TranslationContext';

const {width} = Dimensions.get('window');

interface ViewUserProfileProps {
  userId: string;
  visible?: boolean;
  onClose?: () => void;
  showAsModal?: boolean;
}

interface UserData {
  id: string;
  name: string;
  email: string;
  bio: string;
  avatar: any;
  role: string;
  language: string;
  translateCode: string;
  createdAt: any;
  lastActive: any;
  userStatus: {
    status: string;
    lastSeen: any;
    isOnline: boolean;
  };
}

const ViewUserProfile: React.FC<ViewUserProfileProps> = ({
  userId,
  visible = true,
  onClose,
  showAsModal = false,
}) => {
  const navigation = useNavigation<any>();
  const [userData, setUserData] = useState<UserData | null>(null);
  const {user: currentUser} = useAuth();
  const [loading, setLoading] = useState(true);
  const [fadeAnim] = useState(new Animated.Value(0));

  // Admin edit states
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editAvatar, setEditAvatar] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const {t} = useTranslation();

  // Tour guide stats
  const [groupCount, setGroupCount] = useState(0);
  const [loadingStats, setLoadingStats] = useState(false);

  // Check if current user is admin
  const isAdmin = currentUser?.role === 'admin';

  useEffect(() => {
    if (userId) {
      loadUserProfile();
      if (isAdmin) {
        loadTourGuideStats();
      }
    }
  }, [userId, isAdmin]);

  useEffect(() => {
    if (userData) {
      setEditName(userData.name);
      setEditBio(userData.bio);
      setEditAvatar(userData.avatar);

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    }
  }, [userData]);

  const loadUserProfile = async () => {
    if (!userId) {
      return;
    }

    setLoading(true);
    try {
      const doc = await firestore().collection('users').doc(userId).get();

      if (doc.exists) {
        const data = doc.data();
        setUserData({
          id: doc.id,
          name: data?.name || t('viewUserProfile.unknownUser'),
          email: data?.email || '',
          bio: data?.bio || '',
          avatar: data?.avatar || null,
          role: data?.role || 'tourist',
          language: data?.language || 'en-US',
          translateCode: data?.translateCode || 'en',
          createdAt: data?.createdAt,
          lastActive: data?.lastActive,
          userStatus: data?.userStatus || {
            status: 'offline',
            lastSeen: null,
            isOnline: false,
          },
        });
      } else {
        Alert.alert(t('common.error'), t('viewUserProfile.userNotFound'));
        if (onClose) {
          onClose();
        }
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
      Alert.alert(t('common.error'), t('viewUserProfile.failedToLoadProfile'));
      if (onClose) {
        onClose();
      }
    } finally {
      setLoading(false);
    }
  };

  const loadTourGuideStats = async () => {
    if (!userId || !isAdmin) {
      return;
    }

    setLoadingStats(true);
    try {
      // Get groups where this user is owner
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('isGroup', '==', true)
        .where(`roles.${userId}`, '==', 'owner')
        .get();

      setGroupCount(chatsSnapshot.size);
    } catch (error) {
      console.error('Error loading tour guide stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  // Cloudinary upload function based on imageUpload.tsx
  const uploadImageToCloudinary = async (imageUri: string): Promise<any> => {
    const formData = new FormData();
    formData.append('file', {
      uri: imageUri,
      name: `avatar_${userId}_${Date.now()}.jpg`,
      type: 'image/jpeg',
    } as any);

    const cloud_name = 'djlhfgzbw';
    const upload_preset = 'chatapp';

    formData.append('upload_preset', upload_preset);

    try {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const json = await res.json();
      return json;
    } catch (err) {
      console.error('Image upload error:', err);
      throw err;
    }
  };

  const handleImagePicker = () => {
    Alert.alert(
      t('viewUserProfile.selectImage'),
      t('viewUserProfile.chooseOption'),
      [
        {text: t('viewUserProfile.camera'), onPress: openCamera},
        {text: t('viewUserProfile.gallery'), onPress: openGallery},
        {text: t('common.cancel'), style: 'cancel'},
      ],
    );
  };

  const openCamera = async () => {
    const requestCameraPermission = async () => {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: t('viewUserProfile.cameraPermission'),
            message: t('viewUserProfile.cameraPermissionMessage'),
            buttonNeutral: t('viewUserProfile.askMeLater'),
            buttonNegative: t('common.cancel'),
            buttonPositive: t('common.ok'),
          },
        );
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        } else {
          Alert.alert(
            t('viewUserProfile.permissionDenied'),
            t('viewUserProfile.cameraPermissionRequired'),
          );
          return false;
        }
      } catch (err) {
        console.warn(err);
        return false;
      }
    };

    // ... rest of camera logic remains the same ...
  };

  const openGallery = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
        includeBase64: false,
      },
      response => {
        if (response.didCancel || response.errorMessage) {
          console.log('Gallery cancelled or error:', response.errorMessage);
          return;
        }

        const asset = response.assets?.[0];
        if (asset?.uri) {
          uploadImage(asset.uri);
        }
      },
    );
  };

  const uploadImage = async (imageUri: string) => {
    setUploading(true);
    try {
      const cloudinaryResponse = await uploadImageToCloudinary(imageUri);

      if (cloudinaryResponse && cloudinaryResponse.secure_url) {
        setEditAvatar({
          url: cloudinaryResponse.url,
          secure_url: cloudinaryResponse.secure_url,
          public_id: cloudinaryResponse.public_id,
        });
      } else {
        throw new Error('Invalid response from Cloudinary');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert(
        'Upload Error',
        'Failed to upload image. Please check your internet connection and try again.',
      );
    } finally {
      setUploading(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!editName.trim()) {
      Alert.alert(t('common.error'), t('viewUserProfile.nameCannotBeEmpty'));
      return;
    }

    setUploading(true);
    try {
      const updateData: any = {
        name: editName.trim(),
        bio: editBio.trim(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
      };

      if (editAvatar) {
        updateData.avatar = editAvatar;
      }

      await firestore().collection('users').doc(userId).update(updateData);

      if (editPassword.trim()) {
        Alert.alert(
          t('viewUserProfile.passwordUpdate'),
          t('viewUserProfile.passwordUpdateMessage'),
        );
      }

      setUserData(prev =>
        prev
          ? {
              ...prev,
              name: editName.trim(),
              bio: editBio.trim(),
              avatar: editAvatar,
            }
          : null,
      );

      setIsEditing(false);
      setEditPassword('');
      Alert.alert(
        t('common.success'),
        t('viewUserProfile.profileUpdatedSuccessfully'),
      );
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert(
        t('common.error'),
        t('viewUserProfile.failedToUpdateProfile'),
      );
    } finally {
      setUploading(false);
    }
  };

  // ... existing helper functions (formatLastSeen, formatJoinDate, etc.) ...
  const formatLastSeen = (lastSeen: any) => {
    if (!lastSeen) {
      return '';
    }
    const lastSeenDate = lastSeen.toDate
      ? lastSeen.toDate()
      : new Date(lastSeen);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - lastSeenDate.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) {
      return t('chatMembers.justNow');
    }
    if (diffInMinutes < 60) {
      return diffInMinutes + t('chatMembers.minutesAgo');
    }
    if (diffInMinutes < 1440) {
      return Math.floor(diffInMinutes / 60) + t('chatMembers.hoursAgo');
    }
    return Math.floor(diffInMinutes / 1440) + t('chatMembers.daysAgo');
  };

  const formatJoinDate = (createdAt: any) => {
    if (!createdAt) {
      return t('viewUserProfile.unknown');
    }

    const joinDate = createdAt.toDate
      ? createdAt.toDate()
      : new Date(createdAt);
    return moment(joinDate).format('MMMM YYYY');
  };
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return '#10B981';
      case 'away':
        return '#F59E0B';
      case 'busy':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'online':
        return t('viewUserProfile.status.online');
      case 'away':
        return t('viewUserProfile.status.away');
      case 'busy':
        return t('viewUserProfile.status.busy');
      default:
        return t('viewUserProfile.status.offline');
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'tour_guide':
        return t('viewUserProfile.roles.tourGuide');
      case 'admin':
        return t('viewUserProfile.roles.administrator');
      default:
        return t('viewUserProfile.roles.tourist');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'tour_guide':
        return 'tour';
      case 'admin':
        return 'admin-panel-settings';
      default:
        return 'person';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'tour_guide':
        return '#4AC6D0';
      case 'admin':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const handleStartChat = async () => {
    try {
      const chatId = [currentUser.uid, userData?.id].sort().join('_');
      await firestore()
        .collection('chats')
        .doc(chatId)
        .set(
          {
            isGroup: false,
            members: [currentUser.uid, userData?.id],
            roles: {
              [currentUser.uid]: 'member',
              [userData?.id || '']: 'member',
            },
            createdAt: firestore.FieldValue.serverTimestamp(),
          },
          {merge: true},
        );

      if (onClose) {
        onClose();
      }
      navigation.popToTop();
      navigation.navigate('Chat', {
        chatId: chatId,
        toUserId: userData?.id,
        name: userData?.name,
        avatar: userData?.avatar?.secure_url || userData?.avatar?.url || '',
        currentAvatar:
          currentUser?.avatar?.secure_url || currentUser?.avatar?.url || '',
        isGroup: false,
      });
    } catch (error) {
      console.error('Error starting chat:', error);
      Alert.alert(t('common.error'), t('viewUserProfile.failedToStartChat'));
    }
  };

  const renderEditForm = () => (
    <View style={styles.editForm}>
      {/* Avatar Edit */}
      <View style={styles.editAvatarSection}>
        <TouchableOpacity
          style={styles.editAvatarContainer}
          onPress={handleImagePicker}
          disabled={uploading}>
          <Image
            source={
              editAvatar?.secure_url || editAvatar?.url
                ? {uri: editAvatar.secure_url || editAvatar.url}
                : require('../assets/default-avatar.png')
            }
            style={styles.editAvatar}
          />
          <View style={styles.editAvatarOverlay}>
            <Icon name="camera-alt" size={24} color="#fff" />
          </View>
          {uploading && (
            <View style={styles.uploadingOverlay}>
              <Loading isLoading={true} />
              <Text style={styles.uploadingText}>
                {t('viewUserProfile.uploading')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <Text style={styles.avatarHint}>
          {t('viewUserProfile.tapToChangeAvatar')}
        </Text>
      </View>

      {/* Name Edit */}
      <View style={styles.editField}>
        <Text style={styles.editLabel}>{t('viewUserProfile.name')}</Text>
        <TextInput
          style={styles.editInput}
          value={editName}
          onChangeText={setEditName}
          placeholder={t('viewUserProfile.enterName')}
          placeholderTextColor="#9CA3AF"
        />
      </View>

      {/* Bio Edit */}
      <View style={styles.editField}>
        <Text style={styles.editLabel}>{t('viewUserProfile.bio')}</Text>
        <TextInput
          style={[styles.editInput, styles.editTextArea]}
          value={editBio}
          onChangeText={setEditBio}
          placeholder={t('viewUserProfile.enterBio')}
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />
      </View>

      {/* Password Edit */}
      <View style={styles.editField}>
        <Text style={styles.editLabel}>
          {t('viewUserProfile.newPasswordOptional')}
        </Text>
        <TextInput
          style={styles.editInput}
          value={editPassword}
          onChangeText={setEditPassword}
          placeholder={t('viewUserProfile.enterNewPassword')}
          placeholderTextColor="#9CA3AF"
          secureTextEntry
        />
        <Text style={styles.editHint}>
          {t('viewUserProfile.leaveEmptyToKeepPassword')}
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.editActions}>
        <TouchableOpacity
          style={[styles.editActionButton, styles.cancelButton]}
          onPress={() => {
            setIsEditing(false);
            setEditPassword('');
            setEditName(userData?.name || '');
            setEditBio(userData?.bio || '');
            setEditAvatar(userData?.avatar);
          }}
          disabled={uploading}>
          <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.editActionButton, styles.saveButton]}
          onPress={handleSaveChanges}
          disabled={uploading || !editName.trim()}>
          <LinearGradient
            colors={
              uploading || !editName.trim()
                ? ['#9CA3AF', '#6B7280']
                : ['#4AC6D0', '#3BB8C3']
            }
            style={styles.saveButtonGradient}>
            <Text style={styles.saveButtonText}>
              {uploading
                ? t('viewUserProfile.saving')
                : t('viewUserProfile.saveChanges')}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderContent = () => (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

      {/* Header */}
      <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.header}>
        <TouchableOpacity
          onPress={onClose || (() => navigation.goBack())}
          style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {userData?.name || userData?.email}
        </Text>

        {isAdmin && (
          <TouchableOpacity
            onPress={() => setIsEditing(!isEditing)}
            style={styles.editHeaderButton}>
            <Icon name={isEditing ? 'close' : 'edit'} size={20} color="#fff" />
          </TouchableOpacity>
        )}

        {!isAdmin && <View style={styles.headerRight} />}
      </LinearGradient>

      {loading ? (
        <Loading isLoading={true} />
      ) : userData ? (
        <Animated.ScrollView
          style={[styles.scrollView, {opacity: fadeAnim}]}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}>
          {isEditing && isAdmin ? (
            renderEditForm()
          ) : (
            <>
              {/* Avatar & Basic Info */}
              <View style={styles.profileSection}>
                <View style={styles.avatarContainer}>
                  <Image
                    source={
                      userData.avatar?.secure_url || userData.avatar?.url
                        ? {
                            uri:
                              userData.avatar.secure_url || userData.avatar.url,
                          }
                        : require('../assets/default-avatar.png')
                    }
                    style={styles.avatar}
                  />

                  {/* Status Indicator */}
                  <View
                    style={[
                      styles.statusIndicator,
                      {
                        backgroundColor: getStatusColor(
                          userData.userStatus.status,
                        ),
                      },
                    ]}>
                    {/* Role Badge */}
                    <View
                      style={[
                        styles.roleBadge,
                        {backgroundColor: getRoleColor(userData.role)},
                      ]}>
                      <Icon
                        name={getRoleIcon(userData.role)}
                        size={14}
                        color="#fff"
                      />
                    </View>
                  </View>

                  <Text style={styles.userEmail}>{userData.email}</Text>

                  {/* Status & Last Seen */}
                  <View style={styles.statusContainer}>
                    <View
                      style={[
                        styles.statusDot,
                        {
                          backgroundColor: getStatusColor(
                            userData.userStatus.status,
                          ),
                        },
                      ]}
                    />
                    <Text style={styles.statusText}>
                      {getStatusText(userData.userStatus.status)}
                    </Text>
                    {userData.userStatus.status !== 'online' && (
                      <Text style={styles.lastSeenText}>
                        •{' '}
                        {t('viewUserProfile.lastSeen') +
                          ' ' +
                          formatLastSeen(userData.userStatus.lastSeen)}
                      </Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Info Cards */}
              <View style={styles.infoSection}>
                {/* Bio Card */}
                {userData.bio ? (
                  <View style={styles.infoCard}>
                    <View style={styles.cardHeader}>
                      <Icon name="info" size={20} color="#4AC6D0" />
                      <Text style={styles.cardTitle}>
                        {t('viewUserProfile.about')}
                      </Text>
                    </View>
                    <Text style={styles.bioText}>{userData.bio}</Text>
                  </View>
                ) : null}

                {/* Details Card */}
                <View style={styles.infoCard}>
                  <View style={styles.cardHeader}>
                    <Icon name="person" size={20} color="#4AC6D0" />
                    <Text style={styles.cardTitle}>
                      {t('viewUserProfile.details')}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="work" size={18} color="#6B7280" />
                    <Text style={styles.detailLabel}>
                      {t('viewUserProfile.role')}:
                    </Text>
                    <Text
                      style={[
                        styles.detailValue,
                        {color: getRoleColor(userData.role)},
                      ]}>
                      {getRoleText(userData.role)}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="language" size={18} color="#6B7280" />
                    <Text style={styles.detailLabel}>
                      {t('viewUserProfile.language')}:
                    </Text>
                    <Text style={styles.detailValue}>
                      {userData.language || t('viewUserProfile.english')}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Icon name="event" size={18} color="#6B7280" />
                    <Text style={styles.detailLabel}>
                      {t('viewUserProfile.joined')}:
                    </Text>
                    <Text style={styles.detailValue}>
                      {formatJoinDate(userData.createdAt)}
                    </Text>
                  </View>

                  {/* Tour Guide Stats */}
                  {isAdmin && userData.role === 'tour_guide' && (
                    <View style={styles.detailRow}>
                      <Icon name="group" size={18} color="#6B7280" />
                      <Text style={styles.detailLabel}>
                        {t('viewUserProfile.groups')}:
                      </Text>
                      <Text style={styles.detailValue}>
                        {loadingStats
                          ? '...'
                          : `${groupCount} ${
                              groupCount === 1
                                ? t('viewUserProfile.group')
                                : t('viewUserProfile.groups')
                            }`}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Actions Card - Only show for non-admin */}
                {!isAdmin && (
                  <View style={styles.actionsCard}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={handleStartChat}>
                      <LinearGradient
                        colors={['#4AC6D0', '#3BB8C3']}
                        style={styles.actionButtonGradient}>
                        <Icon name="chat" size={20} color="#fff" />
                        <Text style={styles.actionButtonText}>
                          {t('viewUserProfile.startChat')}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </>
          )}
        </Animated.ScrollView>
      ) : null}
    </SafeAreaView>
  );

  if (showAsModal) {
    return (
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}>
        {renderContent()}
      </Modal>
    );
  }

  return renderContent();
};

const styles = StyleSheet.create({
  // ... existing styles ...
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 4,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
  },
  headerRight: {
    width: 40,
  },
  editHeaderButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  // Edit form styles
  editForm: {
    backgroundColor: '#fff',
    margin: 20,
    borderRadius: 16,
    padding: 20,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  editAvatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  editAvatarContainer: {
    position: 'relative',
  },
  editAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#E5E7EB',
  },
  editAvatarOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#4AC6D0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 8,
    fontWeight: '600',
  },
  avatarHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  editField: {
    marginBottom: 20,
  },
  editLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  editInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#F9FAFB',
  },
  editTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  editHint: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  editActionButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  saveButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  // ... rest of existing styles ...
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 30,
  },
  profileSection: {
    backgroundColor: '#fff',
    paddingVertical: 40,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  avatarContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E5E7EB',
    borderWidth: 4,
    borderColor: '#fff',
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 2,
  },
  roleBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    elevation: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  lastSeenText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 4,
  },
  infoSection: {
    paddingHorizontal: 20,
    gap: 16,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 8,
  },
  bioText: {
    fontSize: 16,
    color: '#64748B',
    lineHeight: 24,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailLabel: {
    fontSize: 16,
    color: '#6B7280',
    marginLeft: 12,
    minWidth: 80,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
    textAlign: 'right',
  },
  actionsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  actionButton: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
});

export default ViewUserProfile;
