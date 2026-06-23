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

  const { saveItem, removeItem, saveBatch } = useFirestore();

  const openAddEmp = () => {
    setEditingEmpId(null);
    setEmpName('');
    setEmpPosition('');
    setEmpLocation('');
    setEmpCoordinator('');
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
    setEmpModalOpen(true);
  };

  const saveEmployeeForm = () => {
    if (!empName.trim()) return alert('Name required.');
    if (editingEmpId) {
      const updatedEmp = {
        id: editingEmpId,
        name: empName.trim(),
        position: empPosition.trim(),
        location: empLocation.trim(),
        coordinator: empCoordinator.trim(),
      };
      setEmployees(prev => prev.map(e => {
        if (e.id === editingEmpId) {
          return { ...e, ...updatedEmp };
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
    openAddEmp,
    openEditEmp,
    saveEmployeeForm,
    removeEmployeeRecord,
    importEmployeesExcel
  };
}
export default useEmployees;
