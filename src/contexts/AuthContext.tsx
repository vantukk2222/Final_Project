import React, { createContext, useContext, useEffect, useState } from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

type Role = 'tour_guide' | 'tourist' | null;

interface AuthContextType {
  user: any;
  role: Role;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: Role) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);
 
  
  useEffect(() => {
    const unsubscribeAuth = auth().onAuthStateChanged((authUser) => {
      setUser(authUser);
      setLoading(false);

      if (authUser) {
        const unsubscribeDoc = firestore()
          .collection('users')
          .doc(authUser.uid)
          .onSnapshot(doc => {
            const data = doc.data();
            setRole(data?.role ?? null);

            setUser({
              uid: authUser.uid,
              ...data
            })
          });

        return unsubscribeDoc;
      } else {
        setRole(null);
      }
    });

    return unsubscribeAuth;
  }, []);

  const signIn = async (email: string, password: string) => {
    await auth().signInWithEmailAndPassword(email, password);
  };

  const signUp = async (email: string, password: string, role: Role) => {
    const userCredential = await auth().createUserWithEmailAndPassword(email, password);
    await firestore().collection('users').doc(userCredential.user.uid).set({
      email,
      role,
      createdAt: firestore.FieldValue.serverTimestamp(),
    });
  };

  const signOut = async () => {
    await auth().signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
