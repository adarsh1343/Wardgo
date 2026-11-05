export interface PixelRun {
  x: number;
  y: number;
  w: number;
  ch: string;
}

const cache = new Map<string, PixelRun[]>();

/** Merges horizontal runs of the same color so a sprite renders with few SVG nodes. */
export function pixelRuns(art: readonly string[]): PixelRun[] {
  const key = art.join('\n');
  const hit = cache.get(key);
  if (hit) return hit;
  const runs: PixelRun[] = [];
  art.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x]!;
      if (ch === '.') {
        x++;
        continue;
      }
      let end = x + 1;
      while (end < row.length && row[end] === ch) end++;
      runs.push({ x, y, w: end - x, ch });
      x = end;
    }
  });
  cache.set(key, runs);
  return runs;
}
