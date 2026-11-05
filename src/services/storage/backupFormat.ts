// Backup archive format, validation and the database side of restore.
// No Expo imports here, so it is covered by Node-based tests.
import type { Db, SqlParam } from '../../database/db';
import { LATEST_VERSION } from '../../database/migrations';

export const BACKUP_FORMAT = 'wardgo-backup';
export const BACKUP_FORMAT_VERSION = 1;

/**
 * Tables included in a backup, in foreign-key-safe insertion order, with the
 * exact columns copied. Column names come only from this whitelist — never
 * from the archive — so a crafted file cannot inject SQL.
 */
export const BACKUP_TABLES = {
  items: ['id', 'name', 'category', 'subcategory', 'primary_color', 'secondary_colors', 'pattern', 'material', 'seasons',
    'formality', 'style_tags', 'warmth', 'rain', 'notes', 'favorite', 'available', 'created_at', 'updated_at'],
  item_images: ['id', 'item_id', 'file_name', 'thumb_file_name', 'position', 'created_at'],
  outfits: ['id', 'name', 'favorite', 'notes', 'style_tags', 'occasion', 'weather_json', 'created_at', 'updated_at'],
  outfit_items: ['outfit_id', 'slot', 'item_id', 'item_name'],
  albums: ['id', 'name', 'description', 'cover_outfit_id', 'position', 'created_at', 'updated_at'],
  album_outfits: ['album_id', 'outfit_id', 'position', 'added_at'],
  preferences: ['key', 'value'],
  wear_events: ['id', 'outfit_id', 'worn_on', 'created_at'],
  wear_event_items: ['event_id', 'item_id'],
  feedback: ['id', 'kind', 'target_key', 'value', 'created_at'],
} as const;

export type BackupTable = keyof typeof BACKUP_TABLES;
export const TABLE_ORDER = Object.keys(BACKUP_TABLES) as BackupTable[];
type Row = Record<string, SqlParam>;
export type BackupTables = Record<BackupTable, Row[]>;

export interface BackupHeader {
  format: typeof BACKUP_FORMAT;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  appVersion: string;
}

export interface BackupArchive extends BackupHeader {
  tables: BackupTables;
  /** file name -> base64 JPEG */
  images: Record<string, string>;
}

// ------------------------------------------------------------------ export
export async function readTablesForBackup(db: Db): Promise<BackupTables> {
  const out = {} as BackupTables;
  for (const table of TABLE_ORDER) {
    const cols = BACKUP_TABLES[table].join(', ');
    out[table] = await db.getAllAsync<Row>(`SELECT ${cols} FROM ${table}`);
  }
  return out;
}

// --------------------------------------------------------------- validation
export type ValidationOutcome =
  | { ok: true; archive: BackupArchive; warnings: string[] }
  | { ok: false; error: string };

const SAFE_FILE = /^[A-Za-z0-9_.-]{1,128}$/;

function isRowValue(v: unknown): v is SqlParam {
  return v === null || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
}

/** Checks structure and types; drops individually malformed rows with a warning. */
export function validateBackup(raw: unknown): ValidationOutcome {
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'This file is not a Wardgo backup.' };
  const r = raw as Record<string, unknown>;
  if (r.format !== BACKUP_FORMAT) return { ok: false, error: 'This file is not a Wardgo backup.' };
  if (typeof r.formatVersion !== 'number' || r.formatVersion > BACKUP_FORMAT_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of Wardgo. Update the app and try again.' };
  }
  if (typeof r.schemaVersion !== 'number' || r.schemaVersion > LATEST_VERSION) {
    return { ok: false, error: 'This backup uses a newer database version than this app supports.' };
  }
  if (!r.tables || typeof r.tables !== 'object') return { ok: false, error: 'The backup has no data section.' };
  const rawTables = r.tables as Record<string, unknown>;
  const warnings: string[] = [];
  const tables = {} as BackupTables;

  for (const table of TABLE_ORDER) {
    const list = rawTables[table];
    if (list === undefined) {
      tables[table] = [];
      continue;
    }
    if (!Array.isArray(list)) return { ok: false, error: `The "${table}" section is damaged.` };
    const cols = BACKUP_TABLES[table];
    const rows: Row[] = [];
    let dropped = 0;
    for (const entry of list) {
      if (!entry || typeof entry !== 'object') {
        dropped++;
        continue;
      }
      const e = entry as Record<string, unknown>;
      const row: Row = {};
      let valid = true;
      for (const c of cols) {
        const v = e[c] === undefined ? null : e[c];
        if (!isRowValue(v)) {
          valid = false;
          break;
        }
        row[c] = v;
      }
      if (valid) rows.push(row);
      else dropped++;
    }
    if (dropped > 0) warnings.push(`Skipped ${dropped} damaged ${table.replace('_', ' ')} record(s).`);
    tables[table] = rows;
  }

  const images: Record<string, string> = {};
  if (r.images && typeof r.images === 'object') {
    for (const [name, data] of Object.entries(r.images as Record<string, unknown>)) {
      if (SAFE_FILE.test(name) && typeof data === 'string' && data.length > 0) images[name] = data;
    }
  }

  return {
    ok: true,
    warnings,
    archive: {
      format: BACKUP_FORMAT,
      formatVersion: r.formatVersion,
      schemaVersion: r.schemaVersion,
      exportedAt: typeof r.exportedAt === 'string' ? r.exportedAt : '',
      appVersion: typeof r.appVersion === 'string' ? r.appVersion : '',
      tables,
      images,
    },
  };
}

