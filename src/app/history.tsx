import { Alert, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { PixelTag } from '../components/Chip';
import { Screen, SectionTitle } from '../components/Screen';
import { Sticker } from '../components/Sticker';
import {
  clearFeedback,
  clearRecommendationLog,
  deleteFeedback,
  deleteWearEvent,
  listFeedback,
  listRecommendationLog,
  listWearEvents,
} from '../database/repositories/history';
import { listItems } from '../database/repositories/items';
import { SLOT_ORDER } from '../engine/catalog';
import { useApp, useLiveQuery } from '../features/app/AppState';
import { formatShortDate, formatTime } from '../utils/date';

export default function HistoryScreen() {
  const { db, notifyDataChanged } = useApp();
  const { data } = useLiveQuery(async (d) => {
    const [wears, log, feedback, items] = await Promise.all([listWearEvents(d, 60), listRecommendationLog(d, 30), listFeedback(d), listItems(d)]);
    return { wears, log, feedback, names: new Map(items.map((i) => [i.id, i.name])) };
  });
  if (!data) return null;
  const name = (id: string) => data.names.get(id) ?? 'deleted item';
  const describe = (key: string) => key.split('|').map(name).join(' + ');

  return (
    <Screen topInset={false}>
      <AppText variant="small" muted>
        Wear history and feedback stay on this phone and steer future suggestions: recently worn pieces rest for a few days, liked combinations get a boost, disliked ones are avoided.
      </AppText>

      <Sticker style={{ gap: 10 }}>
        <SectionTitle title={`Worn (${data.wears.length})`} />
        {data.wears.length === 0 ? (
          <AppText variant="small" muted>
            Tap “Wore it today” on an outfit to start a history.
          </AppText>
        ) : (
          data.wears.map((w) => (
            <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{formatShortDate(w.wornOn)}</AppText>
                <AppText variant="small" muted numberOfLines={2}>
                  {w.itemIds.map(name).join(', ') || 'items deleted'}
                </AppText>
              </View>
              <Button
                label="Remove"
                size="sm"
                variant="ghost"
                onPress={async () => {
                  await deleteWearEvent(db, w.id);
                  notifyDataChanged();
                }}
              />
            </View>
          ))
        )}
      </Sticker>

      <Sticker style={{ gap: 10 }} shape="ticketAlt">
        <SectionTitle
          title={`Feedback (${data.feedback.length})`}
          action={
            data.feedback.length ? (
              <Button
                label="Clear"
                size="sm"
                variant="ghost"
                onPress={() =>
                  Alert.alert('Clear all feedback?', 'Likes and dislikes will no longer affect suggestions.', [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Clear',
                      style: 'destructive',
                      onPress: async () => {
                        await clearFeedback(db);
                        notifyDataChanged();
                      },
                    },
                  ])
                }
              />
            ) : undefined
          }
        />
        {data.feedback.length === 0 ? (
          <AppText variant="small" muted>
            Saving an outfit counts as a like; “Not for me” counts as a dislike.
          </AppText>
        ) : (
          data.feedback.slice(0, 40).map((f) => (
            <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 }}>
              <PixelTag label={f.value > 0 ? 'Liked' : 'Disliked'} tone={f.value > 0 ? 'mint' : 'secondary'} />
              <AppText variant="small" style={{ flex: 1 }} numberOfLines={2}>
                {f.kind === 'combo' ? describe(f.targetKey) : name(f.targetKey)}
              </AppText>
              <Button
                label="Undo"
                size="sm"
                variant="ghost"
                onPress={async () => {
                  await deleteFeedback(db, f.id);
                  notifyDataChanged();
                }}
                accessibilityLabel="Remove this feedback"
              />
            </View>
          ))
        )}
      </Sticker>

      <Sticker style={{ gap: 10 }}>
        <SectionTitle
          title="Past suggestions"
          action={
            data.log.length ? (
              <Button
                label="Clear"
                size="sm"
                variant="ghost"
                onPress={async () => {
                  await clearRecommendationLog(db);
                  notifyDataChanged();
                }}
              />
            ) : undefined
          }
        />
        {data.log.length === 0 ? (
          <AppText variant="small" muted>
            Suggestions from Today appear here.
          </AppText>
        ) : (
          data.log.map((l) => (
            <View key={l.id} style={{ gap: 2, paddingVertical: 6 }}>
              <AppText variant="caption" muted>
                {formatShortDate(l.createdAt)} {formatTime(l.createdAt)} {l.weatherSummary ? `· ${l.weatherSummary}` : ''}
              </AppText>
              <AppText variant="small">
                {SLOT_ORDER.map((s) => l.slots[s])
                  .filter((x): x is string => !!x)
                  .map(name)
                  .join(' + ')}
              </AppText>
            </View>
          ))
        )}
      </Sticker>
    </Screen>
  );
}
