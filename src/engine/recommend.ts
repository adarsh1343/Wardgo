// Outfit generation and locked-item regeneration.
//
// Contract:
//   * Outfits are maps of slot -> wardrobe item ID.
//   * Locked item IDs are passed explicitly. A locked item is never removed,
//     moved or replaced; results that violate this are rejected by
//     validateRegeneration() before they are returned.
//   * When nothing valid can replace the requested slots, the function returns
//     { ok: false, reason } and the caller keeps the previous outfit.
import type { OutfitSlots, SlotKey, WardrobeItem } from '../types/models';
import {
  ACCESSORY_SLOTS,
  CORE_SLOTS,
  REQUIRED_SLOTS,
  SLOT_LABELS,
  SLOT_ORDER,
  isAccessorySlot,
  slotForItem,
} from './catalog';
import { createRng } from './random';
import {
  type EngineContext,
  type ItemScore,
  type Reason,
  comboKey,
  scoreCombination,
  scoreItem,
} from './scoring';
import { type Climate, deriveClimate } from './weather';

export interface Recommendation {
  slots: OutfitSlots;
  score: number;
  /** Short, user-facing explanation lines, most important first. */
  reasons: string[];
  /** Things the user should know (missing categories, compromises). */
  warnings: string[];
  climate: Climate;
}

export type RegenScope = { kind: 'all' } | { kind: 'slot'; slot: SlotKey };

export interface RegenRequest {
  current: OutfitSlots;
  lockedIds: string[];
  scope: RegenScope;
}

export type RegenResult =
  | { ok: true; recommendation: Recommendation; changedSlots: SlotKey[] }
  | { ok: false; reason: string };

export type GenerateResult =
  | { ok: true; recommendation: Recommendation }
  | { ok: false; reason: string; missing: SlotKey[] };

const CANDIDATES_PER_SLOT = 6;
const NONE = null;

export function climateFor(ctx: EngineContext): Climate {
  return deriveClimate(ctx.weather, {
    comfort: ctx.prefs.temperatureComfort,
    warmthAdjust: ctx.adjustments.warmth,
    date: ctx.date,
    latitude: ctx.latitude ?? null,
  });
}

/** Groups available items by the slot they occupy. */
export function itemsBySlot(items: WardrobeItem[], includeUnavailable = false): Map<SlotKey, WardrobeItem[]> {
  const map = new Map<SlotKey, WardrobeItem[]>();
  for (const item of items) {
    if (!includeUnavailable && !item.available) continue;
    const slot = slotForItem(item);
    const list = map.get(slot) ?? [];
    list.push(item);
    map.set(slot, list);
  }
  return map;
}

/** Which required slots have no available items at all. */
export function missingRequiredSlots(items: WardrobeItem[]): SlotKey[] {
  const bySlot = itemsBySlot(items);
  return REQUIRED_SLOTS.filter((s) => (bySlot.get(s)?.length ?? 0) === 0);
}

interface BuildOptions {
  /** Slots whose current item must be kept exactly. */
  fixed: OutfitSlots;
  /** Slots that may be (re)filled. */
  open: Set<SlotKey>;
  /** Item IDs that must not be chosen for a given slot (forces a change). */
  exclude: Map<SlotKey, Set<string>>;
  /** Item IDs that should preferably change (soft penalty). */
  discourage: Set<string>;
  /** Strict mode: never fall back to weather-unsuitable items for required slots. */
  strict: boolean;
}

interface BuildOutcome {
  slots: OutfitSlots;
  score: number;
  reasons: Reason[];
  warnings: string[];
  /** Open slots that had no acceptable candidate. */
  unfilled: { slot: SlotKey; why: string }[];
}

