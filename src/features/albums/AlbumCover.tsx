import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { SPRITES } from '../../assets/pixel/sprites';
import { AppText } from '../../components/AppText';
import { IconButton } from '../../components/Button';
import { ItemPhoto } from '../../components/ItemPhoto';
import { DotGrid, Triangle } from '../../components/memphis/Shapes';
import { PixelArt } from '../../components/pixel/PixelArt';
import { useTheme } from '../../theme/ThemeProvider';
import { borders, offsetShadow, radii } from '../../theme/tokens';
import type { Album, SavedOutfit, WardrobeItem } from '../../types/models';

interface Props {
  album: Album;
  outfitsById: Map<string, SavedOutfit>;
  itemsById: Map<string, WardrobeItem>;
  width: number;
  index: number;
  reorder?: { onUp?: () => void; onDown?: () => void };
}

/** Cover photo from a real outfit, framed by a Memphis "mat" that varies per album. */
export function AlbumCover({ album, outfitsById, itemsById, width, index, reorder }: Props) {
  const { colors } = useTheme();
  const mats = [colors.secondary, colors.highlight, colors.mint, colors.primary];
  const mat = mats[index % mats.length]!;
  const coverOutfit = (album.coverOutfitId && outfitsById.get(album.coverOutfitId)) || outfitsById.get(album.outfitIds[0] ?? '');
  const coverItem = coverOutfit?.items
    .map((i) => (i.itemId ? itemsById.get(i.itemId) : undefined))
    .find((i): i is WardrobeItem => !!i && i.images.length > 0);
  const frameShape = index % 2 === 0 ? radii.ticket : radii.ticketAlt;
  const inner = width - 3 - 16;

  return (
    <View style={{ width, marginBottom: 18 }}>
      <Pressable
        onPress={() => router.push(`/album/${album.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`Album ${album.name}, ${album.outfitIds.length} outfits`}
      >
        {({ pressed }) => (
          <View
            style={[
              {
                backgroundColor: mat,
                borderWidth: borders.bold,
                borderColor: colors.border,
                padding: 8,
                boxShadow: pressed ? undefined : offsetShadow(colors.shadow, 3),
                transform: pressed ? [{ translateX: 3 }, { translateY: 3 }] : [],
                marginRight: 3,
              },
              frameShape,
            ]}
          >
            <View style={{ width: inner, height: inner, borderWidth: borders.thin, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.photoBg }}>
              {coverItem ? (
                <ItemPhoto item={coverItem} style={{ width: '100%', height: '100%' }} label={`Cover of ${album.name}`} />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceAlt }}>
                  <PixelArt art={SPRITES.emptyAlbum} scale={4} />
                </View>
              )}
            </View>
            <View style={{ position: 'absolute', right: -8, top: -10 }} pointerEvents="none">
              {index % 2 === 0 ? <Triangle size={24} color={colors.surface} outline={colors.border} rotate={15} /> : <DotGrid rows={2} cols={3} gap={7} color={colors.border} />}
            </View>
          </View>
        )}
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8, gap: 6 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {album.name}
          </AppText>
          <AppText variant="pixel" muted>
            {`${album.outfitIds.length} FIT${album.outfitIds.length === 1 ? '' : 'S'}`}
          </AppText>
        </View>
        {reorder ? (
          <View style={{ flexDirection: 'row', gap: 4 }}>
            <IconButton icon="arrowLeft" onPress={reorder.onUp ?? (() => undefined)} disabled={!reorder.onUp} accessibilityLabel={`Move ${album.name} earlier`} size={40} />
            <IconButton icon="arrowRight" onPress={reorder.onDown ?? (() => undefined)} disabled={!reorder.onDown} accessibilityLabel={`Move ${album.name} later`} size={40} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
