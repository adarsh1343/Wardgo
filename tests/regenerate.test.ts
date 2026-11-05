import {
  generateOutfit,
  regenerateOutfit,
  validateRegeneration,
  type Recommendation,
} from '../src/engine/recommend';
import { emptySession, sessionReducer } from '../src/engine/session';
import type { OutfitSlots } from '../src/types/models';
import { EXAMPLE_OUTFIT, makeContext, makeItem, sampleWardrobe } from './fixtures';

const current: OutfitSlots = { ...EXAMPLE_OUTFIT };

function expectOk<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  if (!r.ok) throw new Error(`Expected ok, got: ${(r as { reason?: string }).reason}`);
  return r as Extract<T, { ok: true }>;
}

describe('locked-item regeneration', () => {
  test('one locked item stays exactly the same', () => {
    const ctx = makeContext(sampleWardrobe());
    for (let seed = 1; seed <= 25; seed++) {
      const res = expectOk(
        regenerateOutfit({ ...ctx, seed }, { current, lockedIds: ['grey-jeans'], scope: { kind: 'all' } }),
      );
      expect(res.recommendation.slots.bottom).toBe('grey-jeans');
      expect(res.changedSlots.length).toBeGreaterThan(0);
    }
  });

  test('multiple locked items are all preserved', () => {
    const ctx = makeContext(sampleWardrobe());
    const locked = ['grey-jeans', 'white-sneakers', 'black-shirt'];
    for (let seed = 1; seed <= 25; seed++) {
      const res = regenerateOutfit({ ...ctx, seed }, { current, lockedIds: locked, scope: { kind: 'all' } });
      if (!res.ok) continue; // allowed: maybe nothing else could change
      expect(res.recommendation.slots.bottom).toBe('grey-jeans');
      expect(res.recommendation.slots.footwear).toBe('white-sneakers');
      expect(res.recommendation.slots.top).toBe('black-shirt');
    }
  });

  test('locked accessories are preserved', () => {
    const ctx = makeContext(sampleWardrobe(), { prefs: { ...makeContext([]).prefs, maxAccessories: 1 } });
    for (let seed = 1; seed <= 25; seed++) {
      const res = expectOk(
        regenerateOutfit({ ...ctx, seed }, { current, lockedIds: ['black-watch', 'black-cap'], scope: { kind: 'all' } }),
      );
      // Locked accessories survive even though they exceed maxAccessories.
      expect(res.recommendation.slots.watch).toBe('black-watch');
      expect(res.recommendation.slots.headwear).toBe('black-cap');
    }
  });

  test('regenerating only the top changes nothing else', () => {
    const ctx = makeContext(sampleWardrobe());
    const res = expectOk(regenerateOutfit(ctx, { current, lockedIds: [], scope: { kind: 'slot', slot: 'top' } }));
    const next = res.recommendation.slots;
    expect(next.top).toBeDefined();
    expect(next.top).not.toBe('black-shirt');
    expect(next.bottom).toBe(current.bottom);
    expect(next.footwear).toBe(current.footwear);
    expect(next.watch).toBe(current.watch);
    expect(next.headwear).toBe(current.headwear);
    expect(next.outerwear).toBeUndefined();
    expect(res.changedSlots).toEqual(['top']);
  });

  test('regenerating a single accessory category', () => {
    const ctx = makeContext(sampleWardrobe());
    const res = expectOk(regenerateOutfit(ctx, { current, lockedIds: [], scope: { kind: 'slot', slot: 'watch' } }));
    expect(res.recommendation.slots.watch).toBe('silver-watch');
    expect(res.changedSlots).toEqual(['watch']);
  });

  test('refuses to swap a locked slot', () => {
    const ctx = makeContext(sampleWardrobe());
    const res = regenerateOutfit(ctx, { current, lockedIds: ['black-shirt'], scope: { kind: 'slot', slot: 'top' } });
    expect(res.ok).toBe(false);
  });

  test('explains when no replacement exists', () => {
    const items = sampleWardrobe().filter((i) => i.subcategory !== 'watch' || i.id === 'black-watch');
    const ctx = makeContext(items);
    const res = regenerateOutfit(ctx, { current, lockedIds: [], scope: { kind: 'slot', slot: 'watch' } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/only watch/i);
  });

  test('everything locked -> clear message, nothing changes', () => {
    const ctx = makeContext(sampleWardrobe());
    const res = regenerateOutfit(ctx, { current, lockedIds: Object.values(current), scope: { kind: 'all' } });
    expect(res.ok).toBe(false);
  });

  test('unavailable items are never chosen as replacements', () => {
    const items = sampleWardrobe().map((i) =>
      i.id === 'white-tee' || i.id === 'navy-ls' ? { ...i, available: false } : i,
    );
    const ctx = makeContext(items);
    const res = regenerateOutfit(ctx, { current, lockedIds: [], scope: { kind: 'slot', slot: 'top' } });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toMatch(/unavailable/i);

    for (let seed = 1; seed <= 20; seed++) {
      const all = regenerateOutfit({ ...ctx, seed }, { current, lockedIds: [], scope: { kind: 'all' } });
      if (!all.ok) continue;
      for (const id of Object.values(all.recommendation.slots)) {
        if (id === current.top) continue; // unchanged slot is fine
        expect(items.find((i) => i.id === id)?.available).toBe(true);
      }
    }
  });

  test('a locked item stays even if it is now unavailable', () => {
    const items = sampleWardrobe().map((i) => (i.id === 'grey-jeans' ? { ...i, available: false } : i));
    const res = expectOk(
      regenerateOutfit(makeContext(items), { current, lockedIds: ['grey-jeans'], scope: { kind: 'all' } }),
    );
    expect(res.recommendation.slots.bottom).toBe('grey-jeans');
  });

  test('repeated regeneration keeps locks and keeps producing valid outfits', () => {
    const items = sampleWardrobe();
    let state = sessionReducer(emptySession, {
      type: 'load',
      recommendation: { slots: current, score: 0, reasons: [], warnings: [], climate: {} as Recommendation['climate'] },
      lockedIds: ['grey-jeans', 'black-watch'],
    });
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) {
      const ctx = makeContext(items, { seed: 1000 + i, recentlyShown: state.shownIds });
      const res = regenerateOutfit(ctx, {
        current: state.current!.slots,
        lockedIds: state.lockedIds,
        scope: { kind: 'all' },
      });
      if (res.ok) {
        state = sessionReducer(state, { type: 'regenerated', recommendation: res.recommendation, changedSlots: res.changedSlots });
      } else {
        state = sessionReducer(state, { type: 'regenerateFailed', reason: res.reason });
      }
      expect(state.current!.slots.bottom).toBe('grey-jeans');
      expect(state.current!.slots.watch).toBe('black-watch');
      seen.add(state.current!.slots.top ?? '');
    }
    // Variety: more than one top shows up over repeated regenerations.
    expect(seen.size).toBeGreaterThan(1);
  });
});

