import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, useWindowDimensions, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, IconButton } from '../../components/Button';
import { Chip, ChipRow, PixelTag } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { SaveBurst } from '../../components/Feedback';
import { Field } from '../../components/Field';
import { ItemPhoto } from '../../components/ItemPhoto';
import { Screen, SectionTitle } from '../../components/Screen';
import { PromptSheet } from '../../components/Sheet';
import { Sticker } from '../../components/Sticker';
import { albumIdsForOutfit, listAlbums, setOutfitAlbums } from '../../database/repositories/albums';
import { deleteWearEvent, listWearEvents, logWear } from '../../database/repositories/history';
import { listItems } from '../../database/repositories/items';
import { deleteOutfit, getOutfit, updateOutfit } from '../../database/repositories/outfits';
import { OCCASIONS, SLOT_LABELS, STYLE_TAGS } from '../../engine/catalog';
import { formatTemp } from '../../engine/weather';
import { useApp, useLiveQuery } from '../../features/app/AppState';
import { useTheme } from '../../theme/ThemeProvider';
import { borders, radii } from '../../theme/tokens';
import { formatShortDate } from '../../utils/date';

export default function OutfitDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, prefs, notifyDataChanged } = useApp();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [renameOpen, setRenameOpen] = useState(false);
  const [burst, setBurst] = useState(0);
  const { data } = useLiveQuery(
    async (d) => {
      const outfit = await getOutfit(d, id);
      if (!outfit) return null;
      const [items, albums, memberOf, wears] = await Promise.all([listItems(d), listAlbums(d), albumIdsForOutfit(d, id), listWearEvents(d, 500)]);
      return { outfit, itemsById: new Map(items.map((i) => [i.id, i])), albums, memberOf, wears: wears.filter((w) => w.outfitId === id) };
    },
    [id],
  );

  if (data === null) {
    return (
      <Screen topInset={false}>
        <EmptyState title="Outfit not found" body="It may have been deleted." action={<Button label="Back" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  if (!data) return null;
  const { outfit, itemsById, albums, memberOf, wears } = data;
  const tileW = Math.floor((Math.min(width, 700) - 32 - 12) / 2);

  const patch = async (p: Parameters<typeof updateOutfit>[2]) => {
    await updateOutfit(db, outfit.id, p);
    notifyDataChanged();
  };
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <View style={{ flex: 1 }}>
      <Screen topInset={false}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {outfit.favorite ? <PixelTag label="Favorite" tone="secondary" /> : null}
            <PixelTag label={`Saved ${formatShortDate(outfit.createdAt)}`} tone="surface" />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
              {outfit.name}
            </AppText>
            <IconButton icon="pencil" onPress={() => setRenameOpen(true)} accessibilityLabel="Rename outfit" />
            <IconButton
              icon={outfit.favorite ? 'heartFilled' : 'heart'}
              tone={outfit.favorite ? 'secondary' : 'surface'}
              selected={outfit.favorite}
              onPress={() => patch({ favorite: !outfit.favorite })}
              accessibilityLabel={outfit.favorite ? 'Remove from favorites' : 'Add to favorites'}
            />
          </View>
          {outfit.weather ? (
            <AppText variant="small" muted>
              Saved on a {formatTemp(outfit.weather.tempC, prefs.units)} {outfit.weather.summary.toLowerCase()} day.
            </AppText>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
          {outfit.items.map((piece) => {
            const item = piece.itemId ? itemsById.get(piece.itemId) : undefined;
            return (
              <View key={piece.slot} style={{ width: tileW }}>
                <View style={{ borderWidth: borders.bold, borderColor: colors.border, borderRadius: radii.soft, overflow: 'hidden', backgroundColor: colors.surface }}>
                  {item ? (
                    <ItemPhoto item={item} style={{ width: '100%', aspectRatio: 1 }} />
                  ) : (
                    <View style={{ width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sunk, padding: 8 }}>
                      <AppText variant="pixel" muted>
                        REMOVED
                      </AppText>
                    </View>
                  )}
                  <View style={{ padding: 8, borderTopWidth: borders.thin, borderColor: colors.border, gap: 2 }}>
                    <AppText variant="pixel" muted>
                      {SLOT_LABELS[piece.slot].toUpperCase()}
                    </AppText>
                    <AppText variant="caption" numberOfLines={2}>
                      {item ? item.name : `${piece.itemName || 'Item'} (deleted from wardrobe)`}
                    </AppText>
                  </View>
                </View>
                {item ? <Button label="View" size="sm" variant="ghost" onPress={() => router.push(`/item/${item.id}`)} style={{ marginTop: 6 }} /> : null}
              </View>
            );
          })}
        </View>

        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button
            label="Wore it today"
            icon="check"
            variant="mint"
            onPress={async () => {
              await logWear(db, { outfitId: outfit.id, itemIds: outfit.items.map((i) => i.itemId).filter((x): x is string => !!x) });
              notifyDataChanged();
              setBurst((b) => b + 1);
            }}
            style={{ flexGrow: 1 }}
          />
          <Button label="Remix in Today" icon="dice" onPress={() => router.navigate({ pathname: '/', params: { outfit: outfit.id } })} style={{ flexGrow: 1 }} accessibilityHint="Opens this outfit on Today so you can lock and regenerate pieces" />
        </View>

        <Sticker tone="surface" style={{ gap: 12 }}>
          <SectionTitle title="Albums" />
          {albums.length === 0 ? (
            <AppText variant="small" muted>
              No albums yet — create one in the Outfits tab.
            </AppText>
          ) : (
            <ChipRow>
              {albums.map((a) => (
                <Chip
                  key={a.id}
                  label={a.name}
                  icon="album"
                  selected={memberOf.includes(a.id)}
                  onPress={async () => {
                    await setOutfitAlbums(db, outfit.id, toggle(memberOf, a.id));
                    notifyDataChanged();
                  }}
                  tone="mint"
                />
              ))}
            </ChipRow>
          )}
        </Sticker>

        <Sticker tone="surface" style={{ gap: 12 }}>
          <SectionTitle title="Tags" />
          <AppText variant="bodyStrong">Occasion</AppText>
          <ChipRow>
            {OCCASIONS.map((o) => (
              <Chip key={o.key} label={o.label} selected={outfit.occasion === o.key} onPress={() => patch({ occasion: outfit.occasion === o.key ? '' : o.key })} tone="secondary" />
            ))}
          </ChipRow>
          <AppText variant="bodyStrong">Style</AppText>
          <ChipRow>
            {STYLE_TAGS.map((s) => (
              <Chip key={s} label={s} selected={outfit.styleTags.includes(s)} onPress={() => patch({ styleTags: toggle(outfit.styleTags, s) })} tone="highlight" />
            ))}
          </ChipRow>
          <NotesField key={outfit.id} initial={outfit.notes} onSave={(notes) => patch({ notes })} />
        </Sticker>

        <Sticker tone="alt" lift={0} style={{ gap: 8 }}>
          <SectionTitle title={`Wear history (${wears.length})`} />
          {wears.length === 0 ? (
            <AppText variant="small" muted>
              Not worn yet.
            </AppText>
          ) : (
            wears.slice(0, 20).map((w) => (
              <View key={w.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
                <AppText variant="body">{formatShortDate(w.wornOn)}</AppText>
                <Button
                  label="Remove"
                  size="sm"
                  variant="ghost"
                  onPress={async () => {
                    await deleteWearEvent(db, w.id);
                    notifyDataChanged();
                  }}
                  accessibilityLabel={`Remove wear on ${formatShortDate(w.wornOn)}`}
                />
              </View>
            ))
          )}
        </Sticker>

        <Button
          label="Delete outfit"
          icon="trash"
          variant="danger"
          onPress={() =>
            Alert.alert('Delete this outfit?', 'The clothes stay in your wardrobe. The outfit is removed from all albums.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                  await deleteOutfit(db, outfit.id);
                  notifyDataChanged();
                  router.back();
                },
              },
            ])
          }
        />
      </Screen>
      <SaveBurst trigger={burst} label="LOGGED!" />
      <PromptSheet
        visible={renameOpen}
        title="Rename outfit"
        label="Name"
        initialValue={outfit.name}
        onCancel={() => setRenameOpen(false)}
        onSubmit={async (name) => {
          setRenameOpen(false);
          await patch({ name });
        }}
      />
    </View>
  );
}

/** Local draft of the notes, saved when the field loses focus. Keyed per outfit. */
function NotesField({ initial, onSave }: { initial: string; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(initial);
  return (
    <Field
      label="Notes"
      value={notes}
      onChangeText={setNotes}
      onBlur={() => notes !== initial && onSave(notes)}
      multiline
      maxLength={500}
      placeholder="Where you wore it, what to change…"
    />
  );
}
