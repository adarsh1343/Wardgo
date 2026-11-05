// Static wardrobe vocabulary: categories, subcategories, colors, styles.
// Pure data so it is shared by the engine, the UI and the tests.
import type {
  AccessorySlot,
  Category,
  Formality,
  Occasion,
  Pattern,
  RainSuitability,
  Season,
  SlotKey,
  Warmth,
} from '../types/models';

export interface SubcategoryDef {
  key: string;
  label: string;
  category: Category;
  slot: SlotKey;
  /** Sensible defaults applied when the user picks this subcategory. */
  warmth: Warmth;
  formality: Formality;
  rain: RainSuitability;
  /** Feels-like range (°C) where the item is wearable at all. */
  minTempC?: number;
  maxTempC?: number;
}

const sub = (
  category: Category,
  slot: SlotKey,
  key: string,
  label: string,
  warmth: Warmth,
  formality: Formality,
  extra: Partial<Pick<SubcategoryDef, 'rain' | 'minTempC' | 'maxTempC'>> = {},
): SubcategoryDef => ({
  key,
  label,
  category,
  slot,
  warmth,
  formality,
  rain: extra.rain ?? 'ok',
  minTempC: extra.minTempC,
  maxTempC: extra.maxTempC,
});

export const SUBCATEGORIES: SubcategoryDef[] = [
  // Tops — main layer
  sub('top', 'top', 'tshirt', 'T-shirt', 1, 2),
  sub('top', 'top', 'tank', 'Tank top', 1, 1, { minTempC: 18 }),
  sub('top', 'top', 'shirt', 'Shirt', 2, 3),
  sub('top', 'top', 'polo', 'Polo', 1, 3),
  sub('top', 'top', 'blouse', 'Blouse', 1, 3),
  sub('top', 'top', 'longsleeve', 'Long sleeve', 2, 2),
  sub('top', 'top', 'sweater', 'Sweater', 4, 3, { maxTempC: 22 }),
  sub('top', 'top', 'hoodie', 'Hoodie', 3, 1, { maxTempC: 24 }),
  sub('top', 'top', 'sweatshirt', 'Sweatshirt', 3, 1, { maxTempC: 24 }),
  sub('top', 'top', 'othertop', 'Other top', 2, 2),
  // Tops — outer layer
  sub('top', 'outerwear', 'jacket', 'Jacket', 3, 2, { maxTempC: 22 }),
  sub('top', 'outerwear', 'denimjacket', 'Denim jacket', 2, 2, { maxTempC: 23 }),
  sub('top', 'outerwear', 'blazer', 'Blazer', 2, 4, { maxTempC: 24 }),
  sub('top', 'outerwear', 'cardigan', 'Cardigan', 2, 3, { maxTempC: 22 }),
  sub('top', 'outerwear', 'coat', 'Coat', 4, 4, { maxTempC: 16 }),
  sub('top', 'outerwear', 'parka', 'Parka / puffer', 5, 2, { maxTempC: 10, rain: 'waterproof' }),
  sub('top', 'outerwear', 'raincoat', 'Raincoat', 2, 2, { rain: 'waterproof', maxTempC: 24 }),
  // Bottoms
  sub('bottom', 'bottom', 'jeans', 'Jeans', 3, 2),
  sub('bottom', 'bottom', 'trousers', 'Trousers', 3, 4),
  sub('bottom', 'bottom', 'chinos', 'Chinos', 2, 3),
  sub('bottom', 'bottom', 'shorts', 'Shorts', 1, 1, { minTempC: 17 }),
  sub('bottom', 'bottom', 'joggers', 'Joggers', 3, 1),
  sub('bottom', 'bottom', 'skirt', 'Skirt', 1, 3, { minTempC: 12 }),
  sub('bottom', 'bottom', 'otherbottom', 'Other bottom', 2, 2),
  // Footwear
  sub('footwear', 'footwear', 'sneakers', 'Sneakers', 2, 2),
  sub('footwear', 'footwear', 'boots', 'Boots', 4, 3, { rain: 'waterproof' }),
  sub('footwear', 'footwear', 'dressshoes', 'Dress shoes', 2, 5),
  sub('footwear', 'footwear', 'loafers', 'Loafers', 2, 4),
  sub('footwear', 'footwear', 'sandals', 'Sandals', 1, 1, { minTempC: 18, rain: 'no' }),
  sub('footwear', 'footwear', 'otherfootwear', 'Other footwear', 2, 2),
  // Accessories
  sub('accessory', 'watch', 'watch', 'Watch', 1, 3),
  sub('accessory', 'headwear', 'cap', 'Cap', 1, 1),
  sub('accessory', 'headwear', 'hat', 'Hat', 1, 3),
  sub('accessory', 'headwear', 'beanie', 'Beanie', 3, 1, { maxTempC: 12 }),
  sub('accessory', 'belt', 'belt', 'Belt', 1, 3),
  sub('accessory', 'bag', 'bag', 'Bag', 1, 3),
  sub('accessory', 'bag', 'backpack', 'Backpack', 1, 1),
  sub('accessory', 'eyewear', 'sunglasses', 'Sunglasses', 1, 2),
  sub('accessory', 'jewelry', 'jewelry', 'Jewelry', 1, 3),
  sub('accessory', 'neckwear', 'scarf', 'Scarf', 3, 3, { maxTempC: 14 }),
  sub('accessory', 'neckwear', 'tie', 'Tie', 1, 5),
  sub('accessory', 'gloves', 'gloves', 'Gloves', 4, 2, { maxTempC: 8 }),
  sub('accessory', 'other', 'otheraccessory', 'Other accessory', 1, 2),
];

