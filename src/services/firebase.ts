import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey:              import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:          import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:           import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:        import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId:   import.meta.env.VITE_FIREBASE_MESSAGING_ID,
  appId:               import.meta.env.VITE_FIREBASE_APP_ID,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let firestoreDb;

const isStoragePermitted = () => {
  try {
    if (typeof window === 'undefined') return false;
    localStorage.setItem('__storage_test__', 'test');
    localStorage.removeItem('__storage_test__');
    if (!window.indexedDB) return false;
    return true;
  } catch (e) {
    return false;
  }
};

if (isStoragePermitted()) {
  try {
    firestoreDb = initializeFirestore(app, {
      localCache: persistentLocalCache(),
      experimentalForceLongPolling: true,
    }, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */
  } catch (e) {
    console.warn('initializeFirestore with cache failed, falling back:', e);
    firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
} else {
  console.warn('Storage or IndexedDB access is restricted inside sandbox. Falling back to memory-only Firestore client.');
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

export { signInWithPopup, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously };
