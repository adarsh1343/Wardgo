import { useState } from 'react';
import { TextInput, type TextInputProps, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { borders, fonts, radii } from '../theme/tokens';
import { AppText } from './AppText';

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
}

export function Field({ label, hint, style, multiline, onFocus, onBlur, ...rest }: FieldProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <AppText variant="bodyStrong">{label}</AppText>
      <TextInput
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={colors.textMuted}
        multiline={multiline}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        maxFontSizeMultiplier={2}
        style={[
          {
            minHeight: multiline ? 96 : 48,
            paddingHorizontal: 14,
            paddingVertical: multiline ? 12 : 10,
            borderWidth: focused ? borders.bold + 0.5 : borders.bold,
            borderColor: focused ? colors.primary : colors.border,
            borderRadius: radii.sharp,
            backgroundColor: colors.surface,
            color: colors.text,
            fontFamily: fonts.body,
            fontSize: 16,
            textAlignVertical: multiline ? 'top' : 'center',
          },
          style,
        ]}
        {...rest}
      />
      {hint ? (
        <AppText variant="caption" muted>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

/** Search input with pixel magnifier. */
export function SearchField(props: TextInputProps & { label?: string }) {
  const { colors } = useTheme();
  return (
    <TextInput
      accessibilityLabel={props.label ?? 'Search'}
      placeholderTextColor={colors.textMuted}
      clearButtonMode="while-editing"
      returnKeyType="search"
      maxFontSizeMultiplier={2}
      {...props}
      style={[
        {
          minHeight: 46,
          paddingHorizontal: 14,
          borderWidth: borders.bold,
          borderColor: colors.border,
          borderRadius: radii.pill,
          backgroundColor: colors.surface,
          color: colors.text,
          fontFamily: fonts.body,
          fontSize: 16,
        },
        props.style,
      ]}
    />
  );
}
