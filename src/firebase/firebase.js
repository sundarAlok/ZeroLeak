// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "[REDACTED]",
  authDomain: "[REDACTED]",
  databaseURL: "[REDACTED]",
  projectId: "[REDACTED]",
  storageBucket: "[REDACTED].firebasestorage.app",
  messagingSenderId: "[REDACTED]",
  appId: "1:[REDACTED]:web:7850829785f1cd84386380",
  measurementId: "[REDACTED]"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
// Analytics disabled (not used)

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Firestore (used for messages, profiles)
export const db = getFirestore(app);

// Realtime Database (if needed elsewhere)
export const rtdb = getDatabase(app);
