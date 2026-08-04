import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { User } from '../types';

type Preferences = NonNullable<User['preferences']>;

export function useUserPreferences(currentUser: User | null) {
  const [prefs, setPrefs] = useState<Preferences>({});
  const [loaded, setLoaded] = useState(false);

  // Load on mount
  useEffect(() => {
    if (!currentUser) {
      // Fallback: read from localStorage for anonymous/local users
      setPrefs({
        sidebarCollapsed: 
          localStorage.getItem('w2proj_sidebar_collapsed') === 'true',
        projectsViewMode: 
          (localStorage.getItem('gantt_projects_viewMode') as any) || 'list',
        projectsFilterTab: 
          localStorage.getItem('projectsFilterTab') || 'current',
        projectsSortBy: 
          (localStorage.getItem('gantt_projects_sortBy') as any) || 'deadline',
        ganttShowSCurve: 
          localStorage.getItem('gantt_showSCurve') === 'true',
        ganttAutoSchedule: 
          localStorage.getItem('gantt_autoSchedule') !== 'false',
        ganttShowResourceLoad: 
          localStorage.getItem('gantt_showResourceLoad') === 'true',
        matProcessingViewMode: 
          localStorage.getItem('matProcessingViewMode') || 'board',
      });
      setLoaded(true);
      return;
    }

    // Load from Firestore users collection
    const loadPrefs = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.id));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setPrefs(data.preferences || {});
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
      } finally {
        setLoaded(true);
      }
    };
    loadPrefs();
  }, [currentUser?.id]);

  // Save a preference value
  const setPref = useCallback(async <K extends keyof Preferences>(
    key: K, 
    value: Preferences[K]
  ) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    
    if (!currentUser) {
      // Fallback localStorage keys for backward compat
      const lsMap: Partial<Record<keyof Preferences, string>> = {
        sidebarCollapsed: 'w2proj_sidebar_collapsed',
        projectsViewMode: 'gantt_projects_viewMode',
        projectsFilterTab: 'projectsFilterTab',
        projectsSortBy: 'gantt_projects_sortBy',
        ganttShowSCurve: 'gantt_showSCurve',
        ganttAutoSchedule: 'gantt_autoSchedule',
        ganttShowResourceLoad: 'gantt_showResourceLoad',
        matProcessingViewMode: 'matProcessingViewMode',
      };
      const lsKey = lsMap[key];
      if (lsKey) localStorage.setItem(lsKey, String(value));
      return;
    }

    try {
      await updateDoc(doc(db, 'users', currentUser.id), {
        [`preferences.${key}`]: value
      });
    } catch (err) {
      console.error('Failed to save preference:', err);
    }
  }, [currentUser?.id]);

  return { prefs, setPref, loaded };
}
