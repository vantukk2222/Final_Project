import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
} from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import {Alert} from 'react-native';
import {fcmService} from '../services/FCMService';
import {useTranslation} from './TranslationContext';

type Role = 'tourist' | 'tour_guide' | 'admin';
type UserStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

interface User {
  uid: string;
  email: string;
  role: Role;
  status?: UserStatus;
  isActive?: boolean;
  name?: string;
  avatar?: string;
  bio?: string;
  userStatus?: {
    deviceId?: string;
    isOnline?: boolean;
    lastActivity?: any;
    lastSeen?: any;
    sessionId?: string;
    status?: 'online' | 'offline' | 'away';
    updatedAt?: any;
  };
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
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProviderInternal = ({children}: {children: React.ReactNode}) => {
  const {t} = useTranslation();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // Refs to track cleanup functions and prevent race conditions
  const unsubscribeDocRef = useRef<(() => void) | null>(null);
  const isSigningOutRef = useRef(false);

  // Function to handle account status issues
  const handleAccountStatusIssue = async (userData: any, message: string) => {
    if (isSigningOutRef.current) {
      return;
    } // Prevent multiple alerts during signout

    Alert.alert(t('auth.accountIssue'), message, [
      {
        text: t('common.ok'),
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  };

  // Function to check if user can access the app
  const checkUserAccess = (
    userData: any,
  ): {canAccess: boolean; message?: string} => {
    if (!userData) {
      return {canAccess: false, message: t('auth.userDataNotFound')};
    }

    // Check for tour guides
    if (userData.role === 'tour_guide') {
      switch (userData.status) {
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

    // Check for tourists
    if (userData.role === 'tourist') {
      if (userData.isActive === false) {
        return {
          canAccess: false,
          message: t('auth.accountDeactivated'),
        };
      }
      return {canAccess: true};
    }

    // Admin always has access
    if (userData.role === 'admin') {
      return {canAccess: true};
    }

    return {canAccess: true};
  };

  // Cleanup function for document listener
  const cleanupDocListener = () => {
    if (unsubscribeDocRef.current) {
      console.log('Cleaning up document listener');
      unsubscribeDocRef.current();
      unsubscribeDocRef.current = null;
    }
  };

  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged(async authUser => {
      console.log('Auth state changed:', authUser?.uid || 'null');

      if (authUser && !isSigningOutRef.current) {
        // Clean up any existing document listener
        cleanupDocListener();

        // Listen to user document changes in real-time
        const unsubscribeDoc = firestore()
          .collection('users')
          .doc(authUser.uid)
          .onSnapshot(
            async doc => {
              try {
                // Skip if we're in the process of signing out
                if (isSigningOutRef.current) {
                  console.log('Skipping document update during signout');
                  return;
                }

                const userData = doc.data();
                // console.log('User data updated:', userData);

                if (!userData) {
                  // Create user document if it doesn't exist (for new users)
                  const newUserData = {
                    email: authUser.email,
                    role: 'tourist' as Role,
                    isActive: true,
                    createdAt: firestore.FieldValue.serverTimestamp(),
                  };

                  await firestore()
                    .collection('users')
                    .doc(authUser.uid)
                    .set(newUserData);

                  if (!isSigningOutRef.current) {
                    setUser({
                      uid: authUser.uid,
                      ...newUserData,
                      email: authUser.email || '',
                      createdAt: new Date().toISOString(),
                    });
                    setRole('tourist');
                    setLoading(false);
                  }
                  return;
                }

                // Check if user can access the app
                const accessCheck = checkUserAccess(userData);

                if (!accessCheck.canAccess) {
                  await handleAccountStatusIssue(
                    userData,
                    accessCheck.message || t('auth.accessDenied'),
                  );
                  return;
                }

                // Set user data if access is allowed and not signing out
                if (!isSigningOutRef.current) {
                  const fullUserData: User = {
                    uid: authUser.uid,
                    email: authUser.email || userData.email || '',
                    role: userData.role || 'tourist',
                    status: userData.status,
                    isActive: userData.isActive !== false, // Default to true
                    name: userData.name,
                    avatar: userData.avatar,
                    bio: userData.bio,
                    userStatus: userData.userStatus || {
                      deviceId: '',
                      isOnline: false,
                      lastActivity: null,
                      lastSeen: null,
                      sessionId: '',
                      status: 'offline',
                      updatedAt: null,
                    },
                    translateCode: userData.translateCode || 'en-US',
                    language: userData.language || 'en',
                    fcmToken: userData.fcmToken || '',
                    lastActive: userData.lastActive || '',
                    createdAt: userData.createdAt
                      ? userData.createdAt.toDate().toISOString()
                      : new Date().toISOString(),
                    updatedAt: userData.updatedAt
                      ? userData.updatedAt.toDate().toISOString()
                      : new Date().toISOString(),
                  };

                  setUser(fullUserData);
                  setRole(userData.role || 'tourist');
                  setLoading(false);
                }
              } catch (error) {
                console.error('Error processing user data:', error);
                if (!isSigningOutRef.current) {
                  setLoading(false);
                }
              }
            },
            error => {
              console.error('Error listening to user document:', error);
              if (!isSigningOutRef.current) {
                setLoading(false);
              }
            },
          );

        // Store the unsubscribe function
        unsubscribeDocRef.current = unsubscribeDoc;
      } else {
        // User is not authenticated or signing out
        cleanupDocListener();
        setUser(null);
        setRole(null);
        setLoading(false);
      }
    });

    return () => {
      console.log('Cleaning up auth listener');
      unsubscribeAuth();
      cleanupDocListener();
    };
  }, [t]); // Add t as dependency

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      isSigningOutRef.current = false; // Reset signout flag
      await auth().signInWithEmailAndPassword(email, password);
      // User data will be handled by the onAuthStateChanged listener
    } catch (error: any) {
      setLoading(false);
      // Let the calling component handle the error with proper translation
      throw error;
    }
  };

  const signUp = async (
    email: string,
    password: string,
    role: Role,
    name?: string,
  ) => {
    try {
      setLoading(true);
      isSigningOutRef.current = false; // Reset signout flag
      const userCredential = await auth().createUserWithEmailAndPassword(
        email,
        password,
      );

      const userData = {
        email,
        role,
        name: name || '',
        createdAt: firestore.FieldValue.serverTimestamp(),
        updatedAt: firestore.FieldValue.serverTimestamp(),
        isActive: true,
        // Set initial status for tour guides
        ...(role === 'tour_guide' && {status: 'pending'}),
      };

      await firestore()
        .collection('users')
        .doc(userCredential.user.uid)
        .set(userData, {merge: true});

      // For tour guides, show immediate feedback and sign them out
      if (role === 'tour_guide') {
        Alert.alert(
          t('auth.accountCreated'),
          t('auth.tourGuideAccountCreatedMessage'),
          [
            {
              text: t('common.ok'),
              onPress: async () => {
                await signOut();
              },
            },
          ],
        );
      }
      // For tourists, they remain logged in and the AuthContext will handle the flow
    } catch (error: any) {
      setLoading(false);
      // Let the calling component handle the error with proper translation
      throw error;
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting signout process');
      isSigningOutRef.current = true; // Set signout flag

      // Get current user before signing out
      const currentUser = auth().currentUser;

      if (currentUser) {
        try {
          // Update last active time (but ignore errors if user is already signed out)
          // await firestore().collection('users').doc(currentUser.uid).update({
          //   lastActive: firestore.FieldValue.serverTimestamp(),
          //   fcmToken: firestore.FieldValue.delete(),
          // });
          // Use FCM service to remove token
          await fcmService.removeToken(currentUser.uid);
        } catch (updateError) {
          console.log(
            'Could not update user data on signout (user may already be signed out):',
            updateError,
          );
        }
      }

      // Clean up document listener before signing out
      cleanupDocListener();

      // Clear state immediately
      setUser(null);
      setRole(null);
      setLoading(false);
      fcmService.cleanup();

      // Sign out from Firebase Auth
      await auth().signOut();

      console.log('Signout completed successfully');
    } catch (error: any) {
      console.error('Error signing out:', error);

      // Even if there's an error, clean up the state
      isSigningOutRef.current = false;
      cleanupDocListener();
      setUser(null);
      setRole(null);
      setLoading(false);

      // Only throw error if it's not "no current user" (which is expected in some cases)
      if (error.code !== 'auth/no-current-user') {
        throw error;
      }
    } finally {
      // Reset the signout flag after a delay to ensure all listeners have been cleaned up
      setTimeout(() => {
        isSigningOutRef.current = false;
      }, 1000);
    }
  };

  return (
    <AuthContext.Provider
      value={{user, role, loading, signIn, signUp, signOut}}>
      {children}
    </AuthContext.Provider>
  );
};

// Main AuthProvider wrapper
export const AuthProvider = ({children}: {children: React.ReactNode}) => {
  return <AuthProviderInternal>{children}</AuthProviderInternal>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