function explainEmpty(slot: SlotKey, all: WardrobeItem[], scored: ItemScore[], excluded: Set<string> | undefined): string {
  const label = SLOT_LABELS[slot].toLowerCase();
  const inSlot = all.filter((i) => slotForItem(i) === slot);
  const others = inSlot.filter((i) => !excluded?.has(i.id));
  if (inSlot.length === 0) return `You have no ${label} items yet.`;
  if (others.length === 0) return `This is your only ${label} item.`;
  const available = others.filter((i) => i.available);
  if (available.length === 0) return `Your other ${label} items are marked unavailable.`;
  const why = scored.find((s) => !s.eligible)?.ineligibleBecause;
  return `None of your other ${label} items suit today${why ? ` (${why})` : ''}.`;
}

function build(ctx: EngineContext, climate: Climate, opts: BuildOptions): BuildOutcome {
  const rng = createRng(ctx.seed);
  const byId = new Map(ctx.items.map((i) => [i.id, i]));
  const bySlot = itemsBySlot(ctx.items);
  const warnings: string[] = [];
  const unfilled: { slot: SlotKey; why: string }[] = [];

  const scoreFor = (item: WardrobeItem, slot: SlotKey): ItemScore => {
    const s = scoreItem(item, slot, climate, ctx);
    if (opts.discourage.has(item.id)) s.score -= 2.5;
    return s;
  };

  // Fixed items are scored too (they contribute to harmony) but never change.
  const fixedScores: ItemScore[] = [];
  for (const slot of SLOT_ORDER) {
    const id = opts.fixed[slot];
    if (!id) continue;
    const item = byId.get(id);
    if (item) fixedScores.push(scoreFor(item, slot));
  }

  // --- Candidate lists for open core slots --------------------------------
  type Option = ItemScore | typeof NONE;
  const coreOptions: { slot: SlotKey; options: Option[] }[] = [];
  for (const slot of CORE_SLOTS) {
    if (!opts.open.has(slot) || opts.fixed[slot]) continue;
    const excluded = opts.exclude.get(slot);
    const all = (bySlot.get(slot) ?? []).filter((i) => !excluded?.has(i.id));
    const scored = all.map((i) => scoreFor(i, slot)).sort((a, b) => b.score - a.score);
    let eligible = scored.filter((s) => s.eligible);
    const isRequired = (REQUIRED_SLOTS as readonly SlotKey[]).includes(slot);

    if (eligible.length === 0 && isRequired && scored.length > 0 && !opts.strict) {
      // Better to suggest something imperfect than nothing at all.
      eligible = scored.slice(0, 1);
      warnings.push(
        `No ${SLOT_LABELS[slot].toLowerCase()} really suits today — picked the closest option (${scored[0]!.ineligibleBecause ?? 'compromise'}).`,
      );
    }
    const top = eligible.slice(0, CANDIDATES_PER_SLOT);

    if (slot === 'outerwear') {
      // Explicitly requested layer swap: a layer must be chosen.
      const forced = opts.exclude.has('outerwear');
      if (climate.outerwear === false && !forced) {
        coreOptions.push({ slot, options: [NONE] });
      } else if (top.length === 0) {
        if (forced) unfilled.push({ slot, why: explainEmpty(slot, ctx.items, scored, excluded) });
        else if (climate.outerwear === true)
          warnings.push(`It's ${Math.round(climate.effectiveC)}° — an outer layer would help, but none is available.`);
        coreOptions.push({ slot, options: [NONE] });
      } else {
        coreOptions.push({ slot, options: climate.outerwear === true || forced ? top : [NONE, ...top] });
      }
      continue;
    }

    if (top.length === 0) {
      unfilled.push({ slot, why: explainEmpty(slot, ctx.items, scored, excluded) });
      continue;
    }
    coreOptions.push({ slot, options: top });
  }

  // --- Enumerate combinations of open core slots ---------------------------
  const combos: { picks: ItemScore[]; score: number; reasons: Reason[] }[] = [];
  const walk = (idx: number, picks: ItemScore[]) => {
    if (idx === coreOptions.length) {
      const combined = [...fixedScores.filter((f) => !isAccessorySlot(f.slot)), ...picks];
      const cs = scoreCombination(combined, ctx);
      // Small seeded jitter keeps repeated generation varied; adventurous widens it.
      const jitter = rng() * (0.6 + ctx.adjustments.adventurous * 0.4);
      combos.push({ picks: [...picks], score: cs.score + jitter, reasons: cs.reasons });
      return;
    }
    for (const opt of coreOptions[idx]!.options) {
      if (opt) picks.push(opt);
      walk(idx + 1, picks);
      if (opt) picks.pop();
    }
  };
  walk(0, []);
  combos.sort((a, b) => b.score - a.score);

  // Weighted pick among the best few for variety.
  let chosen = combos[0];
  if (combos.length > 1) {
    const best = combos[0]!.score;
    // Only near-equivalent options are eligible, so a clear penalty is never overridden by luck.
    const pool = combos.slice(0, 4).filter((c) => best - c.score <= 1.2);
    const weights = pool.map((c) => Math.exp((c.score - best) * 2));
    const total = weights.reduce((a, b) => a + b, 0);
    let r = rng() * total;
    for (let i = 0; i < pool.length; i++) {
      r -= weights[i]!;
      if (r <= 0) {
        chosen = pool[i];
        break;
      }
    }
  }

  const slots: OutfitSlots = { ...opts.fixed };
  const picked: ItemScore[] = [...fixedScores];
  for (const p of chosen?.picks ?? []) {
    slots[p.slot] = p.item.id;
    picked.push(p);
  }

  // --- Accessories: greedy, limited by maxAccessories ----------------------
  const fixedAccessoryCount = ACCESSORY_SLOTS.filter((s) => opts.fixed[s]).length;
  let budget = Math.max(0, ctx.prefs.maxAccessories - fixedAccessoryCount);
  const accCandidates: ItemScore[] = [];
  for (const slot of ACCESSORY_SLOTS) {
    if (!opts.open.has(slot) || opts.fixed[slot]) continue;
    const excluded = opts.exclude.get(slot);
    const all = (bySlot.get(slot) ?? []).filter((i) => !excluded?.has(i.id));
    const scored = all
      .map((i) => {
        const s = scoreFor(i, slot);
        // Harmony with what is already chosen.
        const cs = scoreCombination([...picked.filter((p) => !isAccessorySlot(p.slot)), s], ctx);
        const base = scoreCombination(picked.filter((p) => !isAccessorySlot(p.slot)), ctx);
        s.score += (cs.score - base.score - s.score) * 0.5;
        return s;
      })
      .filter((s) => s.eligible)
      .sort((a, b) => b.score - a.score);
    const forced = opts.exclude.has(slot); // explicit single-slot swap
    if (scored.length === 0) {
      if (forced) unfilled.push({ slot, why: explainEmpty(slot, ctx.items, all.map((i) => scoreFor(i, slot)), excluded) });
      continue;
    }
    if (forced) {
      const first = scored[0]!;
      slots[slot] = first.item.id;
      picked.push(first);
      budget = Math.max(0, budget - 1);
      continue;
    }
    accCandidates.push(scored[0]!);
  }
  accCandidates.sort((a, b) => b.score - a.score);
  for (const c of accCandidates) {
    if (budget <= 0) break;
    // Only add accessories that genuinely help the outfit.
    if (c.score < -1.2) continue;
    slots[c.slot] = c.item.id;
    picked.push(c);
    budget--;
  }

  const finalCombo = scoreCombination(picked, ctx);
  return {
    slots,
    score: finalCombo.score,
    reasons: [...(chosen?.reasons ?? []), ...picked.flatMap((p) => p.reasons)],
    warnings,
    unfilled,
  };
}

