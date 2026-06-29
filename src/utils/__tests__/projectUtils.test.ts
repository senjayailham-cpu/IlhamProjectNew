import { describe, it, expect } from 'vitest';
import { calcPct, calcTaskCounts, calcDuration } from '../projectUtils';
import { makeProject, makeAssembly, makeTask } from '../../test/factories';

describe('projectUtils - basic calculations', () => {
  describe('calcPct', () => {
    it('returns 0 when project has no assemblies', () => {
      const project = makeProject({ assemblies: [] });
      expect(calcPct(project)).toBe(0);
    });

    it('returns 0 when all tasks have pct=0', () => {
      const task1 = makeTask({ pct: 0 });
      const task2 = makeTask({ pct: 0 });
      const assembly = makeAssembly({ tasks: [task1, task2] });
      const project = makeProject({ assemblies: [assembly] });
      expect(calcPct(project)).toBe(0);
    });

    it('returns 100 when all tasks have pct=100', () => {
      const task1 = makeTask({ pct: 100 });
      const task2 = makeTask({ pct: 100 });
      const assembly = makeAssembly({ tasks: [task1, task2] });
      const project = makeProject({ assemblies: [assembly] });
      expect(calcPct(project)).toBe(100);
    });

    it('correctly weights tasks by difficulty', () => {
      // task1 has weight 1, pct 50 -> weighted pct 50
      // task2 has weight 3, pct 100 -> weighted pct 300
      // total weight = 4. expected pct = (50 + 300) / 4 = 350 / 4 = 87.5 => 88 (rounded)
      const task1 = makeTask({ pct: 50, difficulty: 1 });
      const task2 = makeTask({ pct: 100, difficulty: 3 });
      const assembly = makeAssembly({ tasks: [task1, task2] });
      const project = makeProject({ assemblies: [assembly] });
      expect(calcPct(project)).toBe(88);
    });

    it('ignores tasks with difficulty=0 (treats as 1)', () => {
      // task1 has difficulty 0 (treats as 1), pct 50 -> weighted pct 50
      // task2 has difficulty 1, pct 100 -> weighted pct 100
      // total weight = 2. expected pct = (50 + 100) / 2 = 75
      const task1 = makeTask({ pct: 50, difficulty: 0 });
      const task2 = makeTask({ pct: 100, difficulty: 1 });
      const assembly = makeAssembly({ tasks: [task1, task2] });
      const project = makeProject({ assemblies: [assembly] });
      expect(calcPct(project)).toBe(75);
    });

    it('rounds to nearest integer', () => {
      // task1 difficulty 1, pct 33
      // task2 difficulty 1, pct 34
      // total 67 / 2 = 33.5 => rounded to 34
      const task1 = makeTask({ pct: 33, difficulty: 1 });
      const task2 = makeTask({ pct: 34, difficulty: 1 });
      const assembly = makeAssembly({ tasks: [task1, task2] });
      const project = makeProject({ assemblies: [assembly] });
      expect(calcPct(project)).toBe(34);
    });
  });

  describe('calcTaskCounts', () => {
    it('returns {total:0, done:0} for empty assemblies', () => {
      const project = makeProject({ assemblies: [] });
      expect(calcTaskCounts(project)).toEqual({ total: 0, done: 0 });
    });

    it('counts done=true tasks correctly', () => {
      const task1 = makeTask({ pct: 0, done: true });
      const task2 = makeTask({ pct: 0, done: false });
      const assembly = makeAssembly({ tasks: [task1, task2] });
      const project = makeProject({ assemblies: [assembly] });
      expect(calcTaskCounts(project)).toEqual({ total: 2, done: 1 });
    });

    it('counts pct>=100 tasks as done', () => {
      const task1 = makeTask({ pct: 100, done: false });
      const task2 = makeTask({ pct: 50, done: false });
      const assembly = makeAssembly({ tasks: [task1, task2] });
      const project = makeProject({ assemblies: [assembly] });
      expect(calcTaskCounts(project)).toEqual({ total: 2, done: 1 });
    });

    it('counts across multiple assemblies', () => {
      const task1 = makeTask({ pct: 100, done: false });
      const task2 = makeTask({ pct: 50, done: false });
      const assembly1 = makeAssembly({ tasks: [task1, task2] });

      const task3 = makeTask({ pct: 0, done: true });
      const assembly2 = makeAssembly({ tasks: [task3] });

      const project = makeProject({ assemblies: [assembly1, assembly2] });
      expect(calcTaskCounts(project)).toEqual({ total: 3, done: 2 });
    });
  });

  describe('calcDuration', () => {
    it('returns null for invalid dates', () => {
      expect(calcDuration('', '2023-01-01')).toBeNull();
      expect(calcDuration('2023-01-01', '')).toBeNull();
      expect(calcDuration('invalid-date', '2023-01-01')).toBeNull();
      expect(calcDuration('2023-01-01', 'invalid-date')).toBeNull();
      expect(calcDuration('2023-01-02', '2023-01-01')).toBeNull(); // negative span
    });

    it('returns {days:0} for same-day dates', () => {
      const res = calcDuration('2023-01-01', '2023-01-01');
      expect(res).not.toBeNull();
      expect(res!.days).toBe(0);
      expect(res!.label).toBe('Same day');
    });

    it('returns correct days for date range', () => {
      const res = calcDuration('2023-01-01', '2023-01-05');
      expect(res).not.toBeNull();
      expect(res!.days).toBe(4);
    });

    it('returns label "1 day" for 1-day span', () => {
      const res = calcDuration('2023-01-01', '2023-01-02');
      expect(res).not.toBeNull();
      expect(res!.days).toBe(1);
      expect(res!.label).toBe('1 day');
    });

    it('returns label in weeks for 14+ day spans', () => {
      // 14 days -> 2 weeks
      const res = calcDuration('2023-01-01', '2023-01-15');
      expect(res).not.toBeNull();
      expect(res!.days).toBe(14);
      expect(res!.label).toBe('2 weeks');
    });

    it('returns label in months for 60+ day spans', () => {
      // 61 days -> 2 months (61 / 30.44 = 2)
      const res = calcDuration('2023-01-01', '2023-03-03');
      expect(res).not.toBeNull();
      expect(res!.days).toBe(61);
      expect(res!.label).toBe('2 months');
    });
  });
});
