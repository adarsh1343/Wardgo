import * as Crypto from 'expo-crypto';

/** RFC 4122 v4 UUID. Uses expo-crypto, with fallbacks for tests and the web. */
export function newId(): string {
  try {
    const id = Crypto.randomUUID();
    if (typeof id === 'string' && id.length >= 32) return id;
  } catch {
    // fall through
  }
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