function summarizeReasons(climate: Climate, ctx: EngineContext, outcome: BuildOutcome): string[] {
  const out: string[] = [];
  const t = Math.round(climate.effectiveC);
  if (climate.inferred) {
    out.push(`No live weather — dressed for a typical ${climate.season} day.`);
  } else {
    const bandText: Record<Climate['band'], string> = {
      freezing: 'freezing, so warm layers and cover-ups',
      cold: 'cold, so a warm outer layer',
      cool: 'cool, so a jacket on top',
      mild: 'mild, so a light layer is optional',
      warm: 'warm, so light pieces',
      hot: 'hot, so the lightest pieces you have',
    };
    out.push(`Feels like ${t}° — ${bandText[climate.band]}.`);
  }
  if (climate.rainy) out.push('Rain is likely, so rain-friendly shoes and layers are preferred.');
  if (climate.windy) out.push('Windy today — a layer that blocks the wind helps.');

  const colors = outcome.reasons.find((r) => r.text.startsWith('Colors:'));
  if (colors) out.push(`${colors.text.replace('Colors: ', '')[0]!.toUpperCase()}${colors.text.replace('Colors: ', '').slice(1)}.`);
  const style = outcome.reasons.find((r) => r.text === 'Pieces share a consistent style');
  if (style) out.push('The pieces share a consistent style.');
  const liked = outcome.reasons.find((r) => r.text === 'A combination you liked');
  if (liked) out.push("It's a combination you liked before.");
  const favs = Object.values(outcome.slots).filter((id) => ctx.items.find((i) => i.id === id)?.favorite).length;
  if (favs > 0) out.push(`Includes ${favs} favorite${favs > 1 ? 's' : ''}.`);
  if (ctx.adjustments.avoidRecent || Object.keys(ctx.lastWornDaysAgo).length > 0) {
    const fresh = Object.values(outcome.slots).every((id) => {
      const d = id ? ctx.lastWornDaysAgo[id] : undefined;
      return d === undefined || d > 3;
    });
    if (fresh) out.push('Nothing here was worn in the last 3 days.');
  }
  return out.slice(0, 5);
}

