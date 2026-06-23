import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let isIndexedDBAvailable = false;
try {
  isIndexedDBAvailable = (
    typeof window !== 'undefined' &&
    'indexedDB' in window &&
    window.indexedDB !== null &&
    typeof window.indexedDB.open === 'function'
  );
} catch (_) {}

let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, {
    ...(isIndexedDBAvailable ? { localCache: persistentLocalCache() } : {}),
    experimentalForceLongPolling: true,
  }, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
} catch (e) {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}


export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword };
