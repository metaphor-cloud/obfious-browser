import type { Collector } from '../types.js';

/**
 * Timezone data: IANA timezone name and standard UTC offset.
 * Uses January 1 as a fixed reference date to avoid DST-dependent drift.
 */
export const collectTimezone: Collector = async () => {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
    // Use a fixed reference date (Jan 1) to get the standard offset,
    // avoiding DST-dependent values that change throughout the year.
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    const offset = jan1.getTimezoneOffset();
    return `tz:${tz}|offset:${offset}`;
  } catch {
    return null;
  }
};
