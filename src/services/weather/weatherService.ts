// Weather with an on-device cache. The app always has something to show:
// fresh data, cached (marked stale) data, or nothing — in which case the
// engine falls back to seasonal defaults.
import type { Db } from '../../database/db';
import type { LocationPref, WeatherSnapshot } from '../../types/models';
import { localDateKey } from '../../utils/date';
import { fetchForecast } from './openMeteo';

const CACHE_KEY = 'latest';
/** Data older than this is labelled stale in the UI. */
export const STALE_AFTER_MS = 3 * 60 * 60 * 1000;

export interface WeatherState {
  snapshot: WeatherSnapshot | null;
  stale: boolean;
  /** Present when the last refresh attempt failed. */
  error: string | null;
}

export function isStale(snapshot: WeatherSnapshot, now = new Date()): boolean {
  const age = now.getTime() - new Date(snapshot.fetchedAt).getTime();
  // Yesterday's forecast is stale even if it is only a few hours old.
  return age > STALE_AFTER_MS || localDateKey(new Date(snapshot.fetchedAt)) !== localDateKey(now);
}

export async function readCachedWeather(db: Db): Promise<WeatherSnapshot | null> {
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM weather_cache WHERE key = ?', [CACHE_KEY]);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.payload) as WeatherSnapshot;
    return typeof parsed.tempC === 'number' && typeof parsed.fetchedAt === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

async function writeCache(db: Db, snapshot: WeatherSnapshot): Promise<void> {
  await db.runAsync(
    'INSERT INTO weather_cache (key, payload, fetched_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at',
    [CACHE_KEY, JSON.stringify(snapshot), snapshot.fetchedAt],
  );
}

function sameLocation(a: WeatherSnapshot, loc: LocationPref): boolean {
  if (loc.mode === 'none') return false;
  return Math.abs(a.latitude - loc.latitude) < 0.05 && Math.abs(a.longitude - loc.longitude) < 0.05;
}

/**
 * Returns weather for the chosen location. Fetches when `force` is set or the
 * cache is older than `maxAgeMinutes` (0 = only fetch when forced).
 */
export async function getWeather(
  db: Db,
  location: LocationPref,
  opts: { force?: boolean; maxAgeMinutes: number },
): Promise<WeatherState> {
  const cached = await readCachedWeather(db);
  const usable = cached && sameLocation(cached, location) ? cached : null;
  if (location.mode === 'none') {
    return { snapshot: null, stale: false, error: null };
  }
  const ageMs = usable ? Date.now() - new Date(usable.fetchedAt).getTime() : Infinity;
  const due = opts.force || (opts.maxAgeMinutes > 0 && ageMs > opts.maxAgeMinutes * 60_000) || !usable;
  if (!due && usable) return { snapshot: usable, stale: isStale(usable), error: null };

  try {
    const fresh = await fetchForecast({ name: location.name, latitude: location.latitude, longitude: location.longitude });
    await writeCache(db, fresh);
    return { snapshot: fresh, stale: false, error: null };
  } catch (e) {
    const message = e instanceof Error && e.name === 'AbortError' ? 'Weather request timed out.' : 'Could not reach the weather service.';
    return { snapshot: usable, stale: usable ? isStale(usable) : false, error: usable ? `${message} Showing saved weather.` : message };
  }
}
