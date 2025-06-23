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
  FlatList,
  StyleSheet,
  Image,
  TouchableOpacity,
  Alert,
  TextInput,
  SafeAreaView,
  ScrollView,
  Animated,
  ActivityIndicator,
  Dimensions,
  Clipboard,
} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import {useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useAuth} from '../contexts/AuthContext';
import AvatarStatus from './AvatarStatus';
import LinearGradient from 'react-native-linear-gradient';
import Loading from './Loading';
import {useTranslation} from '../contexts/TranslationContext';

// Types
interface Member {
  id: string;
  name?: string;
  email: string;
  avatar?: {
    secure_url?: string;
    url?: string;
  };
  avatarUrl?: string;
  bio?: string;
  userStatus?: {
    isOnline?: boolean;
    lastSeen?: any;
    status?: 'online' | 'offline' | 'away';
  };
}

interface ChatData {
  isGroup: boolean;
  name?: string;
  members: string[];
  roles: Record<string, 'owner' | 'admin' | 'member'>;
  code?: string;
}

// State reducer for atomic updates
type StateAction =
  | {type: 'SET_LOADING'; payload: boolean}
  | {type: 'SET_MEMBERS'; payload: Member[]}
  | {type: 'SET_ROLES'; payload: Record<string, string>}
  | {type: 'SET_CHAT_NAME'; payload: string}
  | {type: 'SET_IS_GROUP'; payload: boolean}
  | {type: 'SET_OTHER_USER'; payload: Member | null}
  | {type: 'SET_EDITING_NAME'; payload: boolean}
  | {type: 'SET_NEW_MEMBER_EMAIL'; payload: string}
  | {type: 'UPDATE_MEMBER'; payload: {id: string; data: Partial<Member>}}
  | {type: 'REMOVE_MEMBER'; payload: string}
  | {type: 'ADD_MEMBER'; payload: Member}
  | {type: 'RESET_STATE'};

interface State {
  members: Member[];
  roles: Record<string, string>;
  chatName: string;
  isGroup: boolean;
  otherUser: Member | null;
  loading: boolean;
  isEditingName: boolean;
  newMemberEmail: string;
}

const initialState: State = {
  members: [],
  roles: {},
  chatName: '',
  isGroup: false,
  otherUser: null,
  loading: true,
  isEditingName: false,
  newMemberEmail: '',
};

// Atomic state reducer
const stateReducer = (state: State, action: StateAction): State => {
  switch (action.type) {
    case 'SET_LOADING':
      return {...state, loading: action.payload};
    case 'SET_MEMBERS':
      return {...state, members: action.payload};
    case 'SET_ROLES':
      return {...state, roles: action.payload};
    case 'SET_CHAT_NAME':
      return {...state, chatName: action.payload};
    case 'SET_IS_GROUP':
      return {...state, isGroup: action.payload};
    case 'SET_OTHER_USER':
      return {...state, otherUser: action.payload};
    case 'SET_EDITING_NAME':
      return {...state, isEditingName: action.payload};
    case 'SET_NEW_MEMBER_EMAIL':
      return {...state, newMemberEmail: action.payload};
    case 'UPDATE_MEMBER':
      return {
        ...state,
        members: state.members.map(member =>
          member.id === action.payload.id
            ? {...member, ...action.payload.data}
            : member,
        ),
      };
    case 'REMOVE_MEMBER':
      return {
        ...state,
        members: state.members.filter(member => member.id !== action.payload),
        roles: Object.fromEntries(
          Object.entries(state.roles).filter(([id]) => id !== action.payload),
        ),
      };
    case 'ADD_MEMBER':
      return {
        ...state,
        members: [...state.members, action.payload],
        roles: {...state.roles, [action.payload.id]: 'member'},
        newMemberEmail: '',
      };
    case 'RESET_STATE':
      return initialState;
    default:
      return state;
  }
};

// Constants
const {width} = Dimensions.get('window');
const BATCH_SIZE = 10;
const ANIMATION_DURATION = 300;

// Memoized utility functions - outside component to prevent recreation
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
    return `${diffInMinutes} ${t('chatMembers.minutesAgo')}`;
  }
  if (diffInMinutes < 1440) {
    return `${Math.floor(diffInMinutes / 60)} ${t('chatMembers.hoursAgo')}`;
  }
  return `${Math.floor(diffInMinutes / 1440)} ${t('chatMembers.daysAgo')}`;
};

