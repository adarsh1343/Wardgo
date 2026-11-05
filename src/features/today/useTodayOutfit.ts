// State for the Today screen: today's recommendation, locks, undo, and the
// actions around it. The current outfit is persisted per day so reopening the
// app shows the same outfit instead of a new random one.
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { addFeedback, comboKeyForSlots, logRecommendation, logWear } from '../../database/repositories/history';
import { getValue, setValue } from '../../database/repositories/preferences';
import { saveOutfit } from '../../database/repositories/outfits';
import { slotForItem } from '../../engine/catalog';
import { climateFor, generateOutfit, missingRequiredSlots, type Recommendation, type RegenScope, regenerateOutfit } from '../../engine/recommend';
import { hashString } from '../../engine/random';
import { type Adjustments, NEUTRAL_ADJUSTMENTS } from '../../engine/scoring';
import { emptySession, sessionReducer } from '../../engine/session';
import type { Occasion, OutfitSlots, SlotKey, WardrobeItem, WeatherContext } from '../../types/models';
import { localDateKey } from '../../utils/date';
import { useApp } from '../app/AppState';
import { buildContext, type EngineInputs, loadEngineInputs } from './engineContext';

const TODAY_KEY = 'today_state';

interface PersistedToday {
  date: string;
  recommendation: Recommendation;
  lockedIds: string[];
  occasion: Occasion;
  adjustments: Adjustments;
}

export type TodayStatus = 'loading' | 'empty' | 'insufficient' | 'ready';

