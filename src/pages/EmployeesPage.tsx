import React from 'react';
import EmployeesView from '../components/EmployeesView';
import { Employee, TimesheetEntry, WireLog, UserRoleType } from '../types';

interface EmployeesPageProps {
  employees: Employee[];
  timesheets: TimesheetEntry[];
  wireLogs: WireLog[];
  currentUser: { id: string; name: string; role: UserRoleType } | null;
  openAddEmp: () => void;
  openEditEmp: (id: string) => void;
  removeEmployeeRecord: (id: string) => void;
  importEmployeesExcel: (rows: Omit<Employee, 'id'>[]) => void;
  onMarkExEmployee: (id: string, resignDate: string, resignReason: string) => void;
  onReinstateEmployee: (id: string) => void;
  onClearAllEmployees?: () => void;
}

export function EmployeesPage({
  employees,
  timesheets,
  wireLogs,
  currentUser,
  openAddEmp,
  openEditEmp,
  removeEmployeeRecord,
  importEmployeesExcel,
  onMarkExEmployee,
  onReinstateEmployee,
  onClearAllEmployees
}: EmployeesPageProps) {
  return (
    <EmployeesView
      employees={employees}
      timesheets={timesheets}
      wireLogs={wireLogs}
      currentUser={currentUser}
      openAddEmployee={openAddEmp}
      openEditEmployee={openEditEmp}
      deleteEmployee={removeEmployeeRecord}
      onImportExcel={importEmployeesExcel}
      onMarkExEmployee={onMarkExEmployee}
      onReinstateEmployee={onReinstateEmployee}
      onClearAllEmployees={onClearAllEmployees}
    />
  );
}

export default EmployeesPage;
