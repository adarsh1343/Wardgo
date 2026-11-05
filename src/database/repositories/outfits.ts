import type { OutfitSlots, SavedOutfit, SavedOutfitItem, SlotKey, WeatherContext } from '../../types/models';
import { SLOT_ORDER } from '../../engine/catalog';
import { newId } from '../../utils/id';
import { type Db, nowIso, parseJsonArray } from '../db';

interface OutfitRow {
  id: string;
  name: string;
  favorite: number;
  notes: string;
  style_tags: string;
  occasion: string;
  weather_json: string | null;
  created_at: string;
  updated_at: string;
  wear_count: number;
  last_worn_on: string | null;
}

interface OutfitItemRow {
  outfit_id: string;
  slot: SlotKey;
  item_id: string | null;
  item_name: string;
}

function parseWeather(s: string | null): WeatherContext | null {
  if (!s) return null;
  try {
    const w = JSON.parse(s) as WeatherContext;
    return typeof w.tempC === 'number' ? w : null;
  } catch {
    return null;
  }
}

const OUTFIT_SELECT = `
  SELECT o.*,
    (SELECT COUNT(*) FROM wear_events w WHERE w.outfit_id = o.id) AS wear_count,
    (SELECT MAX(worn_on) FROM wear_events w WHERE w.outfit_id = o.id) AS last_worn_on
  FROM outfits o`;

function assemble(rows: OutfitRow[], itemRows: OutfitItemRow[]): SavedOutfit[] {
  const byOutfit = new Map<string, SavedOutfitItem[]>();
  for (const r of itemRows) {
    const list = byOutfit.get(r.outfit_id) ?? [];
    list.push({ slot: r.slot, itemId: r.item_id, itemName: r.item_name });
    byOutfit.set(r.outfit_id, list);
  }
  const order = (s: SlotKey) => SLOT_ORDER.indexOf(s);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    favorite: r.favorite === 1,
    notes: r.notes,
    styleTags: parseJsonArray(r.style_tags),
    occasion: r.occasion,
    weather: parseWeather(r.weather_json),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    items: (byOutfit.get(r.id) ?? []).sort((a, b) => order(a.slot) - order(b.slot)),
    wearCount: r.wear_count,
    lastWornOn: r.last_worn_on,
  }));
}

export async function listOutfits(db: Db): Promise<SavedOutfit[]> {
  const rows = await db.getAllAsync<OutfitRow>(`${OUTFIT_SELECT} ORDER BY o.created_at DESC`);
  const items = await db.getAllAsync<OutfitItemRow>('SELECT * FROM outfit_items');
  return assemble(rows, items);
}

export async function getOutfit(db: Db, id: string): Promise<SavedOutfit | null> {
  const rows = await db.getAllAsync<OutfitRow>(`${OUTFIT_SELECT} WHERE o.id = ?`, [id]);
  if (rows.length === 0) return null;
  const items = await db.getAllAsync<OutfitItemRow>('SELECT * FROM outfit_items WHERE outfit_id = ?', [id]);
  return assemble(rows, items)[0] ?? null;
}

export interface SaveOutfitInput {
  name: string;
  slots: OutfitSlots;
  occasion?: string;
  styleTags?: string[];
  notes?: string;
  favorite?: boolean;
  weather?: WeatherContext | null;
}

/** Saves references to existing wardrobe items. Items are never copied. */
export async function saveOutfit(db: Db, input: SaveOutfitInput): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO outfits (id, name, favorite, notes, style_tags, occasion, weather_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.name.trim() || 'Untitled outfit',
        input.favorite ? 1 : 0,
        input.notes ?? '',
        JSON.stringify(input.styleTags ?? []),
        input.occasion ?? '',
        input.weather ? JSON.stringify(input.weather) : null,
        now,
        now,
      ],
    );
    for (const slot of SLOT_ORDER) {
      const itemId = input.slots[slot];
      if (!itemId) continue;
      const item = await db.getFirstAsync<{ name: string }>('SELECT name FROM items WHERE id = ?', [itemId]);
      if (!item) throw new Error(`Cannot save outfit: wardrobe item ${itemId} no longer exists.`);
      await db.runAsync('INSERT INTO outfit_items (outfit_id, slot, item_id, item_name) VALUES (?, ?, ?, ?)', [
        id,
        slot,
        itemId,
        item.name,
      ]);
    }
  });
  return id;
}

export interface OutfitPatch {
  name?: string;
  notes?: string;
  favorite?: boolean;
  styleTags?: string[];
  occasion?: string;
}

export async function updateOutfit(db: Db, id: string, patch: OutfitPatch): Promise<void> {
  const sets: string[] = [];
  const params: (string | number)[] = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    params.push(patch.name.trim() || 'Untitled outfit');
  }
  if (patch.notes !== undefined) {
    sets.push('notes = ?');
    params.push(patch.notes);
  }
  if (patch.favorite !== undefined) {
    sets.push('favorite = ?');
    params.push(patch.favorite ? 1 : 0);
  }
  if (patch.styleTags !== undefined) {
    sets.push('style_tags = ?');
    params.push(JSON.stringify(patch.styleTags));
  }
  if (patch.occasion !== undefined) {
    sets.push('occasion = ?');
    params.push(patch.occasion);
  }
  if (sets.length === 0) return;
  sets.push('updated_at = ?');
  params.push(nowIso(), id);
  await db.runAsync(`UPDATE outfits SET ${sets.join(', ')} WHERE id = ?`, params);
}

/** Album links and outfit_items are removed by ON DELETE CASCADE; wardrobe items are untouched. */
export async function deleteOutfit(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM outfits WHERE id = ?', [id]);
}

/** Signature used to detect whether the same combination is already saved. */
export function outfitSignature(slots: OutfitSlots): string {
  return SLOT_ORDER.map((s) => `${s}:${slots[s] ?? ''}`).join(',');
}

export async function findSavedOutfitWithSlots(db: Db, slots: OutfitSlots): Promise<string | null> {
  const sig = outfitSignature(slots);
  const all = await listOutfits(db);
  for (const o of all) {
    const os: OutfitSlots = {};
    for (const it of o.items) if (it.itemId) os[it.slot] = it.itemId;
    if (o.items.every((it) => it.itemId) && outfitSignature(os) === sig) return o.id;
  }
  return null;
}

export function outfitToSlots(outfit: SavedOutfit): OutfitSlots {
  const slots: OutfitSlots = {};
  for (const it of outfit.items) if (it.itemId) slots[it.slot] = it.itemId;
  return slots;
}
