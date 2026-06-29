import { describe, it, expect } from 'vitest';
import { uid, sha256 } from '../helpers';

describe('helpers utility functions', () => {
  describe('uid', () => {
    it('returns a non-empty string', () => {
      const id = uid();
      expect(id).toBeTypeOf('string');
      expect(id).not.toBe('');
    });

    it('each call returns a unique value', () => {
      const id1 = uid();
      const id2 = uid();
      expect(id1).not.toBe(id2);
    });

    it('has reasonable length (>6 chars)', () => {
      const id = uid();
      expect(id.length).toBeGreaterThan(6);
    });
  });

  describe('sha256', () => {
    it('same input always returns same hash', async () => {
      const input = 'hello batam';
      const hash1 = await sha256(input);
      const hash2 = await sha256(input);
      expect(hash1).toBe(hash2);
    });

    it('different inputs return different hashes', async () => {
      const hash1 = await sha256('hello batam');
      const hash2 = await sha256('hello batam!');
      expect(hash1).not.toBe(hash2);
    });

    it('returns a 64-char hex string', async () => {
      const hash = await sha256('test string');
      expect(hash).toHaveLength(64);
      // Verify it's a hex string (a-f, 0-9)
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('handles empty string input', async () => {
      const hash = await sha256('');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });
  });
});
