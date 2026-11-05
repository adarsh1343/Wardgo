import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, type StyleProp, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { AppText } from './AppText';
import { type AccentVariant, MemphisAccent } from './memphis/Accents';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  /** Include the top safe-area inset (tab screens). Stack screens with a header skip it. */
  topInset?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}

export function Screen({ children, scroll = true, topInset = true, contentStyle, refreshing, onRefresh, footer }: ScreenProps) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ padding: 16, paddingBottom: 120, gap: 18 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1, padding: 16, gap: 16 }, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView edges={topInset ? ['top', 'left', 'right'] : ['left', 'right']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

interface HeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  accent?: AccentVariant;
  right?: ReactNode;
}

/** Display-type header with a pixel-font eyebrow and a Memphis accent cluster. */
export function ScreenHeader({ eyebrow, title, subtitle, accent, right }: HeaderProps) {
  return (
    <View style={{ minHeight: accent ? 104 : undefined, paddingTop: 6, paddingRight: accent ? 120 : 0 }}>
      {accent ? <MemphisAccent variant={accent} /> : null}
      {eyebrow ? (
        <AppText variant="pixel" muted style={{ marginBottom: 4 }}>
          {eyebrow}
        </AppText>
      ) : null}
      <AppText variant="display" accessibilityRole="header">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="small" muted style={{ marginTop: 4 }}>
          {subtitle}
        </AppText>
      ) : null}
      {right ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>{right}</View> : null}
    </View>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
        <View style={{ width: 10, height: 10, backgroundColor: colors.secondary, borderWidth: 1.5, borderColor: colors.border, transform: [{ rotate: '45deg' }] }} />
        <AppText variant="heading" accessibilityRole="header" style={{ flexShrink: 1 }}>
          {title}
        </AppText>
      </View>
      {action}
    </View>
  );
}
