import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import localConfig from '../firebase-applet-config.json';

// Support VITE_ environment variables first (ideal for Google Cloud/GitHub deploys with secret gating)
// If not specified, fall back to the AI Studio development configuration file.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || localConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || localConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || localConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || localConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || localConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || localConfig.firestoreDatabaseId || "(default)"
};

const app = initializeApp(firebaseConfig);

// If the database ID is "(default)", use the default Firestore instance. Otherwise, use the custom database ID.
export const db = getFirestore(
  app, 
  firebaseConfig.firestoreDatabaseId === "(default)" || !firebaseConfig.firestoreDatabaseId
    ? undefined 
    : firebaseConfig.firestoreDatabaseId
);

export const auth = getAuth();
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut };
