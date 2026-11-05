import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, useWindowDimensions, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Chip, ChipRow, PixelTag } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { PipMeter } from '../../components/Feedback';
import { ItemPhoto } from '../../components/ItemPhoto';
import { Screen, SectionTitle } from '../../components/Screen';
import { Sticker } from '../../components/Sticker';
import { countOutfitsUsingItem, deleteItem, getItem, setItemFlags } from '../../database/repositories/items';
import { listWearEvents } from '../../database/repositories/history';
import { FORMALITY_LABELS, getColor, getSubcategory, PATTERNS, SLOT_LABELS, slotForItem, WARMTH_LABELS } from '../../engine/catalog';
import { useApp, useLiveQuery } from '../../features/app/AppState';
import { deleteImageFiles } from '../../services/storage/images';
import { useTheme } from '../../theme/ThemeProvider';
import { borders, radii } from '../../theme/tokens';
import { formatShortDate } from '../../utils/date';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, notifyDataChanged } = useApp();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const { data } = useLiveQuery(
    async (d) => {
      const item = await getItem(d, id);
      if (!item) return null;
      const [outfits, wears] = await Promise.all([countOutfitsUsingItem(d, id), listWearEvents(d, 500)]);
      const worn = wears.filter((w) => w.itemIds.includes(id));
      return { item, outfits, wornCount: worn.length, lastWorn: worn[0]?.wornOn ?? null };
    },
    [id],
  );

  if (data === null) {
    return (
      <Screen topInset={false}>
        <EmptyState title="Item not found" body="It may have been deleted." action={<Button label="Back to wardrobe" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  if (!data) return null;
  const { item } = data;
  const sub = getSubcategory(item.subcategory);
  const color = getColor(item.primaryColor);
  const photoW = Math.min(width, 700) - 32;

  const toggle = async (flags: { favorite?: boolean; available?: boolean }) => {
    await setItemFlags(db, item.id, flags);
    notifyDataChanged();
  };

  const confirmDelete = () => {
    const usedIn = data.outfits > 0 ? `\n\nIt appears in ${data.outfits} saved outfit${data.outfits > 1 ? 's' : ''}. Those outfits will show it as “removed” — nothing is swapped in automatically.` : '';
    Alert.alert(`Delete “${item.name}”?`, `This removes the item and its photos from this device.${usedIn}`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const files = await deleteItem(db, item.id);
          deleteImageFiles(files);
          notifyDataChanged();
          router.back();
        },
      },
    ]);
  };

  return (
    <Screen topInset={false}>
      <Stack.Screen options={{ title: '' }} />
      <View>
        {item.images.length > 1 ? (
          <FlatList
            data={item.images}
            keyExtractor={(i) => i.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / photoW))}
            renderItem={({ item: img, index }) => (
              <ItemPhoto item={item} fileName={img.fileName} fit="contain" style={{ width: photoW, aspectRatio: 0.85 }} label={`Photo ${index + 1} of ${item.images.length}: ${item.name}`} />
            )}
            style={{ borderWidth: borders.bold, borderColor: colors.border, borderRadius: radii.soft, overflow: 'hidden' }}
          />
        ) : (
          <View style={{ borderWidth: borders.bold, borderColor: colors.border, borderRadius: radii.soft, overflow: 'hidden' }}>
            <ItemPhoto item={item} full fit="contain" style={{ width: '100%', aspectRatio: 0.85 }} />
          </View>
        )}
        {item.images.length > 1 ? (
          <AppText variant="pixel" center style={{ marginTop: 6 }}>
            {`${page + 1} / ${item.images.length}`}
          </AppText>
        ) : null}
      </View>

      <View style={{ gap: 6 }}>
        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
          <PixelTag label={SLOT_LABELS[slotForItem(item)]} tone="primary" />
          {item.favorite ? <PixelTag label="Favorite" tone="secondary" /> : null}
          {!item.available ? <PixelTag label="Unavailable" tone="highlight" /> : null}
        </View>
        <AppText variant="title" accessibilityRole="header">
          {item.name}
        </AppText>
        <AppText variant="small" muted>
          {sub?.label ?? item.subcategory} · added {formatShortDate(item.createdAt)}
        </AppText>
      </View>

      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
        <Button label={item.favorite ? 'Favorited' : 'Favorite'} icon={item.favorite ? 'heartFilled' : 'heart'} variant="secondary" size="sm" onPress={() => toggle({ favorite: !item.favorite })} />
        <Button
          label={item.available ? 'Mark unavailable' : 'Mark available'}
          icon={item.available ? 'close' : 'check'}
          variant="ghost"
          size="sm"
          onPress={() => toggle({ available: !item.available })}
          accessibilityHint="Unavailable items are skipped by recommendations"
        />
      </View>

      <Button label="Style this piece" icon="dice" onPress={() => router.navigate({ pathname: '/', params: { lock: item.id } })} accessibilityHint="Builds today's outfit around this item, locked" />

      <Sticker tone="surface" shape="ticket" style={{ gap: 12 }}>
        <SectionTitle title="Details" />
        <DetailRow label="Main color">
          <Chip label={color?.label ?? item.primaryColor} swatch={color?.hex} />
        </DetailRow>
        {item.secondaryColors.length ? (
          <DetailRow label="Other colors">
            <ChipRow>
              {item.secondaryColors.map((c) => (
                <Chip key={c} label={getColor(c)?.label ?? c} swatch={getColor(c)?.hex} />
              ))}
            </ChipRow>
          </DetailRow>
        ) : null}
        <DetailRow label="Pattern" value={PATTERNS.find((p) => p.key === item.pattern)?.label ?? item.pattern} />
        {item.material ? <DetailRow label="Material" value={item.material} /> : null}
        <DetailRow label="Seasons" value={item.seasons.length ? item.seasons.join(', ') : 'All-season'} />
        <DetailRow label="Rain" value={{ no: 'Avoid rain', ok: 'Fine in drizzle', waterproof: 'Waterproof' }[item.rain]} />
        {item.styleTags.length ? <DetailRow label="Style" value={item.styleTags.join(', ')} /> : null}
        <PipMeter label="Formality" value={item.formality} valueLabel={FORMALITY_LABELS[item.formality]} />
        <PipMeter label="Warmth" value={item.warmth} valueLabel={WARMTH_LABELS[item.warmth]} tone="secondary" />
        {item.notes ? <DetailRow label="Notes" value={item.notes} /> : null}
      </Sticker>

      <Sticker tone="alt" lift={0} style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
        <Stat value={String(data.wornCount)} label="times worn" />
        <Stat value={data.lastWorn ? formatShortDate(data.lastWorn) : '—'} label="last worn" />
        <Stat value={String(data.outfits)} label="saved outfits" />
      </Sticker>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Button label="Edit" icon="pencil" variant="ghost" onPress={() => router.push(`/item/edit/${item.id}`)} style={{ flex: 1 }} />
        <Button label="Delete" icon="trash" variant="danger" onPress={confirmDelete} style={{ flex: 1 }} />
      </View>
    </Screen>
  );
}

function DetailRow({ label, value, children }: { label: string; value?: string; children?: React.ReactNode }) {
  return (
    <View style={{ gap: 4 }}>
      <AppText variant="caption" muted>
        {label}
      </AppText>
      {children ?? <AppText variant="body">{value}</AppText>}
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, flex: 1 }} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText variant="pixelLarge">{value}</AppText>
      <AppText variant="caption" muted center>
        {label}
      </AppText>
    </View>
  );
}
