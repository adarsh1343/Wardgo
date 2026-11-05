// Pure state machine for the outfit being edited on the Today screen:
// current recommendation, lock set, and an undo stack. The previous outfit is
// only replaced when a regeneration succeeds.
import type { OutfitSlots, SlotKey } from '../types/models';
import type { Recommendation } from './recommend';

export interface OutfitSession {
  current: Recommendation | null;
  /** Previous recommendations, most recent last. */
  past: Recommendation[];
  lockedIds: string[];
  /** Item IDs shown during this session's regenerations (for variety). */
  shownIds: string[];
  /** Last user-facing status message (e.g. why a regeneration failed). */
  message: string | null;
  /** Slots that changed in the most recent regeneration (for highlight animation). */
  changedSlots: SlotKey[];
}

export const MAX_UNDO = 20;

export const emptySession: OutfitSession = {
  current: null,
  past: [],
  lockedIds: [],
  shownIds: [],
  message: null,
  changedSlots: [],
};

export type SessionAction =
  | { type: 'load'; recommendation: Recommendation; lockedIds?: string[] }
  | { type: 'regenerated'; recommendation: Recommendation; changedSlots: SlotKey[] }
  | { type: 'regenerateFailed'; reason: string }
  | { type: 'replace'; recommendation: Recommendation; lockedIds: string[] }
  | { type: 'pruneMissing'; existingIds: string[] }
  | { type: 'undo' }
  | { type: 'toggleLock'; itemId: string }
  | { type: 'setLocks'; lockedIds: string[] }
  | { type: 'clearMessage' }
  | { type: 'reset' };

function idsIn(slots: OutfitSlots): string[] {
  return Object.values(slots).filter((x): x is string => !!x);
}

export function sessionReducer(state: OutfitSession, action: SessionAction): OutfitSession {
  switch (action.type) {
    case 'load': {
      const ids = idsIn(action.recommendation.slots);
      return {
        ...emptySession,
        current: action.recommendation,
        lockedIds: (action.lockedIds ?? []).filter((id) => ids.includes(id)),
        shownIds: ids,
      };
    }
    case 'regenerated': {
      if (!state.current) return { ...state, current: action.recommendation };
      const nextIds = idsIn(action.recommendation.slots);
      // Defensive: a regeneration that drops a locked item never commits.
      const lostLock = state.lockedIds.find((id) => !nextIds.includes(id));
      if (lostLock) {
        return { ...state, message: 'That result changed a locked item, so it was discarded.' };
      }
      return {
        ...state,
        past: [...state.past, state.current].slice(-MAX_UNDO),
        current: action.recommendation,
        shownIds: [...new Set([...state.shownIds, ...nextIds])].slice(-40),
        message: null,
        changedSlots: action.changedSlots,
      };
    }
    case 'replace': {
      // Start from a different outfit (e.g. "style this item") while keeping undo history.
      const ids = idsIn(action.recommendation.slots);
      return {
        ...state,
        past: state.current ? [...state.past, state.current].slice(-MAX_UNDO) : state.past,
        current: action.recommendation,
        lockedIds: action.lockedIds.filter((id) => ids.includes(id)),
        shownIds: [...new Set([...state.shownIds, ...ids])].slice(-40),
        message: null,
        changedSlots: [],
      };
    }
    case 'pruneMissing': {
      // Items deleted from the wardrobe leave an empty slot; nothing is substituted.
      const keep = new Set(action.existingIds);
      const prune = (r: Recommendation): Recommendation => {
        const slots: OutfitSlots = {};
        for (const [k, v] of Object.entries(r.slots) as [SlotKey, string | undefined][]) if (v && keep.has(v)) slots[k] = v;
        return { ...r, slots };
      };
      const count = (r: Recommendation) => idsIn(r.slots).length;
      const current = state.current ? prune(state.current) : null;
      const past = state.past.map(prune);
      const currentChanged = !!state.current && count(current!) !== count(state.current);
      const pastChanged = past.some((p, i) => count(p) !== count(state.past[i]!));
      if (!currentChanged && !pastChanged) return state;
      return {
        ...state,
        current,
        past,
        lockedIds: state.lockedIds.filter((id) => keep.has(id)),
        message: currentChanged ? 'An item in this outfit was deleted from your wardrobe. Regenerate to fill the gap.' : state.message,
        changedSlots: [],
      };
    }
    case 'regenerateFailed':
      // The current outfit stays untouched.
      return { ...state, message: action.reason, changedSlots: [] };
    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return { ...state, message: 'Nothing to undo.' };
      const ids = idsIn(previous.slots);
      return {
        ...state,
        current: previous,
        past: state.past.slice(0, -1),
        lockedIds: state.lockedIds.filter((id) => ids.includes(id)),
        message: null,
        changedSlots: [],
      };
    }
    case 'toggleLock': {
      if (!state.current || !idsIn(state.current.slots).includes(action.itemId)) return state;
      const locked = state.lockedIds.includes(action.itemId);
      return {
        ...state,
        lockedIds: locked ? state.lockedIds.filter((id) => id !== action.itemId) : [...state.lockedIds, action.itemId],
      };
    }
    case 'setLocks': {
      const ids = state.current ? idsIn(state.current.slots) : [];
      return { ...state, lockedIds: action.lockedIds.filter((id) => ids.includes(id)) };
    }
    case 'clearMessage':
      return { ...state, message: null };
    case 'reset':
      return emptySession;
  }
}