describe('insufficient inventory', () => {
  test('empty wardrobe', () => {
    const res = generateOutfit(makeContext([]));
    expect(res.ok).toBe(false);
  });

  test('missing categories are reported but an outfit is still built', () => {
    const items = [makeItem('tshirt', { id: 't' }), makeItem('jeans', { id: 'j' })];
    const res = generateOutfit(makeContext(items));
    const ok = expectOk(res);
    expect(ok.recommendation.slots.top).toBe('t');
    expect(ok.recommendation.slots.bottom).toBe('j');
    expect(ok.recommendation.slots.footwear).toBeUndefined();
    expect(ok.recommendation.warnings.join(' ')).toMatch(/shoes/i);
  });

  test('only one item per slot: regenerate all reports no alternative', () => {
    const items = [makeItem('tshirt', { id: 't' }), makeItem('jeans', { id: 'j' }), makeItem('sneakers', { id: 's' })];
    const ctx = makeContext(items);
    const gen = expectOk(generateOutfit(ctx));
    const res = regenerateOutfit(ctx, { current: gen.recommendation.slots, lockedIds: [], scope: { kind: 'all' } });
    expect(res.ok).toBe(false);
  });
});

describe('validation', () => {
  const items = sampleWardrobe();
  test('rejects a result that drops a locked item', () => {
    const next = { ...current, bottom: 'blue-jeans' };
    const v = validateRegeneration(current, next, ['grey-jeans'], { kind: 'all' }, items);
    expect(v.valid).toBe(false);
  });
  test('rejects a result that moves a locked item to another slot', () => {
    const next: OutfitSlots = { ...current, bottom: 'beige-chinos', top: 'grey-jeans' };
    const v = validateRegeneration(current, next, ['grey-jeans'], { kind: 'all' }, items);
    expect(v.valid).toBe(false);
  });
  test('rejects changes outside a single-slot scope', () => {
    const next = { ...current, top: 'white-tee', footwear: 'brown-boots' };
    const v = validateRegeneration(current, next, [], { kind: 'slot', slot: 'top' }, items);
    expect(v.valid).toBe(false);
  });
  test('rejects unknown and unavailable items', () => {
    const unavailable = items.map((i) => (i.id === 'white-tee' ? { ...i, available: false } : i));
    expect(validateRegeneration(current, { ...current, top: 'ghost' }, [], { kind: 'all' }, items).valid).toBe(false);
    expect(validateRegeneration(current, { ...current, top: 'white-tee' }, [], { kind: 'all' }, unavailable).valid).toBe(false);
  });
  test('accepts a valid regeneration', () => {
    const next = { ...current, top: 'white-tee' };
    expect(validateRegeneration(current, next, ['grey-jeans'], { kind: 'slot', slot: 'top' }, items).valid).toBe(true);
  });
});

