// Design tokens for the Memphis × pixel-art system.
//
// Roles, not raw colors, are used in components:
//   primary   (cobalt)  — main actions, active tab, focus
//   secondary (coral)   — favorites, playful highlights, destructive-adjacent accents
//   highlight (mustard) — locks, "new"/status badges, sun
//   mint                — success, saved states
//   lilac / sky / pink  — quiet pastel surfaces behind decoration
// Dark mode is its own palette (deep aubergine, cream ink, neon-ish accents)
// rather than an inversion.

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceAlt: string;
  sunk: string;
  text: string;
  textMuted: string;
  border: string;
  shadow: string;
  primary: string;
  onPrimary: string;
  secondary: string;
  onSecondary: string;
  highlight: string;
  onHighlight: string;
  mint: string;
  onMint: string;
  lilac: string;
  sky: string;
  pink: string;
  danger: string;
  onDanger: string;
  overlay: string;
  photoBg: string;
}

export const lightColors: ThemeColors = {
  bg: '#FFF4E0',
  surface: '#FFFDF7',
  surfaceAlt: '#FCEBCB',
  sunk: '#F3E3C6',
  text: '#1B1A1F',
  textMuted: '#58524C',
  border: '#1B1A1F',
  shadow: '#1B1A1F',
  primary: '#2347E8',
  onPrimary: '#FFFFFF',
  secondary: '#FF5A7A',
  onSecondary: '#1B1A1F',
  highlight: '#F6B91A',
  onHighlight: '#1B1A1F',
  mint: '#3DD6B5',
  onMint: '#1B1A1F',
  lilac: '#D5C8FF',
  sky: '#C4E2FF',
  pink: '#FFD0DC',
  danger: '#C8283F',
  onDanger: '#FFFFFF',
  overlay: 'rgba(27,26,31,0.55)',
  photoBg: '#FFFFFF',
};

export const darkColors: ThemeColors = {
  bg: '#17141F',
  surface: '#221E2D',
  surfaceAlt: '#2D2840',
  sunk: '#110E17',
  text: '#FFF4E0',
  textMuted: '#C9C0B3',
  border: '#F2E6CF',
  shadow: '#5B4BDB',
  primary: '#7A93FF',
  onPrimary: '#0E0B16',
  secondary: '#FF7A94',
  onSecondary: '#0E0B16',
  highlight: '#FFC94A',
  onHighlight: '#0E0B16',
  mint: '#58E6C8',
  onMint: '#0E0B16',
  lilac: '#3A3160',
  sky: '#24365A',
  pink: '#4A2638',
  danger: '#FF6B7D',
  onDanger: '#0E0B16',
  overlay: 'rgba(0,0,0,0.65)',
  photoBg: '#F7F3EA',
};

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;

/**
 * Corner vocabulary. Memphis likes contrast between sharp and round, so
 * components pick a shape intentionally instead of rounding everything.
 */
export const radii = {
  sharp: 4,
  soft: 14,
  pill: 999,
  /** Asymmetric "ticket" corners: big on one diagonal, sharp on the other. */
  ticket: { borderTopLeftRadius: 18, borderBottomRightRadius: 18, borderTopRightRadius: 4, borderBottomLeftRadius: 4 },
  ticketAlt: { borderTopLeftRadius: 4, borderBottomRightRadius: 4, borderTopRightRadius: 18, borderBottomLeftRadius: 18 },
} as const;

export const borders = { hairline: 1, thin: 1.5, bold: 2.5 } as const;

/** Hard, unblurred offset shadows — like a print misregistration or a sticker. */
export function offsetShadow(color: string, distance = 4): string {
  return `${distance}px ${distance}px 0px ${color}`;
}

export const fonts = {
  display: 'ArchivoBlack_400Regular',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
  pixel: 'Silkscreen_400Regular',
} as const;

export const touchTarget = 44;
