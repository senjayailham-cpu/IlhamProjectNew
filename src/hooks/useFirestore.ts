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

  const saveItem = async (colName: string, item: any): Promise<boolean> => {
    try {
      const cleaned = cleanFirestoreData(item);
      await setDoc(doc(db, colName, item.id), cleaned, { merge: true });
      return true;
    } catch (error) {
      console.error(`[Firestore] Failed to save item in ${colName}:`, error);
      return false;
    }
  };

  const removeItem = async (colName: string, id: string): Promise<boolean> => {
    try {
      await deleteDoc(doc(db, colName, id));
      return true;
    } catch (error) {
      console.error(`[Firestore] Failed to remove item ${id} from ${colName}:`, error);
      return false;
    }
  };

  const saveBatch = async (colName: string, items: any[]): Promise<boolean> => {
    try {
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
        await batch.commit();
      }
      return true;
    } catch (error) {
      console.error(`[Firestore] Failed to save batch in ${colName}:`, error);
      return false;
    }
  };

  return {
    cleanFirestoreData,
    saveItem,
    removeItem,
    saveBatch,
  };
}

export default useFirestore;
