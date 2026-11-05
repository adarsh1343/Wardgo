// Regression test for "TypeError: Cannot read property 'forEach' of null"
// thrown from Button on iPhone (Expo Go / React Native 0.86). RN's transform
// processor does not accept a missing transform, so styles must use [] instead
// of undefined/null. The Jest renderer skips native style processing, which is
// why component tests alone did not catch it.
// Node built-ins, typed locally (the project has no @types/node).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { readdirSync, readFileSync, statSync } = require('fs') as {
  readdirSync(p: string): string[];
  readFileSync(p: string, enc: 'utf8'): string;
  statSync(p: string): { isDirectory(): boolean };
};
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { join } = require('path') as { join(...parts: string[]): string };
declare const __dirname: string;

// eslint-disable-next-line @typescript-eslint/no-require-imports
const processTransform = require('react-native/Libraries/StyleSheet/processTransform').default as (t: unknown) => unknown;

describe('transform styles', () => {
  test('React Native rejects a null transform with the error seen on device', () => {
    expect(() => processTransform(null)).toThrow(/forEach/);
  });

  test('an empty transform array is accepted', () => {
    expect(() => processTransform([])).not.toThrow();
    expect(() => processTransform([{ translateX: 3 }, { translateY: 3 }])).not.toThrow();
  });

  test('no component sets transform to undefined or null', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name)) {
          readFileSync(path, 'utf8')
            .split('\n')
            .forEach((line: string, i: number) => {
              if (/transform:[^\n]*:\s*(undefined|null)\b/.test(line) || /transform:\s*(undefined|null)\b/.test(line)) {
                offenders.push(`${path}:${i + 1}`);
              }
            });
        }
      }
    };
    walk(join(__dirname, '..', 'src'));
    expect(offenders).toEqual([]);
  });
});
