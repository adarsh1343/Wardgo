// File I/O for export, restore and "delete all data".
// A backup is one self-contained JSON file (records + base64 photos) that the
// user saves wherever they like via the iOS share sheet (Files, AirDrop, …).
import Constants from 'expo-constants';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Db } from '../../database/db';
import { allImageFileNames } from '../../database/repositories/items';
import { LATEST_VERSION } from '../../database/migrations';
import { localDateKey } from '../../utils/date';
import {
  BACKUP_FORMAT,
  BACKUP_FORMAT_VERSION,
  type BackupHeader,
  type RestoreMode,
  type RestorePlan,
  applyRestorePlan,
  planRestore,
  readExistingIds,
  readTablesForBackup,
  validateBackup,
  wipeAllTables,
} from './backupFormat';
import { cleanupOrphanImages, deleteAllImages, deleteImageFiles, readImageBase64, writeImageBase64 } from './images';

function exportDir(): Directory {
  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export interface ExportResult {
  uri: string;
  items: number;
  images: number;
  missingImages: number;
}

/**
 * Writes the backup incrementally (one image at a time) so large wardrobes do
 * not need the whole archive in memory as a single string.
 */
export async function createBackupFile(db: Db): Promise<ExportResult> {
  const tables = await readTablesForBackup(db);
  const header: BackupHeader = {
    format: BACKUP_FORMAT,
    formatVersion: BACKUP_FORMAT_VERSION,
    schemaVersion: LATEST_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: Constants.expoConfig?.version ?? 'unknown',
  };
  const file = new File(exportDir(), `wardgo-backup-${localDateKey()}.json`);
  if (file.exists) file.delete();
  file.create();

  const headJson = JSON.stringify({ ...header, tables });
  // Replace the closing brace so we can append the images object.
  await file.write(`${headJson.slice(0, -1)},"images":{`);

  let first = true;
  let images = 0;
  let missingImages = 0;
  const names = await allImageFileNames(db);
  for (const name of names) {
    const data = await readImageBase64(name);
    if (!data) {
      missingImages++;
      continue;
    }
    await file.write(`${first ? '' : ','}${JSON.stringify(name)}:${JSON.stringify(data)}`, { append: true });
    first = false;
    images++;
  }
  await file.write('}}', { append: true });
  return { uri: file.uri, items: tables.items.length, images, missingImages };
}

export async function shareBackup(uri: string): Promise<boolean> {
  if (!(await Sharing.isAvailableAsync())) return false;
  await Sharing.shareAsync(uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Save your Wardgo backup',
  });
  return true;
}

export type PickedBackup =
  | { ok: true; plan: (mode: RestoreMode) => Promise<RestorePlan>; summary: string; warnings: string[]; raw: unknown }
  | { ok: false; error: string; canceled?: boolean };

/** Lets the user pick a backup file and validates it without changing anything. */
export async function pickBackup(db: Db): Promise<PickedBackup> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets?.[0]) return { ok: false, error: 'No file selected.', canceled: true };
  let parsed: unknown;
  try {
    parsed = JSON.parse(await new File(result.assets[0].uri).text());
  } catch {
    return { ok: false, error: 'That file could not be read as a Wardgo backup (invalid JSON).' };
  }
  const v = validateBackup(parsed);
  if (!v.ok) return { ok: false, error: v.error };
  const t = v.archive.tables;
  const summary = `${t.items.length} items, ${t.outfits.length} outfits, ${t.albums.length} albums, ${Object.keys(v.archive.images).length} photos${
    v.archive.exportedAt ? ` — saved ${v.archive.exportedAt.slice(0, 10)}` : ''
  }`;
  return {
    ok: true,
    summary,
    warnings: v.warnings,
    raw: parsed,
    plan: async (mode) => planRestore(v.archive, mode, await readExistingIds(db, await allImageFileNames(db))),
  };
}

/**
 * Applies a restore. Photos are written first; if the database step fails,
 * the newly written photos are deleted and the database is rolled back, so the
 * previous data stays intact.
 */
export async function applyRestore(db: Db, plan: RestorePlan, mode: RestoreMode): Promise<void> {
  const written: string[] = [];
  try {
    for (const [name, data] of Object.entries(plan.images)) {
      await writeImageBase64(name, data);
      written.push(name);
    }
    await applyRestorePlan(db, plan, mode);
  } catch (e) {
    deleteImageFiles(written.map((fileName) => ({ fileName, thumbFileName: null })));
    throw e;
  }
  if (mode === 'replace') {
    // Old photos are no longer referenced.
    await cleanupOrphanImages(db, 0);
  }
}

/** Deletes all records and photos. Preferences reset to defaults. */
export async function deleteAllData(db: Db): Promise<void> {
  await db.withTransactionAsync(async () => {
    await wipeAllTables(db);
  });
  deleteAllImages();
  const dir = new Directory(Paths.cache, 'exports');
  if (dir.exists) dir.delete();
}
