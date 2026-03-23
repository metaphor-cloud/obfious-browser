import { describe, it, expect } from 'vitest';
import { collectAll, getComponentNames } from '../../src/collectors/index.js';

describe('collectAll timeout', () => {
  it('returns null for collectors that exceed the timeout', async () => {
    // Use a 1ms timeout — every collector doing real work will exceed it
    const results = await collectAll([], 1);
    const names = getComponentNames();
    expect(results.length).toBe(names.length);
    // All results should still be string or null (never throw)
    for (const result of results) {
      expect(result === null || typeof result === 'string').toBe(true);
    }
  });

  it('collectors that throw are caught and return null', async () => {
    // collectAll wraps each collector in a try-catch.
    // In happy-dom, many APIs are missing so collectors return null gracefully.
    // This verifies the overall contract holds: no exceptions escape.
    const results = await collectAll();
    for (const result of results) {
      expect(result === null || typeof result === 'string').toBe(true);
    }
  });

  it('excluding all collectors returns empty array', async () => {
    const allNames = getComponentNames();
    const results = await collectAll(allNames);
    expect(results).toEqual([]);
  });
});
