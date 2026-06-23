import React from 'react';
import InspectionView from '../components/InspectionView';
import { InspectionRequest, Project, User } from '../types';

interface InspectionsPageProps {
  inspections: InspectionRequest[];
  projects: Project[];
  currentUser: User | null;
  onAddInspection: (ins: Omit<InspectionRequest, 'id' | 'rfiNo'>) => void;
  onUpdateInspectionStatus: (
    id: string,
    status: InspectionRequest['status'],
    comments?: string,
    assignedInspector?: string,
    punchList?: string
  ) => void;
  onDeleteInspection: (id: string) => void;
}

export function InspectionsPage({
  inspections,
  projects,
  currentUser,
  onAddInspection,
  onUpdateInspectionStatus,
  onDeleteInspection
}: InspectionsPageProps) {
  return (
    <InspectionView
      inspections={inspections}
      projects={projects}
      currentUser={currentUser}
      onAddInspection={onAddInspection}
      onUpdateInspectionStatus={onUpdateInspectionStatus}
      onDeleteInspection={onDeleteInspection}
    />
  );
}

export default InspectionsPage;
