import React from 'react';
import WireConsumableView from '../components/WireConsumableView';
import { WireLog, Project, Employee, User } from '../types';

interface WireLogPageProps {
  wireLogs: WireLog[];
  projects: Project[];
  employees: Employee[];
  currentUser: User | null;
  onAddWireLog: (log: Omit<WireLog, 'id'>) => void;
  onEditWireLog: (id: string, updates: Partial<Omit<WireLog, 'id'>>) => void;
  onDeleteWireLog: (id: string) => void;
}

export function WireLogPage({
  wireLogs,
  projects,
  employees,
  currentUser,
  onAddWireLog,
  onEditWireLog,
  onDeleteWireLog
}: WireLogPageProps) {
  return (
    <WireConsumableView
      wireLogs={wireLogs}
      projects={projects}
      employees={employees}
      currentUser={currentUser ? currentUser : undefined}
      onAddWireLog={onAddWireLog}
      onEditWireLog={onEditWireLog}
      onDeleteWireLog={onDeleteWireLog}
    />
  );
}

export default WireLogPage;
