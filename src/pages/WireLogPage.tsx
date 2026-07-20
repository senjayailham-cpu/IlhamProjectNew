import React from 'react';
import ConsumableView from '../components/ConsumableView';
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
  onDeleteWireLog
}: Omit<WireLogPageProps, 'onAddWireLog'>) {
  return (
    <ConsumableView
      wireLogs={wireLogs}
      consumptionLogs={[]}
      materials={[]}
      projects={projects}
      employees={employees}
      currentUser={currentUser || { id: 'dummy', name: 'Dummy', role: 'viewer' }}
      onDeleteWireLog={onDeleteWireLog}
    />
  );
}

export default WireLogPage;
