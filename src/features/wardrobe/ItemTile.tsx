import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { AppText } from '../../components/AppText';
import { PixelTag } from '../../components/Chip';
import { CATEGORY_ICON, ItemPhoto } from '../../components/ItemPhoto';
import { PixelIcon } from '../../components/pixel/PixelArt';
import { getColor } from '../../engine/catalog';
import { useTheme } from '../../theme/ThemeProvider';
import { borders, offsetShadow, radii } from '../../theme/tokens';
import type { Category, WardrobeItem } from '../../types/models';

/** Memphis marker shape per category: circle, square, ticket, diamond. */
const MARKER_SHAPE: Record<Category, ViewStyle> = {
  top: { borderRadius: 999 },
  bottom: { borderRadius: 2 },
  footwear: { borderTopLeftRadius: 10, borderBottomRightRadius: 10, borderTopRightRadius: 2, borderBottomLeftRadius: 2 },
  accessory: { borderRadius: 2, transform: [{ rotate: '45deg' }] },
};

function ItemTileBase({ item, width, onPress }: { item: WardrobeItem; width: number; onPress?: () => void }) {
  const { colors } = useTheme();
  const markerBg: Record<Category, string> = { top: colors.primary, bottom: colors.secondary, footwear: colors.highlight, accessory: colors.mint };
  const markerFg: Record<Category, string> = { top: colors.onPrimary, bottom: colors.onSecondary, footwear: colors.onHighlight, accessory: colors.onMint };
  const color = getColor(item.primaryColor);
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/item/${item.id}`))}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}${item.favorite ? ', favorite' : ''}${item.available ? '' : ', unavailable'}`}
      style={{ width, marginBottom: 14 }}
    >
      {({ pressed }) => (
        <View
          style={{
            borderWidth: borders.bold,
            borderColor: colors.border,
            borderRadius: radii.soft,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            boxShadow: pressed ? undefined : offsetShadow(colors.shadow, 3),
            transform: pressed ? [{ translateX: 3 }, { translateY: 3 }] : [],
            marginRight: 3,
          }}
        >
          <View style={{ opacity: item.available ? 1 : 0.45 }}>
            <ItemPhoto item={item} style={{ width: '100%', aspectRatio: 0.9 }} />
          </View>
          <View style={{ position: 'absolute', left: 8, top: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <View style={[{ position: 'absolute', width: 24, height: 24, backgroundColor: markerBg[item.category], borderWidth: 1.5, borderColor: colors.border }, MARKER_SHAPE[item.category]]} />
            <PixelIcon name={CATEGORY_ICON[item.category]} size={12} color={markerFg[item.category]} />
          </View>
          {item.favorite ? (
            <View style={{ position: 'absolute', right: 8, top: 8 }}>
              <PixelIcon name="heartFilled" size={24} color={colors.secondary} />
            </View>
          ) : null}
          {!item.available ? (
            <View style={{ position: 'absolute', left: 8, bottom: 52 }}>
              <PixelTag label="Away" tone="highlight" />
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, borderTopWidth: borders.thin, borderColor: colors.border }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color?.hex ?? '#ccc', borderWidth: 1.5, borderColor: colors.border }} />
            <AppText variant="caption" numberOfLines={1} style={{ flex: 1 }}>
              {item.name}
            </AppText>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export const ItemTile = memo(ItemTileBase);
