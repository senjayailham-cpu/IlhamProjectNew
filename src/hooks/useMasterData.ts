import { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { MasterDataEntry } from '../types';
import { uid } from '../utils';

export function useMasterData(enabled: boolean) {
  const [entries, setEntries] = useState<MasterDataEntry[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('austin_masterdata_cache_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}
    return [];
  });
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    const colRef = collection(db, 'masterData');
    const unsubscribe = onSnapshot(
      colRef,
      (snapshot) => {
        const list: MasterDataEntry[] = [];
        snapshot.forEach((d) => {
          list.push({ id: d.id, ...d.data() } as MasterDataEntry);
        });
        setEntries(list);
        setLoading(false);
        try {
          if (typeof window !== 'undefined' && list.length > 0) {
            localStorage.setItem('austin_masterdata_cache_v1', JSON.stringify(list));
          }
        } catch (e) {}
      },
      (error) => {
        console.warn('Firestore real-time sync notice on masterData:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [enabled]);

  const ensureEntry = async (
    category: MasterDataEntry['category'],
    value: string,
    gaNumber?: string
  ): Promise<void> => {
    if (!value || !value.trim()) return;
    const trimmedValue = value.trim();
    const normalizedValue = trimmedValue.toLowerCase();

    // Optimistically update local entries state immediately
    const existing = entries.find(
      (e) => e.category === category && e.normalizedValue === normalizedValue
    );

    if (existing) {
      const updatedList = entries.map(e =>
        e.id === existing.id
          ? {
              ...e,
              usageCount: (e.usageCount || 0) + 1,
              lastUsedAt: new Date().toISOString(),
              ...(gaNumber && gaNumber.trim() && !e.gaNumber ? { gaNumber: gaNumber.trim().toUpperCase() } : {})
            }
          : e
      );
      setEntries(updatedList);
    } else {
      const tempEntry: MasterDataEntry = {
        id: 'md_' + uid(),
        category,
        value: trimmedValue,
        normalizedValue,
        usageCount: 1,
        createdAt: new Date().toISOString(),
        lastUsedAt: new Date().toISOString(),
        createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'System',
        ...(gaNumber && gaNumber.trim() ? { gaNumber: gaNumber.trim().toUpperCase() } : {})
      };
      setEntries(prev => [...prev, tempEntry]);
    }

    // Only commit to Firestore cloud if user is fully authenticated
    if (!auth.currentUser) {
      return;
    }

    try {
      if (existing) {
        const docRef = doc(db, 'masterData', existing.id);
        const updates: any = {
          usageCount: (existing.usageCount || 0) + 1,
          lastUsedAt: new Date().toISOString(),
        };
        if (gaNumber && gaNumber.trim() && !existing.gaNumber) {
          updates.gaNumber = gaNumber.trim().toUpperCase();
        }
        await updateDoc(docRef, updates);
      } else {
        const id = 'md_' + uid();
        const docRef = doc(db, 'masterData', id);
        const newEntry: MasterDataEntry = {
          id,
          category,
          value: trimmedValue,
          normalizedValue,
          usageCount: 1,
          createdAt: new Date().toISOString(),
          lastUsedAt: new Date().toISOString(),
          createdBy: auth.currentUser?.displayName || auth.currentUser?.email || 'System',
        };
        if (gaNumber && gaNumber.trim()) {
          newEntry.gaNumber = gaNumber.trim().toUpperCase();
        }
        await setDoc(docRef, newEntry);
      }
    } catch (error: any) {
      if (error?.code !== 'permission-denied') {
        console.warn('Notice in ensureEntry Firestore sync:', error);
      }
    }
  };

  const getSuggestions = (category: MasterDataEntry['category'], query: string): MasterDataEntry[] => {
    if (!query || typeof query !== 'string' || !query.trim()) return [];
    const lowerQuery = query.toLowerCase().trim();
    return entries
      .filter((e) => e.category === category && (e.value || '').toLowerCase().includes(lowerQuery))
      .sort((a, b) => {
        if (b.usageCount !== a.usageCount) {
          return b.usageCount - a.usageCount;
        }
        return new Date(b.lastUsedAt).getTime() - new Date(a.lastUsedAt).getTime();
      })
      .slice(0, 8);
  };

  const deleteEntry = async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'masterData', id));
    } catch (error) {
      console.error('Error in deleteEntry:', error);
    }
  };

  const mergeEntries = async (keepId: string, mergeFromIds: string[]): Promise<void> => {
    try {
      const mainEntry = entries.find((e) => e.id === keepId);
      if (!mainEntry) return;

      let totalUsageCount = mainEntry.usageCount || 0;
      let mergedGaNumber = mainEntry.gaNumber;

      for (const id of mergeFromIds) {
        const entry = entries.find((e) => e.id === id);
        if (entry) {
          totalUsageCount += entry.usageCount || 0;
          if (!mergedGaNumber && entry.gaNumber) {
            mergedGaNumber = entry.gaNumber;
          }
        }
      }

      const mainRef = doc(db, 'masterData', keepId);
      await updateDoc(mainRef, {
        usageCount: totalUsageCount,
        lastUsedAt: new Date().toISOString(),
        ...(mergedGaNumber ? { gaNumber: mergedGaNumber } : {}),
      });

      const batch = writeBatch(db);
      for (const id of mergeFromIds) {
        batch.delete(doc(db, 'masterData', id));
      }
      await batch.commit();
    } catch (error) {
      console.error('Error in mergeEntries:', error);
    }
  };

  return {
    entries,
    loading,
    ensureEntry,
    getSuggestions,
    deleteEntry,
    mergeEntries,
  };
}

export default useMasterData;
