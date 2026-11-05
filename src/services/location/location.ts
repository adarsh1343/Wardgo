// Foreground-only location. Permission is requested only when the user taps
// "Use my location" — never at app start.
import * as Location from 'expo-location';

export type DeviceLocationResult =
  | { ok: true; name: string; latitude: number; longitude: number }
  | { ok: false; reason: 'denied' | 'unavailable'; message: string };

export async function getDeviceLocation(): Promise<DeviceLocationResult> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (perm.status !== 'granted') {
    return {
      ok: false,
      reason: 'denied',
      message: 'Location permission was not granted. You can search for your city instead, or enable location for Expo Go / Wardgo in iOS Settings.',
    };
  }
  try {
    const pos =
      (await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 })) ??
      (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }));
    let name = 'Current location';
    try {
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      if (place) name = place.city ?? place.subregion ?? place.region ?? name;
    } catch {
      // Reverse geocoding is optional.
    }
    return { ok: true, name, latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch {
    return { ok: false, reason: 'unavailable', message: 'Could not determine your location right now. Try again or search for a city.' };
  }
}