// ------------------------------------------------------------------ planning
export type RestoreMode = 'replace' | 'merge';

export interface RestorePlan {
  tables: BackupTables;
  /** Images to write to disk (file name -> base64). */
  images: Record<string, string>;
  report: {
    items: number;
    outfits: number;
    albums: number;
    skippedDuplicates: number;
    missingImages: number;
    repairedLinks: number;
  };
}

export interface ExistingIds {
  items: Set<string>;
  outfits: Set<string>;
  albums: Set<string>;
  imageFiles: Set<string>;
  wearEvents: Set<string>;
  feedback: Set<string>;
}

const s = (v: SqlParam | undefined): string => (typeof v === 'string' ? v : '');

/**
 * Builds the exact set of rows to insert. Handles:
 *  - duplicate IDs (merge mode keeps the existing local record, skips the backup's),
 *  - images missing from the archive (row dropped; the item shows a placeholder),
 *  - dangling references (e.g. outfit pointing at an item not in the backup),
 *  - unsafe file names.
 */
export function planRestore(archive: BackupArchive, mode: RestoreMode, existing: ExistingIds): RestorePlan {
  const t = archive.tables;
  let skippedDuplicates = 0;
  let missingImages = 0;
  let repairedLinks = 0;
  const dedupe = (rows: Row[], key: string, local: Set<string>): Row[] => {
    const seen = new Set<string>();
    const out: Row[] = [];
    for (const row of rows) {
      const id = s(row[key]);
      if (!id || seen.has(id)) {
        skippedDuplicates++;
        continue;
      }
      seen.add(id);
      if (mode === 'merge' && local.has(id)) {
        skippedDuplicates++;
        continue;
      }
      out.push(row);
    }
    return out;
  };

  const items = dedupe(t.items, 'id', existing.items);
  const outfits = dedupe(t.outfits, 'id', existing.outfits);
  const albums = dedupe(t.albums, 'id', existing.albums);
  const wearEvents = dedupe(t.wear_events, 'id', existing.wearEvents);
  const feedback = dedupe(t.feedback, 'id', existing.feedback);

  const mergeLocal = mode === 'merge';
  const allItemIds = new Set([...items.map((r) => s(r.id)), ...(mergeLocal ? existing.items : [])]);
  const allOutfitIds = new Set([...outfits.map((r) => s(r.id)), ...(mergeLocal ? existing.outfits : [])]);
  const newItemIds = new Set(items.map((r) => s(r.id)));
  const newOutfitIds = new Set(outfits.map((r) => s(r.id)));
  const newAlbumIds = new Set(albums.map((r) => s(r.id)));
  const newWearIds = new Set(wearEvents.map((r) => s(r.id)));

  // Images: only for items being inserted, only with data present, safe names, no clashes.
  const images: Record<string, string> = {};
  const itemImages: Row[] = [];
  const usedNames = new Set(mergeLocal ? existing.imageFiles : []);
  for (const row of t.item_images) {
    if (!newItemIds.has(s(row.item_id))) continue;
    const file = s(row.file_name);
    if (!SAFE_FILE.test(file) || usedNames.has(file)) {
      skippedDuplicates++;
      continue;
    }
    const data = archive.images[file];
    if (!data) {
      missingImages++;
      continue;
    }
    const thumb = s(row.thumb_file_name);
    const thumbData = thumb && SAFE_FILE.test(thumb) && !usedNames.has(thumb) ? archive.images[thumb] : undefined;
    images[file] = data;
    usedNames.add(file);
    if (thumbData) {
      images[thumb] = thumbData;
      usedNames.add(thumb);
    }
    itemImages.push({ ...row, thumb_file_name: thumbData ? thumb : null });
  }

  const outfitItems: Row[] = [];
  for (const row of t.outfit_items) {
    if (!newOutfitIds.has(s(row.outfit_id))) continue;
    const itemId = row.item_id;
    if (typeof itemId === 'string' && !allItemIds.has(itemId)) {
      repairedLinks++;
      outfitItems.push({ ...row, item_id: null }); // shows as "removed" rather than pointing nowhere
    } else outfitItems.push(row);
  }

  const albumRows = albums.map((row) => {
    const cover = row.cover_outfit_id;
    if (typeof cover === 'string' && !allOutfitIds.has(cover)) {
      repairedLinks++;
      return { ...row, cover_outfit_id: null };
    }
    return row;
  });
  const albumOutfits = t.album_outfits.filter((row) => {
    if (!newAlbumIds.has(s(row.album_id))) return false;
    if (!allOutfitIds.has(s(row.outfit_id))) {
      repairedLinks++;
      return false;
    }
    return true;
  });

  const wearRows = wearEvents.map((row) => {
    const o = row.outfit_id;
    if (typeof o === 'string' && !allOutfitIds.has(o)) return { ...row, outfit_id: null };
    return row;
  });
  const wearItems = t.wear_event_items.filter(
    (row) => newWearIds.has(s(row.event_id)) && allItemIds.has(s(row.item_id)),
  );

  // In merge mode, local preferences win; in replace mode, restore them.
  const preferences = mode === 'replace' ? t.preferences.filter((r) => s(r.key).length > 0) : [];

  return {
    tables: {
      items,
      item_images: itemImages,
      outfits,
      outfit_items: outfitItems,
      albums: albumRows,
      album_outfits: albumOutfits,
      preferences,
      wear_events: wearRows,
      wear_event_items: wearItems,
      feedback,
    },
    images,
    report: {
      items: items.length,
      outfits: outfits.length,
      albums: albums.length,
      skippedDuplicates,
      missingImages,
      repairedLinks,
    },
  };
}

