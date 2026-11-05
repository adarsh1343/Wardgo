import { parseForecast, roundCoord } from '../src/services/weather/openMeteo';
import { isStale } from '../src/services/weather/weatherService';

// Shape captured from a real Open-Meteo response (2026-10-19).
const SAMPLE = {
  current: { time: '2026-10-19T21:45', temperature_2m: 7.3, apparent_temperature: 4.5, weather_code: 2, wind_speed_10m: 7.3, precipitation: 0, is_day: 0 },
  daily: { temperature_2m_max: [11.8], temperature_2m_min: [5.3], precipitation_probability_max: [0], weather_code: [3] },
};

describe('Open-Meteo parsing', () => {
  test('maps fields', () => {
    const w = parseForecast(SAMPLE, { name: 'Berlin', latitude: 52.52, longitude: 13.41 }, '2026-10-19T21:45:00Z');
    expect(w.tempC).toBe(7.3);
    expect(w.feelsLikeC).toBe(4.5);
    expect(w.highC).toBe(11.8);
    expect(w.lowC).toBe(5.3);
    expect(w.precipProbability).toBe(0);
    expect(w.isDay).toBe(false);
    expect(w.summary).toBe('Partly cloudy');
  });
  test('a wet day forecast wins over a dry "now"', () => {
    const wet = { ...SAMPLE, daily: { ...SAMPLE.daily, weather_code: [63], precipitation_probability_max: [null] } };
    const w = parseForecast(wet, { name: 'X', latitude: 0, longitude: 0 }, 'now');
    expect(w.code).toBe(63);
    expect(w.precipProbability).toBeNull();
  });
  test('rejects malformed payloads', () => {
    expect(() => parseForecast({}, { name: 'X', latitude: 0, longitude: 0 }, 'now')).toThrow();
  });
  test('coordinates are rounded to ~1 km before sending', () => {
    expect(roundCoord(52.520008)).toBe(52.52);
    expect(roundCoord(-33.86882)).toBe(-33.87);
  });
});

describe('staleness', () => {
  const snap = (fetchedAt: string) => ({ ...parseForecast(SAMPLE, { name: 'X', latitude: 0, longitude: 0 }, fetchedAt) });
  test('fresh within 3 hours on the same day', () => {
    expect(isStale(snap('2026-10-19T10:00:00'), new Date('2026-10-19T12:00:00'))).toBe(false);
  });
  test('stale after 3 hours or on a new day', () => {
    expect(isStale(snap('2026-10-19T08:00:00'), new Date('2026-10-19T12:00:00'))).toBe(true);
    expect(isStale(snap('2026-10-19T23:30:00'), new Date('2026-10-20T00:30:00'))).toBe(true);
  });
});
