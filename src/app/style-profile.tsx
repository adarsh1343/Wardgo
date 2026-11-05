import { AppText } from '../components/AppText';
import { Chip, ChipRow } from '../components/Chip';
import { PipMeter } from '../components/Feedback';
import { Screen, SectionTitle } from '../components/Screen';
import { Sticker } from '../components/Sticker';
import { COLORS, OCCASIONS, STYLE_TAGS } from '../engine/catalog';
import { useApp } from '../features/app/AppState';
import type { Occasion } from '../types/models';

export default function StyleProfileScreen() {
  const { prefs, updatePrefs } = useApp();
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <Screen topInset={false}>
      <AppText variant="small" muted>
        These shape the local scoring. Avoided styles and colors are strongly penalised; preferred ones get a boost.
      </AppText>

      <Sticker style={{ gap: 12 }}>
        <SectionTitle title="Styles you love" />
        <ChipRow>
          {STYLE_TAGS.map((s) => (
            <Chip
              key={s}
              label={s}
              selected={prefs.preferredStyles.includes(s)}
              onPress={() => updatePrefs({ preferredStyles: toggle(prefs.preferredStyles, s), avoidStyles: prefs.avoidStyles.filter((x) => x !== s) })}
            />
          ))}
        </ChipRow>
        <SectionTitle title="Styles to avoid" />
        <ChipRow>
          {STYLE_TAGS.map((s) => (
            <Chip
              key={s}
              label={s}
              tone="secondary"
              selected={prefs.avoidStyles.includes(s)}
              onPress={() => updatePrefs({ avoidStyles: toggle(prefs.avoidStyles, s), preferredStyles: prefs.preferredStyles.filter((x) => x !== s) })}
            />
          ))}
        </ChipRow>
      </Sticker>

      <Sticker style={{ gap: 12 }} shape="ticketAlt">
        <SectionTitle title="Colors you love" />
        <ChipRow>
          {COLORS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              swatch={c.hex}
              selected={prefs.preferredColors.includes(c.key)}
              onPress={() => updatePrefs({ preferredColors: toggle(prefs.preferredColors, c.key), avoidColors: prefs.avoidColors.filter((x) => x !== c.key) })}
            />
          ))}
        </ChipRow>
        <SectionTitle title="Colors to avoid" />
        <ChipRow>
          {COLORS.map((c) => (
            <Chip
              key={c.key}
              label={c.label}
              swatch={c.hex}
              tone="secondary"
              selected={prefs.avoidColors.includes(c.key)}
              onPress={() => updatePrefs({ avoidColors: toggle(prefs.avoidColors, c.key), preferredColors: prefs.preferredColors.filter((x) => x !== c.key) })}
            />
          ))}
        </ChipRow>
      </Sticker>

      <Sticker style={{ gap: 12 }}>
        <SectionTitle title="Occasions" />
        <AppText variant="bodyStrong">Default for Today</AppText>
        <ChipRow>
          {OCCASIONS.map((o) => (
            <Chip key={o.key} label={o.label} selected={prefs.defaultOccasion === o.key} onPress={() => updatePrefs({ defaultOccasion: o.key })} tone="highlight" />
          ))}
        </ChipRow>
        <AppText variant="bodyStrong">Typical week</AppText>
        <ChipRow>
          {OCCASIONS.map((o) => (
            <Chip
              key={o.key}
              label={o.label}
              selected={prefs.typicalOccasions.includes(o.key)}
              onPress={() => updatePrefs({ typicalOccasions: toggle<Occasion>(prefs.typicalOccasions, o.key) })}
              tone="mint"
            />
          ))}
        </ChipRow>
      </Sticker>

      <Sticker style={{ gap: 12 }} shape="ticket">
        <SectionTitle title="Comfort" />
        <AppText variant="bodyStrong">Temperature comfort</AppText>
        <ChipRow>
          <Chip label="I run cold" selected={prefs.temperatureComfort === -1} onPress={() => updatePrefs({ temperatureComfort: -1 })} />
          <Chip label="Average" selected={prefs.temperatureComfort === 0} onPress={() => updatePrefs({ temperatureComfort: 0 })} />
          <Chip label="I run hot" selected={prefs.temperatureComfort === 1} onPress={() => updatePrefs({ temperatureComfort: 1 })} />
        </ChipRow>
        <PipMeter
          label="Accessories per outfit (max)"
          value={Math.max(1, prefs.maxAccessories)}
          valueLabel={prefs.maxAccessories === 0 ? 'none' : undefined}
          onChange={(v) => updatePrefs({ maxAccessories: v })}
          tone="highlight"
        />
        <Chip label="No accessories" selected={prefs.maxAccessories === 0} onPress={() => updatePrefs({ maxAccessories: prefs.maxAccessories === 0 ? 2 : 0 })} />
      </Sticker>
    </Screen>
  );
}
