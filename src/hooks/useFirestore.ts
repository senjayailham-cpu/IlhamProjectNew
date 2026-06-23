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

  const saveItem = async (colName: string, item: any) => {
    const cleaned = cleanFirestoreData(item);
    await setDoc(doc(db, colName, item.id), cleaned, { merge: true });
  };

  const removeItem = async (colName: string, id: string) => {
    await deleteDoc(doc(db, colName, id));
  };

  const saveBatch = async (colName: string, items: any[]) => {
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
  };

  return {
    cleanFirestoreData,
    saveItem,
    removeItem,
    saveBatch,
  };
}

export default useFirestore;
