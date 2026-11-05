// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
  measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID || undefined
};

const requiredFirebaseConfig = {
  REACT_APP_FIREBASE_API_KEY: firebaseConfig.apiKey,
  REACT_APP_FIREBASE_AUTH_DOMAIN: firebaseConfig.authDomain,
  REACT_APP_FIREBASE_DATABASE_URL: firebaseConfig.databaseURL,
  REACT_APP_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
  REACT_APP_FIREBASE_STORAGE_BUCKET: firebaseConfig.storageBucket,
  REACT_APP_FIREBASE_MESSAGING_SENDER_ID: firebaseConfig.messagingSenderId,
  REACT_APP_FIREBASE_APP_ID: firebaseConfig.appId
};
const missingFirebaseConfig = Object.entries(requiredFirebaseConfig)
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missingFirebaseConfig.length > 0) {
  throw new Error(`Missing Firebase environment variables: ${missingFirebaseConfig.join(", ")}`);
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Analytics disabled (not used)

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Firestore (used for messages, profiles)
export const db = getFirestore(app);

// Realtime Database (if needed elsewhere)
export const rtdb = getDatabase(app);
