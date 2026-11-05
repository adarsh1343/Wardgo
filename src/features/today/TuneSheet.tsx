import { useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button } from '../../components/Button';
import { Sheet } from '../../components/Sheet';
import { type Adjustments, NEUTRAL_ADJUSTMENTS } from '../../engine/scoring';
import { useTheme } from '../../theme/ThemeProvider';
import { borders, radii } from '../../theme/tokens';

type Dial = 'formality' | 'colorful' | 'warmth' | 'adventurous';
const DIALS: { key: Dial; left: string; right: string }[] = [
  { key: 'formality', left: 'More casual', right: 'More formal' },
  { key: 'colorful', left: 'More neutral', right: 'More colorful' },
  { key: 'warmth', left: 'Lighter', right: 'Warmer' },
  { key: 'adventurous', left: 'Conservative', right: 'Adventurous' },
];

/** Three-way segmented dial: left / balanced / right. */
function Segmented({ value, onChange, left, right }: { value: -1 | 0 | 1; onChange: (v: -1 | 0 | 1) => void; left: string; right: string }) {
  const { colors } = useTheme();
  const opts: { v: -1 | 0 | 1; label: string }[] = [
    { v: -1, label: left },
    { v: 0, label: 'Balanced' },
    { v: 1, label: right },
  ];
  return (
    <View style={{ flexDirection: 'row', borderWidth: borders.bold, borderColor: colors.border, borderRadius: radii.sharp, overflow: 'hidden' }} accessibilityRole="radiogroup">
      {opts.map((o, i) => {
        const selected = value === o.v;
        return (
          <Pressable
            key={o.v}
            onPress={() => onChange(o.v)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: 4,
              backgroundColor: selected ? colors.primary : colors.surface,
              borderLeftWidth: i === 0 ? 0 : borders.thin,
              borderColor: colors.border,
            }}
          >
            <AppText variant="caption" center color={selected ? colors.onPrimary : colors.text} style={selected ? { fontFamily: 'DMSans_700Bold' } : undefined}>
              {selected ? '● ' : ''}
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

interface TuneSheetProps {
  visible: boolean;
  value: Adjustments;
  onClose: () => void;
  onApply: (a: Adjustments) => void;
}

/** Keyed on `visible` so each opening starts from the current adjustments. */
export function TuneSheet(props: TuneSheetProps) {
  return <TuneSheetInner key={props.visible ? 'open' : 'closed'} {...props} />;
}

function TuneSheetInner({ visible, value, onClose, onApply }: TuneSheetProps) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(value);
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Tune the vibe"
      footer={
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button label="Reset" variant="ghost" onPress={() => setDraft(NEUTRAL_ADJUSTMENTS)} style={{ flex: 1 }} />
          <Button label="Apply & regenerate" icon="dice" onPress={() => onApply(draft)} style={{ flex: 2 }} />
        </View>
      }
    >
      <AppText variant="small" muted>
        These nudge the local scoring. Locked pieces always stay put.
      </AppText>
      {DIALS.map((d) => (
        <Segmented key={d.key} value={draft[d.key]} left={d.left} right={d.right} onChange={(v) => setDraft({ ...draft, [d.key]: v })} />
      ))}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Avoid recently worn</AppText>
          <AppText variant="small" muted>
            Push harder away from pieces and combinations worn in the last two weeks.
          </AppText>
        </View>
        <Switch
          value={draft.avoidRecent}
          onValueChange={(v) => setDraft({ ...draft, avoidRecent: v })}
          trackColor={{ true: colors.primary, false: colors.sunk }}
          accessibilityLabel="Avoid recently worn"
        />
      </View>
    </Sheet>
  );
}
