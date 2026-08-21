import { useState, useEffect, useCallback } from 'react';
import { ShiftHandoverNote } from '../types';

const STORAGE_KEY = 'austin_shift_handover_notes';

const INITIAL_NOTES: ShiftHandoverNote[] = [
  {
    id: 'handover-init-1',
    note: 'Welding sub-assembly Tray Section A selesai 80%. Shift malam mohon lanjut pengelasan joint 4 & 5 serta siapkan fitting untuk Assembly B.',
    authorName: 'Coordinator Senjaya',
    authorRole: 'coordinator',
    targetShift: 'Night Shift',
    priority: 'important',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    isPinned: true,
    station: 'Workshop 1 - Bay 2',
    acknowledgedBy: []
  }
];

export function useShiftHandover(currentUser?: { name: string; role?: string } | null) {
  const [notes, setNotes] = useState<ShiftHandoverNote[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse shift handover notes from localStorage:', e);
    }
    return INITIAL_NOTES;
  });

  // Save changes to localStorage and dispatch custom event
  const persistNotes = useCallback((newNotes: ShiftHandoverNote[]) => {
    setNotes(newNotes);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newNotes));
      window.dispatchEvent(new Event('austin_shift_handover_update'));
    } catch (e) {
      console.error('Failed to save shift handover notes:', e);
    }
  }, []);

  // Sync across tabs or multi-instance
  useEffect(() => {
    const handleStorageUpdate = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setNotes(parsed);
          }
        }
      } catch (e) {
        // ignore
      }
    };

    window.addEventListener('storage', handleStorageUpdate);
    window.addEventListener('austin_shift_handover_update', handleStorageUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageUpdate);
      window.removeEventListener('austin_shift_handover_update', handleStorageUpdate);
    };
  }, []);

  // Active / Pinned Note (The newest pinned note)
  const pinnedNote = notes.find(n => n.isPinned) || null;

  // Pin a new note
  const pinNote = useCallback((params: {
    note: string;
    targetShift?: string;
    priority?: 'normal' | 'important' | 'urgent';
    station?: string;
    authorName?: string;
    authorRole?: string;
  }) => {
    const now = new Date().toISOString();
    const newNote: ShiftHandoverNote = {
      id: `handover-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      note: params.note.trim(),
      authorName: params.authorName || currentUser?.name || 'Coordinator Lapangan',
      authorRole: params.authorRole || currentUser?.role || 'coordinator',
      targetShift: params.targetShift || 'Next Shift',
      priority: params.priority || 'normal',
      createdAt: now,
      isPinned: true,
      station: params.station || '',
      acknowledgedBy: []
    };

    // Unpin other notes when pinning a new active one, and prepend
    const updated = [
      newNote,
      ...notes.map(n => ({ ...n, isPinned: false }))
    ];

    persistNotes(updated);
    return newNote;
  }, [currentUser, notes, persistNotes]);

  // Unpin active note
  const unpinNote = useCallback((id: string) => {
    const updated = notes.map(n => n.id === id ? { ...n, isPinned: false } : n);
    persistNotes(updated);
  }, [notes, persistNotes]);

  // Toggle pin status
  const togglePin = useCallback((id: string) => {
    const target = notes.find(n => n.id === id);
    if (!target) return;
    const willPin = !target.isPinned;
    const updated = notes.map(n => {
      if (n.id === id) {
        return { ...n, isPinned: willPin };
      }
      // If we are pinning this, unpin others to keep single primary pinned note
      if (willPin) {
        return { ...n, isPinned: false };
      }
      return n;
    });
    persistNotes(updated);
  }, [notes, persistNotes]);

  // Acknowledge note
  const acknowledgeNote = useCallback((id: string, userName?: string) => {
    const nameToUse = userName || currentUser?.name || 'Staff Lapangan';
    const updated = notes.map(n => {
      if (n.id === id) {
        const currentAck = n.acknowledgedBy || [];
        if (!currentAck.includes(nameToUse)) {
          return { ...n, acknowledgedBy: [...currentAck, nameToUse] };
        }
      }
      return n;
    });
    persistNotes(updated);
  }, [currentUser, notes, persistNotes]);

  // Update an existing note
  const updateNote = useCallback((id: string, updates: Partial<ShiftHandoverNote>) => {
    const updated = notes.map(n => n.id === id ? { ...n, ...updates } : n);
    persistNotes(updated);
  }, [notes, persistNotes]);

  // Delete note
  const deleteNote = useCallback((id: string) => {
    const updated = notes.filter(n => n.id !== id);
    persistNotes(updated);
  }, [notes, persistNotes]);

  return {
    notes,
    pinnedNote,
    pinNote,
    unpinNote,
    togglePin,
    acknowledgeNote,
    updateNote,
    deleteNote
  };
}
