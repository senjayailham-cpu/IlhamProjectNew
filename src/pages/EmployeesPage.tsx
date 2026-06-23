import React from 'react';
import EmployeesView from '../components/EmployeesView';
import { Employee } from '../types';

interface EmployeesPageProps {
  employees: Employee[];
  openAddEmp: () => void;
  openEditEmp: (id: string) => void;
  removeEmployeeRecord: (id: string) => void;
  importEmployeesExcel: (rows: Omit<Employee, 'id'>[]) => void;
}

export function EmployeesPage({
  employees,
  openAddEmp,
  openEditEmp,
  removeEmployeeRecord,
  importEmployeesExcel
}: EmployeesPageProps) {
  return (
    <EmployeesView
      employees={employees}
      openAddEmployee={openAddEmp}
      openEditEmployee={openEditEmp}
      deleteEmployee={removeEmployeeRecord}
      onImportExcel={importEmployeesExcel}
    />
  );
}

export default EmployeesPage;
