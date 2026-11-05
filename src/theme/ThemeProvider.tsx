import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import { darkColors, lightColors, type ThemeColors } from './tokens';

export interface Theme {
  colors: ThemeColors;
  dark: boolean;
  reduceMotion: boolean;
}

const ThemeContext = createContext<Theme>({ colors: lightColors, dark: false, reduceMotion: false });

export function ThemeProvider({ mode, children }: { mode: 'system' | 'light' | 'dark'; children: ReactNode }) {
  const scheme = useColorScheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => mounted && setReduceMotion(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const dark = mode === 'dark' || (mode === 'system' && scheme === 'dark');
  const value = useMemo<Theme>(() => ({ colors: dark ? darkColors : lightColors, dark, reduceMotion }), [dark, reduceMotion]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
