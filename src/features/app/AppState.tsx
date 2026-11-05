// App-wide context: database adapter, preferences, and a "data version"
// counter that screens watch so they reload after any write.
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { adaptExpoDb, type Db } from '../../database/db';
import { DEFAULT_PREFERENCES, loadPreferences, savePreferences } from '../../database/repositories/preferences';
import type { Preferences } from '../../types/models';

interface AppState {
  db: Db;
  prefs: Preferences;
  prefsLoaded: boolean;
  updatePrefs: (patch: Partial<Preferences>) => Promise<void>;
  reloadPrefs: () => Promise<void>;
  dataVersion: number;
  /** Call after any write so visible screens reload their data. */
  notifyDataChanged: () => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const sqlite = useSQLiteContext();
  const db = useMemo(() => adaptExpoDb(sqlite), [sqlite]);
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  // Latest preferences for async callbacks; updated wherever prefs change.
  const prefsRef = useRef(prefs);

  const reloadPrefs = useCallback(async () => {
    try {
      const loaded = await loadPreferences(db);
      prefsRef.current = loaded;
      setPrefs(loaded);
    } finally {
      setPrefsLoaded(true);
    }
  }, [db]);

  useEffect(() => {
    reloadPrefs().catch(() => undefined);
  }, [reloadPrefs]);

  const updatePrefs = useCallback(
    async (patch: Partial<Preferences>) => {
      const next = { ...prefsRef.current, ...patch };
      prefsRef.current = next;
      setPrefs(next);
      await savePreferences(db, next);
    },
    [db],
  );

  const notifyDataChanged = useCallback(() => setDataVersion((v) => v + 1), []);

  const value = useMemo(
    () => ({ db, prefs, prefsLoaded, updatePrefs, reloadPrefs, dataVersion, notifyDataChanged }),
    [db, prefs, prefsLoaded, updatePrefs, reloadPrefs, dataVersion, notifyDataChanged],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppStateProvider');
  return ctx;
}

/**
 * Loads data with `loader`, reloading when the screen regains focus or when any
 * write calls notifyDataChanged(). Keeps the previous data while reloading.
 */
export function useLiveQuery<T>(loader: (db: Db) => Promise<T>, deps: (string | number | undefined)[] = []) {
  const { db, dataVersion } = useApp();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Always call the latest loader without re-subscribing on every render.
  const loaderRef = useRef(loader);
  useLayoutEffect(() => {
    loaderRef.current = loader;
  });
  // Dependencies are primitives (ids), so a joined key is a stable cache key.
  const depsKey = deps.join('|');

  const run = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loaderRef.current(db));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong while loading.');
    } finally {
      setLoading(false);
    }
  }, [db, dataVersion, depsKey]); // eslint-disable-line react-hooks/exhaustive-deps -- dataVersion/depsKey are intentional reload triggers

  // Runs on focus, and again whenever `run` changes (new data version) while focused.
  useFocusEffect(
    useCallback(() => {
      run();
    }, [run]),
  );

  return { data, error, loading, reload: run };
}
