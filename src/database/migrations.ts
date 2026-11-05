// Schema migrations, tracked with SQLite's `PRAGMA user_version`.
// To change the schema, append a new migration — never edit an old one,
// because devices that already ran it will not run it again.
import type { Db } from './db';

export interface Migration {
  version: number;
  description: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema',
    sql: `
CREATE TABLE items (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('top','bottom','footwear','accessory')),
  subcategory TEXT NOT NULL,
  primary_color TEXT NOT NULL,
  secondary_colors TEXT NOT NULL DEFAULT '[]',
  pattern TEXT NOT NULL DEFAULT 'solid',
  material TEXT NOT NULL DEFAULT '',
  seasons TEXT NOT NULL DEFAULT '[]',
  formality INTEGER NOT NULL CHECK (formality BETWEEN 1 AND 5),
  style_tags TEXT NOT NULL DEFAULT '[]',
  warmth INTEGER NOT NULL CHECK (warmth BETWEEN 1 AND 5),
  rain TEXT NOT NULL DEFAULT 'ok' CHECK (rain IN ('no','ok','waterproof')),
  notes TEXT NOT NULL DEFAULT '',
  favorite INTEGER NOT NULL DEFAULT 0,
  available INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX idx_items_category ON items(category);

CREATE TABLE item_images (
  id TEXT PRIMARY KEY NOT NULL,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL UNIQUE,
  thumb_file_name TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_item_images_item ON item_images(item_id);

CREATE TABLE outfits (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  favorite INTEGER NOT NULL DEFAULT 0,
  notes TEXT NOT NULL DEFAULT '',
  style_tags TEXT NOT NULL DEFAULT '[]',
  occasion TEXT NOT NULL DEFAULT '',
  weather_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- item_id becomes NULL if the wardrobe item is deleted; item_name keeps a
-- record of what was there so the outfit can show "removed: Grey jeans"
-- instead of silently substituting something else.
CREATE TABLE outfit_items (
  outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  slot TEXT NOT NULL,
  item_id TEXT REFERENCES items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (outfit_id, slot)
);
CREATE INDEX idx_outfit_items_item ON outfit_items(item_id);

CREATE TABLE albums (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cover_outfit_id TEXT REFERENCES outfits(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Deleting an album removes only these links, never the outfits.
CREATE TABLE album_outfits (
  album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL,
  PRIMARY KEY (album_id, outfit_id)
);

CREATE TABLE preferences (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE TABLE wear_events (
  id TEXT PRIMARY KEY NOT NULL,
  outfit_id TEXT REFERENCES outfits(id) ON DELETE SET NULL,
  worn_on TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_wear_events_date ON wear_events(worn_on);

CREATE TABLE wear_event_items (
  event_id TEXT NOT NULL REFERENCES wear_events(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, item_id)
);
CREATE INDEX idx_wear_event_items_item ON wear_event_items(item_id);

CREATE TABLE feedback (
  id TEXT PRIMARY KEY NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('combo','item')),
  target_key TEXT NOT NULL,
  value INTEGER NOT NULL CHECK (value IN (-1, 1)),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_feedback_target ON feedback(target_key);

CREATE TABLE recommendation_log (
  id TEXT PRIMARY KEY NOT NULL,
  slots_json TEXT NOT NULL,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  weather_summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE weather_cache (
  key TEXT PRIMARY KEY NOT NULL,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);
`,
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1]!.version;

/** Applies pending migrations. Each migration runs in its own transaction. */
export async function migrate(db: Db): Promise<number> {
  // Foreign keys are per-connection and cannot be changed inside a transaction.
  await db.execAsync('PRAGMA foreign_keys = ON;');
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;
  if (version > LATEST_VERSION) {
    throw new Error(
      `Database version ${version} is newer than this app understands (${LATEST_VERSION}). Update the app.`,
    );
  }
  for (const m of MIGRATIONS) {
    if (m.version <= version) continue;
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.execAsync(`PRAGMA user_version = ${m.version}`);
    });
    version = m.version;
  }
  return version;
}
