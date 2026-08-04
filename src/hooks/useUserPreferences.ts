import { useCallback, useEffect, useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { User } from '../types';

type Preferences = NonNullable<User['preferences']>;

export function useUserPreferences(currentUser: User | null) {
  const [prefs, setPrefs] = useState<Preferences>({});
  const [loaded, setLoaded] = useState(false);

  const getLocalFallback = useCallback((): Preferences => {
    return {
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
      ...(currentUser?.preferences || {})
    };
  }, [currentUser?.preferences]);

  // Load on mount
  useEffect(() => {
    const localVals = getLocalFallback();

    if (!currentUser) {
      setPrefs(localVals);
      setLoaded(true);
      return;
    }

    // Load from Firestore users collection
    const loadPrefs = async () => {
      // First populate with local fallback
      setPrefs(localVals);

      try {
        const targetId = auth.currentUser?.uid || currentUser.id;
        const userDoc = await getDoc(doc(db, 'users', targetId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.preferences) {
            setPrefs(prev => ({ ...prev, ...data.preferences }));
          }
        }
      } catch (err: any) {
        // Fallback gracefully without throwing unhandled permission errors
        console.warn('Using local preferences fallback');
      } finally {
        setLoaded(true);
      }
    };
    loadPrefs();
  }, [currentUser?.id, getLocalFallback]);

  // Save a preference value
  const setPref = useCallback(async <K extends keyof Preferences>(
    key: K, 
    value: Preferences[K]
  ) => {
    setPrefs(prev => ({ ...prev, [key]: value }));
    
    // Always save to localStorage as local fallback
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

    if (!currentUser) return;

    try {
      const targetId = auth.currentUser?.uid || currentUser.id;
      await updateDoc(doc(db, 'users', targetId), {
        [`preferences.${key}`]: value
      });
    } catch (err) {
      // Ignore permission or offline save errors gracefully
    }
  }, [currentUser?.id]);

  return { prefs, setPref, loaded };
}
