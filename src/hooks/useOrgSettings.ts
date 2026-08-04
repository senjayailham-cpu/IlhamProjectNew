import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { OrgSettings, INDUSTRY_TEMPLATES } from '../types';

export const DEFAULT_ORG_SETTINGS: OrgSettings = {
  id: 'orgSettings',
  ...INDUSTRY_TEMPLATES.fabrication,
  updatedAt: new Date().toISOString(),
};

export function useOrgSettings(enabled: boolean = true) {
  const [orgSettings, setOrgSettings] = useState<OrgSettings>(DEFAULT_ORG_SETTINGS);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [docExists, setDocExists] = useState<boolean>(false);

  useEffect(() => {
    if (!enabled) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const docRef = doc(db, 'system_config', 'orgSettings');

    const unsubscribe = onSnapshot(
      docRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as OrgSettings;
          setOrgSettings({
            ...DEFAULT_ORG_SETTINGS,
            ...data,
            id: 'orgSettings',
            terminology: {
              ...DEFAULT_ORG_SETTINGS.terminology,
              ...(data.terminology || {}),
            },
          });
          setDocExists(true);
        } else {
          setOrgSettings(DEFAULT_ORG_SETTINGS);
          setDocExists(false);
        }
        setIsLoading(false);
      },
      (error) => {
        console.error('Error fetching orgSettings snapshot:', error);
        setOrgSettings(DEFAULT_ORG_SETTINGS);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const saveSettings = useCallback(async (newSettings: Partial<OrgSettings>) => {
    try {
      const docRef = doc(db, 'system_config', 'orgSettings');
      const payload: OrgSettings = {
        ...orgSettings,
        ...newSettings,
        id: 'orgSettings',
        updatedAt: new Date().toISOString(),
      };
      await setDoc(docRef, payload, { merge: true });
    } catch (err) {
      console.error('Failed to save orgSettings:', err);
      throw err;
    }
  }, [orgSettings]);

  const applyTemplate = useCallback(async (templateKey: string) => {
    const template = INDUSTRY_TEMPLATES[templateKey];
    if (!template) return;
    const docRef = doc(db, 'system_config', 'orgSettings');
    const payload: OrgSettings = {
      id: 'orgSettings',
      ...template,
      updatedAt: new Date().toISOString(),
    };
    await setDoc(docRef, payload);
  }, []);

  return {
    orgSettings,
    isLoading,
    docExists,
    saveSettings,
    applyTemplate,
  };
}