const SUB_BY_KEY = new Map(SUBCATEGORIES.map((s) => [s.key, s]));

export function getSubcategory(key: string): SubcategoryDef | undefined {
  return SUB_BY_KEY.get(key);
}

/** Slot an item occupies. Falls back to a category-level slot for unknown keys. */
export function slotForItem(item: { category: Category; subcategory: string }): SlotKey {
  const def = SUB_BY_KEY.get(item.subcategory);
  if (def && def.category === item.category) return def.slot;
  switch (item.category) {
    case 'top':
      return 'top';
    case 'bottom':
      return 'bottom';
    case 'footwear':
      return 'footwear';
    case 'accessory':
      return 'other';
  }
}

export const CATEGORIES: { key: Category; label: string; plural: string }[] = [
  { key: 'top', label: 'Top', plural: 'Tops' },
  { key: 'bottom', label: 'Bottom', plural: 'Bottoms' },
  { key: 'footwear', label: 'Footwear', plural: 'Shoes' },
  { key: 'accessory', label: 'Accessory', plural: 'Accessories' },
];

export const CORE_SLOTS = ['top', 'outerwear', 'bottom', 'footwear'] as const;
export const REQUIRED_SLOTS = ['top', 'bottom', 'footwear'] as const;
export const ACCESSORY_SLOTS: AccessorySlot[] = [
  'watch',
  'headwear',
  'eyewear',
  'neckwear',
  'belt',
  'bag',
  'jewelry',
  'gloves',
  'other',
];
/** Display order of slots in an outfit. */
export const SLOT_ORDER: SlotKey[] = [...CORE_SLOTS, ...ACCESSORY_SLOTS];

export const SLOT_LABELS: Record<SlotKey, string> = {
  top: 'Top',
  outerwear: 'Layer',
  bottom: 'Bottom',
  footwear: 'Shoes',
  watch: 'Watch',
  headwear: 'Headwear',
  eyewear: 'Eyewear',
  neckwear: 'Neckwear',
  belt: 'Belt',
  bag: 'Bag',
  jewelry: 'Jewelry',
  gloves: 'Gloves',
  other: 'Extra',
};

export function isAccessorySlot(slot: SlotKey): slot is AccessorySlot {
  return (ACCESSORY_SLOTS as SlotKey[]).includes(slot);
}

// ---------------------------------------------------------------------------
// Colors. `hue` is in degrees; neutrals have no hue and match everything.
export interface ColorDef {
  key: string;
  label: string;
  hex: string;
  neutral: boolean;
  hue: number | null;
  /** Rough lightness 0-1, used for contrast between top and bottom. */
  lightness: number;
}