/** Generate a fresh outfit from scratch. */
export function generateOutfit(ctx: EngineContext): GenerateResult {
  const missing = missingRequiredSlots(ctx.items);
  const available = ctx.items.filter((i) => i.available);
  if (available.length === 0) {
    return { ok: false, reason: 'Add a few available pieces to your wardrobe to get outfit ideas.', missing };
  }
  if (missing.length === REQUIRED_SLOTS.length) {
    return { ok: false, reason: 'Add at least a top, a bottom and some shoes to start getting outfits.', missing };
  }
  const climate = climateFor(ctx);
  const outcome = build(ctx, climate, {
    fixed: {},
    open: new Set(SLOT_ORDER),
    exclude: new Map(),
    discourage: new Set(),
    strict: false,
  });
  const warnings = [...outcome.warnings];
  if (missing.length > 0) {
    warnings.push(`Add ${missing.map((m) => SLOT_LABELS[m].toLowerCase()).join(' and ')} to complete your outfits.`);
  }
  return {
    ok: true,
    recommendation: {
      slots: outcome.slots,
      score: outcome.score,
      reasons: summarizeReasons(climate, ctx, outcome),
      warnings,
      climate,
    },
  };
}

/** Slot that currently holds each item ID in an outfit. */
function slotOf(outfit: OutfitSlots, id: string): SlotKey | undefined {
  return (Object.keys(outfit) as SlotKey[]).find((s) => outfit[s] === id);
}

/**
 * Regenerate part of an outfit while preserving locked items exactly.
 * scope 'all' -> every unlocked slot may change; scope 'slot' -> only that slot.
 */
