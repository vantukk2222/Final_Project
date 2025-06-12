import React, {
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  memo,
  useReducer,
} from 'react';
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
  Platform,
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

// Types
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

// State reducer for atomic updates
type StateAction =
  | {type: 'SET_LOADING'; payload: boolean}
  | {type: 'SET_USER_DATA'; payload: UserData | null}
  | {type: 'SET_EDITING'; payload: boolean}
  | {type: 'SET_UPLOADING'; payload: boolean}
  | {type: 'SET_EDIT_FIELDS'; payload: {name: string; bio: string; avatar: any}}
  | {type: 'SET_EDIT_NAME'; payload: string}
  | {type: 'SET_EDIT_BIO'; payload: string}
  | {type: 'SET_EDIT_PASSWORD'; payload: string}
  | {type: 'SET_EDIT_AVATAR'; payload: any}
  | {type: 'SET_GROUP_COUNT'; payload: number}
  | {type: 'SET_LOADING_STATS'; payload: boolean}
  | {type: 'RESET_EDIT_FORM'}
  | {type: 'UPDATE_USER_FIELD'; payload: {field: keyof UserData; value: any}};

interface ProfileState {
  userData: UserData | null;
  loading: boolean;
  isEditing: boolean;
  editName: string;
  editBio: string;
  editPassword: string;
  editAvatar: any;
  uploading: boolean;
  groupCount: number;
  loadingStats: boolean;
}

const initialState: ProfileState = {
  userData: null,
  loading: true,
  isEditing: false,
  editName: '',
  editBio: '',
  editPassword: '',
  editAvatar: null,
  uploading: false,
  groupCount: 0,
  loadingStats: false,
};

// Atomic state reducer
const profileReducer = (
  state: ProfileState,
  action: StateAction,
): ProfileState => {
  switch (action.type) {
    case 'SET_LOADING':
      return {...state, loading: action.payload};
    case 'SET_USER_DATA':
      return {
        ...state,
        userData: action.payload,
        editName: action.payload?.name || '',
        editBio: action.payload?.bio || '',
        editAvatar: action.payload?.avatar || null,
      };
    case 'SET_EDITING':
      return {...state, isEditing: action.payload};
    case 'SET_UPLOADING':
      return {...state, uploading: action.payload};
    case 'SET_EDIT_FIELDS':
      return {
        ...state,
        editName: action.payload.name,
        editBio: action.payload.bio,
        editAvatar: action.payload.avatar,
      };
    case 'SET_EDIT_NAME':
      return {...state, editName: action.payload};
    case 'SET_EDIT_BIO':
      return {...state, editBio: action.payload};
    case 'SET_EDIT_PASSWORD':
      return {...state, editPassword: action.payload};
    case 'SET_EDIT_AVATAR':
      return {...state, editAvatar: action.payload};
    case 'SET_GROUP_COUNT':
      return {...state, groupCount: action.payload};
    case 'SET_LOADING_STATS':
      return {...state, loadingStats: action.payload};
    case 'RESET_EDIT_FORM':
      return {
        ...state,
        isEditing: false,
        editPassword: '',
        editName: state.userData?.name || '',
        editBio: state.userData?.bio || '',
        editAvatar: state.userData?.avatar || null,
      };
    case 'UPDATE_USER_FIELD':
      if (!state.userData) {
        return state;
      }
      return {
        ...state,
        userData: {
          ...state.userData,
          [action.payload.field]: action.payload.value,
        },
      };
    default:
      return state;
  }
};

// Constants
const {width} = Dimensions.get('window');
const CLOUD_CONFIG = Object.freeze({
  name: 'djlhfgzbw',
  uploadPreset: 'chatapp',
});

const ANIMATION_DURATION = 500;

