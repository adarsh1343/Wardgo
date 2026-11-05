import type { Category, Season, WardrobeItem } from '../../types/models';

export interface WardrobeFilter {
  search: string;
  category: Category | 'all';
  colors: string[];
  styles: string[];
  seasons: Season[];
  favoritesOnly: boolean;
  availability: 'all' | 'available' | 'unavailable';
  sort: 'newest' | 'oldest' | 'az';
}

export const DEFAULT_FILTER: WardrobeFilter = {
  search: '',
  category: 'all',
  colors: [],
  styles: [],
  seasons: [],
  favoritesOnly: false,
  availability: 'all',
  sort: 'newest',
};

export function activeFilterCount(f: WardrobeFilter): number {
  return f.colors.length + f.styles.length + f.seasons.length + (f.favoritesOnly ? 1 : 0) + (f.availability !== 'all' ? 1 : 0);
}

/** Pure filter + sort used by the Wardrobe screen. */
export function applyWardrobeFilter(items: WardrobeItem[], f: WardrobeFilter): WardrobeItem[] {
  const q = f.search.trim().toLowerCase();
  const out = items.filter((i) => {
    if (q && !i.name.toLowerCase().includes(q) && !i.material.toLowerCase().includes(q)) return false;
    if (f.category !== 'all' && i.category !== f.category) return false;
    if (f.colors.length && !f.colors.includes(i.primaryColor) && !i.secondaryColors.some((c) => f.colors.includes(c))) return false;
    if (f.styles.length && !i.styleTags.some((s) => f.styles.includes(s))) return false;
    // Items with no seasons set are treated as all-season.
    if (f.seasons.length && i.seasons.length > 0 && !i.seasons.some((s) => f.seasons.includes(s))) return false;
    if (f.favoritesOnly && !i.favorite) return false;
    if (f.availability === 'available' && !i.available) return false;
    if (f.availability === 'unavailable' && i.available) return false;
    return true;
  });
  const byName = (a: WardrobeItem, b: WardrobeItem) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  if (f.sort === 'az') out.sort((a, b) => byName(a, b) || a.id.localeCompare(b.id));
  else if (f.sort === 'oldest') out.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  else out.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id));
  return out;
}
