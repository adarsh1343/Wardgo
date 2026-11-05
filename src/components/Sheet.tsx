import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { borders } from '../theme/tokens';
import { AppText } from './AppText';
import { Button, IconButton } from './Button';
import { Field } from './Field';
import { Checker } from './memphis/Shapes';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** Bottom sheet built on RN Modal (works in Expo Go, no extra native deps). */
export function Sheet({ visible, onClose, title, children, footer }: SheetProps) {
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType={reduceMotion ? 'fade' : 'slide'} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ position: 'absolute', inset: 0, backgroundColor: colors.overlay }} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.bg,
            borderTopWidth: borders.bold,
            borderColor: colors.border,
            borderTopLeftRadius: 22,
            borderTopRightRadius: 6,
            maxHeight: '88%',
            paddingBottom: Math.max(insets.bottom, 16),
          }}
        >
          <View style={{ position: 'absolute', top: -1, right: 24 }} pointerEvents="none">
            <Checker rows={1} cols={6} cell={8} a={colors.secondary} b={colors.highlight} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingTop: 22 }}>
            <AppText variant="title" accessibilityRole="header" style={{ flex: 1 }}>
              {title}
            </AppText>
            <IconButton icon="close" onPress={onClose} accessibilityLabel="Close" />
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16, gap: 16 }} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

interface PromptProps {
  visible: boolean;
  title: string;
  label: string;
  initialValue?: string;
  secondaryLabel?: string;
  initialSecondary?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onSubmit: (value: string, secondary: string) => void;
}

/**
 * Cross-platform text prompt (Alert.prompt is iOS-only and not themable).
 * Keyed on `visible` so every opening starts from the initial values.
 */
export function PromptSheet(props: PromptProps) {
  return <PromptSheetInner key={props.visible ? 'open' : 'closed'} {...props} />;
}

function PromptSheetInner({ visible, title, label, initialValue = '', secondaryLabel, initialSecondary = '', confirmLabel = 'Save', onCancel, onSubmit }: PromptProps) {
  const [value, setValue] = useState(initialValue);
  const [secondary, setSecondary] = useState(initialSecondary);
  return (
    <Sheet
      visible={visible}
      onClose={onCancel}
      title={title}
      footer={<Button label={confirmLabel} onPress={() => onSubmit(value, secondary)} disabled={value.trim().length === 0} />}
    >
      <Field label={label} value={value} onChangeText={setValue} autoFocus returnKeyType="done" maxLength={60} />
      {secondaryLabel ? <Field label={secondaryLabel} value={secondary} onChangeText={setSecondary} multiline maxLength={240} /> : null}
    </Sheet>
  );
}
