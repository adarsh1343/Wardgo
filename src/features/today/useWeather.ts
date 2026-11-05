import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getWeather, type WeatherState } from '../../services/weather/weatherService';
import { useApp } from '../app/AppState';

export function useWeather() {
  const { db, prefs } = useApp();
  const [state, setState] = useState<WeatherState>({ snapshot: null, stale: false, error: null });
  const [loading, setLoading] = useState(true);
  const locKey = prefs.location.mode === 'none' ? 'none' : `${prefs.location.latitude},${prefs.location.longitude}`;
  const prefsRef = useRef(prefs);
  useLayoutEffect(() => {
    prefsRef.current = prefs;
  });

  const refresh = useCallback(
    async (force = false) => {
      setLoading(true);
      try {
        const p = prefsRef.current;
        setState(await getWeather(db, p.location, { force, maxAgeMinutes: p.weatherRefreshMinutes }));
      } finally {
        setLoading(false);
      }
    },
    [db],
  );

  // Fetch (or read the cache) whenever the chosen location changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with an external system (network + cache)
    refresh(false);
  }, [refresh, locKey]);

  // Re-check when the app comes back to the foreground (e.g. opened from the reminder).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active' && prefsRef.current.weatherRefreshMinutes > 0) refresh(false);
    });
    return () => sub.remove();
  }, [refresh]);

  return { ...state, loading, refresh };
}
