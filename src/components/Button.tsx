import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, View, type ViewStyle } from 'react-native';
import type { IconName } from '../assets/pixel/sprites';
import { useTheme } from '../theme/ThemeProvider';
import { borders, offsetShadow, radii, touchTarget } from '../theme/tokens';
import { AppText } from './AppText';
import { PixelIcon } from './pixel/PixelArt';

type Variant = 'primary' | 'secondary' | 'highlight' | 'ghost' | 'danger' | 'mint';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: IconName;
  size?: 'md' | 'lg' | 'sm';
  disabled?: boolean;
  loading?: boolean;
  accessibilityHint?: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  shape?: 'pill' | 'ticket' | 'sharp';
  trailing?: ReactNode;
}

/** Sticker-style button: pressing pushes it into its own shadow. */
export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  size = 'md',
  disabled,
  loading,
  accessibilityHint,
  accessibilityLabel,
  style,
  haptic = true,
  shape = 'pill',
  trailing,
}: ButtonProps) {
  const { colors } = useTheme();
  const palette: Record<Variant, { bg: string; fg: string }> = {
    primary: { bg: colors.primary, fg: colors.onPrimary },
    secondary: { bg: colors.secondary, fg: colors.onSecondary },
    highlight: { bg: colors.highlight, fg: colors.onHighlight },
    mint: { bg: colors.mint, fg: colors.onMint },
    ghost: { bg: colors.surface, fg: colors.text },
    danger: { bg: colors.danger, fg: colors.onDanger },
  };
  const { bg, fg } = palette[variant];
  const height = size === 'lg' ? 56 : size === 'sm' ? touchTarget : 48;
  const lift = size === 'sm' ? 2 : 4;
  const shapeStyle: ViewStyle = shape === 'ticket' ? radii.ticket : { borderRadius: shape === 'pill' ? radii.pill : radii.sharp };

  return (
    <Pressable
      onPress={() => {
        if (haptic) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
        onPress();
      }}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!(disabled || loading), busy: !!loading }}
      hitSlop={4}
      style={[{ marginRight: lift, marginBottom: lift }, style]}
    >
      {({ pressed }) => (
        <View
          style={[
            {
              minHeight: height,
              paddingHorizontal: size === 'sm' ? 14 : 20,
              backgroundColor: bg,
              borderWidth: borders.bold,
              borderColor: colors.border,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              opacity: disabled ? 0.45 : 1,
              boxShadow: pressed || disabled ? undefined : offsetShadow(colors.shadow, lift),
              transform: pressed ? [{ translateX: lift }, { translateY: lift }] : [],
            },
            shapeStyle,
          ]}
        >
          {loading ? (
            <ActivityIndicator color={fg} />
          ) : (
            <>
              {icon ? <PixelIcon name={icon} size={size === 'lg' ? 24 : 18} color={fg} /> : null}
              <AppText variant={size === 'sm' ? 'caption' : 'bodyStrong'} color={fg} numberOfLines={1}>
                {label}
              </AppText>
              {trailing}
            </>
          )}
        </View>
      )}
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  tone?: 'surface' | 'primary' | 'highlight' | 'secondary' | 'mint';
  selected?: boolean;
  disabled?: boolean;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function IconButton({ icon, onPress, accessibilityLabel, accessibilityHint, tone = 'surface', selected, disabled, size = touchTarget, style }: IconButtonProps) {
  const { colors } = useTheme();
  const bg = { surface: colors.surface, primary: colors.primary, highlight: colors.highlight, secondary: colors.secondary, mint: colors.mint }[tone];
  const fg = { surface: colors.text, primary: colors.onPrimary, highlight: colors.onHighlight, secondary: colors.onSecondary, mint: colors.onMint }[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!disabled, selected }}
      hitSlop={6}
      style={[{ marginRight: 2, marginBottom: 2 }, style]}
    >
      {({ pressed }) => (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: radii.sharp,
            borderWidth: borders.bold,
            borderColor: colors.border,
            backgroundColor: bg,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: disabled ? 0.4 : 1,
            boxShadow: pressed ? undefined : offsetShadow(colors.shadow, 2),
            transform: pressed ? [{ translateX: 2 }, { translateY: 2 }] : [],
          }}
        >
          <PixelIcon name={icon} size={Math.round(size * 0.45 / 12) * 12 || 12} color={fg} />
        </View>
      )}
    </Pressable>
  );
}
