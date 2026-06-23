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

export const sha256 = async (str: string): Promise<string> => {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
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
