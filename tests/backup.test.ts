import { LATEST_VERSION, migrate } from '../src/database/migrations';
import * as albums from '../src/database/repositories/albums';
import * as items from '../src/database/repositories/items';
import * as outfits from '../src/database/repositories/outfits';
import { savePreferences, loadPreferences, DEFAULT_PREFERENCES } from '../src/database/repositories/preferences';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  applyRestorePlan,
  planRestore,
  readExistingIds,
  readTablesForBackup,
  validateBackup,
} from '../src/services/storage/backupFormat';
import { createTestDb } from './nodeDb';

const baseInput = {
  category: 'top' as const,
  subcategory: 'shirt',
  primaryColor: 'black',
  secondaryColors: [],
  pattern: 'solid' as const,
  material: '',
  seasons: [],
  formality: 3 as const,
  styleTags: [],
  warmth: 2 as const,
  rain: 'ok' as const,
  notes: '',
  favorite: false,
  available: true,
};

async function seeded() {
  const db = createTestDb();
  await migrate(db);
  const shirt = await items.createItem(db, { ...baseInput, name: 'Shirt' }, [{ fileName: 'shirt.jpg', thumbFileName: 'shirt_t.jpg' }]);
  const jeans = await items.createItem(db, { ...baseInput, name: 'Jeans', category: 'bottom', subcategory: 'jeans' }, [
    { fileName: 'jeans.jpg', thumbFileName: null },
  ]);
  const o = await outfits.saveOutfit(db, { name: 'Look', slots: { top: shirt, bottom: jeans }, favorite: true });
  const a = await albums.createAlbum(db, 'Work');
  await albums.addOutfitsToAlbum(db, a, [o]);
  await albums.updateAlbum(db, a, { coverOutfitId: o });
  await savePreferences(db, { ...DEFAULT_PREFERENCES, units: 'F' });
  return { db, shirt, jeans, o, a };
}

async function archiveFrom(db: ReturnType<typeof createTestDb>, images: Record<string, string>) {
  return {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: LATEST_VERSION,
    exportedAt: '2026-10-19T00:00:00Z',
    appVersion: '1.0.0',
    tables: await readTablesForBackup(db),
    images,
  };
}

const noIds = () => ({
  items: new Set<string>(),
  outfits: new Set<string>(),
  albums: new Set<string>(),
  imageFiles: new Set<string>(),
  wearEvents: new Set<string>(),
  feedback: new Set<string>(),
});

describe('backup validation', () => {
  test('rejects non-backups and newer versions', () => {
    expect(validateBackup(null).ok).toBe(false);
    expect(validateBackup({ format: 'something-else' }).ok).toBe(false);
    expect(validateBackup({ format: BACKUP_FORMAT, formatVersion: 99, schemaVersion: 1, tables: {} }).ok).toBe(false);
    expect(validateBackup({ format: BACKUP_FORMAT, formatVersion: 1, schemaVersion: 1, tables: { items: 'x' } }).ok).toBe(false);
  });

  test('drops malformed rows and unsafe image names with warnings', () => {
    const v = validateBackup({
      format: BACKUP_FORMAT,
      formatVersion: 1,
      schemaVersion: 1,
      tables: { items: [{ id: 'a', name: { evil: true } }, 'junk'] },
      images: { '../../etc/passwd': 'AAAA', 'ok.jpg': 'AAAA' },
    });
    expect(v.ok).toBe(true);
    if (v.ok) {
      expect(v.archive.tables.items).toHaveLength(0);
      expect(v.warnings.join(' ')).toMatch(/Skipped 2/);
      expect(Object.keys(v.archive.images)).toEqual(['ok.jpg']);
    }
  });
});