const getAvatarUrl = (member: Member): string => {
  return (
    member.avatar?.secure_url || member.avatar?.url || member.avatarUrl || ''
  );
};

// Stable refs hook
const useStableRefs = () => {
  const refs = useRef({
    fadeAnim: new Animated.Value(0),
    lastMembersHash: '',
    lastRolesHash: '',
    unsubscribeChat: null as (() => void) | null,
    isInitialized: false,
  });

  return refs.current;
};

// Memoized Components with strict props comparison
const HeaderComponent = memo(
  ({
    isGroup,
    chatName,
    membersCount,
    otherUser,
    isEditingName,
    isOwner,
    onBack,
    onEdit,
    onNameChange,
    onProfilePress,
    t,
  }: {
    isGroup: boolean;
    chatName: string;
    membersCount: number;
    otherUser: Member | null;
    isEditingName: boolean;
    isOwner: boolean;
    onBack: () => void;
    onEdit: () => void;
    onNameChange: (name: string) => void;
    onProfilePress: () => void;
    t: (key: string) => string;
  }) => (
    <LinearGradient colors={['#4AC6D0', '#3BB8C3']} style={styles.header}>
      <View style={styles.headerContent}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          {isGroup ? (
            <>
              {isEditingName ? (
                <TextInput
                  value={chatName}
                  onChangeText={onNameChange}
                  style={styles.nameInput}
                  autoFocus
                  placeholderTextColor="rgba(255,255,255,0.7)"
                />
              ) : (
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {chatName}
                </Text>
              )}
              <Text style={styles.headerSubtitle}>
                {membersCount} {t('chatMembers.memberCount')}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {otherUser?.name || t('chatMembers.directChat')}
              </Text>
              <Text style={styles.headerSubtitle}>
                {otherUser?.userStatus?.isOnline
                  ? t('chatMembers.online')
                  : t('chatMembers.offline')}
              </Text>
            </>
          )}
        </View>
        {isGroup && isOwner && (
          <TouchableOpacity onPress={onEdit} style={styles.editButton}>
            <Icon
              name={isEditingName ? 'check' : 'edit'}
              size={20}
              color="#FFF"
            />
          </TouchableOpacity>
        )}

        {!isGroup && (
          <TouchableOpacity onPress={onProfilePress} style={styles.editButton}>
            <Icon name={'person'} size={20} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>
    </LinearGradient>
  ),
  (prevProps, nextProps) => {
    // Custom comparison to prevent unnecessary re-renders
    return (
      prevProps.isGroup === nextProps.isGroup &&
      prevProps.chatName === nextProps.chatName &&
      prevProps.membersCount === nextProps.membersCount &&
      prevProps.isEditingName === nextProps.isEditingName &&
      prevProps.otherUser?.id === nextProps.otherUser?.id &&
      prevProps.otherUser?.name === nextProps.otherUser?.name &&
      prevProps.otherUser?.userStatus?.isOnline ===
        nextProps.otherUser?.userStatus?.isOnline
    );
  },
);

const OneOnOneProfile = memo(
  ({
    otherUser,
    onViewProfile,
    t,
  }: {
    otherUser: Member | null;
    onViewProfile: (userId: string) => void;
    t: (key: string) => string;
  }) => {
    const handleViewProfile = useCallback(() => {
      if (otherUser?.id) {
        onViewProfile(otherUser.id);
      }
    }, [otherUser?.id, onViewProfile]);

    const statusText = useMemo(() => {
      if (!otherUser) {
        return '';
      }
      if (otherUser.userStatus?.isOnline) {
        return t('chatMembers.online');
      }
      if (otherUser.userStatus?.lastSeen) {
        return `${t('chatMembers.lastSeen')} ${formatLastSeen(
          otherUser.userStatus.lastSeen,
          t,
        )}`;
      }
      return t('chatMembers.offline');
    }, [otherUser?.userStatus, t]);

    if (!otherUser) {
      return null;
    }

    return (
      <View style={styles.oneOnOneCard}>
        <LinearGradient
          colors={['rgba(74, 198, 208, 0.1)', 'rgba(74, 198, 208, 0.05)']}
          style={styles.infoCardGradient}>
          <View style={styles.oneOnOneProfile}>
            <View style={styles.largeAvatarContainer}>
              <AvatarStatus
                avatarUrl={getAvatarUrl(otherUser)}
                size={100}
                status={otherUser.userStatus?.status || 'offline'}
                style={styles.largeAvatar}
              />
            </View>

            <Text style={styles.oneOnOneUserName}>
              {otherUser.name || otherUser.email}
            </Text>
            <Text style={styles.oneOnOneUserEmail}>{otherUser.email}</Text>

            {otherUser.bio && (
              <Text style={styles.oneOnOneUserBio}>{otherUser.bio}</Text>
            )}

            <View style={styles.oneOnOneStatus}>
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: otherUser.userStatus?.isOnline
                      ? '#10B981'
                      : '#6B7280',
                  },
                ]}
              />
              <Text style={styles.oneOnOneStatusText}>{statusText}</Text>
            </View>

            <TouchableOpacity
              style={styles.viewProfileButton}
              onPress={handleViewProfile}>
              <LinearGradient
                colors={['#4AC6D0', '#3BB8C3']}
                style={styles.viewProfileGradient}>
                <Icon name="person" size={18} color="#FFF" />
                <Text style={styles.viewProfileText}>
                  {t('chatMembers.viewProfile')}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.otherUser?.id === nextProps.otherUser?.id &&
      prevProps.otherUser?.name === nextProps.otherUser?.name &&
      prevProps.otherUser?.email === nextProps.otherUser?.email &&
      prevProps.otherUser?.bio === nextProps.otherUser?.bio &&
      JSON.stringify(prevProps.otherUser?.userStatus) ===
        JSON.stringify(nextProps.otherUser?.userStatus)
    );
  },
);

