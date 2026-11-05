import { generateOutfit } from '../src/engine/recommend';
import { colorPairScore, paletteScore } from '../src/engine/harmony';
import { deriveClimate, describeWeatherCode, seasonFor } from '../src/engine/weather';
import { COLD_RAIN, HOT, makeContext, makeItem, sampleWardrobe } from './fixtures';

describe('weather influence', () => {
  const wardrobe = () => [
    ...sampleWardrobe(),
    makeItem('shorts', { id: 'shorts', primaryColor: 'beige' }),
    makeItem('sandals', { id: 'sandals', primaryColor: 'brown' }),
    makeItem('parka', { id: 'parka', primaryColor: 'black' }),
    makeItem('raincoat', { id: 'raincoat', primaryColor: 'navy' }),
    makeItem('sweater', { id: 'sweater', primaryColor: 'cream' }),
  ];

  test('cold rain: warm outer layer, no shorts or sandals, waterproof shoes', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const res = generateOutfit(makeContext(wardrobe(), { weather: COLD_RAIN, seed }));
      if (!res.ok) throw new Error(res.reason);
      const s = res.recommendation.slots;
      expect(s.outerwear).toBeDefined();
      expect(s.bottom).not.toBe('shorts');
      expect(s.footwear).not.toBe('sandals');
      expect(s.footwear).toBe('brown-boots');
      expect(res.recommendation.reasons.join(' ')).toMatch(/rain/i);
    }
  });

  test('hot day: no outer layer, no sweater or parka', () => {
    for (let seed = 1; seed <= 15; seed++) {
      const res = generateOutfit(makeContext(wardrobe(), { weather: HOT, seed }));
      if (!res.ok) throw new Error(res.reason);
      const s = res.recommendation.slots;
      expect(s.outerwear).toBeUndefined();
      expect(s.top).not.toBe('sweater');
    }
  });

  test('no weather falls back to the season and says so', () => {
    const res = generateOutfit(makeContext(sampleWardrobe(), { weather: null }));
    if (!res.ok) throw new Error(res.reason);
    expect(res.recommendation.climate.inferred).toBe(true);
    expect(res.recommendation.reasons[0]).toMatch(/No live weather/);
  });

  test('comfort preference shifts the effective temperature', () => {
    const w = { ...COLD_RAIN, feelsLikeC: 12, highC: 14, lowC: 10, precipProbability: 0, code: 2 };
    expect(deriveClimate(w, { comfort: -1 }).effectiveC).toBeLessThan(deriveClimate(w).effectiveC);
    expect(deriveClimate(w, { warmthAdjust: 1 }).effectiveC).toBeLessThan(deriveClimate(w).effectiveC);
  });

  test('season and weather code helpers', () => {
    expect(seasonFor(new Date('2026-07-01'), 50)).toBe('summer');
    expect(seasonFor(new Date('2026-07-01'), -33)).toBe('winter');
    expect(describeWeatherCode(63).icon).toBe('rain');
    expect(describeWeatherCode(0, false).icon).toBe('clear-night');
  });
});

describe('personalisation', () => {
  test('disliked combination is avoided', () => {
    const items = [
      makeItem('tshirt', { id: 't1', primaryColor: 'white' }),
      makeItem('tshirt', { id: 't2', primaryColor: 'grey' }),
      makeItem('jeans', { id: 'j', primaryColor: 'denim' }),
      makeItem('sneakers', { id: 's', primaryColor: 'white' }),
    ];
    for (let seed = 1; seed <= 10; seed++) {
      const res = generateOutfit(makeContext(items, { seed, dislikedCombos: ['j|s|t1'] }));
      if (!res.ok) throw new Error(res.reason);
      expect(res.recommendation.slots.top).toBe('t2');
    }
  });

  test('recently worn items are avoided when alternatives exist', () => {
    const items = sampleWardrobe();
    let worn = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const res = generateOutfit(
        makeContext(items, { seed, lastWornDaysAgo: { 'black-shirt': 0, 'white-tee': 1 } }),
      );
      if (!res.ok) throw new Error(res.reason);
      if (['black-shirt', 'white-tee'].includes(res.recommendation.slots.top ?? '')) worn++;
    }
    expect(worn).toBeLessThan(5);
  });

  test('avoided colors are penalised', () => {
    const items = [
      makeItem('tshirt', { id: 'red', primaryColor: 'red' }),
      makeItem('tshirt', { id: 'white', primaryColor: 'white' }),
      makeItem('jeans', { id: 'j', primaryColor: 'denim' }),
      makeItem('sneakers', { id: 's', primaryColor: 'white' }),
    ];
    const base = makeContext(items);
    for (let seed = 1; seed <= 10; seed++) {
      const res = generateOutfit({ ...base, seed, prefs: { ...base.prefs, avoidColors: ['white'] } });
      if (!res.ok) throw new Error(res.reason);
      expect(res.recommendation.slots.top).toBe('red');
    }
  });
});

describe('color harmony', () => {
  test('neutrals pair well, clashing hues do not', () => {
    expect(colorPairScore('black', 'white')).toBeGreaterThan(0);
    expect(colorPairScore('green', 'purple')).toBeLessThan(0);
    expect(paletteScore(['black', 'white', 'grey']).boldColors).toHaveLength(0);
    expect(paletteScore(['red', 'green', 'purple']).score).toBeLessThan(paletteScore(['red', 'grey', 'white']).score);
  });
});
