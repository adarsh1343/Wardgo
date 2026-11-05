import { generateOutfit } from '../src/engine/recommend';
import { activeFilterCount, applyWardrobeFilter, DEFAULT_FILTER } from '../src/features/wardrobe/filter';
import { makeContext, makeItem } from './fixtures';

const items = [
  makeItem('tshirt', { id: 'a', name: 'Zebra tee', primaryColor: 'white', createdAt: '2026-01-03', styleTags: ['casual'], seasons: ['summer'] }),
  makeItem('jeans', { id: 'b', name: 'apple jeans', primaryColor: 'denim', createdAt: '2026-01-01', favorite: true, styleTags: ['streetwear'] }),
  makeItem('boots', { id: 'c', name: 'Mud boots', primaryColor: 'brown', secondaryColors: ['white'], createdAt: '2026-01-02', available: false }),
];

describe('wardrobe filter', () => {
  test('search by name, case-insensitive', () => {
    expect(applyWardrobeFilter(items, { ...DEFAULT_FILTER, search: 'JEANS' }).map((i) => i.id)).toEqual(['b']);
  });
  test('category, color (incl. secondary), style, season, favorites, availability', () => {
    expect(applyWardrobeFilter(items, { ...DEFAULT_FILTER, category: 'footwear' }).map((i) => i.id)).toEqual(['c']);
    expect(applyWardrobeFilter(items, { ...DEFAULT_FILTER, colors: ['white'] }).map((i) => i.id).sort()).toEqual(['a', 'c']);
    expect(applyWardrobeFilter(items, { ...DEFAULT_FILTER, styles: ['streetwear'] }).map((i) => i.id)).toEqual(['b']);
    // Items without seasons count as all-season.
    expect(applyWardrobeFilter(items, { ...DEFAULT_FILTER, seasons: ['winter'] }).map((i) => i.id).sort()).toEqual(['b', 'c']);
    expect(applyWardrobeFilter(items, { ...DEFAULT_FILTER, favoritesOnly: true }).map((i) => i.id)).toEqual(['b']);
    expect(applyWardrobeFilter(items, { ...DEFAULT_FILTER, availability: 'unavailable' }).map((i) => i.id)).toEqual(['c']);
  });
  test('sorting', () => {
    expect(applyWardrobeFilter(items, DEFAULT_FILTER).map((i) => i.id)).toEqual(['a', 'c', 'b']);
    expect(applyWardrobeFilter(items, { ...DEFAULT_FILTER, sort: 'az' }).map((i) => i.id)).toEqual(['b', 'c', 'a']);
    expect(applyWardrobeFilter(items, { ...DEFAULT_FILTER, sort: 'oldest' }).map((i) => i.id)).toEqual(['b', 'c', 'a']);
  });
  test('active filter count', () => {
    expect(activeFilterCount(DEFAULT_FILTER)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTER, colors: ['red'], favoritesOnly: true })).toBe(2);
  });
});

describe('large wardrobes', () => {
  test('600 items: filtering and generation stay fast and valid', () => {
    const subs = ['tshirt', 'shirt', 'sweater', 'jeans', 'chinos', 'shorts', 'sneakers', 'boots', 'watch', 'cap', 'belt', 'jacket', 'coat'];
    const colors = ['black', 'white', 'navy', 'grey', 'red', 'green', 'beige', 'blue'];
    const many = Array.from({ length: 600 }, (_, n) =>
      makeItem(subs[n % subs.length]!, { id: `i${n}`, name: `Item ${n}`, primaryColor: colors[n % colors.length]!, favorite: n % 17 === 0 }),
    );
    const t0 = Date.now();
    const filtered = applyWardrobeFilter(many, { ...DEFAULT_FILTER, search: 'item 1', sort: 'az' });
    expect(filtered.length).toBeGreaterThan(0);
    const res = generateOutfit(makeContext(many));
    const elapsed = Date.now() - t0;
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.recommendation.slots.top).toBeDefined();
      expect(res.recommendation.slots.bottom).toBeDefined();
      expect(res.recommendation.slots.footwear).toBeDefined();
    }
    expect(elapsed).toBeLessThan(1500);
  });
});
