import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import auth, {FirebaseAuthTypes} from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {Alert} from 'react-native';
import {fcmService} from '../services/FCMService';
import {useTranslation} from './TranslationContext';

// Types
type Role = 'tourist' | 'tour_guide' | 'admin';
type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';
type OnlineStatus = 'online' | 'offline' | 'away';

interface UserStatusData {
  deviceId?: string;
  isOnline?: boolean;
  lastActivity?: FirebaseAuthTypes.Timestamp;
  lastSeen?: FirebaseAuthTypes.Timestamp;
  sessionId?: string;
  status?: OnlineStatus;
  updatedAt?: FirebaseAuthTypes.Timestamp;
}

interface User {
  uid: string;
  email: string;
  role: Role;
  status?: UserStatus;
  isActive?: boolean;
  name?: string;
  avatar?: string;
  bio?: string;
  userStatus?: UserStatusData;
  translateCode?: string;
  fcmToken?: string;
  language?: string;
  lastActive?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  role: Role | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    role: Role,
    name?: string,
  ) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

interface AccessCheckResult {
  canAccess: boolean;
  message?: string;
}

// Constants
const SIGNOUT_CLEANUP_DELAY = 1000;
const DEFAULT_USER_STATUS: UserStatusData = {
  deviceId: '',
  isOnline: false,
  lastActivity: null,
  lastSeen: null,
  sessionId: '',
  status: 'offline',
  updatedAt: null,
};

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hooks for auth logic
const useAuthState = () => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  return {
    user,
    setUser,
    role,
    setRole,
    loading,
    setLoading,
  };
};

const useAuthRefs = () => {
  const unsubscribeDocRef = useRef<(() => void) | null>(null);
  const isSigningOutRef = useRef(false);
  const currentUserRef = useRef<User | null>(null);

  return {
    unsubscribeDocRef,
    isSigningOutRef,
    currentUserRef,
  };
};

// Utility functions
const createDefaultUserData = (
  authUser: FirebaseAuthTypes.User,
  role: Role = 'tourist',
): Partial<User> => ({
  email: authUser.email || '',
  role,
  isActive: true,
  createdAt: firestore.FieldValue.serverTimestamp(),
  updatedAt: firestore.FieldValue.serverTimestamp(),
});

const transformFirestoreUser = (
  authUser: FirebaseAuthTypes.User,
  userData: any,
): User => ({
  uid: authUser.uid,
  email: authUser.email || userData.email || '',
  role: userData.role || 'tourist',
  status: userData.status,
  isActive: userData.isActive !== false,
  name: userData.name,
  avatar: userData.avatar,
  bio: userData.bio,
  userStatus: userData.userStatus || DEFAULT_USER_STATUS,
  translateCode: userData.translateCode || 'en-US',
  language: userData.language || 'en',
  fcmToken: userData.fcmToken || '',
  lastActive: userData.lastActive || '',
  createdAt:
    userData.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
  updatedAt:
    userData.updatedAt?.toDate()?.toISOString() || new Date().toISOString(),
});

