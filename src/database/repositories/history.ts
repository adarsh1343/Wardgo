// Wear history, recommendation feedback and the recommendation log.
import { slotForItem } from '../../engine/catalog';
import { comboKey } from '../../engine/scoring';
import type { Category, FeedbackEntry, FeedbackValue, OutfitSlots, WearEvent } from '../../types/models';
import { daysBetween, localDateKey } from '../../utils/date';
import { newId } from '../../utils/id';
import { type Db, nowIso, parseJsonArray } from '../db';

// ---------------------------------------------------------------- wear log
export async function logWear(db: Db, input: { itemIds: string[]; outfitId?: string | null; wornOn?: string }): Promise<string> {
  const id = newId();
  const wornOn = input.wornOn ?? localDateKey();
  await db.withTransactionAsync(async () => {
    await db.runAsync('INSERT INTO wear_events (id, outfit_id, worn_on, created_at) VALUES (?, ?, ?, ?)', [
      id,
      input.outfitId ?? null,
      wornOn,
      nowIso(),
    ]);
    for (const itemId of new Set(input.itemIds)) {
      const exists = await db.getFirstAsync<{ id: string }>('SELECT id FROM items WHERE id = ?', [itemId]);
      if (exists) await db.runAsync('INSERT INTO wear_event_items (event_id, item_id) VALUES (?, ?)', [id, itemId]);
    }
  });
  return id;
}

export async function deleteWearEvent(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM wear_events WHERE id = ?', [id]);
}

export async function listWearEvents(db: Db, limit = 200): Promise<WearEvent[]> {
  const events = await db.getAllAsync<{ id: string; outfit_id: string | null; worn_on: string; created_at: string }>(
    'SELECT * FROM wear_events ORDER BY worn_on DESC, created_at DESC LIMIT ?',
    [limit],
  );
  const links = await db.getAllAsync<{ event_id: string; item_id: string }>('SELECT * FROM wear_event_items');
  const byEvent = new Map<string, string[]>();
  for (const l of links) {
    const list = byEvent.get(l.event_id) ?? [];
    list.push(l.item_id);
    byEvent.set(l.event_id, list);
  }
  return events.map((e) => ({
    id: e.id,
    outfitId: e.outfit_id,
    wornOn: e.worn_on,
    createdAt: e.created_at,
    itemIds: byEvent.get(e.id) ?? [],
  }));
}

/** item id -> days since last worn (0 = today). */
export async function lastWornDaysAgo(db: Db, today = localDateKey()): Promise<Record<string, number>> {
  const rows = await db.getAllAsync<{ item_id: string; last: string }>(
    `SELECT wi.item_id AS item_id, MAX(w.worn_on) AS last
     FROM wear_event_items wi JOIN wear_events w ON w.id = wi.event_id GROUP BY wi.item_id`,
  );
  const out: Record<string, number> = {};
  for (const r of rows) out[r.item_id] = Math.max(0, daysBetween(r.last, today));
  return out;
}

const CORE = new Set(['top', 'outerwear', 'bottom', 'footwear']);

/** Core-combination keys of wear events in the last `days` days. */
export async function recentComboKeys(db: Db, days = 14, today = localDateKey()): Promise<string[]> {
  const events = await listWearEvents(db, 100);
  const itemSlots = await db.getAllAsync<{ id: string; category: Category; subcategory: string }>(
    'SELECT id, category, subcategory FROM items',
  );
  const slotOf = new Map<string, string>(itemSlots.map((i) => [i.id, slotForItem(i)]));
  return events
    .filter((e) => daysBetween(e.wornOn, today) <= days)
    .map((e) => comboKey(e.itemIds.filter((id) => CORE.has(slotOf.get(id) ?? ''))))
    .filter((k) => k.length > 0);
}

// ---------------------------------------------------------------- feedback
export async function addFeedback(db: Db, kind: 'combo' | 'item', targetKey: string, value: FeedbackValue): Promise<void> {
  await db.runAsync('INSERT INTO feedback (id, kind, target_key, value, created_at) VALUES (?, ?, ?, ?, ?)', [
    newId(),
    kind,
    targetKey,
    value,
    nowIso(),
  ]);
}

export function comboKeyForSlots(slots: OutfitSlots): string {
  return comboKey([slots.top, slots.outerwear, slots.bottom, slots.footwear]);
}

export async function listFeedback(db: Db): Promise<FeedbackEntry[]> {
  const rows = await db.getAllAsync<{ id: string; kind: 'combo' | 'item'; target_key: string; value: number; created_at: string }>(
    'SELECT * FROM feedback ORDER BY created_at DESC',
  );
  return rows.map((r) => ({
    id: r.id,
    kind: r.kind,
    targetKey: r.target_key,
    value: (r.value > 0 ? 1 : -1) as FeedbackValue,
    createdAt: r.created_at,
  }));
}

export async function deleteFeedback(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM feedback WHERE id = ?', [id]);
}

export async function clearFeedback(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM feedback');
}

export interface FeedbackSummary {
  likedCombos: string[];
  dislikedCombos: string[];
  itemFeedback: Record<string, number>;
}

export async function feedbackSummary(db: Db): Promise<FeedbackSummary> {
  const rows = await listFeedback(db);
  const comboNet = new Map<string, number>();
  const itemFeedback: Record<string, number> = {};
  for (const r of rows) {
    if (r.kind === 'combo') comboNet.set(r.targetKey, (comboNet.get(r.targetKey) ?? 0) + r.value);
    else itemFeedback[r.targetKey] = (itemFeedback[r.targetKey] ?? 0) + r.value;
  }
  return {
    likedCombos: [...comboNet].filter(([, v]) => v > 0).map(([k]) => k),
    dislikedCombos: [...comboNet].filter(([, v]) => v < 0).map(([k]) => k),
    itemFeedback,
  };
}

// ------------------------------------------------------- recommendation log
export interface RecommendationLogEntry {
  id: string;
  slots: OutfitSlots;
  reasons: string[];
  weatherSummary: string;
  createdAt: string;
}

export async function logRecommendation(db: Db, slots: OutfitSlots, reasons: string[], weatherSummary: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO recommendation_log (id, slots_json, reasons_json, weather_summary, created_at) VALUES (?, ?, ?, ?, ?)',
    [newId(), JSON.stringify(slots), JSON.stringify(reasons), weatherSummary, nowIso()],
  );
  // Keep the log bounded.
  await db.runAsync(
    'DELETE FROM recommendation_log WHERE id NOT IN (SELECT id FROM recommendation_log ORDER BY created_at DESC LIMIT 200)',
  );
}

export async function listRecommendationLog(db: Db, limit = 50): Promise<RecommendationLogEntry[]> {
  const rows = await db.getAllAsync<{ id: string; slots_json: string; reasons_json: string; weather_summary: string; created_at: string }>(
    'SELECT * FROM recommendation_log ORDER BY created_at DESC LIMIT ?',
    [limit],
  );
  return rows.map((r) => {
    let slots: OutfitSlots = {};
    try {
      slots = JSON.parse(r.slots_json) as OutfitSlots;
    } catch {
      slots = {};
    }
    return { id: r.id, slots, reasons: parseJsonArray(r.reasons_json), weatherSummary: r.weather_summary, createdAt: r.created_at };
  });
}

export async function clearRecommendationLog(db: Db): Promise<void> {
  await db.runAsync('DELETE FROM recommendation_log');
}