// Memoized utility functions - outside component
const formatLastSeen = (lastSeen: any, t: (key: string) => string): string => {
  if (!lastSeen) {
    return '';
  }

  const lastSeenDate = lastSeen.toDate ? lastSeen.toDate() : new Date(lastSeen);
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

const formatJoinDate = (createdAt: any, t: (key: string) => string): string => {
  if (!createdAt) {
    return t('viewUserProfile.unknown');
  }
  const joinDate = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
  return moment(joinDate).format('MMMM YYYY');
};

// Status utility functions - memoized
const getStatusConfig = (status: string) => {
  const configs = {
    online: {color: '#10B981', text: 'online'},
    away: {color: '#F59E0B', text: 'away'},
    busy: {color: '#EF4444', text: 'busy'},
    offline: {color: '#6B7280', text: 'offline'},
  };
  return configs[status as keyof typeof configs] || configs.offline;
};

const getRoleConfig = (role: string) => {
  const configs = {
    tour_guide: {
      text: 'tourGuide',
      icon: 'tour',
      color: '#4AC6D0',
    },
    admin: {
      text: 'administrator',
      icon: 'admin-panel-settings',
      color: '#EF4444',
    },
    tourist: {
      text: 'tourist',
      icon: 'person',
      color: '#6B7280',
    },
  };
  return configs[role as keyof typeof configs] || configs.tourist;
};

// Custom hooks
const useStableRefs = () => {
  const refs = useRef({
    fadeAnim: new Animated.Value(0),
    unsubscribeUser: null as (() => void) | null,
    isInitialized: false,
    lastUserDataHash: '',
  });

  return refs.current;
};

const useCloudinaryUpload = () => {
  const uploadImage = useCallback(
    async (imageUri: string, userId: string): Promise<any> => {
      const formData = new FormData();
      formData.append('file', {
        uri: imageUri,
        name: `avatar_${userId}_${Date.now()}.jpg`,
        type: 'image/jpeg',
      } as any);
      formData.append('upload_preset', CLOUD_CONFIG.uploadPreset);

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_CONFIG.name}/image/upload`,
        {
          method: 'POST',
          body: formData,
          headers: {'Content-Type': 'multipart/form-data'},
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    },
    [],
  );

  return {uploadImage};
};

// Memoized Components
const ProfileHeader = memo(
  ({
    title,
    isEditing,
    isAdmin,
    onBack,
    onEdit,
  }: {
    title: string;
    isEditing: boolean;
    isAdmin: boolean;
    onBack: () => void;
    onEdit: () => void;
  }) => (
    <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.backButton}>
        <Icon name="arrow-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={styles.headerTitle} numberOfLines={1}>
        {title}
      </Text>
      {isAdmin ? (
        <TouchableOpacity onPress={onEdit} style={styles.editHeaderButton}>
          <Icon name={isEditing ? 'close' : 'edit'} size={20} color="#fff" />
        </TouchableOpacity>
      ) : (
        <View style={styles.headerRight} />
      )}
    </LinearGradient>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.title === nextProps.title &&
      prevProps.isEditing === nextProps.isEditing &&
      prevProps.isAdmin === nextProps.isAdmin
    );
  },
);

const AvatarSection = memo(
  ({
    userData,
    statusConfig,
    roleConfig,
    t,
  }: {
    userData: UserData;
    statusConfig: {color: string; text: string};
    roleConfig: {text: string; icon: string; color: string};
    t: (key: string) => string;
  }) => {
    const avatarSource = useMemo(() => {
      return userData.avatar?.secure_url || userData.avatar?.url
        ? {uri: userData.avatar.secure_url || userData.avatar.url}
        : require('../assets/default-avatar.png');
    }, [userData.avatar]);

    const statusText = useMemo(() => {
      const baseText = t(`viewUserProfile.status.${statusConfig.text}`);
      if (
        userData.userStatus.status !== 'online' &&
        userData.userStatus.lastSeen
      ) {
        return `${baseText} • ${t('viewUserProfile.lastSeen')} ${formatLastSeen(
          userData.userStatus.lastSeen,
          t,
        )}`;
      }
      return baseText;
    }, [userData.userStatus, statusConfig.text, t]);

    return (
      <View style={styles.profileSection}>
        <View style={styles.avatarContainer}>
          <Image source={avatarSource} style={styles.avatar} />

          <View
            style={[
              styles.statusIndicator,
              {backgroundColor: statusConfig.color},
            ]}>
            <View
              style={[styles.roleBadge, {backgroundColor: roleConfig.color}]}>
              <Icon name={roleConfig.icon} size={14} color="#fff" />
            </View>
          </View>

          <Text style={styles.userName}>{userData.name}</Text>
          <Text style={styles.userEmail}>{userData.email}</Text>

          <View style={styles.statusContainer}>
            <View
              style={[styles.statusDot, {backgroundColor: statusConfig.color}]}
            />
            <Text style={styles.statusText} numberOfLines={2}>
              {statusText}
            </Text>
          </View>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.userData.name === nextProps.userData.name &&
      prevProps.userData.email === nextProps.userData.email &&
      prevProps.userData.avatar?.secure_url ===
        nextProps.userData.avatar?.secure_url &&
      prevProps.userData.userStatus.status ===
        nextProps.userData.userStatus.status &&
      JSON.stringify(prevProps.userData.userStatus.lastSeen) ===
        JSON.stringify(nextProps.userData.userStatus.lastSeen)
    );
  },
);

const EditAvatarSection = memo(
  ({
    editAvatar,
    uploading,
    onImagePicker,
    t,
  }: {
    editAvatar: any;
    uploading: boolean;
    onImagePicker: () => void;
    t: (key: string) => string;
  }) => {
    const avatarSource = useMemo(() => {
      return editAvatar?.secure_url || editAvatar?.url
        ? {uri: editAvatar.secure_url || editAvatar.url}
        : require('../assets/default-avatar.png');
    }, [editAvatar]);

    return (
      <View style={styles.editAvatarSection}>
        <TouchableOpacity
          style={styles.editAvatarContainer}
          onPress={onImagePicker}
          disabled={uploading}>
          <Image source={avatarSource} style={styles.editAvatar} />
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
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.uploading === nextProps.uploading &&
      prevProps.editAvatar?.secure_url === nextProps.editAvatar?.secure_url
    );
  },
);

const EditForm = memo(
  ({
    editName,
    editBio,
    editPassword,
    editAvatar,
    uploading,
    onNameChange,
    onBioChange,
    onPasswordChange,
    onImagePicker,
    onCancel,
    onSave,
    t,
  }: {
    editName: string;
    editBio: string;
    editPassword: string;
    editAvatar: any;
    uploading: boolean;
    onNameChange: (text: string) => void;
    onBioChange: (text: string) => void;
    onPasswordChange: (text: string) => void;
    onImagePicker: () => void;
    onCancel: () => void;
    onSave: () => void;
    t: (key: string) => string;
  }) => {
    const canSave = editName.trim() !== '' && !uploading;

    return (
      <View style={styles.editForm}>
        <EditAvatarSection
          editAvatar={editAvatar}
          uploading={uploading}
          onImagePicker={onImagePicker}
          t={t}
        />

        <View style={styles.editField}>
          <Text style={styles.editLabel}>{t('viewUserProfile.name')}</Text>
          <TextInput
            style={styles.editInput}
            value={editName}
            onChangeText={onNameChange}
            placeholder={t('viewUserProfile.enterName')}
            placeholderTextColor="#9CA3AF"
            editable={!uploading}
          />
        </View>

        <View style={styles.editField}>
          <Text style={styles.editLabel}>{t('viewUserProfile.bio')}</Text>
          <TextInput
            style={[styles.editInput, styles.editTextArea]}
            value={editBio}
            onChangeText={onBioChange}
            placeholder={t('viewUserProfile.enterBio')}
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            editable={!uploading}
          />
        </View>

        <View style={styles.editField}>
          <Text style={styles.editLabel}>
            {t('viewUserProfile.newPasswordOptional')}
          </Text>
          <TextInput
            style={styles.editInput}
            value={editPassword}
            onChangeText={onPasswordChange}
            placeholder={t('viewUserProfile.enterNewPassword')}
            placeholderTextColor="#9CA3AF"
            secureTextEntry
            editable={!uploading}
          />
          <Text style={styles.editHint}>
            {t('viewUserProfile.leaveEmptyToKeepPassword')}
          </Text>
        </View>

        <View style={styles.editActions}>
          <TouchableOpacity
            style={[styles.editActionButton, styles.cancelButton]}
            onPress={onCancel}
            disabled={uploading}>
            <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.editActionButton, styles.saveButton]}
            onPress={onSave}
            disabled={!canSave}>
            <LinearGradient
              colors={canSave ? ['#4AC6D0', '#3BB8C3'] : ['#9CA3AF', '#6B7280']}
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
  },
  (prevProps, nextProps) => {
    return (
      prevProps.editName === nextProps.editName &&
      prevProps.editBio === nextProps.editBio &&
      prevProps.editPassword === nextProps.editPassword &&
      prevProps.uploading === nextProps.uploading &&
      prevProps.editAvatar?.secure_url === nextProps.editAvatar?.secure_url
    );
  },
);

const InfoSection = memo(
  ({
    userData,
    roleConfig,
    groupCount,
    loadingStats,
    isAdmin,
    onStartChat,
    t,
  }: {
    userData: UserData;
    roleConfig: {text: string; icon: string; color: string};
    groupCount: number;
    loadingStats: boolean;
    isAdmin: boolean;
    onStartChat: () => void;
    t: (key: string) => string;
  }) => {
    const joinDate = useMemo(
      () => formatJoinDate(userData.createdAt, t),
      [userData.createdAt, t],
    );

    return (
      <View style={styles.infoSection}>
        {userData.bio ? (
          <View style={styles.infoCard}>
            <View style={styles.cardHeader}>
              <Icon name="info" size={20} color="#4AC6D0" />
              <Text style={styles.cardTitle}>{t('viewUserProfile.about')}</Text>
            </View>
            <Text style={styles.bioText}>{userData.bio}</Text>
          </View>
        ) : null}

        <View style={styles.infoCard}>
          <View style={styles.cardHeader}>
            <Icon name="person" size={20} color="#4AC6D0" />
            <Text style={styles.cardTitle}>{t('viewUserProfile.details')}</Text>
          </View>

          <View style={styles.detailRow}>
            <Icon name="work" size={18} color="#6B7280" />
            <Text style={styles.detailLabel}>{t('viewUserProfile.role')}:</Text>
            <Text style={[styles.detailValue, {color: roleConfig.color}]}>
              {t(`viewUserProfile.roles.${roleConfig.text}`)}
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
            <Text style={styles.detailValue}>{joinDate}</Text>
          </View>

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

        {!isAdmin && (
          <View style={styles.actionsCard}>
            <TouchableOpacity style={styles.actionButton} onPress={onStartChat}>
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
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.userData.bio === nextProps.userData.bio &&
      prevProps.userData.role === nextProps.userData.role &&
      prevProps.userData.language === nextProps.userData.language &&
      prevProps.groupCount === nextProps.groupCount &&
      prevProps.loadingStats === nextProps.loadingStats &&
      prevProps.isAdmin === nextProps.isAdmin &&
      JSON.stringify(prevProps.userData.createdAt) ===
        JSON.stringify(nextProps.userData.createdAt)
    );
  },
);

// Main Component
const ViewUserProfile: React.FC<ViewUserProfileProps> = ({
  userId,
  visible = true,
  onClose,
  showAsModal = false,
}) => {
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const {user: currentUser} = useAuth();
  const [state, dispatch] = useReducer(profileReducer, initialState);
  const refs = useStableRefs();
  const {uploadImage} = useCloudinaryUpload();

  // Memoized computed values
  const computedValues = useMemo(() => {
    const isAdmin = currentUser?.role === 'admin';
    const statusConfig = state.userData
      ? getStatusConfig(state.userData.userStatus.status)
      : {color: '#6B7280', text: 'offline'};
    const roleConfig = state.userData
      ? getRoleConfig(state.userData.role)
      : {text: 'tourist', icon: 'person', color: '#6B7280'};

    return {
      isAdmin,
      statusConfig,
      roleConfig,
      title: state.userData?.name || state.userData?.email || 'Profile',
    };
  }, [currentUser?.role, state.userData]);

  // Stable navigation handlers
  const navigationHandlers = useMemo(
    () => ({
      handleBack: () => (onClose ? onClose() : navigation.goBack()),
    }),
    [onClose, navigation],
  );

  // Form handlers - memoized
  const formHandlers = useMemo(
    () => ({
      handleNameChange: (text: string) =>
        dispatch({type: 'SET_EDIT_NAME', payload: text}),
      handleBioChange: (text: string) =>
        dispatch({type: 'SET_EDIT_BIO', payload: text}),
      handlePasswordChange: (text: string) =>
        dispatch({type: 'SET_EDIT_PASSWORD', payload: text}),
      handleEditToggle: () => {
        if (state.isEditing) {
          dispatch({type: 'RESET_EDIT_FORM'});
        } else {
          dispatch({type: 'SET_EDITING', payload: true});
        }
      },
      handleCancel: () => dispatch({type: 'RESET_EDIT_FORM'}),
    }),
    [state.isEditing],
  );

  // Image picker handlers
  const imageHandlers = useMemo(
    () => ({
      handleImagePicker: () => {
        Alert.alert(
          t('viewUserProfile.selectImage'),
          t('viewUserProfile.chooseOption'),
          [
            {text: t('viewUserProfile.camera'), onPress: () => openCamera()},
            {text: t('viewUserProfile.gallery'), onPress: () => openGallery()},
            {text: t('common.cancel'), style: 'cancel'},
          ],
        );
      },
    }),
    [t],
  );

  // Camera permission and opening
  const openCamera = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            t('viewUserProfile.permissionDenied'),
            t('viewUserProfile.cameraPermissionRequired'),
          );
          return;
        }
      } catch (err) {
        console.warn(err);
        return;
      }
    }

    launchCamera(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 800,
        maxHeight: 800,
        includeBase64: false,
      },
      response => {
        if (response.didCancel || response.errorMessage) {
          return;
        }
        const asset = response.assets?.[0];
        if (asset?.uri) {
          uploadImageHandler(asset.uri);
        }
      },
    );
  }, [t]);

  const openGallery = useCallback(() => {
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
          return;
        }
        const asset = response.assets?.[0];
        if (asset?.uri) {
          uploadImageHandler(asset.uri);
        }
      },
    );
  }, []);

  const uploadImageHandler = useCallback(
    async (imageUri: string) => {
      dispatch({type: 'SET_UPLOADING', payload: true});
      try {
        const cloudinaryResponse = await uploadImage(imageUri, userId);
        if (cloudinaryResponse?.secure_url) {
          dispatch({
            type: 'SET_EDIT_AVATAR',
            payload: {
              url: cloudinaryResponse.url,
              secure_url: cloudinaryResponse.secure_url,
              public_id: cloudinaryResponse.public_id,
            },
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
        dispatch({type: 'SET_UPLOADING', payload: false});
      }
    },
    [uploadImage, userId],
  );

  // Business logic handlers - memoized
  const businessHandlers = useMemo(
    () => ({
      handleSaveChanges: async () => {
        if (!state.editName.trim()) {
          Alert.alert(
            t('common.error'),
            t('viewUserProfile.nameCannotBeEmpty'),
          );
          return;
        }

        dispatch({type: 'SET_UPLOADING', payload: true});
        try {
          const updateData: any = {
            name: state.editName.trim(),
            bio: state.editBio.trim(),
            updatedAt: firestore.FieldValue.serverTimestamp(),
          };

          if (state.editAvatar) {
            updateData.avatar = state.editAvatar;
          }

          await firestore().collection('users').doc(userId).update(updateData);

          if (state.editPassword.trim()) {
            Alert.alert(
              t('viewUserProfile.passwordUpdate'),
              t('viewUserProfile.passwordUpdateMessage'),
            );
          }

          // Update local state
          dispatch({
            type: 'UPDATE_USER_FIELD',
            payload: {field: 'name', value: state.editName.trim()},
          });
          dispatch({
            type: 'UPDATE_USER_FIELD',
            payload: {field: 'bio', value: state.editBio.trim()},
          });
          if (state.editAvatar) {
            dispatch({
              type: 'UPDATE_USER_FIELD',
              payload: {field: 'avatar', value: state.editAvatar},
            });
          }

          dispatch({type: 'SET_EDITING', payload: false});
          dispatch({type: 'SET_EDIT_PASSWORD', payload: ''});
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
          dispatch({type: 'SET_UPLOADING', payload: false});
        }
      },

      handleStartChat: async () => {
        if (!state.userData || !currentUser) {
          return;
        }

        try {
          const chatId = [currentUser.uid, state.userData.id].sort().join('_');
          await firestore()
            .collection('chats')
            .doc(chatId)
            .set(
              {
                isGroup: false,
                members: [currentUser.uid, state.userData.id],
                roles: {
                  [currentUser.uid]: 'member',
                  [state.userData.id]: 'member',
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
            chatId,
            toUserId: state.userData.id,
            name: state.userData.name,
            avatar:
              state.userData.avatar?.secure_url ||
              state.userData.avatar?.url ||
              '',
            currentAvatar:
              currentUser?.avatar?.secure_url || currentUser?.avatar?.url || '',
            isGroup: false,
          });
        } catch (error) {
          console.error('Error starting chat:', error);
          Alert.alert(
            t('common.error'),
            t('viewUserProfile.failedToStartChat'),
          );
        }
      },
    }),
    [state, userId, currentUser, t, onClose, navigation],
  );

  // Data fetching functions - optimized
  const loadUserProfile = useCallback(async () => {
    if (!userId) {
      return;
    }

    dispatch({type: 'SET_LOADING', payload: true});
    try {
      const doc = await firestore().collection('users').doc(userId).get();

      if (doc.exists) {
        const data = doc.data();
        const userData: UserData = {
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
        };

        // Check if data actually changed
        const userDataHash = JSON.stringify(userData);
        if (refs.lastUserDataHash !== userDataHash) {
          refs.lastUserDataHash = userDataHash;
          dispatch({type: 'SET_USER_DATA', payload: userData});
        }
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
      dispatch({type: 'SET_LOADING', payload: false});
    }
  }, [userId, t, onClose, refs]);

  const loadTourGuideStats = useCallback(async () => {
    if (!userId || !computedValues.isAdmin) {
      return;
    }

    dispatch({type: 'SET_LOADING_STATS', payload: true});
    try {
      const chatsSnapshot = await firestore()
        .collection('chats')
        .where('isGroup', '==', true)
        .where(`roles.${userId}`, '==', 'owner')
        .get();

      dispatch({type: 'SET_GROUP_COUNT', payload: chatsSnapshot.size});
    } catch (error) {
      console.error('Error loading tour guide stats:', error);
    } finally {
      dispatch({type: 'SET_LOADING_STATS', payload: false});
    }
  }, [userId, computedValues.isAdmin]);

  // Effects
  useEffect(() => {
    if (!refs.isInitialized) {
      Animated.timing(refs.fadeAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION,
        useNativeDriver: true,
      }).start();
      refs.isInitialized = true;
    }
  }, [refs]);

  useEffect(() => {
    if (userId) {
      loadUserProfile();
      if (computedValues.isAdmin) {
        loadTourGuideStats();
      }
    }
  }, [userId, computedValues.isAdmin, loadUserProfile, loadTourGuideStats]);

  // Main render function
  const renderContent = useCallback(
    () => (
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor="#4AC6D0" barStyle="light-content" />

        <ProfileHeader
          title={computedValues.title}
          isEditing={state.isEditing}
          isAdmin={computedValues.isAdmin}
          onBack={navigationHandlers.handleBack}
          onEdit={formHandlers.handleEditToggle}
        />

        {state.loading ? (
          <Loading isLoading={true} />
        ) : state.userData ? (
          <Animated.ScrollView
            style={[styles.scrollView, {opacity: refs.fadeAnim}]}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
            {state.isEditing && computedValues.isAdmin ? (
              <EditForm
                editName={state.editName}
                editBio={state.editBio}
                editPassword={state.editPassword}
                editAvatar={state.editAvatar}
                uploading={state.uploading}
                onNameChange={formHandlers.handleNameChange}
                onBioChange={formHandlers.handleBioChange}
                onPasswordChange={formHandlers.handlePasswordChange}
                onImagePicker={imageHandlers.handleImagePicker}
                onCancel={formHandlers.handleCancel}
                onSave={businessHandlers.handleSaveChanges}
                t={t}
              />
            ) : (
              <>
                <AvatarSection
                  userData={state.userData}
                  statusConfig={computedValues.statusConfig}
                  roleConfig={computedValues.roleConfig}
                  t={t}
                />
                <InfoSection
                  userData={state.userData}
                  roleConfig={computedValues.roleConfig}
                  groupCount={state.groupCount}
                  loadingStats={state.loadingStats}
                  isAdmin={computedValues.isAdmin}
                  onStartChat={businessHandlers.handleStartChat}
                  t={t}
                />
              </>
            )}
          </Animated.ScrollView>
        ) : null}
      </SafeAreaView>
    ),
    [
      state,
      computedValues,
      refs.fadeAnim,
      formHandlers,
      imageHandlers,
      businessHandlers,
      navigationHandlers,
      t,
    ],
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

// Styles remain the same as before
const styles = StyleSheet.create({
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
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  headerRight: {
    width: 40,
  },
  editHeaderButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
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
    maxWidth: '90%',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flexShrink: 1,
  },
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

export default memo(ViewUserProfile);