const GroupInfoCard = memo(
  ({
    membersCount,
    currentUserId,
    userRole,
    t,
  }: {
    membersCount: number;
    currentUserId: string;
    userRole: string;
    t: (key: string) => string;
  }) => (
    <View style={styles.infoCard}>
      <LinearGradient
        colors={['rgba(74, 198, 208, 0.1)', 'rgba(74, 198, 208, 0.05)']}
        style={styles.infoCardGradient}>
        <View style={styles.infoRow}>
          <View style={styles.infoIconContainer}>
            <Icon name="group" size={24} color="#4AC6D0" />
          </View>
          <View style={styles.infoTextContainer}>
            <Text style={styles.infoTitle}>
              {t('chatMembers.groupMembers')}
            </Text>
            <Text style={styles.infoSubtitle}>
              {t('chatMembers.manageGroupMembers')}
            </Text>
          </View>
          {userRole === 'owner' && (
            <View style={styles.ownerBadge}>
              <Icon name="admin-panel-settings" size={16} color="#4AC6D0" />
              <Text style={styles.ownerBadgeText}>
                {t('chatMembers.roles.owner')}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  ),
  (prevProps, nextProps) => {
    return (
      prevProps.membersCount === nextProps.membersCount &&
      prevProps.userRole === nextProps.userRole
    );
  },
);

const AddMemberCard = memo(
  ({
    newMemberEmail,
    onEmailChange,
    onAddMember,
    userRole,
    isVisible,
    t,
  }: {
    newMemberEmail: string;
    onEmailChange: (email: string) => void;
    onAddMember: () => void;
    userRole: string;
    isVisible: boolean;
    t: (key: string) => string;
  }) => {
    if (!isVisible) {
      return null;
    }

    return (
      <View style={styles.addMemberCard}>
        <View style={styles.addMemberHeader}>
          <Icon name="person-add" size={20} color="#4AC6D0" />
          <Text style={styles.addMemberTitle}>
            {t('chatMembers.addNewMember')}
          </Text>
        </View>
        <View style={styles.addMemberForm}>
          <View style={styles.inputContainer}>
            <Icon name="email" size={16} color="#4AC6D0" />
            <TextInput
              value={newMemberEmail}
              onChangeText={onEmailChange}
              placeholder={t('chatMembers.enterEmailAddress')}
              style={styles.input}
              placeholderTextColor="#94A3B8"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
          <TouchableOpacity style={styles.addButton} onPress={onAddMember}>
            <LinearGradient
              colors={['#4AC6D0', '#3BB8C3']}
              style={styles.addButtonGradient}>
              <Icon name="add" size={18} color="#FFF" />
              <Text style={styles.addButtonText}>{t('common.add')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.newMemberEmail === nextProps.newMemberEmail &&
      prevProps.isVisible === nextProps.isVisible
    );
  },
);

// Optimized member item with deep comparison prevention
const MemberItem = memo(
  ({
    member,
    isGroup,
    currentUserId,
    memberRole,
    canRemove,
    fadeAnim,
    onRemoveMember,
    onViewProfile,
    t,
  }: {
    member: Member;
    isGroup: boolean;
    currentUserId: string;
    memberRole: string;
    canRemove: boolean;
    fadeAnim: Animated.Value;
    onRemoveMember: (memberId: string) => void;
    onViewProfile: (userId: string) => void;
    t: (key: string) => string;
  }) => {
    const handlePress = useCallback(() => {
      if (member.id !== currentUserId) {
        onViewProfile(member.id);
      }
    }, [member.id, currentUserId, onViewProfile]);

    const handleRemove = useCallback(() => {
      onRemoveMember(member.id);
    }, [member.id, onRemoveMember]);

    const isCurrentUser = member.id === currentUserId;

    const statusText = useMemo(() => {
      if (isGroup || !member.userStatus) {
        return null;
      }
      if (member.userStatus.isOnline) {
        return t('chatMembers.online');
      }
      if (member.userStatus.lastSeen) {
        return `${t('chatMembers.lastSeen')} ${formatLastSeen(
          member.userStatus.lastSeen,
          t,
        )}`;
      }
      return t('chatMembers.offline');
    }, [isGroup, member.userStatus, t]);

    return (
      <Animated.View
        style={[
          styles.memberItem,
          {
            opacity: fadeAnim,
            transform: [
              {
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}>
        <TouchableOpacity onPress={handlePress} style={styles.memberDetails}>
          <View style={styles.avatarContainer}>
            <AvatarStatus
              avatarUrl={getAvatarUrl(member)}
              size={isGroup ? 52 : 64}
              status={member.userStatus?.status || 'offline'}
              style={styles.avatar}
            />
            {isCurrentUser && (
              <View style={styles.currentUserBadge}>
                <Icon name="star" size={12} color="#4AC6D0" />
              </View>
            )}
          </View>

          <View style={styles.memberInfo}>
            <Text style={[styles.memberName, !isGroup && styles.oneOnOneName]}>
              {member.name || member.email}
            </Text>

            {isGroup && memberRole && (
              <View style={styles.roleBadge}>
                <Icon
                  name={
                    memberRole === 'owner' ? 'admin-panel-settings' : 'person'
                  }
                  size={14}
                  color="#4AC6D0"
                />
                <Text style={styles.memberRole}>
                  {t(`chatMembers.roles.${memberRole}`)}
                </Text>
              </View>
            )}

            <Text
              style={[styles.memberEmail, !isGroup && styles.oneOnOneEmail]}>
              {member.email}
            </Text>

            {statusText && <Text style={styles.statusText}>{statusText}</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.memberActions}>
          {isCurrentUser && (
            <View style={styles.youBadge}>
              <Text style={styles.youBadgeText}>{t('chatMembers.you')}</Text>
            </View>
          )}

          {canRemove && (
            <TouchableOpacity
              onPress={handleRemove}
              style={styles.removeButton}>
              <Icon name="person-remove" size={18} color="#FFF" />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison to prevent re-renders
    return (
      prevProps.member.id === nextProps.member.id &&
      prevProps.member.name === nextProps.member.name &&
      prevProps.member.email === nextProps.member.email &&
      prevProps.memberRole === nextProps.memberRole &&
      prevProps.canRemove === nextProps.canRemove &&
      prevProps.isGroup === nextProps.isGroup &&
      JSON.stringify(prevProps.member.userStatus) ===
        JSON.stringify(nextProps.member.userStatus)
    );
  },
);

// Optimized members list with stable references
const MembersList = memo(
  ({
    members,
    isGroup,
    currentUserId,
    roles,
    fadeAnim,
    onRemoveMember,
    onViewProfile,
    t,
  }: {
    members: Member[];
    isGroup: boolean;
    currentUserId: string;
    roles: Record<string, string>;
    fadeAnim: Animated.Value;
    onRemoveMember: (memberId: string) => void;
    onViewProfile: (userId: string) => void;
    t: (key: string) => string;
  }) => {
    // Memoize member data with removal permissions
    const memberData = useMemo(() => {
      const currentUserRole = roles[currentUserId];
      const isOwnerOrAdmin =
        currentUserRole === 'owner' || currentUserRole === 'admin';

      return members.map(member => ({
        member,
        memberRole: roles[member.id],
        canRemove: isGroup && isOwnerOrAdmin && member.id !== currentUserId,
      }));
    }, [members, roles, currentUserId, isGroup]);

    const renderMemberItem = useCallback(
      ({item, index}: {item: (typeof memberData)[0]; index: number}) => (
        <MemberItem
          member={item.member}
          isGroup={isGroup}
          currentUserId={currentUserId}
          memberRole={item.memberRole}
          canRemove={item.canRemove}
          fadeAnim={fadeAnim}
          onRemoveMember={onRemoveMember}
          onViewProfile={onViewProfile}
          t={t}
        />
      ),
      [isGroup, currentUserId, fadeAnim, onRemoveMember, onViewProfile, t],
    );

    const keyExtractor = useCallback(
      (item: (typeof memberData)[0]) => item.member.id,
      [],
    );

    const ItemSeparator = useCallback(
      () => <View style={styles.separator} />,
      [],
    );

    const EmptyComponent = useCallback(
      () => (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>
            {t('chatMembers.noMembersFound')}
          </Text>
        </View>
      ),
      [t],
    );

    return (
      <View style={styles.membersCard}>
        <View style={styles.membersHeader}>
          <Icon name="people" size={20} color="#4AC6D0" />
          <Text style={styles.membersTitle}>{t('chatMembers.allMembers')}</Text>
        </View>

        <FlatList
          data={memberData}
          keyExtractor={keyExtractor}
          renderItem={renderMemberItem}
          scrollEnabled={false}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={ItemSeparator}
          ListEmptyComponent={EmptyComponent}
          removeClippedSubviews
          initialNumToRender={BATCH_SIZE}
          maxToRenderPerBatch={BATCH_SIZE}
          updateCellsBatchingPeriod={50}
          windowSize={21}
          getItemLayout={(data, index) => ({
            length: 72, // Approximate item height
            offset: 72 * index,
            index,
          })}
        />
      </View>
    );
  },
  (prevProps, nextProps) => {
    // Hash comparison for members and roles to prevent deep object comparison
    const prevMembersHash = JSON.stringify(
      prevProps.members.map(m => ({id: m.id, name: m.name, email: m.email})),
    );
    const nextMembersHash = JSON.stringify(
      nextProps.members.map(m => ({id: m.id, name: m.name, email: m.email})),
    );
    const prevRolesHash = JSON.stringify(prevProps.roles);
    const nextRolesHash = JSON.stringify(nextProps.roles);

    return (
      prevMembersHash === nextMembersHash &&
      prevRolesHash === nextRolesHash &&
      prevProps.isGroup === nextProps.isGroup &&
      prevProps.currentUserId === nextProps.currentUserId
    );
  },
);

// Main Component
const ChatMembersList: React.FC<{route: any}> = ({route}) => {
  const {t} = useTranslation();
  const navigation = useNavigation<any>();
  const {user} = useAuth();
  const {chatId, currentUserId} = route.params;

  const [state, dispatch] = useReducer(stateReducer, initialState);
  const refs = useStableRefs();
  const [code, setCode] = useState<string>('');
  const [isCopyCode, setIsCopyCode] = useState<boolean>(false);
  useEffect(() => {
    if (!chatId || !currentUserId) {
      Alert.alert('Error', 'Chat ID or User ID is missing');
      return;
    }
    const isExistInChat = async () => {
      const unsubscribeExistCheck = firestore()
        .collection('chats')
        .doc(chatId)
        .onSnapshot(
          chatDoc => {
            if (!chatDoc.exists) {
              Alert.alert('Error', 'Chat does not exist');
              navigation.navigate('ChatList');
              return;
            }
            const chatData = chatDoc.data();
            if (!chatData?.members?.includes(currentUserId)) {
              navigation.navigate('ChatList');
            }
          },
          error => {
            console.error('Error checking chat membership:', error);
            Alert.alert('Error', 'Failed to verify chat access');
          },
        );

      return () => unsubscribeExistCheck();
    };
    isExistInChat();
  }, [currentUserId, chatId]);

  useEffect(() => {
    if (isCopyCode) {
      Clipboard.setString(code);
      setTimeout(() => {
        setIsCopyCode(false);
      }, 1500);
    }
  }, [isCopyCode]);
  // Stable navigation handlers
  const navigationHandlers = useMemo(
    () => ({
      handleBack: () => navigation.goBack(),
      handleViewProfile: (userId: string) =>
        navigation.navigate('ViewUserProfile', {userId}),
    }),
    [navigation],
  );

  // Memoized form handlers
  const formHandlers = useMemo(
    () => ({
      handleNameChange: (name: string) =>
        dispatch({type: 'SET_CHAT_NAME', payload: name}),
      handleEmailChange: (email: string) =>
        dispatch({type: 'SET_NEW_MEMBER_EMAIL', payload: email}),
    }),
    [],
  );

  // Memoized computed values
  const computedValues = useMemo(
    () => ({
      membersCount: state.members.length,
      userRole: state.roles[currentUserId] || 'member',
      canAddMembers: user?.role === 'tour_guide' && state.isGroup,
    }),
    [
      state.members.length,
      state.roles,
      currentUserId,
      user?.role,
      state.isGroup,
    ],
  );

  // Batch member fetching - optimized
  const fetchMembersInBatches = useCallback(
    async (memberIds: string[]): Promise<Member[]> => {
      if (memberIds.length === 0) {
        return [];
      }

      // Create hash to check if we need to fetch
      const membersHash = memberIds.sort().join(',');
      if (refs.lastMembersHash === membersHash) {
        return state.members;
      }

      refs.lastMembersHash = membersHash;

      let membersList: Member[] = [];

      if (memberIds.length > BATCH_SIZE) {
        const batches = [];
        for (let i = 0; i < memberIds.length; i += BATCH_SIZE) {
          batches.push(memberIds.slice(i, i + BATCH_SIZE));
        }

        for (const batch of batches) {
          const batchSnapshot = await firestore()
            .collection('users')
            .where(firestore.FieldPath.documentId(), 'in', batch)
            .get();

          batchSnapshot.forEach(doc => {
            membersList.push({id: doc.id, ...doc.data()} as Member);
          });
        }
      } else {
        const membersSnapshot = await firestore()
          .collection('users')
          .where(firestore.FieldPath.documentId(), 'in', memberIds)
          .get();

        membersSnapshot.forEach(doc => {
          membersList.push({id: doc.id, ...doc.data()} as Member);
        });
      }

      return membersList;
    },
    [refs, state.members],
  );

  // Business logic handlers - memoized
  const businessHandlers = useMemo(
    () => ({
      handleEditGroupName: async () => {
        if (!state.isGroup) {
          Alert.alert(
            t('common.error'),
            t('chatMembers.cannotEditDirectChatName'),
          );
          return;
        }

        if (state.isEditingName) {
          try {
            await firestore().collection('chats').doc(chatId).update({
              name: state.chatName,
            });
          } catch (error) {
            console.error('Error updating group name:', error);
            Alert.alert(
              t('common.error'),
              t('chatMembers.failedToUpdateGroupName'),
            );
          }
        }
        dispatch({type: 'SET_EDITING_NAME', payload: !state.isEditingName});
      },

      handleRemoveMember: async (memberId: string) => {
        if (!state.isGroup) {
          Alert.alert(
            t('common.error'),
            t('chatMembers.cannotRemoveFromDirectChat'),
          );
          return;
        }

        if (memberId === currentUserId) {
          Alert.alert(t('common.error'), t('chatMembers.cannotRemoveYourself'));
          return;
        }

        Alert.alert(
          t('chatMembers.removeMember'),
          t('chatMembers.removeMemberConfirmation'),
          [
            {text: t('common.cancel'), style: 'cancel'},
            {
              text: t('common.remove'),
              style: 'destructive',
              onPress: async () => {
                try {
                  await firestore()
                    .collection('chats')
                    .doc(chatId)
                    .update({
                      members: firestore.FieldValue.arrayRemove(memberId),
                      [`roles.${memberId}`]: firestore.FieldValue.delete(),
                    });

                  dispatch({type: 'REMOVE_MEMBER', payload: memberId});
                } catch (error) {
                  console.error('Error removing member:', error);
                  Alert.alert(
                    t('common.error'),
                    t('chatMembers.failedToRemoveMember'),
                  );
                }
              },
            },
          ],
        );
      },

      handleAddMember: async () => {
        if (!state.isGroup) {
          Alert.alert(
            t('common.error'),
            t('chatMembers.cannotAddToDirectChat'),
          );
          return;
        }

        if (!state.newMemberEmail.trim()) {
          Alert.alert(t('common.error'), t('chatMembers.enterValidEmail'));
          return;
        }

        try {
          const userSnapshot = await firestore()
            .collection('users')
            .where('email', '==', state.newMemberEmail.trim())
            .limit(1)
            .get();

          if (userSnapshot.empty) {
            Alert.alert(t('common.error'), t('chatMembers.userNotFound'));
            return;
          }

          const userId = userSnapshot.docs[0].id;
          const userData = userSnapshot.docs[0].data();

          if (state.members.some(member => member.id === userId)) {
            Alert.alert(t('common.error'), t('chatMembers.userAlreadyMember'));
            return;
          }

          await firestore()
            .collection('chats')
            .doc(chatId)
            .update({
              members: firestore.FieldValue.arrayUnion(userId),
              [`roles.${userId}`]: 'member',
            });

          const newMember = {id: userId, ...userData} as Member;
          dispatch({type: 'ADD_MEMBER', payload: newMember});

          Alert.alert(
            t('common.success'),
            `${userData.name || userData.email} ${t(
              'chatMembers.memberAddedToGroup',
            )}`,
          );
        } catch (error) {
          console.error('Error adding member:', error);
          Alert.alert(t('common.error'), t('chatMembers.failedToAddMember'));
        }
      },
    }),
    [state, chatId, currentUserId, t],
  );

  // Animation effect
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

  // Main data fetching effect with optimization
  useEffect(() => {
    if (!chatId) {
      console.error('No chatId provided');
      return;
    }

    // Cleanup previous listener
    if (refs.unsubscribeChat) {
      refs.unsubscribeChat();
    }

    refs.unsubscribeChat = firestore()
      .collection('chats')
      .doc(chatId)
      .onSnapshot(
        async chatDoc => {
          dispatch({type: 'SET_LOADING', payload: true});

          const chatData = chatDoc.data() as ChatData;
          if (!chatData?.members?.length) {
            console.log('No chat data or members found');
            dispatch({type: 'SET_LOADING', payload: false});
            return;
          }

          try {
            // Batch updates to prevent multiple re-renders
            const rolesHash = JSON.stringify(chatData.roles || {});
            if (refs.lastRolesHash !== rolesHash) {
              refs.lastRolesHash = rolesHash;
              dispatch({
                type: 'SET_IS_GROUP',
                payload: chatData.isGroup || false,
              });
              dispatch({
                type: 'SET_CHAT_NAME',
                payload: chatData.name || 'Untitled Group',
              });
              dispatch({type: 'SET_ROLES', payload: chatData.roles || {}});
            }
            const isGroup = chatData.isGroup || false;
            if (isGroup) {
              var codeG = chatData.code || '';
              if (codeG === '') {
                codeG = Math.random()
                  .toString(36)
                  .substring(2, 10)
                  .toUpperCase();
                chatDoc.ref.update({code: codeG});
                await firestore()
                  .collection('codes')
                  .doc(codeG)
                  .set({chatId: chatId}, {merge: true});
              }
              // await firestore().collection('code')
              setCode(codeG);
            }
            const membersList = await fetchMembersInBatches(chatData.members);

            // Find other user in 1-1 chat
            const otherUser =
              !chatData.isGroup && membersList.length === 2
                ? membersList.find(member => member.id !== currentUserId) ||
                  null
                : null;

            dispatch({type: 'SET_MEMBERS', payload: membersList});
            dispatch({type: 'SET_OTHER_USER', payload: otherUser});
            dispatch({type: 'SET_LOADING', payload: false});
          } catch (error) {
            console.error('Error fetching members:', error);
            dispatch({type: 'SET_LOADING', payload: false});
          }
        },
        error => {
          console.error('Error in chat snapshot:', error);
          dispatch({type: 'SET_LOADING', payload: false});
        },
      );

    return () => {
      if (refs.unsubscribeChat) {
        refs.unsubscribeChat();
        refs.unsubscribeChat = null;
      }
    };
  }, [chatId, currentUserId, fetchMembersInBatches, refs]);

  // Render different UI based on isGroup
  if (!state.isGroup) {
    return (
      <SafeAreaView style={styles.container}>
        <Loading isLoading={state.loading} />

        <HeaderComponent
          isGroup={false}
          chatName={state.chatName}
          membersCount={computedValues.membersCount}
          otherUser={state.otherUser}
          isEditingName={false}
          onBack={navigationHandlers.handleBack}
          onEdit={businessHandlers.handleEditGroupName}
          onNameChange={formHandlers.handleNameChange}
          onProfilePress={() =>
            state.otherUser &&
            navigationHandlers.handleViewProfile(state.otherUser.id)
          }
          t={t}
        />

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <OneOnOneProfile
            otherUser={state.otherUser}
            onViewProfile={navigationHandlers.handleViewProfile}
            t={t}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Group Chat UI
  return (
    <SafeAreaView style={styles.container}>
      <Loading isLoading={state.loading} />

      <HeaderComponent
        isGroup={true}
        isOwner={user?.role === 'tour_guide'}
        chatName={state.chatName}
        membersCount={computedValues.membersCount}
        otherUser={null}
        isEditingName={state.isEditingName}
        onBack={navigationHandlers.handleBack}
        onEdit={businessHandlers.handleEditGroupName}
        onNameChange={formHandlers.handleNameChange}
        onProfilePress={() => {}}
        t={t}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <GroupInfoCard
          membersCount={computedValues.membersCount}
          currentUserId={currentUserId}
          userRole={computedValues.userRole}
          t={t}
        />
        <View style={styles.copyCodeContainer}>
          <Text style={styles.copyCodeText}>
            {t('chatMembers.addMemberCode') + ': ' + code}
          </Text>
          <TouchableOpacity onPress={() => setIsCopyCode(!isCopyCode)}>
            <Icon
              name={!isCopyCode ? 'content-copy' : 'check'}
              size={20}
              color="#4AC6D0"
            />
          </TouchableOpacity>
        </View>

        <AddMemberCard
          newMemberEmail={state.newMemberEmail}
          onEmailChange={formHandlers.handleEmailChange}
          onAddMember={businessHandlers.handleAddMember}
          userRole={user?.role || ''}
          isVisible={computedValues.canAddMembers}
          t={t}
        />

        <MembersList
          members={state.members}
          isGroup={state.isGroup}
          currentUserId={currentUserId}
          roles={state.roles}
          fadeAnim={refs.fadeAnim}
          onRemoveMember={businessHandlers.handleRemoveMember}
          onViewProfile={navigationHandlers.handleViewProfile}
          t={t}
        />
      </ScrollView>
    </SafeAreaView>
  );
};

// Styles remain the same as previous version
const styles = StyleSheet.create({
  // ... (same styles as before, keeping them for brevity)
  container: {
    backgroundColor: '#F8FAFC',
    flex: 1,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 20,
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backButton: {
    marginRight: 16,
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  headerTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  nameInput: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.5)',
    paddingVertical: 4,
    marginBottom: 2,
  },
  editButton: {
    padding: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },

  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  oneOnOneCard: {
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  oneOnOneProfile: {
    alignItems: 'center',
    padding: 30,
  },
  largeAvatarContainer: {
    marginBottom: 20,
  },
  largeAvatar: {
    elevation: 8,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  oneOnOneUserName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 4,
  },
  oneOnOneUserEmail: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  oneOnOneUserBio: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  oneOnOneStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  oneOnOneStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  viewProfileButton: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  viewProfileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  viewProfileText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 8,
  },
  infoCard: {
    marginTop: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  infoCardGradient: {
    padding: 20,
    backgroundColor: '#FFF',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  infoSubtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  ownerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  ownerBadgeText: {
    color: '#4AC6D0',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  addMemberCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  addMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  addMemberTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 8,
  },
  copyCodeContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  copyCodeText: {
    fontSize: 14,
    color: '#4AC6D0',
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  addMemberForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1E293B',
    paddingVertical: 12,
    marginLeft: 8,
  },
  addButton: {
    borderRadius: 12,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  addButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
    marginLeft: 4,
  },
  membersCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    elevation: 3,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  membersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  membersTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginLeft: 8,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  memberDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    borderRadius: 26,
  },
  currentUserBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 3,
    elevation: 2,
    shadowColor: '#4AC6D0',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 2,
  },
  oneOnOneName: {
    fontSize: 18,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 198, 208, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#4AC6D0',
    fontWeight: '600',
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  memberEmail: {
    fontSize: 13,
    color: '#64748B',
  },
  oneOnOneEmail: {
    fontSize: 14,
  },
  statusText: {
    fontSize: 12,
    color: '#4AC6D0',
    fontWeight: '600',
    marginTop: 2,
  },
  memberActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  youBadge: {
    backgroundColor: 'rgba(74, 198, 208, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 198, 208, 0.3)',
  },
  youBadgeText: {
    color: '#4AC6D0',
    fontSize: 12,
    fontWeight: '700',
  },
  removeButton: {
    backgroundColor: '#EF4444',
    padding: 8,
    borderRadius: 20,
    elevation: 2,
    shadowColor: '#EF4444',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
  separator: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 4,
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
  },
  emptyText: {
    color: '#64748B',
  },
});

export default memo(ChatMembersList);