export async function readExistingIds(db: Db, imageFiles: Set<string>): Promise<ExistingIds> {
  const ids = async (table: string) =>
    new Set((await db.getAllAsync<{ id: string }>(`SELECT id FROM ${table}`)).map((r) => r.id));
  return {
    items: await ids('items'),
    outfits: await ids('outfits'),
    albums: await ids('albums'),
    wearEvents: await ids('wear_events'),
    feedback: await ids('feedback'),
    imageFiles,
  };
}

/** Deletes every user record (used by "replace" restore and "delete all data"). */
export async function wipeAllTables(db: Db): Promise<void> {
  for (const table of [...TABLE_ORDER].reverse()) {
    await db.runAsync(`DELETE FROM ${table}`);
  }
  await db.runAsync('DELETE FROM recommendation_log');
  await db.runAsync('DELETE FROM weather_cache');
}

/** Inserts a plan inside a single transaction; any failure rolls everything back. */
export async function applyRestorePlan(db: Db, plan: RestorePlan, mode: RestoreMode): Promise<void> {
  await db.withTransactionAsync(async () => {
    if (mode === 'replace') await wipeAllTables(db);
    for (const table of TABLE_ORDER) {
      const cols = BACKUP_TABLES[table];
      // OR IGNORE: a duplicated row inside a damaged archive is skipped instead of aborting the restore.
      const sql = `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${cols
        .map(() => '?')
        .join(', ')})`;
      for (const row of plan.tables[table]) {
        await db.runAsync(
          sql,
          cols.map((c) => row[c] ?? null),
        );
      }
    }
  });
}
