import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, db } from '../firebase/firebase';
import { GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  storeUserCredentials, 
  storeUserProfile,
  clearAuthData 
} from '../utils/storageManager';
import { getPublicProfile } from '../firebase/publicProfile';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      setUser(u);
      if (u) {
        // User is authenticated - store credentials and fetch profile
        storeUserCredentials(u);
        
        try {
          const userDoc = await getDoc(doc(db, 'users', u.uid));
          if (userDoc.exists()) {
            setOnboarded(true);
            // Store user profile data
            const profile = userDoc.data();
            storeUserProfile(u.uid, profile);
            try {
              await setDoc(doc(db, 'publicProfiles', u.uid), getPublicProfile(u.uid, profile));
            } catch (err) {
              console.error('Error migrating public profile:', err);
            }
          } else {
            setOnboarded(false);
          }
        } catch (err) {
          console.error('Error checking onboarding state:', err);
          setOnboarded(false);
        }
      } else {
        // User is logged out
        setOnboarded(false);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    // Credentials are stored automatically via onAuthStateChanged
    return result;
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setOnboarded(false);
    clearAuthData();
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
