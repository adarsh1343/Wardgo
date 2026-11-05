import { router } from 'expo-router';
import { memo } from 'react';
import { Pressable, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { PixelTag } from '../../components/Chip';
import { PixelIcon } from '../../components/pixel/PixelArt';
import { useTheme } from '../../theme/ThemeProvider';
import { borders, offsetShadow, radii } from '../../theme/tokens';
import type { SavedOutfit, WardrobeItem } from '../../types/models';
import { OutfitCollage } from './OutfitCollage';

interface Props {
  outfit: SavedOutfit;
  itemsById: Map<string, WardrobeItem>;
  width: number;
  onPress?: () => void;
  selected?: boolean;
  /** Index used to vary the Memphis label color so a grid feels collected. */
  index?: number;
}

function OutfitCardBase({ outfit, itemsById, width, onPress, selected, index = 0 }: Props) {
  const { colors } = useTheme();
  const accents = [colors.highlight, colors.mint, colors.pink, colors.sky];
  const accent = accents[index % accents.length]!;
  const missing = outfit.items.filter((i) => !i.itemId).length;
  return (
    <Pressable
      onPress={onPress ?? (() => router.push(`/outfit/${outfit.id}`))}
      accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={`${outfit.name}${outfit.favorite ? ', favorite' : ''}, worn ${outfit.wearCount} times${missing ? `, ${missing} removed item` : ''}`}
      style={{ width, marginBottom: 16 }}
    >
      {({ pressed }) => (
        <View
          style={{
            borderWidth: selected ? borders.bold + 1.5 : borders.bold,
            borderColor: selected ? colors.primary : colors.border,
            borderRadius: radii.soft,
            backgroundColor: colors.surface,
            overflow: 'hidden',
            boxShadow: pressed ? undefined : offsetShadow(colors.shadow, 3),
            transform: pressed ? [{ translateX: 3 }, { translateY: 3 }] : [],
            marginRight: 3,
          }}
        >
          <OutfitCollage outfit={outfit} itemsById={itemsById} size={width - 3 - borders.bold * 2} />
          <View style={{ padding: 10, gap: 6, backgroundColor: accent, borderTopWidth: borders.bold, borderColor: colors.border }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {outfit.favorite ? <PixelIcon name="heartFilled" size={12} color={colors.secondary} /> : null}
              <AppText variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }} color={colors.text}>
                {outfit.name}
              </AppText>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
              <PixelTag label={`Worn ×${outfit.wearCount}`} tone="surface" />
              {missing ? <PixelTag label={`${missing} removed`} tone="secondary" /> : null}
              {selected ? <PixelTag label="Selected" tone="primary" /> : null}
            </View>
          </View>
        </View>
      )}
    </Pressable>
  );
}

export const OutfitCard = memo(OutfitCardBase);
