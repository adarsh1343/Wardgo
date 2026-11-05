// Color and style compatibility between items. All scores are small numbers
// around 0 so they can be summed with other factors in scoring.ts.
import { getColor, STYLE_CLASHES } from './catalog';

function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Score for a pair of colors (-2 .. +1.5). */
export function colorPairScore(a: string, b: string): number {
  const ca = getColor(a);
  const cb = getColor(b);
  if (!ca || !cb) return 0;
  if (ca.neutral || cb.neutral) {
    // Neutrals go with everything; tone-on-tone neutrals are slightly better with contrast.
    if (ca.neutral && cb.neutral) return Math.abs(ca.lightness - cb.lightness) > 0.25 ? 1 : 0.6;
    return 0.8;
  }
  if (ca.key === 'multi' || cb.key === 'multi') return -0.5;
  if (ca.hue === null || cb.hue === null) return 0;
  const d = hueDistance(ca.hue, cb.hue);
  if (ca.key === cb.key) return -0.4; // same bold color head-to-toe reads as a uniform
  if (d <= 35) return 1; // analogous
  if (d >= 150) return 0.6; // complementary: bold but intentional
  if (d >= 75 && d < 150) return -1.2; // tends to clash
  return 0.2;
}

export interface PaletteSummary {
  score: number;
  boldColors: string[];
  description: string;
}

/**
 * Score an outfit's whole palette. `colorful` biases towards (+1) or away
 * from (-1) bold colors.
 */
export function paletteScore(colors: string[], colorful: -1 | 0 | 1 = 0): PaletteSummary {
  const known = colors.map((c) => getColor(c)).filter((c): c is NonNullable<typeof c> => !!c);
  const bold = [...new Set(known.filter((c) => !c.neutral).map((c) => c.key))];
  let score = 0;
  for (let i = 0; i < known.length; i++) {
    for (let j = i + 1; j < known.length; j++) {
      score += colorPairScore(known[i]!.key, known[j]!.key) * 0.5;
    }
  }
  // More than two bold colors gets busy unless the user asked for colorful.
  if (bold.length > 2) score -= (bold.length - 2) * (colorful === 1 ? 0.3 : 1.2);
  if (colorful === 1) score += Math.min(bold.length, 2) * 0.8;
  if (colorful === -1) score -= bold.length * 0.9;

  let description: string;
  if (bold.length === 0) description = 'an easy neutral palette';
  else if (bold.length === 1) description = `neutrals with a pop of ${getColor(bold[0]!)?.label.toLowerCase()}`;
  else description = `a bolder mix of ${bold.map((b) => getColor(b)?.label.toLowerCase()).join(' + ')}`;
  return { score, boldColors: bold, description };
}

/** -1.5 (clashing styles) .. +1 (shared style tags). */
export function styleScore(tagsA: string[], tagsB: string[]): number {
  if (tagsA.length === 0 || tagsB.length === 0) return 0;
  const setB = new Set(tagsB);
  const shared = tagsA.filter((t) => setB.has(t)).length;
  let clash = 0;
  for (const [x, y] of STYLE_CLASHES) {
    if ((tagsA.includes(x) && setB.has(y)) || (tagsA.includes(y) && setB.has(x))) clash++;
  }
  const union = new Set([...tagsA, ...tagsB]).size;
  return (shared / union) * 1 - clash * 0.75;
}
