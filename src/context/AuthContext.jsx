import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          setOnboarded(userDoc.exists());
        } catch (err) {
          console.error('Error checking onboarding state:', err);
          setOnboarded(false);
        }
      } else {
        setOnboarded(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setOnboarded(false);
  };

  const value = {
    user,
    loading,
    onboarded,
    signInWithGoogle,
    signOut,
    setOnboarded,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);

export default AuthContext;
