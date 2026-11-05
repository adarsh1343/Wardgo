// Persistent wardrobe photo storage.
//
// Picker results live in temporary/cache locations that iOS may purge, so each
// photo is resized, re-encoded as JPEG and moved into
// <documents>/wardrobe-images/. The database stores only the file NAME; the
// full URI is rebuilt at runtime because the app container path can change
// between installs and updates.
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import type { Db } from '../../database/db';
import { allImageFileNames } from '../../database/repositories/items';
import { newId } from '../../utils/id';

const DIR_NAME = 'wardrobe-images';
const MAIN_MAX = 1400;
const THUMB_MAX = 420;

export function imageDir(): Directory {
  return new Directory(Paths.document, DIR_NAME);
}

export function ensureImageDir(): Directory {
  const dir = imageDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** URI for a stored file name. Rendering components handle missing files. */
export function imageUri(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  return new File(imageDir(), fileName).uri;
}

export function imageFileExists(fileName: string): boolean {
  try {
    return new File(imageDir(), fileName).exists;
  } catch {
    return false;
  }
}

async function render(uri: string, width: number, height: number, max: number, compress: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width > max || height > max) {
    if (width >= height) ctx.resize({ width: max });
    else ctx.resize({ height: max });
  }
  const ref = await ctx.renderAsync();
  const result = await ref.saveAsync({ format: SaveFormat.JPEG, compress });
  return result.uri;
}

export interface StoredImage {
  fileName: string;
  thumbFileName: string | null;
}

/**
 * Copies a picked/captured photo into persistent storage. Writes to a temp
 * name first and moves into place, so an interrupted import never leaves a
 * half-written file under a name the database could reference.
 */
export async function importPhoto(source: { uri: string; width?: number; height?: number }): Promise<StoredImage> {
  const dir = ensureImageDir();
  const base = newId();
  const w = source.width ?? 0;
  const h = source.height ?? 0;

  const mainTmp = await render(source.uri, w, h, MAIN_MAX, 0.82);
  const mainFile = new File(dir, `${base}.jpg`);
  await new File(mainTmp).move(mainFile);

  let thumbFileName: string | null = null;
  try {
    const thumbTmp = await render(source.uri, w, h, THUMB_MAX, 0.7);
    const thumbFile = new File(dir, `${base}_t.jpg`);
    await new File(thumbTmp).move(thumbFile);
    thumbFileName = thumbFile.name;
  } catch {
    // A missing thumbnail is fine — the full image is used instead.
  }
  return { fileName: mainFile.name, thumbFileName };
}

/** Writes base64 image data (from a backup) into the image directory. */
export async function writeImageBase64(fileName: string, base64: string): Promise<void> {
  const dir = ensureImageDir();
  const file = new File(dir, fileName);
  if (file.exists) file.delete();
  file.create();
  await file.write(base64, { encoding: 'base64' });
}

export async function readImageBase64(fileName: string): Promise<string | null> {
  const file = new File(imageDir(), fileName);
  if (!file.exists) return null;
  return file.base64();
}

export function deleteImageFiles(images: StoredImage[]): void {
  for (const img of images) {
    for (const name of [img.fileName, img.thumbFileName]) {
      if (!name) continue;
      try {
        const f = new File(imageDir(), name);
        if (f.exists) f.delete();
      } catch {
        // Ignore: deleting a missing file is not an error for us.
      }
    }
  }
}

/**
 * Removes image files that no database row references (left behind by an
 * interrupted import or a cancelled form). Files newer than `minAgeMs` are kept
 * because an open form may still be about to save them.
 */
export async function cleanupOrphanImages(db: Db, minAgeMs = 60 * 60 * 1000): Promise<number> {
  const dir = imageDir();
  if (!dir.exists) return 0;
  const referenced = await allImageFileNames(db);
  let removed = 0;
  const now = Date.now();
  for (const entry of dir.list()) {
    if (!(entry instanceof File)) continue;
    if (referenced.has(entry.name)) continue;
    const modified = entry.lastModified ?? entry.creationTime ?? 0;
    if (minAgeMs > 0 && (modified === 0 || now - modified < minAgeMs)) continue;
    try {
      entry.delete();
      removed++;
    } catch {
      // ignore
    }
  }
  return removed;
}

export function deleteAllImages(): void {
  const dir = imageDir();
  if (dir.exists) dir.delete();
}
