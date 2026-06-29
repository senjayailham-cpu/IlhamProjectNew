import { describe, it, expect } from 'vitest';
import { getManHoursForWorkOrder } from '../projectUtils';
import { makeTimesheetEntry } from '../../test/factories';

describe('projectUtils - getManHoursForWorkOrder', () => {
  it('returns 0 for empty timesheets', () => {
    expect(getManHoursForWorkOrder('WO-123', [])).toBe(0);
  });

  it('returns 0 for non-matching work order', () => {
    const ts1 = makeTimesheetEntry({ workOrder: 'WO-111', totalHours: 8 });
    const ts2 = makeTimesheetEntry({ workOrder: 'WO-222', totalHours: 6 });
    expect(getManHoursForWorkOrder('WO-333', [ts1, ts2])).toBe(0);
  });

  it('correctly sums hours for matching work order', () => {
    const ts1 = makeTimesheetEntry({ workOrder: 'WO-123', totalHours: 8 });
    const ts2 = makeTimesheetEntry({ workOrder: 'WO-123', totalHours: 6 });
    const ts3 = makeTimesheetEntry({ workOrder: 'WO-999', totalHours: 4 });
    expect(getManHoursForWorkOrder('WO-123', [ts1, ts2, ts3])).toBe(14);
  });

  it('is case-insensitive in matching', () => {
    const ts1 = makeTimesheetEntry({ workOrder: 'wo-123', totalHours: 8 });
    const ts2 = makeTimesheetEntry({ workOrder: 'WO-123', totalHours: 5 });
    expect(getManHoursForWorkOrder('Wo-123', [ts1, ts2])).toBe(13);
  });
});
