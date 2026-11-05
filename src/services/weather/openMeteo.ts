// Open-Meteo client (https://open-meteo.com). Free for non-commercial use,
// no API key, no account. Data licensed CC BY 4.0 — the app shows attribution.
// Only rounded coordinates are sent; nothing about the wardrobe ever is.
import { describeWeatherCode } from '../../engine/weather';
import type { WeatherSnapshot } from '../../types/models';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const TIMEOUT_MS = 12_000;

/** ~1 km precision is plenty for weather and avoids sending an exact position. */
export function roundCoord(v: number): number {
  return Math.round(v * 100) / 100;
}

async function fetchJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`Weather service responded with ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

interface ForecastResponse {
  current?: {
    time: string;
    temperature_2m: number;
    apparent_temperature: number;
    weather_code: number;
    wind_speed_10m: number;
    precipitation: number;
    is_day: number;
  };
  daily?: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_probability_max: (number | null)[];
    weather_code: number[];
  };
}

/** Parses an Open-Meteo forecast payload. Exported for tests. */
export function parseForecast(json: unknown, place: { name: string; latitude: number; longitude: number }, fetchedAt: string): WeatherSnapshot {
  const data = json as ForecastResponse;
  const c = data.current;
  const d = data.daily;
  if (!c || !d || typeof c.temperature_2m !== 'number') throw new Error('Unexpected weather response');
  const high = d.temperature_2m_max[0] ?? c.temperature_2m;
  const low = d.temperature_2m_min[0] ?? c.temperature_2m;
  const precip = d.precipitation_probability_max[0];
  // Use the daily code if it is "wetter" than right now — dressing for the day ahead.
  const code = Math.max(c.weather_code, d.weather_code[0] ?? 0) >= 51 ? Math.max(c.weather_code, d.weather_code[0] ?? 0) : c.weather_code;
  const isDay = c.is_day === 1;
  return {
    tempC: c.temperature_2m,
    feelsLikeC: c.apparent_temperature,
    highC: high,
    lowC: low,
    precipProbability: typeof precip === 'number' ? precip : null,
    windKph: typeof c.wind_speed_10m === 'number' ? c.wind_speed_10m : null,
    code,
    summary: describeWeatherCode(code, isDay).summary,
    isDay,
    locationName: place.name,
    latitude: place.latitude,
    longitude: place.longitude,
    fetchedAt,
  };
}

export async function fetchForecast(place: { name: string; latitude: number; longitude: number }): Promise<WeatherSnapshot> {
  const lat = roundCoord(place.latitude);
  const lon = roundCoord(place.longitude);
  const params = [
    `latitude=${lat}`,
    `longitude=${lon}`,
    'current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,precipitation,is_day',
    'daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code',
    'timezone=auto',
    'forecast_days=1',
  ].join('&');
  const json = await fetchJson(`${FORECAST_URL}?${params}`);
  return parseForecast(json, { ...place, latitude: lat, longitude: lon }, new Date().toISOString());
}

export interface PlaceResult {
  id: number;
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
}

export async function searchPlaces(query: string): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const json = (await fetchJson(`${GEOCODE_URL}?name=${encodeURIComponent(q)}&count=8&language=en&format=json`)) as {
    results?: { id: number; name: string; latitude: number; longitude: number; country?: string; admin1?: string }[];
  };
  return (json.results ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    detail: [r.admin1, r.country].filter(Boolean).join(', '),
    latitude: r.latitude,
    longitude: r.longitude,
  }));
}
