import { useState } from 'react';
import { TimesheetEntry } from '../types';
import { uid } from '../utils';
import { useFirestore } from './useFirestore';

export function useTimesheets(
  verifyMarkChanged: () => void,
  setDeleteConfirm: (confirm: any) => void
) {
  const [timesheets, setTimesheets] = useState<TimesheetEntry[]>([]);
  const [timesheetDate, setTimesheetDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [timesheetModalOpen, setTimesheetModalOpen] = useState<boolean>(false);
  const [editingTsId, setEditingTsId] = useState<string | null>(null);

  const { saveItem, removeItem, saveBatch } = useFirestore();

  const openTimesheetBulkAdd = () => {
    setEditingTsId(null);
    setTimesheetModalOpen(true);
  };

  const openTimesheetEditForm = (id: string) => {
    setEditingTsId(id);
    setTimesheetModalOpen(true);
  };

  const saveTimesheetsBulkImport = (rawLogs: any[]) => {
    const writtenItems: TimesheetEntry[] = [];
    setTimesheets(prev => {
      const copy = [...prev];
      rawLogs.forEach(rl => {
        if (editingTsId) {
          const idx = copy.findIndex(x => x.id === editingTsId && x.empId === rl.empId);
          if (idx > -1) {
            const updated = { ...copy[idx], ...rl };
            copy[idx] = updated;
            writtenItems.push(updated);
          } else {
            const newItem = { id: uid(), date: timesheetDate, ...rl };
            copy.push(newItem);
            writtenItems.push(newItem);
          }
        } else {
          const idx = copy.findIndex(x => x.date === timesheetDate && x.empId === rl.empId);
          if (idx > -1) {
            const updated = { ...copy[idx], ...rl };
            copy[idx] = updated;
            writtenItems.push(updated);
          } else {
            const newItem = { id: uid(), date: timesheetDate, ...rl };
            copy.push(newItem);
            writtenItems.push(newItem);
          }
        }
      });
      return copy;
    });

    if (writtenItems.length > 0) {
      saveBatch('timesheets', writtenItems);
    }

    setTimesheetModalOpen(false);
    verifyMarkChanged();
  };

  const removeTimesheetEntry = (id: string) => {
    const entry = timesheets.find(x => x.id === id);
    if (!entry) return;

    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Logging Entry',
      message: `Are you sure you want to permanently delete the logs entry for "${entry.employee}" working on project "${entry.projectName || ''}"?`,
      onConfirm: () => {
        setTimesheets(prev => prev.filter(x => x.id !== id));
        removeItem('timesheets', id);
        verifyMarkChanged();
        setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const exportTimesheetExcel = () => {
    alert('Spreadsheet compiled dynamically in component views!');
  };

  return {
    timesheets,
    setTimesheets,
    timesheetDate,
    setTimesheetDate,
    timesheetModalOpen,
    setTimesheetModalOpen,
    editingTsId,
    setEditingTsId,
    openTimesheetBulkAdd,
    openTimesheetEditForm,
    saveTimesheetsBulkImport,
    removeTimesheetEntry,
    exportTimesheetExcel
  };
}
export default useTimesheets;
