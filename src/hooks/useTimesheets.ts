import { useState } from 'react';
import { TimesheetEntry } from '../types';
import { uid } from '../utils';
import { useFirestore } from './useFirestore';
import { useAppStore } from '../store';

export function useTimesheets(
  verifyMarkChanged: () => void,
  setDeleteConfirm: (confirm: any) => void
) {
  const [timesheets, setTimesheetsState] = useState<TimesheetEntry[]>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem('epc_timesheets_cache_v1') || localStorage.getItem('austin_timesheets_cache_v1');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch (e) {}
    return [];
  });

  const setTimesheets = (action: React.SetStateAction<TimesheetEntry[]>) => {
    setTimesheetsState((prev) => {
      const next = typeof action === 'function' ? (action as (ts: TimesheetEntry[]) => TimesheetEntry[])(prev) : action;
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('epc_timesheets_cache_v1', JSON.stringify(next));
        }
      } catch (e) {}
      queueMicrotask(() => {
        useAppStore.getState().setTimesheets(next);
      });
      return next;
    });
  };
  const [timesheetDate, setTimesheetDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [timesheetModalOpen, setTimesheetModalOpen] = useState<boolean>(false);
  const [editingTsId, setEditingTsId] = useState<string | null>(null);
  const [preselectedEmpId, setPreselectedEmpId] = useState<string | null>(null);

  const { saveItem, removeItem, saveBatch } = useFirestore();

  const openTimesheetBulkAdd = () => {
    setEditingTsId(null);
    setPreselectedEmpId(null);
    setTimesheetModalOpen(true);
  };

  const openTimesheetForEmployee = (empId: string) => {
    setEditingTsId(null);
    setPreselectedEmpId(empId);
    setTimesheetModalOpen(true);
  };

  const openTimesheetEditForm = (id: string) => {
    setPreselectedEmpId(null);
    setEditingTsId(id);
    setTimesheetModalOpen(true);
  };

  const saveTimesheetsBulkImport = (rawLogs: any[]) => {
    const writtenItems: TimesheetEntry[] = [];
    setTimesheets(prev => {
      const copy = [...prev];
      rawLogs.forEach(rl => {
        const hrs = Math.max(0, Number(rl.totalHours) || 0);
        const normalizedLog = {
          ...rl,
          totalHours: hrs,
          regularHours: Math.min(8, hrs),
          overtimeHours: Math.max(0, hrs - 8),
        };

        if (editingTsId) {
          const idx = copy.findIndex(x => x.id === editingTsId);
          if (idx > -1) {
            const updated = { ...copy[idx], ...normalizedLog };
            copy[idx] = updated;
            writtenItems.push(updated);
          } else {
            const newItem = { id: uid(), date: timesheetDate, ...normalizedLog };
            copy.push(newItem);
            writtenItems.push(newItem);
          }
        } else {
          let idx = -1;
          if (rl.id) {
            idx = copy.findIndex(x => x.id === rl.id);
          } else {
            const keyWo = (rl.workOrder || '').trim().toLowerCase();
            const keyAsm = (rl.assemblyId || '').trim();
            const keyTask = (rl.taskId || '').trim();
            idx = copy.findIndex(x =>
              x.date === timesheetDate &&
              x.empId === rl.empId &&
              (x.workOrder || '').trim().toLowerCase() === keyWo &&
              (x.assemblyId || '').trim() === keyAsm &&
              (x.taskId || '').trim() === keyTask
            );
          }

          if (idx > -1) {
            const updated = { ...copy[idx], ...normalizedLog };
            copy[idx] = updated;
            writtenItems.push(updated);
          } else {
            const newItem = { id: rl.id || uid(), date: timesheetDate, ...normalizedLog };
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

    setEditingTsId(null);
    setPreselectedEmpId(null);
    setTimesheetModalOpen(false);
    verifyMarkChanged();
  };

  const removeTimesheetEntry = (id: string) => {
    const entry = timesheets.find(x => x.id === id);
    if (!entry) return;

    setDeleteConfirm({
      isOpen: true,
      title: 'Remove Logging Entry',
      message: `Are you sure you want to permanently delete the logs entry for "${(entry as any).employee || entry.empName}" working on project "${(entry as any).projectName || entry.workOrder || ''}"?`,
      onConfirm: () => {
        setTimesheets(prev => prev.filter(x => x.id !== id));
        removeItem('timesheets', id);
        verifyMarkChanged();
        setDeleteConfirm((prev: any) => ({ ...prev, isOpen: false }));
      }
    });
  };

  const exportTimesheetExcel = () => {
    // Handled in DailyTimesheetTab component
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
    preselectedEmpId,
    setPreselectedEmpId,
    openTimesheetBulkAdd,
    openTimesheetForEmployee,
    openTimesheetEditForm,
    saveTimesheetsBulkImport,
    removeTimesheetEntry,
    exportTimesheetExcel
  };
}
export default useTimesheets;
