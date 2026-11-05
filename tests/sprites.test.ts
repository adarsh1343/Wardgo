import { ICONS, PIXEL_PALETTE, SPRITES, WEATHER_SPRITES } from '../src/assets/pixel/sprites';
import { pixelRuns } from '../src/components/pixel/pixelRuns';

const all: [string, readonly string[]][] = [
  ...Object.entries(ICONS),
  ...Object.entries(WEATHER_SPRITES),
  ...Object.entries(SPRITES),
];

describe('pixel art assets', () => {
  test.each(all)('%s is rectangular and uses known colors', (_name, art) => {
    const width = art[0]!.length;
    for (const row of art) expect(row.length).toBe(width);
    for (const ch of art.join('')) {
      if (ch === '.' || ch === 'X') continue;
      expect(PIXEL_PALETTE[ch]).toBeDefined();
    }
  });

  test('UI icons are 12×12 and weather sprites are 16×16', () => {
    for (const art of Object.values(ICONS)) {
      expect(art).toHaveLength(12);
      expect(art[0]).toHaveLength(12);
    }
    for (const art of Object.values(WEATHER_SPRITES)) {
      expect(art).toHaveLength(16);
      expect(art[0]).toHaveLength(16);
    }
  });

  test('run-length merging covers exactly the painted pixels', () => {
    const art = ['XX.Y', '.XXX'];
    const runs = pixelRuns(art);
    const painted = runs.reduce((n, r) => n + r.w, 0);
    expect(painted).toBe(6);
    expect(runs).toContainEqual({ x: 0, y: 0, w: 2, ch: 'X' });
    expect(runs).toContainEqual({ x: 3, y: 0, w: 1, ch: 'Y' });
  });
});
