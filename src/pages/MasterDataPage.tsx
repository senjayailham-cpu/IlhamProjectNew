import React from 'react';
import MasterDataView from '../components/MasterDataView';
import { User } from '../types';

interface MasterDataPageProps {
  currentUser: User | null;
}

export function MasterDataPage({ currentUser }: MasterDataPageProps) {
  if (!currentUser) return null;
  return <MasterDataView currentUser={currentUser} />;
}

export default MasterDataPage;
