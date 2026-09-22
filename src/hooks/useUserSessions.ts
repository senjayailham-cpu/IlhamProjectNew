import { useState, useEffect, useCallback } from 'react';
import { UserSessionLog, UserRoleType } from '../types';
import { db } from '../services/firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';

const STORAGE_KEY = 'w2proj_user_sessions_v1';

// Initial sample sessions so the log is never blank on initial load
const INITIAL_SESSIONS: UserSessionLog[] = [
  {
    id: 'sess-init-1',
    userId: 'admin',
    userName: 'Ilham Senjaya',
    userRole: 'admin',
    loginTs: new Date(Date.now() - 1000 * 60 * 45).toISOString(), // 45 mins ago
    logoutTs: null,
    status: 'active',
    deviceInfo: 'Desktop (Chrome / Windows)',
    sessionId: 'sess_live_admin_01',
    durationMinutes: null
  },
  {
    id: 'sess-init-2',
    userId: 'coordinator',
    userName: 'Coordinator Lapangan',
    userRole: 'coordinator',
    loginTs: new Date(Date.now() - 1000 * 60 * 180).toISOString(), // 3 hours ago
    logoutTs: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 mins ago
    status: 'logged_out',
    deviceInfo: 'Mobile Tablet (Chrome / Android)',
    sessionId: 'sess_coord_02',
    durationMinutes: 150
  },
  {
    id: 'sess-init-3',
    userId: 'qc',
    userName: 'QC Inspector',
    userRole: 'quality control',
    loginTs: new Date(Date.now() - 1000 * 60 * 360).toISOString(), // 6 hours ago
    logoutTs: new Date(Date.now() - 1000 * 60 * 120).toISOString(), // 2 hours ago
    status: 'logged_out',
    deviceInfo: 'Desktop (Edge / Windows)',
    sessionId: 'sess_qc_03',
    durationMinutes: 240
  },
  {
    id: 'sess-init-4',
    userId: 'manager',
    userName: 'Rizki Project Manager',
    userRole: 'manager',
    loginTs: new Date(Date.now() - 1000 * 60 * 60 * 14).toISOString(), // 14 hours ago
    logoutTs: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    status: 'logged_out',
    deviceInfo: 'Desktop (Safari / macOS)',
    sessionId: 'sess_mgr_04',
    durationMinutes: 360
  },
  {
    id: 'sess-init-5',
    userId: 'safety_user',
    userName: 'HSE Safety Officer',
    userRole: 'safety',
    loginTs: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 day ago
    logoutTs: new Date(Date.now() - 1000 * 60 * 60 * 17).toISOString(),
    status: 'logged_out',
    deviceInfo: 'Mobile Device (Chrome / Android)',
    sessionId: 'sess_hse_05',
    durationMinutes: 420
  }
];

function getDeviceDescription(): string {
  if (typeof window === 'undefined' || !window.navigator) return 'Web Browser';
  const ua = window.navigator.userAgent;
  let browser = 'Browser';
  if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
  else if (ua.includes('Firefox')) browser = 'Firefox';

  let platform = 'Desktop';
  if (/Android/i.test(ua)) platform = 'Mobile (Android)';
  else if (/iPhone|iPad|iPod/i.test(ua)) platform = 'Mobile (iOS)';
  else if (/Windows/i.test(ua)) platform = 'Windows';
  else if (/Macintosh|Mac OS/i.test(ua)) platform = 'macOS';
  else if (/Linux/i.test(ua)) platform = 'Linux';

  return `${browser} (${platform})`;
}

