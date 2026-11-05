import { migrate, LATEST_VERSION } from '../src/database/migrations';
import * as albums from '../src/database/repositories/albums';
import * as history from '../src/database/repositories/history';
import * as items from '../src/database/repositories/items';
import * as outfits from '../src/database/repositories/outfits';
import { loadPreferences, savePreferences, DEFAULT_PREFERENCES, sanitizePreferences } from '../src/database/repositories/preferences';
import type { ItemInput } from '../src/database/repositories/items';
import { createTestDb } from './nodeDb';

const input = (name: string, subcategory: string, category: ItemInput['category']): ItemInput => ({
  name,
  category,
  subcategory,
  primaryColor: 'black',
  secondaryColors: ['white'],
  pattern: 'solid',
  material: 'cotton',
  seasons: ['autumn'],
  formality: 2,
  styleTags: ['casual'],
  warmth: 2,
  rain: 'ok',
  notes: '',
  favorite: false,
  available: true,
});

async function setup() {
  const db = createTestDb();
  await migrate(db);
  return db;
}

describe('migrations', () => {
  test('creates schema and is idempotent', async () => {
    const db = createTestDb();
    expect(await migrate(db)).toBe(LATEST_VERSION);
    expect(await migrate(db)).toBe(LATEST_VERSION);
    const fk = await db.getFirstAsync<{ foreign_keys: number }>('PRAGMA foreign_keys');
    expect(fk?.foreign_keys).toBe(1);
  });

  test('refuses a database from a newer app version', async () => {
    const db = createTestDb();
    await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION + 5}`);
    await expect(migrate(db)).rejects.toThrow(/newer/);
  });
});

describe('wardrobe items', () => {
  test('create, read, update with images, delete', async () => {
    const db = await setup();
    const id = await items.createItem(db, input('Black shirt', 'shirt', 'top'), [
      { fileName: 'a.jpg', thumbFileName: 'a_t.jpg' },
    ]);
    const got = await items.getItem(db, id);
    expect(got?.name).toBe('Black shirt');
    expect(got?.secondaryColors).toEqual(['white']);
    expect(got?.images.map((i) => i.fileName)).toEqual(['a.jpg']);

    const removed = await items.updateItem(db, id, { ...input('Black oxford', 'shirt', 'top'), favorite: true }, [
      { fileName: 'b.jpg', thumbFileName: null },
    ]);
    expect(removed).toEqual([{ fileName: 'a.jpg', thumbFileName: 'a_t.jpg' }]);
    const updated = await items.getItem(db, id);
    expect(updated?.name).toBe('Black oxford');
    expect(updated?.favorite).toBe(true);

    const files = await items.deleteItem(db, id);
    expect(files.map((f) => f.fileName)).toEqual(['b.jpg']);
    expect(await items.getItem(db, id)).toBeNull();
    const imgs = await db.getAllAsync('SELECT * FROM item_images');
    expect(imgs).toHaveLength(0);
  });

  test('constraint: formality must be 1-5 (clamped by repository)', async () => {
    const db = await setup();
    const id = await items.createItem(db, { ...input('X', 'tshirt', 'top'), formality: 9 as never }, []);
    expect((await items.getItem(db, id))?.formality).toBe(5);
  });
});

describe('outfits and item deletion', () => {
  test('saving references items without copying them', async () => {
    const db = await setup();
    const top = await items.createItem(db, input('Shirt', 'shirt', 'top'), []);
    const bottom = await items.createItem(db, input('Jeans', 'jeans', 'bottom'), []);
    const oid = await outfits.saveOutfit(db, { name: 'Look', slots: { top, bottom } });
    expect((await items.listItems(db)).length).toBe(2);
    const o = await outfits.getOutfit(db, oid);
    expect(o?.items.map((i) => i.itemId)).toEqual([top, bottom]);
  });

  test('saving with a missing item fails and writes nothing', async () => {
    const db = await setup();
    await expect(outfits.saveOutfit(db, { name: 'Bad', slots: { top: 'ghost' } })).rejects.toThrow(/no longer exists/);
    expect(await outfits.listOutfits(db)).toHaveLength(0);
  });

  test('deleting an item leaves a named placeholder, never a substitute', async () => {
    const db = await setup();
    const top = await items.createItem(db, input('Grey jeans', 'jeans', 'bottom'), []);
    const shirt = await items.createItem(db, input('Shirt', 'shirt', 'top'), []);
    const oid = await outfits.saveOutfit(db, { name: 'Look', slots: { bottom: top, top: shirt } });
    expect(await items.countOutfitsUsingItem(db, top)).toBe(1);
    await items.deleteItem(db, top);
    const o = await outfits.getOutfit(db, oid);
    const slot = o?.items.find((i) => i.slot === 'bottom');
    expect(slot?.itemId).toBeNull();
    expect(slot?.itemName).toBe('Grey jeans');
    expect(o?.items.find((i) => i.slot === 'top')?.itemId).toBe(shirt);
    expect(outfits.outfitToSlots(o!)).toEqual({ top: shirt });
  });

  test('detects an already-saved combination', async () => {
    const db = await setup();
    const top = await items.createItem(db, input('Shirt', 'shirt', 'top'), []);
    const oid = await outfits.saveOutfit(db, { name: 'Look', slots: { top } });
    expect(await outfits.findSavedOutfitWithSlots(db, { top })).toBe(oid);
    expect(await outfits.findSavedOutfitWithSlots(db, {})).toBeNull();
  });
});

describe('albums', () => {
  test('outfits can be in many albums; deleting an album keeps outfits', async () => {
    const db = await setup();
    const top = await items.createItem(db, input('Shirt', 'shirt', 'top'), []);
    const o1 = await outfits.saveOutfit(db, { name: 'One', slots: { top } });
    const a = await albums.createAlbum(db, 'Work');
    const b = await albums.createAlbum(db, 'Travel');
    await albums.setOutfitAlbums(db, o1, [a, b]);
    expect((await albums.albumIdsForOutfit(db, o1)).sort()).toEqual([a, b].sort());

    await albums.updateAlbum(db, a, { coverOutfitId: o1 });
    await albums.deleteAlbum(db, a);
    expect(await outfits.getOutfit(db, o1)).not.toBeNull();
    expect(await albums.albumIdsForOutfit(db, o1)).toEqual([b]);
  });

  test('reorder, rename and remove', async () => {
    const db = await setup();
    const a = await albums.createAlbum(db, 'A');
    const b = await albums.createAlbum(db, 'B');
    const c = await albums.createAlbum(db, 'C');
    await albums.reorderAlbums(db, [c, a, b]);
    expect((await albums.listAlbums(db)).map((x) => x.name)).toEqual(['C', 'A', 'B']);
    await albums.updateAlbum(db, a, { name: 'Renamed', description: 'desc' });
    expect((await albums.getAlbum(db, a))?.name).toBe('Renamed');
  });

  test('deleting an outfit removes it from albums and clears cover', async () => {
    const db = await setup();
    const top = await items.createItem(db, input('Shirt', 'shirt', 'top'), []);
    const o1 = await outfits.saveOutfit(db, { name: 'One', slots: { top } });
    const a = await albums.createAlbum(db, 'A');
    await albums.addOutfitsToAlbum(db, a, [o1, o1]);
    await albums.updateAlbum(db, a, { coverOutfitId: o1 });
    await outfits.deleteOutfit(db, o1);
    const album = await albums.getAlbum(db, a);
    expect(album?.outfitIds).toEqual([]);
    expect(album?.coverOutfitId).toBeNull();
  });
});

describe('history and feedback', () => {
  test('wear log drives last-worn and recent combos', async () => {
    const db = await setup();
    const top = await items.createItem(db, input('Shirt', 'shirt', 'top'), []);
    const bottom = await items.createItem(db, input('Jeans', 'jeans', 'bottom'), []);
    const watch = await items.createItem(db, input('Watch', 'watch', 'accessory'), []);
    await history.logWear(db, { itemIds: [top, bottom, watch], wornOn: '2026-10-17' });
    const days = await history.lastWornDaysAgo(db, '2026-10-19');
    expect(days[top]).toBe(2);
    const combos = await history.recentComboKeys(db, 14, '2026-10-19');
    expect(combos).toEqual([[top, bottom].sort().join('|')]);
  });

  test('feedback summary nets likes and dislikes', async () => {
    const db = await setup();
    await history.addFeedback(db, 'combo', 'a|b', -1);
    await history.addFeedback(db, 'combo', 'c|d', 1);
    await history.addFeedback(db, 'item', 'x', -1);
    const s = await history.feedbackSummary(db);
    expect(s.dislikedCombos).toEqual(['a|b']);
    expect(s.likedCombos).toEqual(['c|d']);
    expect(s.itemFeedback.x).toBe(-1);
  });
});

describe('preferences', () => {
  test('defaults, round-trip and sanitising bad values', async () => {
    const db = await setup();
    expect(await loadPreferences(db)).toEqual(DEFAULT_PREFERENCES);
    await savePreferences(db, { ...DEFAULT_PREFERENCES, units: 'F', maxAccessories: 4 });
    expect((await loadPreferences(db)).units).toBe('F');
    const bad = sanitizePreferences({ units: 'K', maxAccessories: 99, reminder: { enabled: true, hour: 30 } });
    expect(bad.units).toBe('C');
    expect(bad.maxAccessories).toBe(5);
    expect(bad.reminder.hour).toBe(DEFAULT_PREFERENCES.reminder.hour);
  });
});
