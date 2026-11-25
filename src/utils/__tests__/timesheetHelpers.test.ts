import { describe, it, expect } from 'vitest';
import {
  matchesProjectEntry,
  findProjectByWoQuery,
  findProjectForTimesheet,
  isTimesheetDraftRowValid,
  findPreviousCrewTimesheets,
  calculateSplitRemainingHours,
} from '../timesheetHelpers';
import type { Project, TimesheetEntry } from '../../types';

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    name: 'Dipper Bucket R117700',
    client: 'WO-1001',
    gaNumber: 'GA-2026-01',
    location: 'workshop1',
    status: 'active',
    category: 'repair',
    created: '2026-10-01',
    start: '2026-10-01',
    due: '2026-12-01',
    assemblies: [],
  },
  {
    id: 'proj-2',
    name: 'Apron Feeder Frame',
    client: 'WO-2002',
    gaNumber: 'GA-2026-02',
    location: 'workshop2',
    status: 'active',
    category: 'fabrication',
    created: '2026-10-05',
    start: '2026-10-05',
    due: '2026-12-15',
    assemblies: [],
  },
];

describe('timesheetHelpers', () => {
  describe('project matching (matchesProjectEntry, findProjectByWoQuery, findProjectForTimesheet)', () => {
    it('matches by projectId even when workOrder is blank or differs', () => {
      const entry: TimesheetEntry = {
        id: 't1',
        date: '2026-11-24',
        empId: 'e1',
        empName: 'Budi',
        totalHours: 8,
        status: 'present',
        projectId: 'proj-1',
        workOrder: '',
      };
      expect(matchesProjectEntry(entry, mockProjects[0])).toBe(true);
      expect(matchesProjectEntry(entry, mockProjects[1])).toBe(false);
      expect(findProjectForTimesheet(entry, mockProjects)?.id).toBe('proj-1');
    });

    it('matches by client WO, gaNumber, or project name case-insensitively with whitespace trimming', () => {
      const byClient: TimesheetEntry = { id: 't2', date: '2026-11-24', empId: 'e1', empName: 'Budi', workOrder: ' wo-1001 ', totalHours: 4, status: 'present' };
      const byGa: TimesheetEntry = { id: 't3', date: '2026-11-24', empId: 'e1', empName: 'Budi', workOrder: 'ga-2026-02', totalHours: 4, status: 'present' };
      const byName: TimesheetEntry = { id: 't4', date: '2026-11-24', empId: 'e1', empName: 'Budi', workOrder: 'Apron Feeder Frame', totalHours: 4, status: 'present' };

      expect(matchesProjectEntry(byClient, mockProjects[0])).toBe(true);
      expect(matchesProjectEntry(byGa, mockProjects[1])).toBe(true);
      expect(matchesProjectEntry(byName, mockProjects[1])).toBe(true);
      expect(findProjectByWoQuery('ga-2026-01', mockProjects)?.id).toBe('proj-1');
    });
  });

  describe('isTimesheetDraftRowValid (Bug A1 fix)', () => {
    it('allows absent and leave rows with 0 hours and empty workOrder', () => {
      expect(isTimesheetDraftRowValid({ included: true, status: 'absent', workOrder: '', totalHours: '0' })).toBe(true);
      expect(isTimesheetDraftRowValid({ included: true, status: 'leave', workOrder: '', totalHours: '' })).toBe(true);
    });

    it('rejects present and late rows without workOrder or with <= 0 hours', () => {
      expect(isTimesheetDraftRowValid({ included: true, status: 'present', workOrder: '', totalHours: '8' })).toBe(false);
      expect(isTimesheetDraftRowValid({ included: true, status: 'late', workOrder: 'WO-1001', totalHours: '0' })).toBe(false);
      expect(isTimesheetDraftRowValid({ included: true, status: 'present', workOrder: 'WO-1001', totalHours: '8' })).toBe(true);
      expect(isTimesheetDraftRowValid({ included: false, status: 'present', workOrder: 'WO-1001', totalHours: '8' })).toBe(false);
    });

    it('rejects negative or > 24 hours', () => {
      expect(isTimesheetDraftRowValid({ included: true, status: 'absent', workOrder: '', totalHours: '-1' })).toBe(false);
      expect(isTimesheetDraftRowValid({ included: true, status: 'present', workOrder: 'WO-1001', totalHours: '25' })).toBe(false);
    });
  });

  describe('findPreviousCrewTimesheets (Feature #1 Copy Previous Day)', () => {
    it('picks the latest date strictly before targetDate for matching crew members', () => {
      const history: TimesheetEntry[] = [
        { id: '1', date: '2026-11-20', empId: 'e1', empName: 'Andi', workOrder: 'WO-OLD', totalHours: 8, status: 'present' },
        { id: '2', date: '2026-11-23', empId: 'e1', empName: 'Andi', workOrder: 'WO-1001', totalHours: 5, status: 'present' },
        { id: '3', date: '2026-11-23', empId: 'e1', empName: 'Andi', workOrder: 'WO-2002', totalHours: 3, status: 'present' },
        { id: '4', date: '2026-11-23', empId: 'e99', empName: 'Other Crew', workOrder: 'WO-999', totalHours: 8, status: 'present' },
        { id: '5', date: '2026-11-24', empId: 'e1', empName: 'Andi', workOrder: 'WO-TODAY', totalHours: 8, status: 'present' },
      ];

      const res = findPreviousCrewTimesheets('2026-11-24', ['e1', 'e2'], history);
      expect(res.sourceDate).toBe('2026-11-23');
      expect(res.logs.map(l => l.id)).toEqual(['2', '3']);
    });

    it('returns null sourceDate when no prior logs exist', () => {
      const res = findPreviousCrewTimesheets('2026-11-24', ['e1'], []);
      expect(res).toEqual({ sourceDate: null, logs: [] });
    });
  });

  describe('calculateSplitRemainingHours', () => {
    it('returns remaining hours toward 8h shift and empty when >= 8h', () => {
      expect(calculateSplitRemainingHours(5, 8)).toBe('3');
      expect(calculateSplitRemainingHours(3.5, 8)).toBe('4.5');
      expect(calculateSplitRemainingHours(8, 8)).toBe('');
      expect(calculateSplitRemainingHours(10, 8)).toBe('');
    });
  });
});