export function regenerateOutfit(ctx: EngineContext, req: RegenRequest): RegenResult {
  const { current, scope } = req;
  const lockedIds = req.lockedIds.filter((id) => slotOf(current, id) !== undefined);
  const lockedSlots = new Set(lockedIds.map((id) => slotOf(current, id)!));

  if (scope.kind === 'slot' && lockedSlots.has(scope.slot)) {
    return { ok: false, reason: `The ${SLOT_LABELS[scope.slot].toLowerCase()} is locked. Unlock it to swap it.` };
  }

  const fixed: OutfitSlots = {};
  const open = new Set<SlotKey>();
  const exclude = new Map<SlotKey, Set<string>>();
  const discourage = new Set<string>();

  if (scope.kind === 'all') {
    const filled = SLOT_ORDER.filter((s) => current[s]);
    if (filled.length > 0 && filled.every((s) => lockedSlots.has(s))) {
      return { ok: false, reason: 'Everything is locked — unlock something to regenerate.' };
    }
    for (const slot of SLOT_ORDER) {
      const id = current[slot];
      if (id && lockedSlots.has(slot)) fixed[slot] = id;
      else {
        open.add(slot);
        if (id) discourage.add(id);
      }
    }
    if (open.size === 0) return { ok: false, reason: 'Everything is locked — unlock something to regenerate.' };
  } else {
    for (const slot of SLOT_ORDER) {
      const id = current[slot];
      if (slot === scope.slot) continue;
      if (id) fixed[slot] = id;
    }
    open.add(scope.slot);
    const cur = current[scope.slot];
    exclude.set(scope.slot, new Set(cur ? [cur] : []));
  }

  const climate = climateFor(ctx);
  const outcome = build(ctx, climate, {
    fixed,
    open,
    exclude,
    discourage,
    strict: scope.kind === 'slot',
  });

  if (scope.kind === 'slot' && outcome.unfilled.some((u) => u.slot === scope.slot)) {
    const why = outcome.unfilled.find((u) => u.slot === scope.slot)!.why;
    return { ok: false, reason: `No valid replacement for the ${SLOT_LABELS[scope.slot].toLowerCase()}. ${why}` };
  }

  const changedSlots = SLOT_ORDER.filter((s) => outcome.slots[s] !== current[s]);
  if (changedSlots.length === 0) {
    return {
      ok: false,
      reason: 'No different combination fits right now. Try unlocking an item, changing the occasion, or adding more pieces.',
    };
  }

  const validation = validateRegeneration(current, outcome.slots, lockedIds, scope, ctx.items);
  if (!validation.valid) {
    return { ok: false, reason: `Regeneration rejected: ${validation.errors.join(' ')}` };
  }

  return {
    ok: true,
    changedSlots,
    recommendation: {
      slots: outcome.slots,
      score: outcome.score,
      reasons: summarizeReasons(climate, ctx, outcome),
      warnings: outcome.warnings,
      climate,
    },
  };
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Final safety net before a regenerated outfit is committed:
 *  - every locked ID is still present in the same slot;
 *  - with slot scope, every other slot is unchanged;
 *  - every item exists, sits in its own slot, and newly chosen items are available.
 */
export function validateRegeneration(
  previous: OutfitSlots,
  next: OutfitSlots,
  lockedIds: string[],
  scope: RegenScope,
  items: WardrobeItem[],
): ValidationResult {
  const errors: string[] = [];
  const byId = new Map(items.map((i) => [i.id, i]));

  for (const id of lockedIds) {
    const prevSlot = slotOf(previous, id);
    if (!prevSlot) continue;
    if (next[prevSlot] !== id) errors.push(`Locked item ${id} changed or disappeared.`);
  }
  if (scope.kind === 'slot') {
    for (const slot of SLOT_ORDER) {
      if (slot === scope.slot) continue;
      if (previous[slot] !== next[slot]) errors.push(`Slot ${slot} changed outside the requested scope.`);
    }
  }
  const seen = new Set<string>();
  for (const slot of Object.keys(next) as SlotKey[]) {
    const id = next[slot];
    if (!id) continue;
    if (seen.has(id)) errors.push(`Item ${id} appears twice.`);
    seen.add(id);
    const item = byId.get(id);
    if (!item) {
      errors.push(`Item ${id} does not exist.`);
      continue;
    }
    if (slotForItem(item) !== slot) errors.push(`Item ${id} is in the wrong slot.`);
    const isNew = previous[slot] !== id;
    if (isNew && !item.available) errors.push(`Item ${id} is unavailable.`);
  }
  return { valid: errors.length === 0, errors };
}

export { comboKey };