describe('restore', () => {
  test('round-trip into a clean data store', async () => {
    const src = await seeded();
    const archive = await archiveFrom(src.db, { 'shirt.jpg': 'AAA', 'shirt_t.jpg': 'BBB', 'jeans.jpg': 'CCC' });
    const v = validateBackup(JSON.parse(JSON.stringify(archive)));
    if (!v.ok) throw new Error(v.error);

    const dest = createTestDb();
    await migrate(dest);
    const plan = planRestore(v.archive, 'replace', await readExistingIds(dest, new Set()));
    expect(Object.keys(plan.images).sort()).toEqual(['jeans.jpg', 'shirt.jpg', 'shirt_t.jpg']);
    await applyRestorePlan(dest, plan, 'replace');

    expect((await items.listItems(dest)).map((i) => i.name).sort()).toEqual(['Jeans', 'Shirt']);
    const o = await outfits.getOutfit(dest, src.o);
    expect(o?.favorite).toBe(true);
    expect(o?.items.map((i) => i.itemId).sort()).toEqual([src.shirt, src.jeans].sort());
    const a = await albums.getAlbum(dest, src.a);
    expect(a?.outfitIds).toEqual([src.o]);
    expect(a?.coverOutfitId).toBe(src.o);
    expect((await loadPreferences(dest)).units).toBe('F');
  });

  test('missing images: item restored without photo', async () => {
    const src = await seeded();
    const v = validateBackup(await archiveFrom(src.db, { 'shirt.jpg': 'AAA' }));
    if (!v.ok) throw new Error(v.error);
    const plan = planRestore(v.archive, 'replace', noIds());
    expect(plan.report.missingImages).toBe(1);
    const dest = createTestDb();
    await migrate(dest);
    await applyRestorePlan(dest, plan, 'replace');
    const jeans = await items.getItem(dest, src.jeans);
    expect(jeans?.images).toHaveLength(0);
    expect((await items.getItem(dest, src.shirt))?.images[0]?.thumbFileName).toBeNull();
  });

  test('merge with duplicate IDs keeps local records and does not duplicate', async () => {
    const src = await seeded();
    const v = validateBackup(await archiveFrom(src.db, { 'shirt.jpg': 'AAA', 'jeans.jpg': 'CCC' }));
    if (!v.ok) throw new Error(v.error);
    await items.updateItem(src.db, src.shirt, { ...baseInput, name: 'Local edit' }, [{ fileName: 'shirt.jpg', thumbFileName: 'shirt_t.jpg' }]);
    const plan = planRestore(v.archive, 'merge', await readExistingIds(src.db, new Set(['shirt.jpg', 'shirt_t.jpg', 'jeans.jpg'])));
    expect(plan.report.items).toBe(0);
    expect(plan.report.skippedDuplicates).toBeGreaterThan(0);
    await applyRestorePlan(src.db, plan, 'merge');
    expect((await items.listItems(src.db)).length).toBe(2);
    expect((await items.getItem(src.db, src.shirt))?.name).toBe('Local edit');
    expect((await loadPreferences(src.db)).units).toBe('F');
  });

  test('dangling references are repaired instead of failing', async () => {
    const src = await seeded();
    const archive = await archiveFrom(src.db, {});
    archive.tables.items = archive.tables.items.filter((r) => r.id !== src.jeans);
    const v = validateBackup(archive);
    if (!v.ok) throw new Error(v.error);
    const plan = planRestore(v.archive, 'replace', noIds());
    expect(plan.report.repairedLinks).toBe(1);
    const dest = createTestDb();
    await migrate(dest);
    await applyRestorePlan(dest, plan, 'replace');
    const o = await outfits.getOutfit(dest, src.o);
    expect(o?.items.find((i) => i.slot === 'bottom')?.itemId).toBeNull();
    expect(o?.items.find((i) => i.slot === 'bottom')?.itemName).toBe('Jeans');
  });

  test('a failing restore rolls back and leaves existing data intact', async () => {
    const src = await seeded();
    const v = validateBackup(await archiveFrom(src.db, {}));
    if (!v.ok) throw new Error(v.error);
    const plan = planRestore(v.archive, 'replace', noIds());
    // Corrupt the plan so a late insert violates a foreign key (OR IGNORE does not skip FK errors).
    plan.tables.wear_event_items.push({ event_id: 'no-such-event', item_id: src.shirt });
    await expect(applyRestorePlan(src.db, plan, 'replace')).rejects.toThrow();
    expect((await items.listItems(src.db)).length).toBe(2);
    expect(await outfits.getOutfit(src.db, src.o)).not.toBeNull();
  });
});
