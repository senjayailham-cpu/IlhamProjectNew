import React from 'react';
import WireConsumableView from '../components/WireConsumableView';
import { WireLog, Project, Employee, User } from '../types';

interface WireLogPageProps {
  wireLogs: WireLog[];
  projects: Project[];
  employees: Employee[];
  currentUser: User | null;
  onAddWireLog: (log: Omit<WireLog, 'id'>) => void;
  onDeleteWireLog: (id: string) => void;
}

export function WireLogPage({
  wireLogs,
  projects,
  employees,
  currentUser,
  onAddWireLog,
  onDeleteWireLog
}: WireLogPageProps) {
  return (
    <WireConsumableView
      wireLogs={wireLogs}
      projects={projects}
      employees={employees}
      currentUser={currentUser ? currentUser : undefined}
      onAddWireLog={onAddWireLog}
      onDeleteWireLog={onDeleteWireLog}
    />
  );
}

export default WireLogPage;
