import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Per-device "Show work shifts" toggle for the Assignments calendar. Saved
// the same way ThemeContext saves the theme. Only one screen uses it, so it's
// a plain hook rather than a context.

const STORAGE_KEY = 'showWorkShifts';

// Same guard as ThemeContext / lib/supabase.ts: no `window` during Expo
// Router's Node pre-render, and AsyncStorage's web build would crash on it
// (CLAUDE.md gotcha #5).
const isServerRender = Platform.OS === 'web' && typeof window === 'undefined';

export function useShowWorkShifts(): [boolean, (show: boolean) => void] {
  const [show, setShowState] = useState(true); // default: on

  // Load the saved choice once. Anything unexpected (or an error) keeps the
  // default of "on".
  useEffect(() => {
    if (isServerRender) return;
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'false') setShowState(false);
      } catch (e) {
        console.warn('Could not load work-shift preference:', e);
      }
    })();
  }, []);

  function setShow(next: boolean) {
    setShowState(next);
    // Fire-and-forget, like the theme: if saving fails, the choice still
    // applies for this session; it just won't survive a restart.
    AsyncStorage.setItem(STORAGE_KEY, String(next)).catch(e =>
      console.warn('Could not save work-shift preference:', e),
    );
  }

  return [show, setShow];
}
