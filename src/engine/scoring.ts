// Per-item and per-combination scoring. Every factor is additive and comes
// with a human-readable reason so recommendations can explain themselves.
import type { Occasion, SlotKey, WardrobeItem, WeatherContext } from '../types/models';
import { getSubcategory, OCCASIONS } from './catalog';
import { paletteScore, styleScore } from './harmony';
import type { Climate } from './weather';

export interface Adjustments {
  /** -1 more casual, +1 more formal */
  formality: -1 | 0 | 1;
  /** -1 more neutral, +1 more colorful */
  colorful: -1 | 0 | 1;
  /** -1 lighter, +1 warmer */
  warmth: -1 | 0 | 1;
  /** -1 conservative, +1 adventurous */
  adventurous: -1 | 0 | 1;
  /** Penalise recently worn items and combinations more strongly. */
  avoidRecent: boolean;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = {
  formality: 0,
  colorful: 0,
  warmth: 0,
  adventurous: 0,
  avoidRecent: false,
};

export interface StylePrefs {
  preferredStyles: string[];
  avoidStyles: string[];
  preferredColors: string[];
  avoidColors: string[];
  temperatureComfort: -1 | 0 | 1;
  maxAccessories: number;
}

export interface EngineContext {
  items: WardrobeItem[];
  weather: WeatherContext | null;
  prefs: StylePrefs;
  occasion: Occasion;
  adjustments: Adjustments;
  /** item id -> whole days since it was last worn */
  lastWornDaysAgo: Record<string, number>;
  /** core-combination keys worn recently (see comboKey) */
  recentCombos: string[];
  dislikedCombos: string[];
  likedCombos: string[];
  /** item id -> net feedback (positive = liked) */
  itemFeedback: Record<string, number>;
  /** Item IDs shown in recent regenerations this session, to keep variety. */
  recentlyShown?: string[];
  seed: number;
  date?: Date;
  latitude?: number | null;
}

export interface Reason {
  weight: number;
  text: string;
}

export interface ItemScore {
  item: WardrobeItem;
  slot: SlotKey;
  score: number;
  /** False when the item is unsuitable (e.g. shorts below 17°C, sandals in rain). */
  eligible: boolean;
  ineligibleBecause?: string;
  reasons: Reason[];
}

export function targetFormality(ctx: Pick<EngineContext, 'occasion' | 'adjustments'>): number {
  const base = OCCASIONS.find((o) => o.key === ctx.occasion)?.formality ?? 2;
  return Math.min(5, Math.max(1, base + ctx.adjustments.formality * 0.9));
}

function idealWarmth(slot: SlotKey, climate: Climate): number | null {
  switch (slot) {
    case 'top':
      return climate.idealTop;
    case 'bottom':
      return climate.idealBottom;
    case 'outerwear':
      return climate.idealOuter;
    case 'footwear':
      return { freezing: 4, cold: 3.5, cool: 2.8, mild: 2.2, warm: 1.8, hot: 1.3 }[climate.band];
    default:
      return null; // accessories are handled by temp ranges
  }
}

export function scoreItem(item: WardrobeItem, slot: SlotKey, climate: Climate, ctx: EngineContext): ItemScore {
  const reasons: Reason[] = [];
  let score = 0;
  let eligible = true;
  let ineligibleBecause: string | undefined;
  const add = (weight: number, text: string) => {
    score += weight;
    if (Math.abs(weight) >= 0.5) reasons.push({ weight, text });
  };
  const def = getSubcategory(item.subcategory);
  const t = climate.effectiveC;

  // --- Weather suitability -------------------------------------------------
  if (def?.minTempC !== undefined && t < def.minTempC - 1) {
    eligible = false;
    ineligibleBecause = `too cold for ${def.label.toLowerCase()}`;
  }
  if (def?.maxTempC !== undefined && t > def.maxTempC + 1) {
    eligible = false;
    ineligibleBecause = `too warm for ${def.label.toLowerCase()}`;
  }
  const ideal = idealWarmth(slot, climate);
  if (ideal !== null) {
    const diff = Math.abs(item.warmth - ideal);
    add(-diff * 1.2, diff < 0.8 ? `right warmth for ${Math.round(t)}°` : `warmth is a stretch for ${Math.round(t)}°`);
    if (slot === 'outerwear' && diff >= 3) {
      eligible = false;
      ineligibleBecause = 'wrong warmth for the weather';
    }
  }
  if (climate.rainy) {
    if (item.rain === 'no') {
      if (slot === 'footwear' || slot === 'outerwear') {
        add(-2.5, 'not great in the rain');
      } else add(-0.5, 'not great in the rain');
    } else if (item.rain === 'waterproof' && (slot === 'footwear' || slot === 'outerwear' || slot === 'headwear')) {
      add(1.8, 'handles the rain');
    }
    if (slot === 'eyewear') add(-1.5, 'sunglasses on a rainy day');
  }
  if (!climate.inferred && slot === 'eyewear' && ctx.weather && ctx.weather.code <= 1 && climate.band !== 'freezing') {
    add(0.8, 'sunny out');
  }
  if ((slot === 'neckwear' || slot === 'gloves' || item.subcategory === 'beanie') && (climate.band === 'cold' || climate.band === 'freezing')) {
    add(1.5, 'extra warmth for the cold');
  }
  if (climate.windy && slot === 'outerwear') add(0.6, 'blocks the wind');

  // --- Season ---------------------------------------------------------------
  if (item.seasons.length > 0) {
    if (item.seasons.includes(climate.season)) add(0.3, `a ${climate.season} piece`);
    else add(climate.inferred ? -1.5 : -0.8, `not tagged for ${climate.season}`);
  }

  // --- Formality --------------------------------------------------------------
  const target = targetFormality(ctx);
  const fdiff = Math.abs(item.formality - target);
  const isAccessory = !['top', 'bottom', 'footwear', 'outerwear'].includes(slot);
  add(-fdiff * (isAccessory ? 0.5 : 0.9), fdiff < 1 ? 'fits the occasion' : 'formality is off');
  if (fdiff >= 3 && !isAccessory) {
    eligible = false;
    ineligibleBecause = ineligibleBecause ?? 'wrong formality for the occasion';
  }

  // --- Personal preferences ------------------------------------------------
  const liked = item.styleTags.filter((s) => ctx.prefs.preferredStyles.includes(s)).length;
  if (liked > 0) add(Math.min(liked, 2) * 0.6, 'matches your style');
  const avoided = item.styleTags.filter((s) => ctx.prefs.avoidStyles.includes(s)).length;
  if (avoided > 0) add(-1.5 * avoided, 'a style you avoid');
  if (ctx.prefs.preferredColors.includes(item.primaryColor)) add(0.7, 'a color you like');
  if (ctx.prefs.avoidColors.includes(item.primaryColor)) add(-2, 'a color you avoid');

  const adv = ctx.adjustments.adventurous;
  if (item.favorite) add(adv === -1 ? 1 : adv === 1 ? 0.2 : 0.6, 'one of your favorites');
  const fb = ctx.itemFeedback[item.id] ?? 0;
  if (fb !== 0) add(Math.max(-2, Math.min(2, fb * 0.8)), fb > 0 ? 'you liked it before' : 'you passed on it before');

  // --- Repetition avoidance --------------------------------------------------
  const days = ctx.lastWornDaysAgo[item.id];
  const recentMult = ctx.adjustments.avoidRecent ? 1.8 : 1;
  if (days !== undefined) {
    if (days <= 1) add(-2.5 * recentMult, 'worn very recently');
    else if (days <= 3) add(-1.2 * recentMult, 'worn in the last few days');
    else if (days <= 6) add(-0.4 * recentMult, 'worn this week');
  } else if (adv === 1) {
    add(0.6, 'not worn yet');
  }
  if (ctx.recentlyShown?.includes(item.id)) add(-1.5, 'shown a moment ago');

  // --- Adventurous vs conservative ---------------------------------------
  if (adv !== 0 && item.pattern !== 'solid' && item.pattern !== 'denim') {
    add(adv * 0.7, adv > 0 ? 'a bolder pattern' : 'pattern kept low-key');
  }

  return { item, slot, score, eligible, ineligibleBecause, reasons };
}

/** Key identifying the core of an outfit, used for feedback and repetition. */
export function comboKey(itemIds: (string | undefined)[]): string {
  return itemIds
    .filter((x): x is string => !!x)
    .sort()
    .join('|');
}

export interface ComboScore {
  score: number;
  reasons: Reason[];
  paletteDescription: string;
}

export function scoreCombination(chosen: ItemScore[], ctx: EngineContext): ComboScore {
  const reasons: Reason[] = [];
  let score = 0;
  for (const c of chosen) score += c.score;

  const core = chosen.filter((c) => ['top', 'bottom', 'footwear', 'outerwear'].includes(c.slot));
  const palette = paletteScore(
    chosen.map((c) => c.item.primaryColor),
    ctx.adjustments.colorful,
  );
  score += palette.score;
  reasons.push({ weight: palette.score, text: `Colors: ${palette.description}` });

  let style = 0;
  let pairs = 0;
  for (let i = 0; i < core.length; i++) {
    for (let j = i + 1; j < core.length; j++) {
      style += styleScore(core[i]!.item.styleTags, core[j]!.item.styleTags);
      pairs++;
    }
  }
  if (pairs > 0) {
    const s = (style / pairs) * 1.5;
    score += s;
    if (s > 0.4) reasons.push({ weight: s, text: 'Pieces share a consistent style' });
    if (s < -0.4) reasons.push({ weight: s, text: 'Mixed styles' });
  }

  const formalities = core.map((c) => c.item.formality);
  if (formalities.length > 1) {
    const spread = Math.max(...formalities) - Math.min(...formalities);
    if (spread > 2) score -= (spread - 2) * 1.0;
  }

  const patterned = core.filter((c) => c.item.pattern !== 'solid' && c.item.pattern !== 'denim').length;
  if (patterned > 1) score -= (patterned - 1) * (ctx.adjustments.adventurous === 1 ? 0.3 : 1);

  const key = comboKey(core.map((c) => c.item.id));
  if (ctx.dislikedCombos.includes(key)) score -= 6;
  if (ctx.likedCombos.includes(key)) {
    score += 1.5;
    reasons.push({ weight: 1.5, text: 'A combination you liked' });
  }
  if (ctx.recentCombos.includes(key)) score -= ctx.adjustments.avoidRecent ? 3 : 2;

  return { score, reasons, paletteDescription: palette.description };
}
