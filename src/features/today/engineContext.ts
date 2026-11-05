import type { Db } from '../../database/db';
import { feedbackSummary, lastWornDaysAgo, recentComboKeys } from '../../database/repositories/history';
import { listItems } from '../../database/repositories/items';
import type { Adjustments, EngineContext } from '../../engine/scoring';
import type { Occasion, Preferences, WardrobeItem, WeatherContext } from '../../types/models';

export interface EngineInputs {
  items: WardrobeItem[];
  lastWorn: Record<string, number>;
  recentCombos: string[];
  feedback: Awaited<ReturnType<typeof feedbackSummary>>;
}

/** Everything the engine needs from the database, loaded in one go. */
export async function loadEngineInputs(db: Db): Promise<EngineInputs> {
  const [items, lastWorn, recentCombos, feedback] = await Promise.all([
    listItems(db),
    lastWornDaysAgo(db),
    recentComboKeys(db),
    feedbackSummary(db),
  ]);
  return { items, lastWorn, recentCombos, feedback };
}

export function buildContext(
  inputs: EngineInputs,
  prefs: Preferences,
  weather: WeatherContext | null,
  occasion: Occasion,
  adjustments: Adjustments,
  seed: number,
  recentlyShown: string[] = [],
): EngineContext {
  return {
    items: inputs.items,
    weather,
    prefs: {
      preferredStyles: prefs.preferredStyles,
      avoidStyles: prefs.avoidStyles,
      preferredColors: prefs.preferredColors,
      avoidColors: prefs.avoidColors,
      temperatureComfort: prefs.temperatureComfort,
      maxAccessories: prefs.maxAccessories,
    },
    occasion,
    adjustments,
    lastWornDaysAgo: inputs.lastWorn,
    recentCombos: inputs.recentCombos,
    dislikedCombos: inputs.feedback.dislikedCombos,
    likedCombos: inputs.feedback.likedCombos,
    itemFeedback: inputs.feedback.itemFeedback,
    recentlyShown,
    seed,
    date: new Date(),
    latitude: prefs.location.mode === 'none' ? null : prefs.location.latitude,
  };
}
