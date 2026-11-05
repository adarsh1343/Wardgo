import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Chip, ChipRow } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { ScreenHeader } from '../../components/Screen';
import { PromptSheet } from '../../components/Sheet';
import { createAlbum, listAlbums, reorderAlbums } from '../../database/repositories/albums';
import { listItems } from '../../database/repositories/items';
import { listOutfits } from '../../database/repositories/outfits';
import { useApp, useLiveQuery } from '../../features/app/AppState';
import { AlbumCover } from '../../features/albums/AlbumCover';
import { OutfitCard } from '../../features/outfits/OutfitCard';
import { useTheme } from '../../theme/ThemeProvider';
import { borders, radii } from '../../theme/tokens';

type Tab = 'saved' | 'favorites' | 'albums';
const SUGGESTED_ALBUMS = ['Everyday', 'University', 'Internship & work', 'Date night', 'Formal', 'Summer', 'Travel', 'Favorite combos'];

export default function OutfitsScreen() {
  const { colors } = useTheme();
  const { db, notifyDataChanged } = useApp();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('saved');
  const [newAlbumOpen, setNewAlbumOpen] = useState(false);
  const [reordering, setReordering] = useState(false);
  const { data } = useLiveQuery(async (d) => {
    const [outfits, albums, items] = await Promise.all([listOutfits(d), listAlbums(d), listItems(d)]);
    return { outfits, albums, items };
  });

  const itemsById = useMemo(() => new Map((data?.items ?? []).map((i) => [i.id, i])), [data]);
  const outfitsById = useMemo(() => new Map((data?.outfits ?? []).map((o) => [o.id, o])), [data]);
  const columns = width >= 700 ? 3 : 2;
  const gap = 14;
  const cardW = Math.floor((width - 32 - gap * (columns - 1)) / columns);

  const outfits = tab === 'favorites' ? (data?.outfits ?? []).filter((o) => o.favorite) : (data?.outfits ?? []);
  const albums = data?.albums ?? [];

  const move = async (index: number, delta: number) => {
    const ids = albums.map((a) => a.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await reorderAlbums(db, ids);
    notifyDataChanged();
  };

  const addAlbum = async (name: string, description = '') => {
    const id = await createAlbum(db, name, description);
    notifyDataChanged();
    return id;
  };

  const header = (
    <View style={{ gap: 14, paddingBottom: 16 }}>
      <ScreenHeader eyebrow={`${data?.outfits.length ?? 0} SAVED · ${albums.length} ALBUMS`} title="Outfits" accent="outfits" />
      <View style={{ flexDirection: 'row', borderWidth: borders.bold, borderColor: colors.border, borderRadius: radii.sharp, overflow: 'hidden' }} accessibilityRole="tablist">
        {(['saved', 'favorites', 'albums'] as Tab[]).map((t, i) => {
          const selected = tab === t;
          return (
            <Pressable
              key={t}
              onPress={() => setTab(t)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={{ flex: 1, minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: selected ? colors.text : colors.surface, borderLeftWidth: i ? borders.thin : 0, borderColor: colors.border }}
            >
              <AppText variant="bodyStrong" color={selected ? colors.bg : colors.text}>
                {t === 'saved' ? 'Saved' : t === 'favorites' ? 'Favorites' : 'Albums'}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      {tab === 'albums' ? (
        <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
          <Button label="New album" icon="plus" onPress={() => setNewAlbumOpen(true)} size="sm" />
          {albums.length > 1 ? <Button label={reordering ? 'Done' : 'Reorder'} variant="ghost" size="sm" onPress={() => setReordering(!reordering)} /> : null}
        </View>
      ) : null}
    </View>
  );

  const albumsEmpty = (
    <View style={{ gap: 16 }}>
      <EmptyState sprite="emptyAlbum" title="No albums yet" body="Group outfits by occasion, season or mood. An outfit can live in as many albums as you like." />
      <AppText variant="bodyStrong">Quick start</AppText>
      <ChipRow>
        {SUGGESTED_ALBUMS.map((n) => (
          <Chip key={n} label={n} icon="plus" onPress={() => addAlbum(n)} />
        ))}
      </ChipRow>
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      {tab === 'albums' ? (
        <FlatList
          key={`albums-${columns}`}
          data={albums}
          numColumns={columns}
          keyExtractor={(a) => a.id}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListHeaderComponent={header}
          ListEmptyComponent={data ? albumsEmpty : undefined}
          renderItem={({ item, index }) => (
            <AlbumCover
              album={item}
              index={index}
              width={cardW}
              outfitsById={outfitsById}
              itemsById={itemsById}
              reorder={reordering ? { onUp: index > 0 ? () => move(index, -1) : undefined, onDown: index < albums.length - 1 ? () => move(index, 1) : undefined } : undefined}
            />
          )}
        />
      ) : (
        <FlatList
          key={`outfits-${columns}`}
          data={outfits}
          numColumns={columns}
          keyExtractor={(o) => o.id}
          columnWrapperStyle={{ gap }}
          contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
          ListHeaderComponent={header}
          initialNumToRender={6}
          windowSize={7}
          ListEmptyComponent={
            data ? (
              <EmptyState
                title={tab === 'favorites' ? 'No favorites yet' : 'No saved outfits'}
                body={tab === 'favorites' ? 'Tap the heart on a saved outfit to keep it here.' : 'Save an outfit from the Today screen and it will appear here with your real photos.'}
                action={<Button label="Go to Today" icon="sun" onPress={() => router.navigate('/')} />}
              />
            ) : undefined
          }
          renderItem={({ item, index }) => <OutfitCard outfit={item} itemsById={itemsById} width={cardW} index={index} />}
        />
      )}

      <PromptSheet
        visible={newAlbumOpen}
        title="New album"
        label="Album name"
        secondaryLabel="Description (optional)"
        confirmLabel="Create album"
        onCancel={() => setNewAlbumOpen(false)}
        onSubmit={async (name, desc) => {
          setNewAlbumOpen(false);
          const id = await addAlbum(name, desc);
          router.push(`/album/${id}`);
        }}
      />
    </SafeAreaView>
  );
}
