import type { ReactNode } from 'react';
import { Pressable, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import type { IconName } from '../assets/pixel/sprites';
import { useTheme } from '../theme/ThemeProvider';
import { borders, radii } from '../theme/tokens';
import { AppText } from './AppText';
import { PixelIcon } from './pixel/PixelArt';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  /** Color swatch shown before the label. */
  swatch?: string;
  tone?: 'primary' | 'secondary' | 'highlight' | 'mint';
  accessibilityLabel?: string;
  leading?: ReactNode;
}

/** Selectable pill. Selection shows a check mark, so state is not color-only. */
export function Chip({ label, selected = false, onPress, icon, swatch, tone = 'primary', accessibilityLabel, leading }: ChipProps) {
  const { colors } = useTheme();
  const bg = selected ? { primary: colors.primary, secondary: colors.secondary, highlight: colors.highlight, mint: colors.mint }[tone] : colors.surface;
  const fg = selected ? { primary: colors.onPrimary, secondary: colors.onSecondary, highlight: colors.onHighlight, mint: colors.onMint }[tone] : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'checkbox' : 'text'}
      accessibilityState={onPress ? { checked: selected } : undefined}
      accessibilityLabel={accessibilityLabel ?? label}
      hitSlop={4}
    >
      {({ pressed }) => (
        <View
          style={{
            minHeight: 36,
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: radii.pill,
            borderWidth: borders.thin,
            borderColor: colors.border,
            backgroundColor: bg,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            opacity: pressed ? 0.75 : 1,
          }}
        >
          {selected ? <PixelIcon name="check" size={12} color={fg} /> : null}
          {leading}
          {swatch ? (
            <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: swatch, borderWidth: 1.5, borderColor: colors.border }} />
          ) : null}
          {icon ? <PixelIcon name={icon} size={12} color={fg} /> : null}
          <AppText variant="caption" color={fg}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

export function ChipRow({ children, scroll = false, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[{ gap: 8, paddingRight: 16 }, style]}>
        {children}
      </ScrollView>
    );
  }
  return <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>{children}</View>;
}

/** Small non-interactive pixel-font label, e.g. "LOCKED", "NEW", slot names. */
export function PixelTag({ label, tone = 'highlight', style }: { label: string; tone?: 'highlight' | 'primary' | 'secondary' | 'mint' | 'surface' | 'ink'; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  const bg = { highlight: colors.highlight, primary: colors.primary, secondary: colors.secondary, mint: colors.mint, surface: colors.surface, ink: colors.text }[tone];
  const fg = { highlight: colors.onHighlight, primary: colors.onPrimary, secondary: colors.onSecondary, mint: colors.onMint, surface: colors.text, ink: colors.bg }[tone];
  return (
    <View
      style={[
        { alignSelf: 'flex-start', backgroundColor: bg, borderWidth: borders.thin, borderColor: colors.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radii.sharp },
        style,
      ]}
    >
      <AppText variant="pixel" color={fg}>
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}
