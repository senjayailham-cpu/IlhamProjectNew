import { useState } from 'react';
import { Employee } from '../types';
import { uid } from '../utils';
import { useFirestore } from './useFirestore';

export function useEmployees(
  verifyMarkChanged: () => void,
  setDeleteConfirm: (confirm: any) => void
) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [empModalOpen, setEmpModalOpen] = useState<boolean>(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);

  const [empName, setEmpName] = useState<string>('');
  const [empPosition, setEmpPosition] = useState<string>('');
  const [empLocation, setEmpLocation] = useState<string>('');
  const [empCoordinator, setEmpCoordinator] = useState<string>('');
  const [empNo, setEmpNo] = useState<string>('');
  const [shift, setShift] = useState<string>('DAY SHIFT');
  const [joinDate, setJoinDate] = useState<string>('');
  const [eoc, setEoc] = useState<string>('');
  const [employmentStatus, setEmploymentStatus] = useState<string>('Permanent');

  const { saveItem, removeItem, saveBatch, removeBatch } = useFirestore();

  const openAddEmp = () => {
    setEditingEmpId(null);
    setEmpName('');
    setEmpPosition('');
    setEmpLocation('');
    setEmpCoordinator('');
    setEmpNo('');
    setShift('DAY SHIFT');
    setJoinDate('');
    setEoc('');
    setEmploymentStatus('Permanent');
    setEmpModalOpen(true);
  };

  const openEditEmp = (id: string) => {
    const e = employees.find(x => x.id === id);
    if (!e) return;
    setEditingEmpId(id);
    setEmpName(e.name);
    setEmpPosition(e.position || '');
    setEmpLocation(e.location || '');
    setEmpCoordinator(e.coordinator || '');
    setEmpNo(e.empNo || '');
    setShift(e.shift || 'DAY SHIFT');
    setJoinDate(e.joinDate || '');
    setEoc(e.eoc || '');
    setEmploymentStatus(e.employmentStatus || 'Permanent');
    setEmpModalOpen(true);
  };

  const saveEmployeeForm = () => {
    if (!empName.trim()) return alert('Name required.');
    if (editingEmpId) {
      const existing = employees.find(e => e.id === editingEmpId);
      const updatedEmp = {
        ...existing,
        id: editingEmpId,
        name: empName.trim(),
        position: empPosition.trim(),
        location: empLocation.trim(),
        coordinator: empCoordinator.trim(),
        empNo: empNo.trim(),
        shift: shift,
        joinDate: joinDate,
        eoc: eoc,
        employmentStatus: employmentStatus,
      };
      setEmployees(prev => prev.map(e => {
        if (e.id === editingEmpId) {
          return updatedEmp;
        }
        return e;
      }));
      saveItem('employees', updatedEmp);
    } else {
      const newEmp = {
        id: uid(),
        name: empName.trim(),
        position: empPosition.trim(),
        location: empLocation.trim(),
        coordinator: empCoordinator.trim(),
        empNo: empNo.trim(),
        shift: shift,
        joinDate: joinDate,
        eoc: eoc,
        employmentStatus: employmentStatus,
        isExEmployee: false,
      };
      setEmployees(prev => [...prev, newEmp]);
      saveItem('employees', newEmp);
    }
    setEmpModalOpen(false);
    verifyMarkChanged();
  };

  const removeEmployeeRecord = (id: string) => {
    const emp = employees.find(x => x.id === id);
    if (!emp) return;

    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Personnel Record',
      message: `Are you sure you want to permanently delete the personnel record for "${emp.name}"? This will remove them from the workforce roster.`,
      onConfirm: () => {
        setEmployees(prev => prev.filter(x => x.id !== id));
        removeItem('employees', id);
        verifyMarkChanged();
        setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const importEmployeesExcel = (rows: Omit<Employee, 'id'>[]) => {
    const newItems: Employee[] = [];
    setEmployees(prev => {
      const copy = [...prev];
      rows.forEach(r => {
        if (!copy.some(x => x.name.toLowerCase() === r.name.toLowerCase())) {
          const newItem = { id: uid(), ...r };
          copy.push(newItem);
          newItems.push(newItem);
        }
      });
      return copy;
    });
    if (newItems.length > 0) {
      saveBatch('employees', newItems);
    }
    verifyMarkChanged();
  };

  const clearAllEmployees = () => {
    if (employees.length === 0) return alert('No employees to delete.');
    setDeleteConfirm({
      isOpen: true,
      title: 'Delete All Employees',
      message: `Are you sure you want to permanently delete ALL ${employees.length} employees? This action is irreversible and will wipe out the entire workforce roster.`,
      onConfirm: async () => {
        const ids = employees.map(x => x.id);
        setEmployees([]);
        await removeBatch('employees', ids);
        verifyMarkChanged();
        setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
      }
    });
  };

  return {
    employees,
    setEmployees,
    empModalOpen,
    setEmpModalOpen,
    editingEmpId,
    setEditingEmpId,
    empName,
    setEmpName,
    empPosition,
    setEmpPosition,
    empLocation,
    setEmpLocation,
    empCoordinator,
    setEmpCoordinator,
    empNo,
    setEmpNo,
    shift,
    setShift,
    joinDate,
    setJoinDate,
    eoc,
    setEoc,
    employmentStatus,
    setEmploymentStatus,
    openAddEmp,
    openEditEmp,
    saveEmployeeForm,
    removeEmployeeRecord,
    importEmployeesExcel,
    clearAllEmployees
  };
}
export default useEmployees;
