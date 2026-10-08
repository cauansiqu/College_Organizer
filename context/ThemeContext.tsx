import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors, type Scheme, type ThemeColors } from '../constants/theme';

// The user's choice. 'system' follows the device's light/dark setting.
export type ThemeMode = 'system' | 'light' | 'dark';

type ThemeContextValue = {
  colors: ThemeColors;   // the active palette
  scheme: Scheme;        // what's actually showing (mode with 'system' resolved)
  mode: ThemeMode;       // what the user picked
  setMode: (mode: ThemeMode) => void;
  ready: boolean;        // false until the saved choice has been loaded
};

const STORAGE_KEY = 'themeMode';

// Same guard as lib/subapase.ts: during Expo Router's Node pre-render there's
// no `window`, and AsyncStorage's web implementation would crash touching
// window.localStorage (CLAUDE.md gotcha #5).
const isServerRender = Platform.OS === 'web' && typeof window === 'undefined';

function isThemeMode(value: unknown): value is ThemeMode {
  return value === 'system' || value === 'light' || value === 'dark';
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system');
  // On the server pre-render there's nothing to load, so start out ready.
  const [ready, setReady] = useState(isServerRender);
  const systemScheme = useColorScheme();

  // Load the saved choice once. `ready` is set in `finally` so a storage
  // error or junk value can never leave the app stuck on the loading spinner —
  // it just falls back to 'system'.
  useEffect(() => {
    if (isServerRender) return;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        setModeState(isThemeMode(saved) ? saved : 'system');
      } catch (e) {
        console.warn('Could not load theme preference:', e);
        setModeState('system');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Native only: tell the OS-level UI (Android date dialog, alerts) to follow
  // a manual Light/Dark choice. react-native-web has no setColorScheme, so
  // calling it on web would crash. 'unspecified' = go back to the system setting.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
  }, [mode]);

  const scheme: Scheme =
    mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;
  // Palettes are module-level constants, so this reference only changes when
  // the theme actually flips — screens' useMemo(makeStyles) relies on that.
  const colors = scheme === 'dark' ? darkColors : lightColors;

  // Web: paint the page root to match, so overscroll areas and the space
  // behind the app don't show a bright white background in dark mode.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = colors.paper;
    document.documentElement.style.colorScheme = scheme;
  }, [colors, scheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors,
      scheme,
      mode,
      ready,
      setMode: (next: ThemeMode) => {
        setModeState(next);
        // Fire-and-forget: if saving fails, the choice still applies for
        // this session; it just won't survive a restart.
        AsyncStorage.setItem(STORAGE_KEY, next).catch(e =>
          console.warn('Could not save theme preference:', e),
        );
      },
    }),
    [colors, scheme, mode, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme() must be used inside <ThemeProvider>');
  return ctx;
}
