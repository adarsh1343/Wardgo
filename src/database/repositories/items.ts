import type {
  Category,
  Formality,
  ItemImage,
  Pattern,
  RainSuitability,
  Season,
  WardrobeItem,
  Warmth,
} from '../../types/models';
import { newId } from '../../utils/id';
import { type Db, nowIso, parseJsonArray } from '../db';

interface ItemRow {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  primary_color: string;
  secondary_colors: string;
  pattern: Pattern;
  material: string;
  seasons: string;
  formality: number;
  style_tags: string;
  warmth: number;
  rain: RainSuitability;
  notes: string;
  favorite: number;
  available: number;
  created_at: string;
  updated_at: string;
}

interface ImageRow {
  id: string;
  item_id: string;
  file_name: string;
  thumb_file_name: string | null;
  position: number;
}

export type ItemInput = Omit<WardrobeItem, 'id' | 'createdAt' | 'updatedAt' | 'images'>;
export interface ImageInput {
  fileName: string;
  thumbFileName: string | null;
}

const clamp = (n: number) => Math.min(5, Math.max(1, Math.round(n)));

function toImage(r: ImageRow): ItemImage {
  return { id: r.id, itemId: r.item_id, fileName: r.file_name, thumbFileName: r.thumb_file_name, position: r.position };
}

function toItem(r: ItemRow, images: ItemImage[]): WardrobeItem {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    subcategory: r.subcategory,
    primaryColor: r.primary_color,
    secondaryColors: parseJsonArray(r.secondary_colors),
    pattern: r.pattern,
    material: r.material,
    seasons: parseJsonArray(r.seasons) as Season[],
    formality: clamp(r.formality) as Formality,
    styleTags: parseJsonArray(r.style_tags),
    warmth: clamp(r.warmth) as Warmth,
    rain: r.rain,
    notes: r.notes,
    favorite: r.favorite === 1,
    available: r.available === 1,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    images,
  };
}

export async function listItems(db: Db): Promise<WardrobeItem[]> {
  const rows = await db.getAllAsync<ItemRow>('SELECT * FROM items ORDER BY created_at DESC');
  const imgs = await db.getAllAsync<ImageRow>('SELECT * FROM item_images ORDER BY position ASC');
  const byItem = new Map<string, ItemImage[]>();
  for (const r of imgs) {
    const list = byItem.get(r.item_id) ?? [];
    list.push(toImage(r));
    byItem.set(r.item_id, list);
  }
  return rows.map((r) => toItem(r, byItem.get(r.id) ?? []));
}

export async function getItem(db: Db, id: string): Promise<WardrobeItem | null> {
  const row = await db.getFirstAsync<ItemRow>('SELECT * FROM items WHERE id = ?', [id]);
  if (!row) return null;
  const imgs = await db.getAllAsync<ImageRow>('SELECT * FROM item_images WHERE item_id = ? ORDER BY position', [id]);
  return toItem(row, imgs.map(toImage));
}

function itemParams(input: ItemInput) {
  return [
    input.name.trim() || 'Untitled piece',
    input.category,
    input.subcategory,
    input.primaryColor,
    JSON.stringify(input.secondaryColors),
    input.pattern,
    input.material.trim(),
    JSON.stringify(input.seasons),
    clamp(input.formality),
    JSON.stringify(input.styleTags),
    clamp(input.warmth),
    input.rain,
    input.notes,
    input.favorite ? 1 : 0,
    input.available ? 1 : 0,
  ];
}

async function writeImages(db: Db, itemId: string, images: ImageInput[]) {
  let pos = 0;
  for (const img of images) {
    await db.runAsync(
      'INSERT INTO item_images (id, item_id, file_name, thumb_file_name, position, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [newId(), itemId, img.fileName, img.thumbFileName, pos++, nowIso()],
    );
  }
}

export async function createItem(db: Db, input: ItemInput, images: ImageInput[]): Promise<string> {
  const id = newId();
  const now = nowIso();
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO items (name, category, subcategory, primary_color, secondary_colors, pattern, material, seasons,
        formality, style_tags, warmth, rain, notes, favorite, available, id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [...itemParams(input), id, now, now],
    );
    await writeImages(db, id, images);
  });
  return id;
}

/**
 * Updates an item and replaces its image list. Returns the image files that are
 * no longer referenced so the caller can delete them from disk.
 */
export async function updateItem(db: Db, id: string, input: ItemInput, images: ImageInput[]): Promise<ImageInput[]> {
  const before = await db.getAllAsync<ImageRow>('SELECT * FROM item_images WHERE item_id = ?', [id]);
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE items SET name = ?, category = ?, subcategory = ?, primary_color = ?, secondary_colors = ?, pattern = ?,
        material = ?, seasons = ?, formality = ?, style_tags = ?, warmth = ?, rain = ?, notes = ?, favorite = ?,
        available = ?, updated_at = ? WHERE id = ?`,
      [...itemParams(input), nowIso(), id],
    );
    await db.runAsync('DELETE FROM item_images WHERE item_id = ?', [id]);
    await writeImages(db, id, images);
  });
  const keep = new Set(images.map((i) => i.fileName));
  return before
    .filter((b) => !keep.has(b.file_name))
    .map((b) => ({ fileName: b.file_name, thumbFileName: b.thumb_file_name }));
}

export async function setItemFlags(db: Db, id: string, flags: { favorite?: boolean; available?: boolean }) {
  if (flags.favorite !== undefined) {
    await db.runAsync('UPDATE items SET favorite = ?, updated_at = ? WHERE id = ?', [flags.favorite ? 1 : 0, nowIso(), id]);
  }
  if (flags.available !== undefined) {
    await db.runAsync('UPDATE items SET available = ?, updated_at = ? WHERE id = ?', [flags.available ? 1 : 0, nowIso(), id]);
  }
}

export async function countOutfitsUsingItem(db: Db, id: string): Promise<number> {
  const r = await db.getFirstAsync<{ n: number }>('SELECT COUNT(DISTINCT outfit_id) AS n FROM outfit_items WHERE item_id = ?', [id]);
  return r?.n ?? 0;
}

/**
 * Deletes an item. Saved outfits keep a "removed" placeholder for its slot
 * (outfit_items.item_id becomes NULL via ON DELETE SET NULL). Returns image
 * files to remove from disk.
 */
export async function deleteItem(db: Db, id: string): Promise<ImageInput[]> {
  const imgs = await db.getAllAsync<ImageRow>('SELECT * FROM item_images WHERE item_id = ?', [id]);
  await db.withTransactionAsync(async () => {
    // Make sure saved outfits remember the name of what was removed.
    await db.runAsync(
      `UPDATE outfit_items SET item_name = (SELECT name FROM items WHERE id = ?) WHERE item_id = ?`,
      [id, id],
    );
    await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
  });
  return imgs.map((b) => ({ fileName: b.file_name, thumbFileName: b.thumb_file_name }));
}

export async function allImageFileNames(db: Db): Promise<Set<string>> {
  const rows = await db.getAllAsync<ImageRow>('SELECT file_name, thumb_file_name FROM item_images');
  const set = new Set<string>();
  for (const r of rows) {
    set.add(r.file_name);
    if (r.thumb_file_name) set.add(r.thumb_file_name);
  }
  return set;
}
