import { db } from '../services/firebase';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc } from 'firebase/firestore';

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

  const syncList = async (colName: string, items: any[]) => {
    const writePromises = items.map((item) => {
      const cleaned = cleanFirestoreData(item);
      return setDoc(doc(db, colName, item.id), cleaned);
    });
    await Promise.all(writePromises);

    const qSnap = await getDocs(collection(db, colName));
    const currentIds = new Set(items.map((i) => i.id));
    const deletePromises: Promise<void>[] = [];

    qSnap.forEach((docSnapshot) => {
      if (!currentIds.has(docSnapshot.id)) {
        deletePromises.push(deleteDoc(docSnapshot.ref));
      }
    });

    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
    }
  };

  return {
    cleanFirestoreData,
    syncList,
  };
}
export default useFirestore;
