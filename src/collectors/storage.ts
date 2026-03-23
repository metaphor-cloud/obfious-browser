import type { Collector } from '../types.js';

/**
 * Storage API availability: localStorage, sessionStorage, indexedDB, cookies.
 */
export const collectStorage: Collector = async () => {
  try {
    const parts: string[] = [];

    // localStorage
    try {
      const key = '__obfious_test__';
      localStorage.setItem(key, '1');
      try { localStorage.removeItem(key); } catch { /* best effort cleanup */ }
      parts.push('ls:1');
    } catch {
      parts.push('ls:0');
    }

    // sessionStorage
    try {
      const key = '__obfious_test__';
      sessionStorage.setItem(key, '1');
      try { sessionStorage.removeItem(key); } catch { /* best effort cleanup */ }
      parts.push('ss:1');
    } catch {
      parts.push('ss:0');
    }

    // IndexedDB
    parts.push('idb:' + (typeof indexedDB !== 'undefined' ? '1' : '0'));

    // Cookies
    parts.push('cookie:' + (navigator.cookieEnabled ? '1' : '0'));

    return parts.join('|');
  } catch {
    return null;
  }
};
