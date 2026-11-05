import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Animated, Pressable, View, useAnimatedValue } from 'react-native';
import { AppText } from '../../components/AppText';
import { PixelTag } from '../../components/Chip';
import { ItemPhoto } from '../../components/ItemPhoto';
import { PixelIcon } from '../../components/pixel/PixelArt';
import { SLOT_LABELS } from '../../engine/catalog';
import { useTheme } from '../../theme/ThemeProvider';
import { borders, offsetShadow, radii } from '../../theme/tokens';
import type { SlotKey, WardrobeItem } from '../../types/models';

interface PieceCardProps {
  slot: SlotKey;
  item: WardrobeItem;
  locked?: boolean;
  onToggleLock?: () => void;
  onSwap?: () => void;
  highlight?: boolean;
  width: number;
}

/**
 * One clothing piece in an outfit. Photo first; the lock is a separate,
 * clearly labelled control whose state is shown by icon, text and border —
 * never by color alone.
 */
export function PieceCard({ slot, item, locked = false, onToggleLock, onSwap, highlight, width }: PieceCardProps) {
  const { colors, reduceMotion } = useTheme();
  const wiggle = useAnimatedValue(0);
  const pop = useAnimatedValue(highlight ? 0 : 1);

  useEffect(() => {
    if (!highlight) return;
    if (reduceMotion) {
      pop.setValue(1);
      return;
    }
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 5, tension: 160 }).start();
  }, [highlight, pop, reduceMotion]);

  const toggle = () => {
    if (!onToggleLock) return;
    Haptics.impactAsync(locked ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    if (!reduceMotion) {
      wiggle.setValue(0);
      Animated.sequence([
        Animated.timing(wiggle, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(wiggle, { toValue: 0, duration: 70, useNativeDriver: true }),
      ]).start();
    }
    onToggleLock();
  };
  const rotate = wiggle.interpolate({ inputRange: [-1, 1], outputRange: ['-10deg', '10deg'] });
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] });

  return (
    <Animated.View style={{ width, transform: [{ scale }] }}>
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: locked ? borders.bold + 1 : borders.bold,
          borderColor: colors.border,
          borderRadius: radii.soft,
          overflow: 'hidden',
          boxShadow: offsetShadow(locked ? colors.highlight : colors.shadow, 4),
          marginRight: 4,
          marginBottom: 4,
        }}
      >
        <Pressable
          onPress={() => router.push(`/item/${item.id}`)}
          accessibilityRole="button"
          accessibilityLabel={`${SLOT_LABELS[slot]}: ${item.name}${locked ? ', locked' : ''}${item.available ? '' : ', marked unavailable'}`}
          accessibilityHint="Opens item details"
        >
          <ItemPhoto item={item} style={{ width: '100%', aspectRatio: 1 }} />
          <View style={{ position: 'absolute', left: 8, top: 8, flexDirection: 'row', gap: 4 }}>
            <PixelTag label={SLOT_LABELS[slot]} tone="surface" />
            {!item.available ? <PixelTag label="Away" tone="secondary" /> : null}
          </View>
          {locked ? (
            <View style={{ position: 'absolute', right: 8, top: 8 }}>
              <PixelTag label="Locked" tone="highlight" />
            </View>
          ) : null}
        </Pressable>
        <View style={{ padding: 10, gap: 8, borderTopWidth: borders.thin, borderColor: colors.border }}>
          <AppText variant="bodyStrong" numberOfLines={2} style={{ minHeight: 44 }}>
            {item.name}
          </AppText>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {onToggleLock ? (
              <Pressable
                onPress={toggle}
                accessibilityRole="switch"
                accessibilityState={{ checked: locked }}
                accessibilityLabel={`Lock ${item.name}`}
                accessibilityHint={locked ? 'Locked items stay when you regenerate' : 'Keep this item when regenerating'}
                hitSlop={4}
                style={({ pressed }) => ({
                  flex: 1,
                  minHeight: 44,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  borderWidth: borders.bold,
                  borderColor: colors.border,
                  borderRadius: radii.sharp,
                  backgroundColor: locked ? colors.highlight : colors.surface,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <Animated.View style={{ transform: [{ rotate }] }}>
                  <PixelIcon name={locked ? 'lock' : 'unlock'} size={24} color={locked ? colors.onHighlight : colors.text} />
                </Animated.View>
                <AppText variant="caption" color={locked ? colors.onHighlight : colors.text} style={{ fontFamily: 'DMSans_700Bold' }}>
                  {locked ? 'Locked' : 'Lock'}
                </AppText>
              </Pressable>
            ) : null}
            {onSwap ? (
              <Pressable
                onPress={onSwap}
                disabled={locked}
                accessibilityRole="button"
                accessibilityLabel={`Swap ${SLOT_LABELS[slot].toLowerCase()}`}
                accessibilityHint="Replaces only this piece"
                accessibilityState={{ disabled: locked }}
                hitSlop={4}
                style={({ pressed }) => ({
                  width: 44,
                  minHeight: 44,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: borders.bold,
                  borderColor: colors.border,
                  borderRadius: radii.sharp,
                  backgroundColor: colors.surface,
                  opacity: locked ? 0.35 : pressed ? 0.7 : 1,
                })}
              >
                <PixelIcon name="dice" size={24} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}
