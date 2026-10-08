import { db } from '../services/firebase';
import { doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';

export function useFirestore() {
  const cleanFirestoreData = (obj: any): any => {
    if (obj === null || typeof obj !== 'object') {
      return obj === undefined ? null : obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(cleanFirestoreData);
    }
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value !== undefined) {
        cleaned[key] = cleanFirestoreData(value);
      }
    }
    return cleaned;
  };

  const updateLocalCache = (colName: string, item: any, isDelete = false) => {
    if (typeof window === 'undefined') return;
    try {
      const cacheKeyMap: Record<string, string> = {
        projects: 'austin_projects_cache_v1',
        employees: 'austin_employees_cache_v1',
        timesheets: 'austin_timesheets_cache_v1',
        materials: 'austin_materials_cache_v1',
      };
      const cacheKey = cacheKeyMap[colName];
      if (!cacheKey) return;

      const raw = localStorage.getItem(cacheKey);
      let list = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(list)) list = [];

      if (isDelete) {
        list = list.filter((x: any) => x.id !== item.id);
      } else {
        const idx = list.findIndex((x: any) => x.id === item.id);
        if (idx >= 0) {
          list[idx] = { ...list[idx], ...item };
        } else {
          list.push(item);
        }
      }
      localStorage.setItem(cacheKey, JSON.stringify(list));
    } catch (e) {
      console.warn(`Local cache update skipped for ${colName}:`, e);
    }
  };

  const saveItem = async (colName: string, item: any) => {
    const cleaned = cleanFirestoreData(item);
    // Instant local disk update first (0ms persistence before network)
    updateLocalCache(colName, cleaned, false);

    try {
      await setDoc(doc(db, colName, item.id), cleaned, { merge: true });
    } catch (err) {
      console.warn(`Firestore saveItem deferred/warning on ${colName}/${item.id}:`, err);
    }
  };

  const removeItem = async (colName: string, id: string) => {
    updateLocalCache(colName, { id }, true);
    try {
      await deleteDoc(doc(db, colName, id));
    } catch (err) {
      console.warn(`Firestore removeItem warning on ${colName}/${id}:`, err);
    }
  };

  const saveBatch = async (colName: string, items: any[]) => {
    // Instant local cache updates for all items
    items.forEach(item => updateLocalCache(colName, cleanFirestoreData(item), false));

    const chunks: any[][] = [];
    for (let i = 0; i < items.length; i += 500) {
      chunks.push(items.slice(i, i + 500));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const item of chunk) {
        const cleaned = cleanFirestoreData(item);
        batch.set(doc(db, colName, item.id), cleaned, { merge: true });
      }
      try {
        await batch.commit();
      } catch (err) {
        console.warn(`Firestore saveBatch error on ${colName}:`, err);
      }
    }
  };

  const removeBatch = async (colName: string, ids: string[]) => {
    ids.forEach(id => updateLocalCache(colName, { id }, true));

    const chunks: string[][] = [];
    for (let i = 0; i < ids.length; i += 500) {
      chunks.push(ids.slice(i, i + 500));
    }
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      for (const id of chunk) {
        batch.delete(doc(db, colName, id));
      }
      try {
        await batch.commit();
      } catch (err) {
        console.warn(`Firestore removeBatch error on ${colName}:`, err);
      }
    }
  };

  return {
    cleanFirestoreData,
    saveItem,
    removeItem,
    saveBatch,
    removeBatch,
  };
}

export default useFirestore;
