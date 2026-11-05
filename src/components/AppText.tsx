import { Text, type TextProps, type TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'small' | 'caption' | 'pixel' | 'pixelLarge';

const VARIANTS: Record<TextVariant, TextStyle & { maxScale: number }> = {
  display: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, letterSpacing: -0.5, maxScale: 1.4 },
  title: { fontFamily: fonts.display, fontSize: 24, lineHeight: 29, maxScale: 1.5 },
  heading: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 23, maxScale: 1.8 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 22, maxScale: 2 },
  bodyStrong: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 22, maxScale: 2 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 19, maxScale: 2 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12.5, lineHeight: 16, maxScale: 1.8 },
  // Pixel font: short labels only (tags, counters, dates). Never paragraphs.
  pixel: { fontFamily: fonts.pixel, fontSize: 11, lineHeight: 14, letterSpacing: 0.6, maxScale: 1.4 },
  pixelLarge: { fontFamily: fonts.pixel, fontSize: 15, lineHeight: 19, letterSpacing: 0.8, maxScale: 1.4 },
};

interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  muted?: boolean;
  center?: boolean;
}

export function AppText({ variant = 'body', color, muted, center, style, ...rest }: AppTextProps) {
  const { colors } = useTheme();
  const { maxScale, ...v } = VARIANTS[variant];
  return (
    <Text
      maxFontSizeMultiplier={maxScale}
      style={[v, { color: color ?? (muted ? colors.textMuted : colors.text) }, center && { textAlign: 'center' }, style]}
      {...rest}
    />
  );
}