// Main AuthProvider component
const AuthProviderInternal: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  const {t} = useTranslation();
  const {user, setUser, role, setRole, loading, setLoading} = useAuthState();
  const {unsubscribeDocRef, isSigningOutRef, currentUserRef} = useAuthRefs();

  // Keep current user ref in sync
  useEffect(() => {
    currentUserRef.current = user;
  }, [user]);

  // Access control logic
  const checkUserAccess = useCallback(
    (userData: any): AccessCheckResult => {
      if (!userData) {
        return {canAccess: false, message: t('auth.userDataNotFound')};
      }

      // Check if user is active
      if (userData.isActive === false) {
        return {
          canAccess: false,
          message: t('auth.accountDeactivated'),
        };
      }

      // Tour guide access control
      if (userData.role === 'tour_guide') {
        const status = userData.status || 'pending';

        switch (status) {
          case 'pending':
            return {
              canAccess: false,
              message: t('auth.tourGuideAwaitingApproval'),
            };
          case 'rejected':
            return {
              canAccess: false,
              message: t('auth.tourGuideApplicationRejected'),
            };
          case 'suspended':
            return {
              canAccess: false,
              message: t('auth.tourGuideAccountSuspended'),
            };
          case 'approved':
            return {canAccess: true};
          default:
            return {
              canAccess: false,
              message: t('auth.tourGuideAwaitingApproval'),
            };
        }
      }

      // Admin access control
      if (userData.role === 'admin') {
        return {canAccess: true};
      }

      // Tourist access control (default)
      return {canAccess: true};
    },
    [t],
  );

  // Account status issue handler
  const handleAccountStatusIssue = useCallback(
    async (message: string) => {
      if (isSigningOutRef.current) {
        return;
      }

      Alert.alert(t('auth.accountIssue'), message, [
        {
          text: t('common.ok'),
          onPress: async () => {
            // Directly call Firebase signOut instead of recursive call
            try {
              isSigningOutRef.current = true;
              cleanupDocListener();
              await auth().signOut();
            } catch (error) {
              console.error(
                'Error in handleAccountStatusIssue signOut:',
                error,
              );
            }
          },
        },
      ]);
    },
    [t, cleanupDocListener],
  );

  // Document listener cleanup
  const cleanupDocListener = useCallback(() => {
    if (unsubscribeDocRef.current) {
      // console.log('🧹 Cleaning up document listener');
      unsubscribeDocRef.current();
      unsubscribeDocRef.current = null;
    }
  }, []);

  // Create user document
  const createUserDocument = useCallback(
    async (
      authUser: FirebaseAuthTypes.User,
      role: Role = 'tourist',
      name?: string,
    ) => {
      try {
        const userData = {
          email: authUser.email || '',
          role,
          isActive: true,
          name: name?.trim() || '',
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          userStatus: DEFAULT_USER_STATUS,
          translateCode: 'en-US',
          language: 'en',
          // Add status for tour guide
          ...(role === 'tour_guide' && {status: 'pending'}),
        };

        await firestore()
          .collection('users')
          .doc(authUser.uid)
          .set(userData, {merge: true});

        if (!isSigningOutRef.current) {
          const newUser = transformFirestoreUser(authUser, {
            ...userData,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          setUser(newUser);
          setRole(role);
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error creating user document:', error);
        if (!isSigningOutRef.current) {
          setLoading(false);
        }
        throw error;
      }
    },
    [setUser, setRole, setLoading],
  );

  // User document snapshot handler
  const handleUserDocumentSnapshot = useCallback(
    async (
      doc: firestore.FirebaseFirestoreTypes.DocumentSnapshot,
      authUser: FirebaseAuthTypes.User,
    ) => {
      try {
        if (isSigningOutRef.current) {
          // console.log('⏭️ Skipping document update during signout');
          return;
        }

        const userData = doc.data();

        // Create user document if it doesn't exist
        if (!userData) {
          await createUserDocument(authUser);
          return;
        }

        // Check access permissions
        const accessCheck = checkUserAccess(userData);
        if (!accessCheck.canAccess) {
          await handleAccountStatusIssue(
            accessCheck.message || t('auth.accessDenied'),
          );
          return;
        }

        // Update user state
        if (!isSigningOutRef.current) {
          const fullUserData = transformFirestoreUser(authUser, userData);
          setUser(fullUserData);
          setRole(userData.role || 'tourist');
          setLoading(false);
        }
      } catch (error) {
        console.error('❌ Error processing user document:', error);
        if (!isSigningOutRef.current) {
          setLoading(false);
        }
      }
    },
    [
      checkUserAccess,
      handleAccountStatusIssue,
      createUserDocument,
      setUser,
      setRole,
      setLoading,
      t,
    ],
  );

  // Document listener error handler
  const handleDocumentError = useCallback(
    (error: Error) => {
      console.error('❌ Error listening to user document:', error);
      if (!isSigningOutRef.current) {
        setLoading(false);
      }
    },
    [setLoading],
  );

  // Setup user document listener
  const setupUserDocumentListener = useCallback(
    (authUser: FirebaseAuthTypes.User) => {
      cleanupDocListener();

      // console.log('👂 Setting up user document listener for:', authUser.uid);

      const unsubscribeDoc = firestore()
        .collection('users')
        .doc(authUser.uid)
        .onSnapshot(
          doc => handleUserDocumentSnapshot(doc, authUser),
          handleDocumentError,
        );

      unsubscribeDocRef.current = unsubscribeDoc;
    },
    [cleanupDocListener, handleUserDocumentSnapshot, handleDocumentError],
  );

  // Auth state change handler
  const handleAuthStateChange = useCallback(
    async (authUser: FirebaseAuthTypes.User | null) => {
      // console.log('🔐 Auth state changed:', authUser?.uid || 'null');

      if (authUser && !isSigningOutRef.current) {
        setupUserDocumentListener(authUser);
      } else {
        cleanupDocListener();
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    },
    [
      setupUserDocumentListener,
      cleanupDocListener,
      setUser,
      setRole,
      setLoading,
    ],
  );

  // Main auth state listener effect
  useEffect(() => {
    // console.log('🚀 Setting up auth state listener');

    const unsubscribeAuth = auth().onAuthStateChanged(handleAuthStateChange);

    return () => {
      // console.log('🧹 Cleaning up auth state listener');
      unsubscribeAuth();
      cleanupDocListener();
    };
  }, [handleAuthStateChange, cleanupDocListener]);

  // Auth methods
  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        setLoading(true);
        isSigningOutRef.current = false;

        const userCredential = await auth().signInWithEmailAndPassword(
          email.trim(),
          password,
        );

        // Check if user document exists
        const userDoc = await firestore()
          .collection('users')
          .doc(userCredential.user.uid)
          .get();

        if (!userDoc.exists) {
          // Create basic user document if it doesn't exist
          await createUserDocument(userCredential.user);
        }

        // User data will be handled by the auth state listener
      } catch (error: any) {
        setLoading(false);
        console.error('❌ Sign in error:', error);

        // Handle Firebase auth errors
        let errorMessage = t('auth.loginError');

        switch (error.code) {
          case 'auth/user-not-found':
          case 'auth/wrong-password':
            errorMessage = t('auth.invalidCredentials');
            break;
          case 'auth/invalid-email':
            errorMessage = t('auth.invalidEmailAddress');
            break;
          case 'auth/user-disabled':
            errorMessage = t('auth.accountDisabled');
            break;
          case 'auth/too-many-requests':
            errorMessage = t('auth.tooManyRequests');
            break;
          case 'auth/network-request-failed':
            errorMessage = t('errors.networkError');
            break;
          case 'auth/invalid-credential':
            errorMessage = t('auth.invalidCredentials');
            break;
          default:
            errorMessage = t('auth.loginError');
        }

        throw new Error(errorMessage);
      }
    },
    [setLoading, createUserDocument, t],
  );

  const signUp = useCallback(
    async (email: string, password: string, role: Role, name?: string) => {
      try {
        setLoading(true);
        isSigningOutRef.current = false;

        const userCredential = await auth().createUserWithEmailAndPassword(
          email.trim(),
          password,
        );

        // Create user document
        const userData = {
          email: userCredential.user.email || '',
          role,
          isActive: true,
          name: name?.trim() || '',
          createdAt: firestore.FieldValue.serverTimestamp(),
          updatedAt: firestore.FieldValue.serverTimestamp(),
          userStatus: DEFAULT_USER_STATUS,
          translateCode: 'en-US',
          language: 'en',
          // Add status for tour guide
          ...(role === 'tour_guide' && {status: 'pending'}),
        };

        await firestore()
          .collection('users')
          .doc(userCredential.user.uid)
          .set(userData, {merge: true});

        // Handle tour guide specific flow
        if (role === 'tour_guide') {
          // Sign out immediately for tour guides since they need approval
          isSigningOutRef.current = true;
          cleanupDocListener();
          await auth().signOut();

          // Reset loading state after signout
          setLoading(false);
          setUser(null);
          setRole(null);

          Alert.alert(
            t('auth.accountCreated'),
            t('auth.tourGuideAccountCreatedMessage'),
            [
              {
                text: t('common.ok'),
                onPress: () => {
                  // Reset the signout flag
                  setTimeout(() => {
                    isSigningOutRef.current = false;
                  }, 500);
                },
              },
            ],
          );
        } else {
          // For tourists, let the auth state listener handle the login
          // Don't set loading to false here, let the listener handle it
        }
      } catch (error: any) {
        setLoading(false);
        console.error('❌ Sign up error:', error);

        // Handle Firebase auth errors
        let errorMessage = t('auth.registrationFailed');

        switch (error.code) {
          case 'auth/email-already-in-use':
            errorMessage = t('auth.emailAlreadyInUse');
            break;
          case 'auth/weak-password':
            errorMessage = t('auth.weakPassword');
            break;
          case 'auth/invalid-email':
            errorMessage = t('auth.invalidEmailAddress');
            break;
          case 'auth/operation-not-allowed':
            errorMessage = t('auth.operationNotAllowed');
            break;
          case 'auth/network-request-failed':
            errorMessage = t('errors.networkError');
            break;
          default:
            errorMessage = t('auth.registrationFailed');
        }

        throw new Error(errorMessage);
      }
    },
    [setLoading, t, cleanupDocListener, setUser, setRole],
  );

  const signOut = useCallback(async () => {
    try {
      // console.log('🚪 Starting signout process');
      isSigningOutRef.current = true;

      const currentUser = auth().currentUser;

      // Clean up FCM and user data
      if (currentUser) {
        try {
          await fcmService.removeToken(currentUser.uid);
        } catch (updateError) {
          // console.log('⚠️ Could not update user data on signout:', updateError);
        }
      }

      // Clean up listeners and state
      cleanupDocListener();
      fcmService.cleanup();

      // Clear state immediately
      setUser(null);
      setRole(null);
      setLoading(false);

      // Sign out from Firebase
      await auth().signOut();

      // console.log('✅ Signout completed successfully');
    } catch (error: any) {
      console.error('❌ Error signing out:', error);

      // Clean up state even on error
      cleanupDocListener();
      setUser(null);
      setRole(null);
      setLoading(false);

      if (error.code !== 'auth/no-current-user') {
        throw error;
      }
    } finally {
      // Reset signout flag after cleanup delay
      setTimeout(() => {
        isSigningOutRef.current = false;
      }, SIGNOUT_CLEANUP_DELAY);
    }
  }, [cleanupDocListener, setUser, setRole, setLoading]);

  // Refresh user data
  const refreshUser = useCallback(async () => {
    const currentUser = auth().currentUser;
    if (currentUser) {
      try {
        const unsubscribe = firestore()
          .collection('users')
          .doc(currentUser.uid)
          .onSnapshot(
            doc => {
              handleUserDocumentSnapshot(doc, currentUser);
              unsubscribe(); // Unsubscribe after first snapshot
            },
            error => {
              console.error('❌ Error refreshing user:', error);
              unsubscribe(); // Unsubscribe on error
            },
          );
      } catch (error) {
        console.error('❌ Error refreshing user:', error);
      }
    }
  }, [handleUserDocumentSnapshot]);

  // Memoized context value
  const contextValue = useMemo(
    () => ({
      user,
      role,
      loading,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [user, role, loading, signIn, signUp, signOut, refreshUser],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};

// Main AuthProvider wrapper with error boundary
export const AuthProvider: React.FC<{children: React.ReactNode}> = ({
  children,
}) => {
  return <AuthProviderInternal>{children}</AuthProviderInternal>;
};

// Custom hook with error handling
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
};

// Additional utility hooks
export const useCurrentUser = () => {
  const {user} = useAuth();
  return user;
};

export const useUserRole = () => {
  const {role} = useAuth();
  return role;
};

export const useAuthLoading = () => {
  const {loading} = useAuth();
  return loading;
};

export default AuthProvider;
