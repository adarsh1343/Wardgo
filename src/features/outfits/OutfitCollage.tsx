import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { ItemPhoto } from '../../components/ItemPhoto';
import { isAccessorySlot } from '../../engine/catalog';
import { useTheme } from '../../theme/ThemeProvider';
import type { SavedOutfit, WardrobeItem } from '../../types/models';

/**
 * 2×2 collage of an outfit's real photos (core pieces first). Deleted items
 * show a "removed" tile — nothing is substituted.
 */
export function OutfitCollage({ outfit, itemsById, size }: { outfit: SavedOutfit; itemsById: Map<string, WardrobeItem>; size: number }) {
  const { colors } = useTheme();
  const ordered = [...outfit.items.filter((i) => !isAccessorySlot(i.slot)), ...outfit.items.filter((i) => isAccessorySlot(i.slot))].slice(0, 4);
  const cell = size / 2;
  return (
    <View
      style={{ width: size, height: size, flexDirection: 'row', flexWrap: 'wrap', backgroundColor: colors.photoBg }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Outfit: ${outfit.items.map((i) => (i.itemId && itemsById.get(i.itemId)?.name) || `removed ${i.itemName}`).join(', ')}`}
    >
      {ordered.map((piece, idx) => {
        const item = piece.itemId ? itemsById.get(piece.itemId) : undefined;
        return (
          <View
            key={`${piece.slot}-${idx}`}
            style={{
              width: cell,
              height: cell,
              borderRightWidth: idx % 2 === 0 ? 1 : 0,
              borderBottomWidth: idx < 2 ? 1 : 0,
              borderColor: colors.border,
            }}
          >
            {item ? (
              <ItemPhoto item={item} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4, backgroundColor: colors.sunk }}>
                <AppText variant="pixel" center color={colors.textMuted}>
                  REMOVED
                </AppText>
                <AppText variant="caption" center muted numberOfLines={2}>
                  {piece.itemName}
                </AppText>
              </View>
            )}
          </View>
        );
      })}
      {ordered.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="pixel" muted>
            EMPTY
          </AppText>
        </View>
      ) : null}
    </View>
  );
}