describe('undo', () => {
  const rec = (slots: OutfitSlots): Recommendation => ({
    slots,
    score: 0,
    reasons: [],
    warnings: [],
    climate: {} as Recommendation['climate'],
  });

  test('undo restores the previous outfit exactly', () => {
    let s = sessionReducer(emptySession, { type: 'load', recommendation: rec(current) });
    const second = rec({ ...current, top: 'white-tee' });
    s = sessionReducer(s, { type: 'regenerated', recommendation: second, changedSlots: ['top'] });
    expect(s.current!.slots.top).toBe('white-tee');
    s = sessionReducer(s, { type: 'undo' });
    expect(s.current!.slots).toEqual(current);
    expect(s.past).toHaveLength(0);
  });

  test('failed regeneration keeps the old outfit intact', () => {
    let s = sessionReducer(emptySession, { type: 'load', recommendation: rec(current) });
    s = sessionReducer(s, { type: 'regenerateFailed', reason: 'nope' });
    expect(s.current!.slots).toEqual(current);
    expect(s.message).toBe('nope');
    expect(s.past).toHaveLength(0);
  });

  test('reducer refuses a result that lost a locked item', () => {
    let s = sessionReducer(emptySession, { type: 'load', recommendation: rec(current), lockedIds: ['grey-jeans'] });
    s = sessionReducer(s, { type: 'regenerated', recommendation: rec({ ...current, bottom: 'blue-jeans' }), changedSlots: ['bottom'] });
    expect(s.current!.slots.bottom).toBe('grey-jeans');
    expect(s.message).toMatch(/locked/);
  });

  test('locks survive undo when the item is still present, and drop otherwise', () => {
    let s = sessionReducer(emptySession, { type: 'load', recommendation: rec(current) });
    s = sessionReducer(s, { type: 'regenerated', recommendation: rec({ ...current, top: 'white-tee' }), changedSlots: ['top'] });
    s = sessionReducer(s, { type: 'toggleLock', itemId: 'white-tee' });
    s = sessionReducer(s, { type: 'toggleLock', itemId: 'grey-jeans' });
    expect(s.lockedIds.sort()).toEqual(['grey-jeans', 'white-tee']);
    s = sessionReducer(s, { type: 'undo' });
    expect(s.lockedIds).toEqual(['grey-jeans']);
  });

  test('replace keeps the previous outfit available for undo', () => {
    let s = sessionReducer(emptySession, { type: 'load', recommendation: rec(current) });
    s = sessionReducer(s, { type: 'replace', recommendation: rec({ top: 'white-tee', bottom: 'beige-chinos' }), lockedIds: ['white-tee'] });
    expect(s.lockedIds).toEqual(['white-tee']);
    s = sessionReducer(s, { type: 'undo' });
    expect(s.current!.slots).toEqual(current);
  });

  test('deleted items are removed from the outfit and history, never substituted', () => {
    let s = sessionReducer(emptySession, { type: 'load', recommendation: rec(current), lockedIds: ['grey-jeans'] });
    s = sessionReducer(s, { type: 'regenerated', recommendation: rec({ ...current, top: 'white-tee' }), changedSlots: ['top'] });
    const existing = sampleWardrobe().map((i) => i.id).filter((id) => id !== 'grey-jeans' && id !== 'black-shirt');
    s = sessionReducer(s, { type: 'pruneMissing', existingIds: existing });
    expect(s.current!.slots.bottom).toBeUndefined();
    expect(s.current!.slots.top).toBe('white-tee');
    expect(s.lockedIds).toEqual([]);
    expect(s.message).toMatch(/deleted/);
    s = sessionReducer(s, { type: 'undo' });
    expect(Object.values(s.current!.slots)).not.toContain('black-shirt');
    expect(Object.values(s.current!.slots)).not.toContain('grey-jeans');
    // No-op when nothing is missing.
    const same = sessionReducer(s, { type: 'pruneMissing', existingIds: sampleWardrobe().map((i) => i.id) });
    expect(same).toBe(s);
  });

  test('multiple undos walk back through history', () => {
    let s = sessionReducer(emptySession, { type: 'load', recommendation: rec(current) });
    s = sessionReducer(s, { type: 'regenerated', recommendation: rec({ ...current, top: 'white-tee' }), changedSlots: ['top'] });
    s = sessionReducer(s, { type: 'regenerated', recommendation: rec({ ...current, top: 'navy-ls' }), changedSlots: ['top'] });
    s = sessionReducer(s, { type: 'undo' });
    expect(s.current!.slots.top).toBe('white-tee');
    s = sessionReducer(s, { type: 'undo' });
    expect(s.current!.slots.top).toBe('black-shirt');
    s = sessionReducer(s, { type: 'undo' });
    expect(s.current!.slots.top).toBe('black-shirt');
    expect(s.message).toMatch(/Nothing to undo/);
  });
});
