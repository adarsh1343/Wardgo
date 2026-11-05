import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Chip, ChipRow } from '../../components/Chip';
import { EmptyState } from '../../components/EmptyState';
import { Banner } from '../../components/Feedback';
import { SearchField } from '../../components/Field';
import { ScreenHeader } from '../../components/Screen';
import { Sheet } from '../../components/Sheet';
import { listItems } from '../../database/repositories/items';
import { CATEGORIES, COLORS, SEASONS, STYLE_TAGS } from '../../engine/catalog';
import { useLiveQuery } from '../../features/app/AppState';
import { activeFilterCount, applyWardrobeFilter, DEFAULT_FILTER, type WardrobeFilter } from '../../features/wardrobe/filter';
import { ItemTile } from '../../features/wardrobe/ItemTile';
import { useTheme } from '../../theme/ThemeProvider';
import type { Season } from '../../types/models';

export default function WardrobeScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { data: items, error } = useLiveQuery(listItems);
  const [filter, setFilter] = useState<WardrobeFilter>(DEFAULT_FILTER);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const columns = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const gap = 12;
  const tileW = Math.floor((width - 32 - gap * (columns - 1)) / columns);
  const visible = useMemo(() => applyWardrobeFilter(items ?? [], filter), [items, filter]);
  const set = (patch: Partial<WardrobeFilter>) => setFilter((f) => ({ ...f, ...patch }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const nFilters = activeFilterCount(filter);
  const total = items?.length ?? 0;

  const header = (
    <View style={{ gap: 14, paddingBottom: 14 }}>
      <ScreenHeader eyebrow={`${total} PIECE${total === 1 ? '' : 'S'}`} title="Wardrobe" accent="wardrobe" />
      {error ? <Banner text={error} tone="error" /> : null}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SearchField value={filter.search} onChangeText={(v) => set({ search: v })} placeholder="Search by name" label="Search wardrobe" />
        </View>
        <Button label="Add" icon="plus" onPress={() => setAddOpen(true)} accessibilityLabel="Add a piece" />
      </View>
      <ChipRow scroll>
        <Chip label="All" selected={filter.category === 'all'} onPress={() => set({ category: 'all' })} />
        {CATEGORIES.map((c) => (
          <Chip key={c.key} label={c.plural} icon={c.key} selected={filter.category === c.key} onPress={() => set({ category: c.key })} />
        ))}
      </ChipRow>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Chip label={nFilters ? `Filters (${nFilters})` : 'Filters'} icon="filter" selected={nFilters > 0} onPress={() => setFiltersOpen(true)} tone="secondary" />
        <Chip label="Favorites" icon="heart" selected={filter.favoritesOnly} onPress={() => set({ favoritesOnly: !filter.favoritesOnly })} tone="secondary" />
        <Chip
          label={filter.sort === 'az' ? 'A–Z' : filter.sort === 'oldest' ? 'Oldest' : 'Newest'}
          onPress={() => set({ sort: filter.sort === 'newest' ? 'az' : filter.sort === 'az' ? 'oldest' : 'newest' })}
          accessibilityLabel={`Sort: ${filter.sort === 'az' ? 'alphabetical' : filter.sort}. Tap to change`}
        />
      </View>
      {total > 0 && visible.length !== total ? (
        <AppText variant="caption" muted>
          Showing {visible.length} of {total}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={visible}
        key={columns}
        numColumns={columns}
        keyExtractor={(i) => i.id}
        columnWrapperStyle={columns > 1 ? { gap } : undefined}
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        ListHeaderComponent={header}
        renderItem={({ item }) => <ItemTile item={item} width={tileW} />}
        initialNumToRender={8}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          items === undefined ? undefined : total === 0 ? (
            <EmptyState
              title="Nothing on the rack yet"
              body="Photograph a piece or pick one from your library. Photos are stored only on this phone."
              action={<Button label="Add your first piece" icon="camera" onPress={() => setAddOpen(true)} />}
            />
          ) : (
            <EmptyState title="No matches" body="Try a different search or clear the filters." action={<Button label="Clear filters" variant="ghost" onPress={() => setFilter(DEFAULT_FILTER)} />} />
          )
        }
      />

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add a piece">
        <Button label="Take a photo" icon="camera" onPress={() => { setAddOpen(false); router.push({ pathname: '/item/new', params: { source: 'camera' } }); }} />
        <Button label="Choose from library" icon="gallery" variant="secondary" onPress={() => { setAddOpen(false); router.push({ pathname: '/item/new', params: { source: 'library' } }); }} />
        <Button label="Add without a photo" variant="ghost" onPress={() => { setAddOpen(false); router.push('/item/new'); }} />
        <AppText variant="small" muted>
          Tip: shoot each piece flat or on a hanger against a plain wall for the cleanest outfit previews.
        </AppText>
      </Sheet>

      <Sheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filter wardrobe"
        footer={
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Button label="Clear" variant="ghost" onPress={() => setFilter((f) => ({ ...DEFAULT_FILTER, search: f.search, category: f.category, sort: f.sort }))} style={{ flex: 1 }} />
            <Button label={`Show ${visible.length}`} onPress={() => setFiltersOpen(false)} style={{ flex: 2 }} />
          </View>
        }
      >
        <AppText variant="bodyStrong">Color</AppText>
        <ChipRow>
          {COLORS.map((c) => (
            <Chip key={c.key} label={c.label} swatch={c.hex} selected={filter.colors.includes(c.key)} onPress={() => set({ colors: toggle(filter.colors, c.key) })} />
          ))}
        </ChipRow>
        <AppText variant="bodyStrong">Style</AppText>
        <ChipRow>
          {STYLE_TAGS.map((s) => (
            <Chip key={s} label={s} selected={filter.styles.includes(s)} onPress={() => set({ styles: toggle<string>(filter.styles, s) })} tone="secondary" />
          ))}
        </ChipRow>
        <AppText variant="bodyStrong">Season</AppText>
        <ChipRow>
          {SEASONS.map((s) => (
            <Chip key={s.key} label={s.label} selected={filter.seasons.includes(s.key)} onPress={() => set({ seasons: toggle<Season>(filter.seasons, s.key) })} tone="mint" />
          ))}
        </ChipRow>
        <AppText variant="bodyStrong">Availability</AppText>
        <ChipRow>
          {(['all', 'available', 'unavailable'] as const).map((a) => (
            <Chip key={a} label={a === 'all' ? 'Everything' : a === 'available' ? 'Available' : 'Unavailable'} selected={filter.availability === a} onPress={() => set({ availability: a })} tone="highlight" />
          ))}
        </ChipRow>
      </Sheet>
    </SafeAreaView>
  );
}
