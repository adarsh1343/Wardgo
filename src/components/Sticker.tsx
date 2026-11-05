import type { ReactNode } from 'react';
import { type StyleProp, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { borders, offsetShadow, radii } from '../theme/tokens';

export type StickerShape = 'soft' | 'sharp' | 'ticket' | 'ticketAlt' | 'pill';

interface StickerProps {
  children?: ReactNode;
  shape?: StickerShape;
  /** Background role. */
  tone?: 'surface' | 'alt' | 'primary' | 'secondary' | 'highlight' | 'mint' | 'lilac' | 'sky' | 'pink' | 'sunk';
  /** Offset of the hard shadow; 0 = flat (no shadow). */
  lift?: 0 | 2 | 4 | 6;
  /** Shadow color role; defaults to the theme shadow. */
  shadowTone?: 'shadow' | 'primary' | 'secondary' | 'highlight' | 'mint';
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}

/** A bordered surface with an optional hard offset shadow — the core Memphis "sticker". */
export function Sticker({ children, shape = 'soft', tone = 'surface', lift = 4, shadowTone = 'shadow', style, padded = true }: StickerProps) {
  const { colors } = useTheme();
  const bg = {
    surface: colors.surface,
    alt: colors.surfaceAlt,
    primary: colors.primary,
    secondary: colors.secondary,
    highlight: colors.highlight,
    mint: colors.mint,
    lilac: colors.lilac,
    sky: colors.sky,
    pink: colors.pink,
    sunk: colors.sunk,
  }[tone];
  const shapeStyle: ViewStyle =
    shape === 'ticket' ? radii.ticket : shape === 'ticketAlt' ? radii.ticketAlt : { borderRadius: radii[shape] };
  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderWidth: borders.bold,
          borderColor: colors.border,
          padding: padded ? 14 : 0,
          boxShadow: lift > 0 ? offsetShadow(colors[shadowTone], lift) : undefined,
          marginRight: lift,
          marginBottom: lift,
        },
        shapeStyle,
        style,
      ]}
    >
      {children}
    </View>
  );
}
