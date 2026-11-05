import type { Album } from '../../types/models';
import { newId } from '../../utils/id';
import { type Db, nowIso } from '../db';

interface AlbumRow {
  id: string;
  name: string;
  description: string;
  cover_outfit_id: string | null;
  position: number;
  created_at: string;
  updated_at: string;
}

export async function listAlbums(db: Db): Promise<Album[]> {
  const rows = await db.getAllAsync<AlbumRow>('SELECT * FROM albums ORDER BY position ASC, created_at ASC');
  const links = await db.getAllAsync<{ album_id: string; outfit_id: string }>(
    'SELECT album_id, outfit_id FROM album_outfits ORDER BY position ASC, added_at ASC',
  );
  const byAlbum = new Map<string, string[]>();
  for (const l of links) {
    const list = byAlbum.get(l.album_id) ?? [];
    list.push(l.outfit_id);
    byAlbum.set(l.album_id, list);
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    coverOutfitId: r.cover_outfit_id,
    position: r.position,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    outfitIds: byAlbum.get(r.id) ?? [],
  }));
}

export async function getAlbum(db: Db, id: string): Promise<Album | null> {
  return (await listAlbums(db)).find((a) => a.id === id) ?? null;
}

export async function createAlbum(db: Db, name: string, description = ''): Promise<string> {
  const id = newId();
  const max = await db.getFirstAsync<{ m: number | null }>('SELECT MAX(position) AS m FROM albums');
  const now = nowIso();
  await db.runAsync(
    'INSERT INTO albums (id, name, description, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name.trim() || 'New album', description, (max?.m ?? -1) + 1, now, now],
  );
  return id;
}

export async function updateAlbum(
  db: Db,
  id: string,
  patch: { name?: string; description?: string; coverOutfitId?: string | null },
): Promise<void> {
  const current = await db.getFirstAsync<AlbumRow>('SELECT * FROM albums WHERE id = ?', [id]);
  if (!current) return;
  await db.runAsync('UPDATE albums SET name = ?, description = ?, cover_outfit_id = ?, updated_at = ? WHERE id = ?', [
    patch.name !== undefined ? patch.name.trim() || current.name : current.name,
    patch.description ?? current.description,
    patch.coverOutfitId !== undefined ? patch.coverOutfitId : current.cover_outfit_id,
    nowIso(),
    id,
  ]);
}

/** Deletes the album and its links only. Outfits are never deleted here. */
export async function deleteAlbum(db: Db, id: string): Promise<void> {
  await db.runAsync('DELETE FROM albums WHERE id = ?', [id]);
}

/** Persists a new album order given the full list of album IDs. */
export async function reorderAlbums(db: Db, orderedIds: string[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < orderedIds.length; i++) {
      await db.runAsync('UPDATE albums SET position = ? WHERE id = ?', [i, orderedIds[i]!]);
    }
  });
}

export async function addOutfitsToAlbum(db: Db, albumId: string, outfitIds: string[]): Promise<void> {
  const max = await db.getFirstAsync<{ m: number | null }>(
    'SELECT MAX(position) AS m FROM album_outfits WHERE album_id = ?',
    [albumId],
  );
  let pos = (max?.m ?? -1) + 1;
  await db.withTransactionAsync(async () => {
    for (const outfitId of outfitIds) {
      await db.runAsync(
        'INSERT OR IGNORE INTO album_outfits (album_id, outfit_id, position, added_at) VALUES (?, ?, ?, ?)',
        [albumId, outfitId, pos++, nowIso()],
      );
    }
  });
}

export async function removeOutfitFromAlbum(db: Db, albumId: string, outfitId: string): Promise<void> {
  await db.runAsync('DELETE FROM album_outfits WHERE album_id = ? AND outfit_id = ?', [albumId, outfitId]);
  await db.runAsync('UPDATE albums SET cover_outfit_id = NULL WHERE id = ? AND cover_outfit_id = ?', [albumId, outfitId]);
}

/** Sets exactly which albums an outfit belongs to. */
export async function setOutfitAlbums(db: Db, outfitId: string, albumIds: string[]): Promise<void> {
  const current = await db.getAllAsync<{ album_id: string }>('SELECT album_id FROM album_outfits WHERE outfit_id = ?', [
    outfitId,
  ]);
  const have = new Set(current.map((c) => c.album_id));
  const want = new Set(albumIds);
  for (const a of have) if (!want.has(a)) await removeOutfitFromAlbum(db, a, outfitId);
  for (const a of want) if (!have.has(a)) await addOutfitsToAlbum(db, a, [outfitId]);
}

export async function albumIdsForOutfit(db: Db, outfitId: string): Promise<string[]> {
  const rows = await db.getAllAsync<{ album_id: string }>('SELECT album_id FROM album_outfits WHERE outfit_id = ?', [outfitId]);
  return rows.map((r) => r.album_id);
}
