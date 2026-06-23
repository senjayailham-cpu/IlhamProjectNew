import React from 'react';
import { auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const errInfo: FirestoreErrorInfo = {
    error: errorMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  
  const isPermissionMsg = errorMessage.toLowerCase().includes('permission') || 
                          errorMessage.toLowerCase().includes('insufficient') ||
                          errorMessage.toLowerCase().includes('denied');
  const isPermissionCode = error && typeof error === 'object' && ('code' in error) && 
                          ((error as any).code === 'permission-denied' || (error as any).code === 'unauthenticated');

  if (isPermissionMsg || isPermissionCode) {
    console.error('Firestore Permission Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else {
    console.warn(`Firestore Offline/Connection status (${operationType} on ${path}):`, errorMessage);
  }
}

export const uid = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
};

function jsSha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const words: number[] = [];
  const asciiLength = ascii.length * 8;
  
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  words[asciiLength >> 5] |= 0x80 << (24 - (asciiLength % 32));
  words[(((asciiLength + 64) >> 9) << 4) + 15] = asciiLength;

  for (let i = 0; i < ascii.length; i++) {
    words[i >> 2] |= ascii.charCodeAt(i) << (24 - (i % 4) * 8);
  }

  for (let i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    const oldHash = [...hash];

    for (let j = 0; j < 64; j++) {
      if (j >= 16) {
        const w15 = w[j - 15] || 0;
        const w2 = w[j - 2] || 0;
        const w16 = w[j - 16] || 0;
        const w7 = w[j - 7] || 0;
        
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[j] = (w16 + s0 + w7 + s1) | 0;
      }

      const a = hash[0], b = hash[1], c = hash[2], d = hash[3];
      const e = hash[4], f = hash[5], g = hash[6], h = hash[7];

      const s0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const s1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      
      const temp1 = (h + s1 + ch + (k[j] || 0) + (w[j] || 0)) | 0;
      const temp2 = (s0 + maj) | 0;

      hash[7] = hash[6];
      hash[6] = hash[5];
      hash[5] = hash[4];
      hash[4] = (hash[3] + temp1) | 0;
      hash[3] = hash[2];
      hash[2] = hash[1];
      hash[1] = hash[0];
      hash[0] = (temp1 + temp2) | 0;
    }

    for (let j = 0; j < 8; j++) {
      hash[j] = (hash[j] + (oldHash[j] || 0)) | 0;
    }
  }

  let result = '';
  for (let i = 0; i < 8; i++) {
    const word = hash[i] || 0;
    result += ((word >>> 24) & 0xff).toString(16).padStart(2, '0');
    result += ((word >>> 16) & 0xff).toString(16).padStart(2, '0');
    result += ((word >>> 8) & 0xff).toString(16).padStart(2, '0');
    result += (word & 0xff).toString(16).padStart(2, '0');
  }

  return result;
}

export const sha256 = async (str: string): Promise<string> => {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) {
    console.warn("crypto.subtle failed, falling back to pure JS hash:", e);
  }
  return jsSha256(str);
};

export const highlightText = (text: string, search: string): React.ReactElement => {
  if (!search.trim()) return React.createElement('span', null, text);
  const regex = new RegExp(`(${search.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return React.createElement(
    'span',
    null,
    ...parts.map((part, i) => 
      regex.test(part) ? React.createElement(
        'mark',
        { key: i, className: "bg-base-accent/25 text-base-accent font-black rounded px-0.5 select-all inline-block" },
        part
      ) : part
    )
  );
};
