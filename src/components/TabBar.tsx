import type { BottomTabBarProps } from 'expo-router/js-tabs';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Animated, Pressable, View, type ViewStyle, useAnimatedValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { IconName } from '../assets/pixel/sprites';
import { useTheme } from '../theme/ThemeProvider';
import { borders, offsetShadow } from '../theme/tokens';
import { AppText } from './AppText';
import { PixelIcon } from './pixel/PixelArt';

interface TabMeta {
  icon: IconName;
  label: string;
  /** Each tab's active badge has its own Memphis shape. */
  shape: ViewStyle;
  diamond?: boolean;
}

const TABS: Record<string, TabMeta> = {
  index: { icon: 'sun', label: 'Today', shape: { borderRadius: 999 } },
  wardrobe: { icon: 'hanger', label: 'Wardrobe', shape: { borderRadius: 4 } },
  outfits: { icon: 'photos', label: 'Outfits', shape: { borderTopLeftRadius: 16, borderBottomRightRadius: 16, borderTopRightRadius: 3, borderBottomLeftRadius: 3 } },
  settings: { icon: 'gear', label: 'Settings', shape: { borderRadius: 4 }, diamond: true },
};

function TabButton({ meta, focused, onPress, onLongPress }: { meta: TabMeta; focused: boolean; onPress: () => void; onLongPress: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const scale = useAnimatedValue(focused ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(focused ? 1 : 0);
      return;
    }
    Animated.spring(scale, { toValue: focused ? 1 : 0, useNativeDriver: true, friction: 6, tension: 140 }).start();
  }, [focused, reduceMotion, scale]);
  const badgeScale = scale.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] });
  const isDiamond = !!meta.diamond;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={meta.label}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 8, minHeight: 56 }}
    >
      <View style={{ width: 44, height: 36, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: isDiamond ? 30 : 42,
              height: isDiamond ? 30 : 34,
              backgroundColor: colors.highlight,
              borderWidth: borders.bold,
              borderColor: colors.border,
              boxShadow: offsetShadow(colors.shadow, 2),
              opacity: scale,
            },
            meta.shape,
            { transform: isDiamond ? [{ rotate: '45deg' }, { scale: badgeScale }] : [{ scale: badgeScale }] },
          ]}
        />
        <PixelIcon name={meta.icon} size={24} color={focused ? colors.onHighlight : colors.text} />
      </View>
      <AppText variant="caption" style={{ marginTop: 3, fontFamily: focused ? 'DMSans_700Bold' : 'DMSans_500Medium' }} muted={!focused} maxFontSizeMultiplier={1.3}>
        {meta.label}
      </AppText>
    </Pressable>
  );
}

// SDK 57 passes `navigation` to custom tab bars. (SDK 58 replaces it with `emitter` + `navigateToTab`.)
export function MemphisTabBar({ state, navigation }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.surface,
        borderTopWidth: borders.bold,
        borderColor: colors.border,
        paddingBottom: Math.max(insets.bottom, 8),
        paddingHorizontal: 6,
      }}
    >
      {state.routes.map((route, index) => {
        const meta = TABS[route.name];
        if (!meta) return null;
        const focused = state.index === index;
        return (
          <TabButton
            key={route.key}
            meta={meta}
            focused={focused}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) {
                Haptics.selectionAsync().catch(() => undefined);
                navigation.navigate(route.name, route.params);
              }
            }}
            onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
          />
        );
      })}
    </View>
  );
}
