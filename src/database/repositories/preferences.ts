import type { Occasion, Preferences } from '../../types/models';
import type { Db } from '../db';

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: 'system',
  units: 'C',
  location: { mode: 'none' },
  weatherRefreshMinutes: 60,
  preferredStyles: [],
  avoidStyles: [],
  preferredColors: [],
  avoidColors: [],
  defaultOccasion: 'everyday',
  typicalOccasions: ['everyday'],
  temperatureComfort: 0,
  maxAccessories: 2,
  reminder: { enabled: false, hour: 7, minute: 30 },
};

const PREFS_KEY = 'preferences';
const OCCASIONS: Occasion[] = ['everyday', 'work', 'date', 'active', 'formal'];

/** Validates stored or restored preferences, falling back to defaults field by field. */
export function sanitizePreferences(raw: unknown): Preferences {
  const d = DEFAULT_PREFERENCES;
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Record<string, unknown>;
  const strArr = (v: unknown, fb: string[]) =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : fb;
  const pick = <T>(v: unknown, allowed: readonly T[], fb: T): T => (allowed.includes(v as T) ? (v as T) : fb);

  let location: Preferences['location'] = d.location;
  const loc = r.location as Record<string, unknown> | undefined;
  if (loc && (loc.mode === 'device' || loc.mode === 'manual') && typeof loc.latitude === 'number' && typeof loc.longitude === 'number') {
    location = {
      mode: loc.mode,
      name: typeof loc.name === 'string' ? loc.name : 'Saved location',
      latitude: loc.latitude,
      longitude: loc.longitude,
    };
  }

  const rem = r.reminder as Record<string, unknown> | undefined;
  const hour = typeof rem?.hour === 'number' && rem.hour >= 0 && rem.hour < 24 ? Math.floor(rem.hour) : d.reminder.hour;
  const minute = typeof rem?.minute === 'number' && rem.minute >= 0 && rem.minute < 60 ? Math.floor(rem.minute) : d.reminder.minute;

  return {
    themeMode: pick(r.themeMode, ['system', 'light', 'dark'] as const, d.themeMode),
    units: pick(r.units, ['C', 'F'] as const, d.units),
    location,
    weatherRefreshMinutes:
      typeof r.weatherRefreshMinutes === 'number' && r.weatherRefreshMinutes >= 0 ? r.weatherRefreshMinutes : d.weatherRefreshMinutes,
    preferredStyles: strArr(r.preferredStyles, d.preferredStyles),
    avoidStyles: strArr(r.avoidStyles, d.avoidStyles),
    preferredColors: strArr(r.preferredColors, d.preferredColors),
    avoidColors: strArr(r.avoidColors, d.avoidColors),
    defaultOccasion: pick(r.defaultOccasion, OCCASIONS, d.defaultOccasion),
    typicalOccasions: strArr(r.typicalOccasions, d.typicalOccasions).filter((o): o is Occasion =>
      OCCASIONS.includes(o as Occasion),
    ),
    temperatureComfort: pick(r.temperatureComfort, [-1, 0, 1] as const, d.temperatureComfort),
    maxAccessories:
      typeof r.maxAccessories === 'number' ? Math.min(5, Math.max(0, Math.round(r.maxAccessories))) : d.maxAccessories,
    reminder: { enabled: rem?.enabled === true, hour, minute },
  };
}

export async function getValue<T>(db: Db, key: string): Promise<T | null> {
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM preferences WHERE key = ?', [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export async function setValue(db: Db, key: string, value: unknown): Promise<void> {
  await db.runAsync(
    'INSERT INTO preferences (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)],
  );
}

export async function loadPreferences(db: Db): Promise<Preferences> {
  return sanitizePreferences(await getValue<unknown>(db, PREFS_KEY));
}

export async function savePreferences(db: Db, prefs: Preferences): Promise<void> {
  await setValue(db, PREFS_KEY, sanitizePreferences(prefs));
}
