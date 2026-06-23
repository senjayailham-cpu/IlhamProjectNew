import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { DEFAULT_USERS } from '../mockData';
import { db, auth, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from '../services/firebase';
import { onAuthStateChanged, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { sha256 } from '../utils/helpers';
import firebaseConfig from '../../firebase-applet-config.json';

interface AuthContextType {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  fbUser: any;
  setFbUser: React.Dispatch<React.SetStateAction<any>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  loginId: string;
  setLoginId: (id: string) => void;
  loginPass: string;
  setLoginPass: (pass: string) => void;
  loginError: string;
  setLoginError: (err: string) => void;
  logoutConfirmOpen: boolean;
  setLogoutConfirmOpen: (open: boolean) => void;
  changePasswordModalOpen: boolean;
  setChangePasswordModalOpen: (open: boolean) => void;
  currentPasswordInput: string;
  setCurrentPasswordInput: (pass: string) => void;
  newPasswordInput: string;
  setNewPasswordInput: (pass: string) => void;
  confirmPasswordInput: string;
  setConfirmPasswordInput: (pass: string) => void;
  changePasswordError: string;
  setChangePasswordError: (err: string) => void;
  changePasswordSuccess: string;
  setChangePasswordSuccess: (success: string) => void;
  handleLoginSubmit: (e: React.FormEvent) => Promise<void>;
  handleLogout: () => void;
  executeLogout: () => Promise<void>;
  handleChangePasswordSubmit: (e: React.FormEvent, logActivity: any) => Promise<void>;
  isAuthLoading: boolean;
  setIsAuthLoading: React.Dispatch<React.SetStateAction<boolean>>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [fbUser, setFbUser] = useState<any>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loginId, setLoginId] = useState<string>('');
  const [loginPass, setLoginPass] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState<boolean>(false);
  const [changePasswordModalOpen, setChangePasswordModalOpen] = useState<boolean>(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState<string>('');
  const [newPasswordInput, setNewPasswordInput] = useState<string>('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState<string>('');
  const [changePasswordError, setChangePasswordError] = useState<string>('');
  const [changePasswordSuccess, setChangePasswordSuccess] = useState<string>('');
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);

  // Parse session on mount
  useEffect(() => {
    const initializeSessionAndUsers = async () => {
      const sess = sessionStorage.getItem('w2proj_session_v1');
      if (sess) {
        const parsed = JSON.parse(sess);
        if (!(parsed.id.startsWith('google-') || parsed.id.length > 20)) {
          setCurrentUser(parsed);
        }
      }

      let loadedUsers = localStorage.getItem('w2proj_users_v1');
      const defaults = await DEFAULT_USERS();
      if (!loadedUsers) {
        localStorage.setItem('w2proj_users_v1', JSON.stringify(defaults));
        setUsers(defaults);
      } else {
        const parsedUsers = JSON.parse(loadedUsers);
        let updated = false;
        for (const defU of defaults) {
          if (!parsedUsers.some((u: any) => u.id === defU.id)) {
            parsedUsers.push(defU);
            updated = true;
          }
        }
        if (updated) {
          localStorage.setItem('w2proj_users_v1', JSON.stringify(parsedUsers));
        }
        setUsers(parsedUsers);
      }
    };

    initializeSessionAndUsers();
  }, []);

  // Listen for Firebase Auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setFbUser(firebaseUser || null);

      if (firebaseUser?.isAnonymous) {
        const sess = sessionStorage.getItem('w2proj_session_v1');
        if (sess) {
          setCurrentUser(JSON.parse(sess));
        } else {
          setCurrentUser(null);
        }
        return;
      }

      if (firebaseUser) {
        try {
          const emailPrefix = firebaseUser.email ? firebaseUser.email.split('@')[0].toLowerCase() : '';
          const isAppletEmailDomain = firebaseUser.email ? (firebaseUser.email.endsWith('@austinbatam.xyz') || firebaseUser.email.includes('.austinbatam.xyz')) : false;
          const isDev = firebaseUser.email === 'senjayailham@gmail.com' ||
            firebaseUser.uid === 'psToBehuTudgpMsgg5xT3h63H6C3' ||
            (isAppletEmailDomain && ['ilhamsenjaya', 'irwanr', 'admin'].includes(emailPrefix));
          const portalId = (firebaseUser.email && isAppletEmailDomain)
            ? emailPrefix
            : firebaseUser.uid;

          const docRef = doc(db, 'users', portalId);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const data = docSnap.data();
            const session: User = {
              id: portalId,
              name: data.name || firebaseUser.displayName || portalId || 'Team User',
              role: isDev ? 'admin' : (data.role || 'coordinator'),
              allowedFeatures: data.allowedFeatures || [],
              allowedPermissions: data.allowedPermissions || {}
            };
            setCurrentUser(session);
            sessionStorage.setItem('w2proj_session_v1', JSON.stringify(session));
            setLoginError('');
          } else {
            const defaultRole = isDev ? 'admin' : 'coordinator';
            const defaultName = firebaseUser.displayName || (isDev ? 'Senjaya Ilham' : portalId || 'Team Member');
            
            const session: User = {
              id: portalId,
              name: defaultName,
              role: defaultRole,
              allowedFeatures: [],
              allowedPermissions: {}
            };
            
            await setDoc(docRef, session);
            setCurrentUser(session);
            sessionStorage.setItem('w2proj_session_v1', JSON.stringify(session));
            setLoginError('');
          }
        } catch (err) {
          console.error("Firestore loading user profile error:", err);
          const emailPrefix = firebaseUser.email ? firebaseUser.email.split('@')[0].toLowerCase() : '';
          const isAppletEmailDomain = firebaseUser.email ? (firebaseUser.email.endsWith('@austinbatam.xyz') || firebaseUser.email.includes('.austinbatam.xyz')) : false;
          const isDev = firebaseUser.email === 'senjayailham@gmail.com' ||
            firebaseUser.uid === 'psToBehuTudgpMsgg5xT3h63H6C3' ||
            (isAppletEmailDomain && ['ilhamsenjaya', 'irwanr', 'admin'].includes(emailPrefix));
          const portalId = (firebaseUser.email && isAppletEmailDomain)
            ? emailPrefix
            : firebaseUser.uid;
          const session: User = {
            id: portalId,
            name: firebaseUser.displayName || portalId || 'Team Member',
            role: isDev ? 'admin' : 'coordinator',
            allowedFeatures: [],
            allowedPermissions: {}
          };
          setCurrentUser(session);
        }
      } else {
        const sess = sessionStorage.getItem('w2proj_session_v1');
        if (sess) {
          setCurrentUser(JSON.parse(sess));
        } else {
          setCurrentUser(null);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    let targetId = loginId.trim().toLowerCase();
    if (targetId.includes('@')) {
      targetId = targetId.split('@')[0];
    }
    if (!targetId || !loginPass) {
      setLoginError('Complete ID and password fields.');
      return;
    }

    let testUser = users.find(u => u.id === targetId);
    let foundDef: User | undefined;

    try {
      const docRef = doc(db, 'users', targetId);
      const dbId = (firebaseConfig && firebaseConfig.firestoreDatabaseId) ? firebaseConfig.firestoreDatabaseId.toLowerCase() : 'default';
      const email = `${targetId}@${dbId}.austinbatam.xyz`;
      const firebasePass = loginPass.length >= 6 ? loginPass : `${loginPass}_austin`;

      if (!testUser) {
        try {
          await signInWithEmailAndPassword(auth, email, firebasePass);
          console.log("Successfully authenticated with Firebase Auth prior to user doc load.");
        } catch (authErr: any) {
          console.warn("Pre-auth login sync check failed (might not be registered yet):", authErr.message);
        }
      }

      let docSnap;
      try {
        docSnap = await getDoc(docRef);
      } catch (getErr) {
        console.warn("Could not get user document directly (likely unauthenticated seed):", getErr);
      }

      const defUsers = await DEFAULT_USERS();
      foundDef = defUsers.find(u => u.id === targetId);

      if ((!docSnap || !docSnap.exists()) && foundDef) {
        console.log(`Self-healing login check: Seeding default user doc "${targetId}" directly to Firestore.`);
        try {
          await setDoc(docRef, foundDef);
          docSnap = await getDoc(docRef);
        } catch (writeErr) {
          console.warn("Could not write missing default user during login (probably unauthenticated):", writeErr);
        }
      }
      if (docSnap && docSnap.exists()) {
        testUser = docSnap.data() as User;
      }
    } catch (err) {
      console.warn("Could not fetch user directly from Firestore, falling back to local list:", err);
    }

    if (!testUser && foundDef) {
      testUser = foundDef;
    }

    if (!testUser) {
      setLoginError('User ID not found or registered.');
      return;
    }

    const hash = await sha256(loginPass);
    if (hash !== testUser.passHash) {
      setLoginError('Incorrect password value entered.');
      return;
    }

    const session: User = { 
      id: testUser.id, 
      name: testUser.name, 
      role: testUser.role,
      allowedFeatures: testUser.allowedFeatures || [],
      allowedPermissions: testUser.allowedPermissions || {}
    };
    setCurrentUser(session);
    sessionStorage.setItem('w2proj_session_v1', JSON.stringify(session));

    const dbId = (firebaseConfig && firebaseConfig.firestoreDatabaseId) ? firebaseConfig.firestoreDatabaseId.toLowerCase() : 'default';
    const email = `${testUser.id.toLowerCase()}@${dbId}.austinbatam.xyz`;
    const firebasePass = loginPass.length >= 6 ? loginPass : `${loginPass}_austin`;
    try {
      await signInWithEmailAndPassword(auth, email, firebasePass);
    } catch (authErr: any) {
      console.warn("Background Firebase Auth login error (auto-healing):", authErr);
      if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, email, firebasePass);
        } catch (regErr) {
          console.warn("Could not register on-the-fly Firebase user:", regErr);
          try {
            await signInAnonymously(auth);
          } catch (anonErr) {
            console.warn("Could not complete backup anonymous login:", anonErr);
          }
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch (anonErr) {
          console.warn("Could not complete backup anonymous login:", anonErr);
        }
      }
    }

    setLoginId('');
    setLoginPass('');
  };

  const handleLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const executeLogout = async () => {
    setLogoutConfirmOpen(false);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (err) {
      console.error("Error signing out:", err);
    }
    setCurrentUser(null);
    sessionStorage.removeItem('w2proj_session_v1');
    setLoginId('');
    setLoginPass('');
  };

  const handleChangePasswordSubmit = async (e: React.FormEvent, logActivity: any) => {
    e.preventDefault();
    setChangePasswordError('');
    setChangePasswordSuccess('');

    if (!currentUser) {
      setChangePasswordError('You must be logged in to change your password.');
      return;
    }

    const oldPass = currentPasswordInput.trim();
    const newPass = newPasswordInput.trim();
    const confirmPass = confirmPasswordInput.trim();

    if (!oldPass || !newPass || !confirmPass) {
      setChangePasswordError('Please fill in all the password fields.');
      return;
    }

    if (newPass !== confirmPass) {
      setChangePasswordError('The new passwords do not match.');
      return;
    }

    if (newPass.length < 4) {
      setChangePasswordError('New password must be at least 4 characters long.');
      return;
    }

    const testUser = users.find(u => u.id === currentUser.id);
    if (!testUser) {
      setChangePasswordError('Unable to locate your user account.');
      return;
    }

    const hashedOld = await sha256(oldPass);
    if (hashedOld !== testUser.passHash) {
      setChangePasswordError('Incorrect current password.');
      return;
    }

    const hashedNew = await sha256(newPass);

    setUsers(prev => prev.map(u => u.id === currentUser.id ? { ...u, passHash: hashedNew } : u));

    if (auth.currentUser) {
      try {
        const firebaseNewPass = newPass.length >= 6 ? newPass : `${newPass}_austin`;
        await updatePassword(auth.currentUser, firebaseNewPass);
        console.log("Firebase Auth password updated successfully in sync.");
      } catch (authErr) {
        console.warn("Could not sync password update to Firebase Auth:", authErr);
      }
    }

    logActivity('user_edit', `Changed own password`, undefined, undefined, undefined, undefined, undefined, undefined, `User ${currentUser.name} updated their sign-in password`);

    setChangePasswordSuccess('Password updated successfully!');
    setCurrentPasswordInput('');
    setNewPasswordInput('');
    setConfirmPasswordInput('');
  };

  const value = {
    currentUser,
    setCurrentUser,
    fbUser,
    setFbUser,
    users,
    setUsers,
    loginId,
    setLoginId,
    loginPass,
    setLoginPass,
    loginError,
    setLoginError,
    logoutConfirmOpen,
    setLogoutConfirmOpen,
    changePasswordModalOpen,
    setChangePasswordModalOpen,
    currentPasswordInput,
    setCurrentPasswordInput,
    newPasswordInput,
    setNewPasswordInput,
    confirmPasswordInput,
    setConfirmPasswordInput,
    changePasswordError,
    setChangePasswordError,
    changePasswordSuccess,
    setChangePasswordSuccess,
    handleLoginSubmit,
    handleLogout,
    executeLogout,
    handleChangePasswordSubmit,
    isAuthLoading,
    setIsAuthLoading,
  };

  return React.createElement(AuthContext.Provider, { value }, children);
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