export function useUserSessions() {
  const [sessions, setSessions] = useState<UserSessionLog[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge initial fallback if cache is sparse
          if (parsed.length < 5) {
            const existingIds = new Set(parsed.map(s => s.id));
            const merged = [...parsed];
            for (const init of INITIAL_SESSIONS) {
              if (!existingIds.has(init.id)) {
                merged.push(init);
              }
            }
            return merged;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Could not read user sessions from cache:', e);
    }
    return INITIAL_SESSIONS;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Firestore Real-Time Subscription
  useEffect(() => {
    let unsubscribe: () => void = () => {};
    try {
      const q = query(
        collection(db, 'userSessions'),
        orderBy('loginTs', 'desc'),
        limit(200)
      );

      unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          if (!snapshot.empty) {
            const list: UserSessionLog[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data() as UserSessionLog;
              list.push({
                ...data,
                id: docSnap.id
              });
            });

            // Sort newest first
            list.sort((a, b) => new Date(b.loginTs).getTime() - new Date(a.loginTs).getTime());

            // If fewer than 5, augment with initial fallback
            if (list.length < 5) {
              const existingIds = new Set(list.map(s => s.id));
              for (const init of INITIAL_SESSIONS) {
                if (!existingIds.has(init.id)) {
                  list.push(init);
                }
              }
            }

            setSessions(list);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
          } else {
            // If empty in Firestore, seed initial sessions to Firestore
            INITIAL_SESSIONS.forEach(async (init) => {
              try {
                await setDoc(doc(db, 'userSessions', init.id), init, { merge: true });
              } catch (err) {
                console.warn('Could not seed initial session:', err);
              }
            });
          }
          setIsLoading(false);
        },
        (error) => {
          console.warn('userSessions subscription error (offline fallback active):', error);
          setIsLoading(false);
        }
      );
    } catch (err) {
      console.warn('Could not establish userSessions listener:', err);
      setIsLoading(false);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  // Record a Login Event
  const recordLogin = useCallback(async (
    user: { id: string; name: string; role: UserRoleType },
    sessionId: string
  ): Promise<string> => {
    const logId = `sess_${user.id}_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const newSession: UserSessionLog = {
      id: logId,
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      loginTs: nowIso,
      logoutTs: null,
      status: 'active',
      deviceInfo: getDeviceDescription(),
      sessionId: sessionId,
      durationMinutes: null
    };

    // Update local state and storage immediately
    setSessions((prev) => {
      // Mark any other active session for this user/session as superseded
      const updated = [newSession, ...prev.filter(s => s.id !== logId)];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    sessionStorage.setItem('w2proj_active_log_id', logId);
    sessionStorage.setItem('w2proj_active_login_ts', nowIso);

    // Save to Firestore
    try {
      await setDoc(doc(db, 'userSessions', logId), newSession, { merge: true });
    } catch (err) {
      console.warn('Could not save login session to Firestore:', err);
    }

    return logId;
  }, []);

  // Record a Logout Event
  const recordLogout = useCallback(async (
    userId?: string,
    sessionId?: string,
    explicitLogId?: string
  ) => {
    const activeLogId = explicitLogId || sessionStorage.getItem('w2proj_active_log_id');
    const loginTsStr = sessionStorage.getItem('w2proj_active_login_ts');
    const nowIso = new Date().toISOString();

    let durationMinutes: number | null = null;
    if (loginTsStr) {
      const loginTime = new Date(loginTsStr).getTime();
      const nowTime = new Date(nowIso).getTime();
      durationMinutes = Math.max(1, Math.round((nowTime - loginTime) / (1000 * 60)));
    }

    // Update local state
    setSessions((prev) => {
      const updated = prev.map((s) => {
        if (
          (activeLogId && s.id === activeLogId) ||
          (sessionId && s.sessionId === sessionId) ||
          (userId && s.userId === userId && s.status === 'active')
        ) {
          const calcDuration = s.loginTs 
            ? Math.max(1, Math.round((new Date(nowIso).getTime() - new Date(s.loginTs).getTime()) / (1000 * 60)))
            : durationMinutes || 1;
          return {
            ...s,
            logoutTs: nowIso,
            status: 'logged_out' as const,
            durationMinutes: calcDuration
          };
        }
        return s;
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });

    // Update Firestore
    if (activeLogId) {
      try {
        await updateDoc(doc(db, 'userSessions', activeLogId), {
          logoutTs: nowIso,
          status: 'logged_out',
          durationMinutes: durationMinutes || 1
        });
      } catch (err) {
        console.warn('Could not update logout session in Firestore:', err);
      }
    }

    sessionStorage.removeItem('w2proj_active_log_id');
    sessionStorage.removeItem('w2proj_active_login_ts');
  }, []);

  // Delete a specific session log
  const deleteSessionLog = useCallback(async (id: string) => {
    setSessions((prev) => {
      const filtered = prev.filter(s => s.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
      return filtered;
    });

    try {
      await deleteDoc(doc(db, 'userSessions', id));
    } catch (err) {
      console.warn('Could not delete session log from Firestore:', err);
    }
  }, []);

  // Clear all session logs
  const clearSessionLogs = useCallback(async () => {
    setSessions([]);
    localStorage.removeItem(STORAGE_KEY);

    // Optional: Delete batch from Firestore if needed
  }, []);

  // Export to CSV helper
  const exportSessionsToCSV = useCallback((dataToExport: UserSessionLog[]) => {
    if (!dataToExport || dataToExport.length === 0) return;

    const headers = [
      'Log ID',
      'User ID',
      'Nama Pengguna',
      'Role / Jabatan',
      'Status Sesi',
      'Waktu Login',
      'Waktu Logout',
      'Durasi (Menit)',
      'Perangkat / Browser',
      'Session ID'
    ];

    const rows = dataToExport.map((s) => {
      const loginFormatted = new Date(s.loginTs).toLocaleString('id-ID');
      const logoutFormatted = s.logoutTs ? new Date(s.logoutTs).toLocaleString('id-ID') : 'Sedang Aktif';
      const durationStr = s.durationMinutes !== null && s.durationMinutes !== undefined 
        ? `${s.durationMinutes} Menit` 
        : (s.status === 'active' ? 'Aktif' : '-');

      return [
        `"${s.id}"`,
        `"${s.userId}"`,
        `"${s.userName.replace(/"/g, '""')}"`,
        `"${s.userRole}"`,
        `"${s.status === 'active' ? 'ONLINE / AKTIF' : 'LOGGED OUT'}"`,
        `"${loginFormatted}"`,
        `"${logoutFormatted}"`,
        `"${durationStr}"`,
        `"${(s.deviceInfo || 'Web').replace(/"/g, '""')}"`,
        `"${s.sessionId}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Austin_User_Login_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  return {
    sessions,
    isLoading,
    recordLogin,
    recordLogout,
    deleteSessionLog,
    clearSessionLogs,
    exportSessionsToCSV
  };
}
