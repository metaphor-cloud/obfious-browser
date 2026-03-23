import { describe, it, expect } from 'vitest';
import { COLLECTOR_REGISTRY, getComponentNames, collectAll } from '../../src/collectors/index.js';

describe('COLLECTOR_REGISTRY', () => {
  it('contains at least one collector', () => {
    expect(COLLECTOR_REGISTRY.length).toBeGreaterThan(0);
  });

  it('each entry has a name and collect function', () => {
    for (const entry of COLLECTOR_REGISTRY) {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
      expect(typeof entry.collect).toBe('function');
    }
  });

  it('has unique names', () => {
    const names = COLLECTOR_REGISTRY.map((c) => c.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('getComponentNames', () => {
  it('returns all names in registry order', () => {
    const names = getComponentNames();
    const expected = COLLECTOR_REGISTRY.map((c) => c.name);
    expect(names).toEqual(expected);
  });

  it('ordering is stable across calls', () => {
    const a = getComponentNames();
    const b = getComponentNames();
    expect(a).toEqual(b);
  });

  it('respects exclusions', () => {
    const all = getComponentNames();
    const excluded = getComponentNames([all[0]!]);
    expect(excluded).not.toContain(all[0]);
    expect(excluded.length).toBe(all.length - 1);
  });

  it('handles empty exclusion array', () => {
    const names = getComponentNames([]);
    const all = getComponentNames();
    expect(names).toEqual(all);
  });

  it('ignores unknown exclusion names', () => {
    const names = getComponentNames(['nonexistent-collector']);
    const all = getComponentNames();
    expect(names).toEqual(all);
  });
});

describe('collectAll', () => {
  it('returns an array with one entry per active collector', async () => {
    const results = await collectAll();
    const names = getComponentNames();
    expect(results.length).toBe(names.length);
  });

  it('each result is a string or null — never throws', async () => {
    const results = await collectAll();
    for (const result of results) {
      expect(result === null || typeof result === 'string').toBe(true);
    }
  });

  it('respects exclusions — returns fewer results', async () => {
    const all = await collectAll();
    const names = getComponentNames();
    const excluded = await collectAll([names[0]!]);
    expect(excluded.length).toBe(all.length - 1);
  });

  it('handles null values gracefully', async () => {
    // In happy-dom, many APIs are unavailable so collectors return null.
    // This test verifies none of them throw.
    const results = await collectAll();
    expect(Array.isArray(results)).toBe(true);
  });
});

describe('individual collectors', () => {
  it('each collector returns string or null without throwing', async () => {
    for (const entry of COLLECTOR_REGISTRY) {
      const result = await entry.collect();
      expect(
        result === null || typeof result === 'string',
        `Collector "${entry.name}" returned ${typeof result}: ${result}`,
      ).toBe(true);
    }
  });
});