export function useTodayOutfit(weather: WeatherContext | null, weatherLoading: boolean) {
  const { db, prefs, dataVersion, notifyDataChanged } = useApp();
  const [session, dispatch] = useReducer(sessionReducer, emptySession);
  const [inputs, setInputs] = useState<EngineInputs | null>(null);
  const [occasion, setOccasionState] = useState<Occasion>(prefs.defaultOccasion);
  const [adjustments, setAdjustmentsState] = useState<Adjustments>(NEUTRAL_ADJUSTMENTS);
  const [emptyReason, setEmptyReason] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  // Latest weather for callbacks, without regenerating when it refreshes.
  const weatherRef = useRef(weather);
  useLayoutEffect(() => {
    weatherRef.current = weather;
  });

  const itemsById = useMemo(() => new Map((inputs?.items ?? []).map((i) => [i.id, i])), [inputs]);

  // Load (and reload after any data change) the wardrobe + history.
  useEffect(() => {
    let alive = true;
    loadEngineInputs(db)
      .then((i) => alive && setInputs(i))
      .catch(() => alive && setInputs({ items: [], lastWorn: {}, recentCombos: [], feedback: { likedCombos: [], dislikedCombos: [], itemFeedback: {} } }));
    return () => {
      alive = false;
    };
  }, [db, dataVersion]);

  const ctxFor = useCallback(
    (seed: number, occ = occasion, adj = adjustments, shown: string[] = session.shownIds) =>
      buildContext(inputs!, prefs, weatherRef.current, occ, adj, seed, shown),
    [inputs, prefs, occasion, adjustments, session.shownIds],
  );

  const freshGenerate = useCallback(
    (occ: Occasion = occasion, adj: Adjustments = adjustments) => {
      if (!inputs) return;
      const res = generateOutfit(ctxFor(hashString(`${localDateKey()}:${occ}`), occ, adj, []));
      if (!res.ok) {
        setEmptyReason(res.reason);
        dispatch({ type: 'reset' });
        return;
      }
      setEmptyReason(null);
      dispatch({ type: 'load', recommendation: res.recommendation });
      logRecommendation(db, res.recommendation.slots, res.recommendation.reasons, weatherRef.current?.summary ?? '').catch(() => undefined);
    },
    [inputs, ctxFor, occasion, adjustments, db],
  );

  // First load: restore today's saved state, or generate once weather has settled.
  useEffect(() => {
    if (!inputs || restored) return;
    let alive = true;
    (async () => {
      const saved = await getValue<PersistedToday>(db, TODAY_KEY).catch(() => null);
      if (!alive) return;
      if (saved && saved.date === localDateKey() && saved.recommendation?.slots) {
        setOccasionState(saved.occasion ?? prefs.defaultOccasion);
        setAdjustmentsState({ ...NEUTRAL_ADJUSTMENTS, ...saved.adjustments });
        dispatch({ type: 'load', recommendation: saved.recommendation, lockedIds: saved.lockedIds });
        setRestored(true);
        return;
      }
      if (weatherLoading) return; // wait so the first outfit uses real weather
      freshGenerate(prefs.defaultOccasion, NEUTRAL_ADJUSTMENTS);
      setRestored(true);
    })();
    return () => {
      alive = false;
    };
  }, [inputs, restored, weatherLoading, db, prefs.defaultOccasion, freshGenerate]);

  // If the wardrobe was empty and items were just added, generate as soon as they load.
  const hasOutfit = !!session.current;
  useEffect(() => {
    if (restored && !hasOutfit && inputs && inputs.items.some((i) => i.available)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacting to freshly loaded database rows
      freshGenerate();
    }
  }, [inputs, restored, hasOutfit, freshGenerate]);

  // Drop slots whose item was deleted (never substitute silently).
  useEffect(() => {
    if (inputs) dispatch({ type: 'pruneMissing', existingIds: inputs.items.map((i) => i.id) });
  }, [inputs]);

  // Persist the current outfit for today.
  const currentRec = session.current;
  const lockedIds = session.lockedIds;
  useEffect(() => {
    if (!currentRec || !restored) return;
    const value: PersistedToday = { date: localDateKey(), recommendation: currentRec, lockedIds, occasion, adjustments };
    setValue(db, TODAY_KEY, value).catch(() => undefined);
  }, [currentRec, lockedIds, occasion, adjustments, restored, db]);

  const regenerate = useCallback(
    (scope: RegenScope, override?: { occasion?: Occasion; adjustments?: Adjustments }) => {
      if (!inputs) return;
      if (!session.current) {
        freshGenerate(override?.occasion, override?.adjustments);
        return;
      }
      setBusy(true);
      const seed = (Date.now() ^ hashString(JSON.stringify(session.current.slots))) >>> 0;
      const res = regenerateOutfit(ctxFor(seed, override?.occasion, override?.adjustments), {
        current: session.current.slots,
        lockedIds: session.lockedIds,
        scope,
      });
      if (res.ok) {
        dispatch({ type: 'regenerated', recommendation: res.recommendation, changedSlots: res.changedSlots });
        logRecommendation(db, res.recommendation.slots, res.recommendation.reasons, weatherRef.current?.summary ?? '').catch(() => undefined);
      } else {
        dispatch({ type: 'regenerateFailed', reason: res.reason });
      }
      setBusy(false);
    },
    [inputs, session, ctxFor, freshGenerate, db],
  );

  const setOccasion = useCallback(
    (o: Occasion) => {
      setOccasionState(o);
      if (session.current) regenerate({ kind: 'all' }, { occasion: o });
    },
    [regenerate, session],
  );

  const applyAdjustments = useCallback(
    (a: Adjustments) => {
      setAdjustmentsState(a);
      regenerate({ kind: 'all' }, { adjustments: a });
    },
    [regenerate],
  );

  /** Start Today from a specific item (locked) or a saved outfit. The previous outfit stays in undo. */
  const startWith = useCallback(
    (opts: { lockItemId?: string; slots?: OutfitSlots }) => {
      if (!inputs) return;
      const ctx = ctxFor((Date.now() >>> 0) ^ hashString(JSON.stringify(opts)), occasion, adjustments, []);
      if (opts.slots) {
        const valid: OutfitSlots = {};
        for (const [s, id] of Object.entries(opts.slots) as [SlotKey, string][]) if (itemsById.has(id)) valid[s] = id;
        dispatch({
          type: 'replace',
          lockedIds: [],
          recommendation: {
            slots: valid,
            score: 0,
            reasons: ['Loaded from your saved outfits. Lock what you love and regenerate the rest.'],
            warnings: [],
            climate: climateFor(ctx),
          },
        });
        setRestored(true);
        return;
      }
      const item = opts.lockItemId ? itemsById.get(opts.lockItemId) : undefined;
      if (!item) return;
      const res = regenerateOutfit(ctx, {
        current: { [slotForItem(item)]: item.id },
        lockedIds: [item.id],
        scope: { kind: 'all' },
      });
      if (res.ok) dispatch({ type: 'replace', recommendation: res.recommendation, lockedIds: [item.id] });
      else dispatch({ type: 'regenerateFailed', reason: res.reason });
      setRestored(true);
    },
    [inputs, itemsById, ctxFor, occasion, adjustments],
  );

  const currentIds = (): string[] => Object.values(session.current?.slots ?? {}).filter((x): x is string => !!x);

  const save = useCallback(
    async (name: string, opts: { favorite?: boolean } = {}) => {
      if (!session.current) throw new Error('No outfit to save');
      const id = await saveOutfit(db, {
        name,
        slots: session.current.slots,
        occasion,
        favorite: opts.favorite,
        styleTags: [...new Set(currentIds().flatMap((i) => itemsById.get(i)?.styleTags ?? []))].slice(0, 4),
        weather: weatherRef.current,
      });
      await addFeedback(db, 'combo', comboKeyForSlots(session.current.slots), 1);
      notifyDataChanged();
      return id;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db, session, occasion, itemsById, notifyDataChanged],
  );

  const markWorn = useCallback(async () => {
    if (!session.current) return;
    await logWear(db, { itemIds: currentIds() });
    notifyDataChanged();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, session, notifyDataChanged]);

  const dislike = useCallback(async () => {
    if (!session.current) return;
    await addFeedback(db, 'combo', comboKeyForSlots(session.current.slots), -1);
    const fresh = await loadEngineInputs(db);
    setInputs(fresh);
    regenerate({ kind: 'all' });
  }, [db, session, regenerate]);

  const items: WardrobeItem[] = inputs?.items ?? [];
  const missing = missingRequiredSlots(items);
  let status: TodayStatus = 'loading';
  if (inputs) {
    if (items.filter((i) => i.available).length === 0) status = 'empty';
    else if (!session.current && emptyReason) status = 'insufficient';
    else if (session.current) status = 'ready';
  }

  return {
    status,
    session,
    itemsById,
    items,
    missing,
    emptyReason,
    occasion,
    setOccasion,
    adjustments,
    applyAdjustments,
    regenerate,
    toggleLock: (itemId: string) => dispatch({ type: 'toggleLock', itemId }),
    undo: () => dispatch({ type: 'undo' }),
    clearMessage: () => dispatch({ type: 'clearMessage' }),
    startWith,
    save,
    markWorn,
    dislike,
    busy,
  };
}
