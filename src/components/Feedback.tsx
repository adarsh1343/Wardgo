import { useEffect } from 'react';
import { Animated, Easing, Pressable, View, useAnimatedValue } from 'react-native';
import { SPRITES } from '../assets/pixel/sprites';
import type { IconName } from '../assets/pixel/sprites';
import { useTheme } from '../theme/ThemeProvider';
import { borders, radii } from '../theme/tokens';
import { AppText } from './AppText';
import { PixelArt, PixelIcon } from './pixel/PixelArt';

/** Inline status message. Tone + icon + text, never color alone. */
export function Banner({ text, tone = 'info', onDismiss }: { text: string; tone?: 'info' | 'warn' | 'error' | 'success'; onDismiss?: () => void }) {
  const { colors } = useTheme();
  const bg = { info: colors.sky, warn: colors.highlight, error: colors.pink, success: colors.mint }[tone];
  const fg = tone === 'info' || tone === 'error' ? colors.text : colors.onHighlight;
  const icon: IconName = { info: 'star', warn: 'bell', error: 'close', success: 'check' }[tone] as IconName;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: bg, borderWidth: borders.thin, borderColor: colors.border, borderRadius: radii.sharp }}>
      {/* One VoiceOver element for the message; the dismiss button stays separately focusable. */}
      <View accessible accessibilityRole="alert" accessibilityLiveRegion="polite" accessibilityLabel={text} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <PixelIcon name={icon} size={12} color={fg} />
        <AppText variant="small" color={fg} style={{ flex: 1 }}>
          {text}
        </AppText>
      </View>
      {onDismiss ? (
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss message" hitSlop={10}>
          <PixelIcon name="close" size={12} color={fg} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** 1–5 pixel-block meter (formality, warmth). Shows a number too. */
export function PipMeter({
  value,
  onChange,
  label,
  valueLabel,
  tone = 'primary',
}: {
  value: number;
  onChange?: (v: number) => void;
  label: string;
  valueLabel?: string;
  tone?: 'primary' | 'secondary' | 'highlight';
}) {
  const { colors } = useTheme();
  const fill = { primary: colors.primary, secondary: colors.secondary, highlight: colors.highlight }[tone];
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <AppText variant="bodyStrong">{label}</AppText>
        <AppText variant="small" muted>
          {value}/5{valueLabel ? ` · ${valueLabel}` : ''}
        </AppText>
      </View>
      <View
        style={{ flexDirection: 'row', gap: 6 }}
        accessible={!!onChange}
        accessibilityRole={onChange ? 'adjustable' : 'text'}
        accessibilityLabel={label}
        accessibilityValue={{ min: 1, max: 5, now: value, text: valueLabel }}
        accessibilityActions={onChange ? [{ name: 'increment' }, { name: 'decrement' }] : undefined}
        onAccessibilityAction={(e) => {
          if (!onChange) return;
          if (e.nativeEvent.actionName === 'increment') onChange(Math.min(5, value + 1));
          if (e.nativeEvent.actionName === 'decrement') onChange(Math.max(1, value - 1));
        }}
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            disabled={!onChange}
            onPress={() => onChange?.(n)}
            style={{
              flex: 1,
              height: 28,
              backgroundColor: n <= value ? fill : colors.surface,
              borderWidth: borders.thin,
              borderColor: colors.border,
              borderRadius: 2,
            }}
            importantForAccessibility="no"
            accessibilityElementsHidden
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Brief pixel sparkle burst for success moments (e.g. outfit saved).
 * Respects Reduce Motion by showing a static badge instead.
 */
export function SaveBurst({ trigger, label }: { trigger: number; label: string }) {
  const { colors, reduceMotion } = useTheme();
  const anim = useAnimatedValue(0);
  useEffect(() => {
    if (trigger === 0) return;
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: reduceMotion ? 1400 : 900,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [trigger, anim, reduceMotion]);
  if (trigger === 0) return null;
  const opacity = anim.interpolate({ inputRange: [0, 0.15, 0.75, 1], outputRange: [0, 1, 1, 0] });
  const scale = reduceMotion ? 1 : anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1.15, 1] });
  const spread = reduceMotion ? 0 : anim.interpolate({ inputRange: [0, 1], outputRange: [0, 34] });
  const neg = reduceMotion ? 0 : Animated.multiply(spread as Animated.AnimatedInterpolation<number>, -1);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: '40%', alignItems: 'center' }} accessibilityLiveRegion="polite">
      <Animated.View style={{ opacity, transform: [{ scale }], alignItems: 'center' }}>
        <Animated.View style={{ position: 'absolute', transform: [{ translateX: neg }, { translateY: neg }] }}>
          <PixelArt art={SPRITES.sparkle} scale={4} />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', transform: [{ translateX: spread }, { translateY: neg }] }}>
          <PixelArt art={SPRITES.sparkle} scale={3} />
        </Animated.View>
        <Animated.View style={{ position: 'absolute', transform: [{ translateX: spread }, { translateY: spread }] }}>
          <PixelArt art={SPRITES.heartPixel} scale={4} />
        </Animated.View>
        <View
          style={{
            backgroundColor: colors.mint,
            borderWidth: borders.bold,
            borderColor: colors.border,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: radii.sharp,
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <PixelIcon name="check" size={12} color={colors.onMint} />
          <AppText variant="pixelLarge" color={colors.onMint}>
            {label}
          </AppText>
        </View>
      </Animated.View>
    </View>
  );
}
