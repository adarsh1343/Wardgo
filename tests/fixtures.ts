import type { EngineContext } from '../src/engine/scoring';
import { NEUTRAL_ADJUSTMENTS } from '../src/engine/scoring';
import { getSubcategory } from '../src/engine/catalog';
import type { WardrobeItem, WeatherContext } from '../src/types/models';

let counter = 0;

export function makeItem(subcategory: string, overrides: Partial<WardrobeItem> = {}): WardrobeItem {
  const def = getSubcategory(subcategory);
  if (!def) throw new Error(`Unknown subcategory ${subcategory}`);
  counter++;
  return {
    id: overrides.id ?? `${subcategory}-${counter}`,
    name: overrides.name ?? `${def.label} ${counter}`,
    category: def.category,
    subcategory,
    primaryColor: 'black',
    secondaryColors: [],
    pattern: 'solid',
    material: '',
    seasons: [],
    formality: def.formality,
    styleTags: ['casual'],
    warmth: def.warmth,
    rain: def.rain,
    notes: '',
    favorite: false,
    available: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    images: [],
    ...overrides,
  };
}

export const MILD_WEATHER: WeatherContext = {
  tempC: 16,
  feelsLikeC: 15,
  highC: 18,
  lowC: 11,
  precipProbability: 10,
  windKph: 10,
  code: 2,
  summary: 'Partly cloudy',
};

export const COLD_RAIN: WeatherContext = {
  tempC: 4,
  feelsLikeC: 1,
  highC: 6,
  lowC: 1,
  precipProbability: 80,
  windKph: 20,
  code: 63,
  summary: 'Rain',
};

export const HOT: WeatherContext = {
  tempC: 31,
  feelsLikeC: 33,
  highC: 33,
  lowC: 22,
  precipProbability: 0,
  windKph: 5,
  code: 0,
  summary: 'Clear sky',
};

export function makeContext(items: WardrobeItem[], overrides: Partial<EngineContext> = {}): EngineContext {
  return {
    items,
    weather: MILD_WEATHER,
    prefs: {
      preferredStyles: [],
      avoidStyles: [],
      preferredColors: [],
      avoidColors: [],
      temperatureComfort: 0,
      maxAccessories: 3,
    },
    occasion: 'everyday',
    adjustments: NEUTRAL_ADJUSTMENTS,
    lastWornDaysAgo: {},
    recentCombos: [],
    dislikedCombos: [],
    likedCombos: [],
    itemFeedback: {},
    seed: 42,
    date: new Date('2026-10-19T08:00:00Z'),
    latitude: 52,
    ...overrides,
  };
}

/** The example wardrobe from the spec plus a few alternatives in every slot. */
export function sampleWardrobe(): WardrobeItem[] {
  return [
    makeItem('shirt', { id: 'black-shirt', name: 'Black shirt', primaryColor: 'black' }),
    makeItem('tshirt', { id: 'white-tee', name: 'White tee', primaryColor: 'white' }),
    makeItem('longsleeve', { id: 'navy-ls', name: 'Navy long sleeve', primaryColor: 'navy' }),
    makeItem('jeans', { id: 'grey-jeans', name: 'Grey jeans', primaryColor: 'grey' }),
    makeItem('chinos', { id: 'beige-chinos', name: 'Beige chinos', primaryColor: 'beige' }),
    makeItem('jeans', { id: 'blue-jeans', name: 'Blue jeans', primaryColor: 'denim', pattern: 'denim' }),
    makeItem('sneakers', { id: 'white-sneakers', name: 'White sneakers', primaryColor: 'white' }),
    makeItem('boots', { id: 'brown-boots', name: 'Brown boots', primaryColor: 'brown' }),
    makeItem('sneakers', { id: 'black-sneakers', name: 'Black sneakers', primaryColor: 'black' }),
    makeItem('watch', { id: 'black-watch', name: 'Black watch', primaryColor: 'black' }),
    makeItem('watch', { id: 'silver-watch', name: 'Silver watch', primaryColor: 'silver' }),
    makeItem('cap', { id: 'black-cap', name: 'Black cap', primaryColor: 'black' }),
    makeItem('cap', { id: 'navy-cap', name: 'Navy cap', primaryColor: 'navy' }),
    makeItem('jacket', { id: 'olive-jacket', name: 'Olive jacket', primaryColor: 'olive' }),
    makeItem('denimjacket', { id: 'denim-jacket', name: 'Denim jacket', primaryColor: 'denim' }),
  ];
}

export const EXAMPLE_OUTFIT = {
  top: 'black-shirt',
  bottom: 'grey-jeans',
  footwear: 'white-sneakers',
  watch: 'black-watch',
  headwear: 'black-cap',
} as const;
