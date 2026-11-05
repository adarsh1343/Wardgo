// Shared domain types. These are plain data shapes with no Expo/React
// dependencies so the recommendation engine and tests can use them directly.

export type Category = 'top' | 'bottom' | 'footwear' | 'accessory';

/**
 * A slot is a position in an outfit. Each slot holds at most one item.
 * Tops are split into the main `top` and an optional `outerwear` layer;
 * accessories are split by where they are worn so an outfit never ends up
 * with two watches or two hats.
 */
export type CoreSlot = 'top' | 'outerwear' | 'bottom' | 'footwear';
export type AccessorySlot =
  | 'headwear'
  | 'eyewear'
  | 'neckwear'
  | 'watch'
  | 'jewelry'
  | 'belt'
  | 'bag'
  | 'gloves'
  | 'other';
export type SlotKey = CoreSlot | AccessorySlot;

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type RainSuitability = 'no' | 'ok' | 'waterproof';
export type Pattern =
  | 'solid'
  | 'stripes'
  | 'checks'
  | 'print'
  | 'floral'
  | 'graphic'
  | 'denim'
  | 'other';

/** 1 = loungewear, 2 = casual, 3 = smart casual, 4 = business, 5 = formal */
export type Formality = 1 | 2 | 3 | 4 | 5;
/** 1 = very light (linen tee), 5 = very warm (parka) */
export type Warmth = 1 | 2 | 3 | 4 | 5;

export interface ItemImage {
  id: string;
  itemId: string;
  /** File name relative to the wardrobe image directory (never an absolute URI). */
  fileName: string;
  thumbFileName: string | null;
  position: number;
}

export interface WardrobeItem {
  id: string;
  name: string;
  category: Category;
  subcategory: string;
  primaryColor: string;
  secondaryColors: string[];
  pattern: Pattern;
  material: string;
  seasons: Season[];
  formality: Formality;
  styleTags: string[];
  warmth: Warmth;
  rain: RainSuitability;
  notes: string;
  favorite: boolean;
  available: boolean;
  createdAt: string;
  updatedAt: string;
  images: ItemImage[];
}

/** An outfit is a mapping from slot to wardrobe item ID. */
export type OutfitSlots = Partial<Record<SlotKey, string>>;

export interface SavedOutfitItem {
  slot: SlotKey;
  /** null when the wardrobe item has been deleted since the outfit was saved. */
  itemId: string | null;
  /** Name captured at save time, shown when the item no longer exists. */
  itemName: string;
}

export interface SavedOutfit {
  id: string;
  name: string;
  favorite: boolean;
  notes: string;
  styleTags: string[];
  occasion: string;
  weather: WeatherContext | null;
  createdAt: string;
  updatedAt: string;
  items: SavedOutfitItem[];
  wearCount: number;
  lastWornOn: string | null;
}

export interface Album {
  id: string;
  name: string;
  description: string;
  coverOutfitId: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
  outfitIds: string[];
}

export interface WearEvent {
  id: string;
  outfitId: string | null;
  wornOn: string; // YYYY-MM-DD
  itemIds: string[];
  createdAt: string;
}

export type FeedbackValue = 1 | -1;
export interface FeedbackEntry {
  id: string;
  /** Sorted, '|'-joined item IDs for combination feedback, or a single item ID. */
  targetKey: string;
  kind: 'combo' | 'item';
  value: FeedbackValue;
  createdAt: string;
}

/** Compact weather facts attached to a recommendation or saved outfit. */
export interface WeatherContext {
  tempC: number;
  feelsLikeC: number;
  highC: number;
  lowC: number;
  precipProbability: number | null;
  windKph: number | null;
  code: number;
  summary: string;
}

export interface WeatherSnapshot extends WeatherContext {
  isDay: boolean;
  locationName: string;
  latitude: number;
  longitude: number;
  fetchedAt: string;
}

export type Occasion = 'everyday' | 'work' | 'date' | 'active' | 'formal';

export interface Preferences {
  themeMode: 'system' | 'light' | 'dark';
  units: 'C' | 'F';
  location: LocationPref;
  weatherRefreshMinutes: number; // 0 = manual only
  preferredStyles: string[];
  avoidStyles: string[];
  preferredColors: string[];
  avoidColors: string[];
  defaultOccasion: Occasion;
  typicalOccasions: Occasion[];
  /** Negative = runs cold (wants warmer clothes), positive = runs hot. */
  temperatureComfort: -1 | 0 | 1;
  maxAccessories: number;
  reminder: { enabled: boolean; hour: number; minute: number };
}

export type LocationPref =
  | { mode: 'none' }
  | { mode: 'device'; name: string; latitude: number; longitude: number }
  | { mode: 'manual'; name: string; latitude: number; longitude: number };