export const COLORS: ColorDef[] = [
  { key: 'black', label: 'Black', hex: '#1B1B1F', neutral: true, hue: null, lightness: 0.05 },
  { key: 'charcoal', label: 'Charcoal', hex: '#3D3D45', neutral: true, hue: null, lightness: 0.2 },
  { key: 'grey', label: 'Grey', hex: '#8E8E96', neutral: true, hue: null, lightness: 0.55 },
  { key: 'white', label: 'White', hex: '#FAFAF7', neutral: true, hue: null, lightness: 0.98 },
  { key: 'cream', label: 'Cream', hex: '#F1E6CF', neutral: true, hue: null, lightness: 0.9 },
  { key: 'beige', label: 'Beige', hex: '#D7C2A0', neutral: true, hue: null, lightness: 0.75 },
  { key: 'brown', label: 'Brown', hex: '#7A4E2D', neutral: true, hue: null, lightness: 0.3 },
  { key: 'navy', label: 'Navy', hex: '#1F2A55', neutral: true, hue: null, lightness: 0.15 },
  { key: 'denim', label: 'Denim', hex: '#4A6A9A', neutral: true, hue: null, lightness: 0.45 },
  { key: 'olive', label: 'Olive', hex: '#6B6B2F', neutral: true, hue: null, lightness: 0.35 },
  { key: 'red', label: 'Red', hex: '#D7263D', neutral: false, hue: 355, lightness: 0.45 },
  { key: 'burgundy', label: 'Burgundy', hex: '#7A1F3D', neutral: false, hue: 340, lightness: 0.25 },
  { key: 'pink', label: 'Pink', hex: '#FF8FB1', neutral: false, hue: 340, lightness: 0.75 },
  { key: 'orange', label: 'Orange', hex: '#F2762E', neutral: false, hue: 25, lightness: 0.6 },
  { key: 'yellow', label: 'Yellow', hex: '#F4C430', neutral: false, hue: 48, lightness: 0.78 },
  { key: 'green', label: 'Green', hex: '#2E8B57', neutral: false, hue: 145, lightness: 0.45 },
  { key: 'mint', label: 'Mint', hex: '#98E2C6', neutral: false, hue: 155, lightness: 0.82 },
  { key: 'teal', label: 'Teal', hex: '#1E8C93', neutral: false, hue: 185, lightness: 0.45 },
  { key: 'blue', label: 'Blue', hex: '#2F6FE0', neutral: false, hue: 220, lightness: 0.5 },
  { key: 'lightblue', label: 'Light blue', hex: '#A9CDF2', neutral: false, hue: 210, lightness: 0.8 },
  { key: 'purple', label: 'Purple', hex: '#7B4FC9', neutral: false, hue: 270, lightness: 0.45 },
  { key: 'lilac', label: 'Lilac', hex: '#C8B6F0', neutral: false, hue: 265, lightness: 0.8 },
  { key: 'gold', label: 'Gold', hex: '#C9A13B', neutral: true, hue: null, lightness: 0.6 },
  { key: 'silver', label: 'Silver', hex: '#C4C8CE', neutral: true, hue: null, lightness: 0.8 },
  { key: 'multi', label: 'Multicolor', hex: '#FF5A7A', neutral: false, hue: null, lightness: 0.5 },
];

const COLOR_BY_KEY = new Map(COLORS.map((c) => [c.key, c]));
export function getColor(key: string): ColorDef | undefined {
  return COLOR_BY_KEY.get(key);
}

// ---------------------------------------------------------------------------
export const STYLE_TAGS = [
  'casual',
  'smart',
  'formal',
  'sporty',
  'streetwear',
  'minimal',
  'classic',
  'vintage',
  'preppy',
  'edgy',
  'boho',
  'outdoor',
] as const;

/** Style pairs that look odd together. Order does not matter. */
export const STYLE_CLASHES: [string, string][] = [
  ['formal', 'sporty'],
  ['formal', 'streetwear'],
  ['formal', 'outdoor'],
  ['preppy', 'edgy'],
  ['minimal', 'boho'],
  ['classic', 'streetwear'],
];

export const PATTERNS: { key: Pattern; label: string }[] = [
  { key: 'solid', label: 'Solid' },
  { key: 'stripes', label: 'Stripes' },
  { key: 'checks', label: 'Checks' },
  { key: 'print', label: 'Print' },
  { key: 'floral', label: 'Floral' },
  { key: 'graphic', label: 'Graphic' },
  { key: 'denim', label: 'Denim' },
  { key: 'other', label: 'Other' },
];

export const SEASONS: { key: Season; label: string }[] = [
  { key: 'spring', label: 'Spring' },
  { key: 'summer', label: 'Summer' },
  { key: 'autumn', label: 'Autumn' },
  { key: 'winter', label: 'Winter' },
];

export const FORMALITY_LABELS: Record<Formality, string> = {
  1: 'Lounge',
  2: 'Casual',
  3: 'Smart casual',
  4: 'Business',
  5: 'Formal',
};

export const WARMTH_LABELS: Record<Warmth, string> = {
  1: 'Very light',
  2: 'Light',
  3: 'Medium',
  4: 'Warm',
  5: 'Very warm',
};

export const OCCASIONS: { key: Occasion; label: string; formality: number }[] = [
  { key: 'everyday', label: 'Everyday', formality: 2 },
  { key: 'work', label: 'Work', formality: 3.5 },
  { key: 'date', label: 'Date night', formality: 3 },
  { key: 'active', label: 'Active', formality: 1 },
  { key: 'formal', label: 'Formal', formality: 4.6 },
];
