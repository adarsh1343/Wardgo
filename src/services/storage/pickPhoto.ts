import * as ImagePicker from 'expo-image-picker';

export type PickResult =
  | { ok: true; asset: { uri: string; width: number; height: number } }
  | { ok: false; reason: 'canceled' | 'denied' | 'error'; message?: string };

/** Camera capture. Permission is requested only at this moment. */
export async function takePhoto(): Promise<PickResult> {
  try {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      return { ok: false, reason: 'denied', message: 'Camera access is off. Enable it in iOS Settings, or choose a photo from your library instead.' };
    }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false, exif: false });
    if (res.canceled || !res.assets[0]) return { ok: false, reason: 'canceled' };
    const a = res.assets[0];
    return { ok: true, asset: { uri: a.uri, width: a.width, height: a.height } };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'The camera could not be opened.' };
  }
}

/**
 * Photo library. On iOS this uses the system picker, which does not need full
 * library permission — the app only receives the photo you choose.
 */
export async function choosePhoto(): Promise<PickResult> {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsEditing: false, exif: false });
    if (res.canceled || !res.assets[0]) return { ok: false, reason: 'canceled' };
    const a = res.assets[0];
    return { ok: true, asset: { uri: a.uri, width: a.width, height: a.height } };
  } catch (e) {
    return { ok: false, reason: 'error', message: e instanceof Error ? e.message : 'The photo library could not be opened.' };
  }
}
