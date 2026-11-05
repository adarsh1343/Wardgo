import { Image } from 'expo-image';
import { useState } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import type { IconName } from '../assets/pixel/sprites';
import { imageUri } from '../services/storage/images';
import { useTheme } from '../theme/ThemeProvider';
import type { Category, WardrobeItem } from '../types/models';
import { AppText } from './AppText';
import { PixelIcon } from './pixel/PixelArt';

const CATEGORY_ICON: Record<Category, IconName> = {
  top: 'top',
  bottom: 'bottom',
  footwear: 'footwear',
  accessory: 'accessory',
};

interface ItemPhotoProps {
  item: Pick<WardrobeItem, 'images' | 'category' | 'name'> | null;
  /** Use the full image instead of the thumbnail. */
  full?: boolean;
  /** Override: show a specific stored file. */
  fileName?: string | null;
  style?: StyleProp<ViewStyle>;
  /** Fit the whole garment ("contain") on detail views; fill ("cover") in grids. */
  fit?: 'cover' | 'contain';
  label?: string;
}

/**
 * Clothing photo on a quiet, neutral surface (no patterns behind photos).
 * Falls back to a pixel category icon if the photo is missing or unreadable.
 */
export function ItemPhoto({ item, full, fileName, style, fit = 'cover', label }: ItemPhotoProps) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const first = item?.images[0];
  const name = fileName ?? (full ? first?.fileName : (first?.thumbFileName ?? first?.fileName));
  const uri = imageUri(name);
  const a11y = label ?? (item ? `Photo of ${item.name}` : 'Missing item');

  return (
    <View
      style={[{ backgroundColor: colors.photoBg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={uri && !failed ? a11y : `${a11y} (no photo)`}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          style={{ width: '100%', height: '100%' }}
          contentFit={fit}
          transition={120}
          recyclingKey={uri}
          onError={() => setFailed(true)}
        />
      ) : (
        <View style={{ alignItems: 'center', gap: 4 }}>
          <PixelIcon name={item ? CATEGORY_ICON[item.category] : 'close'} size={36} color="#9C9AA8" />
          {failed ? (
            <AppText variant="pixel" color="#58524C">
              NO PHOTO
            </AppText>
          ) : null}
        </View>
      )}
    </View>
  );
}

export { CATEGORY_ICON };
