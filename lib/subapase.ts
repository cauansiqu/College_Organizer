import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY!

// True only when we're running the "web" bundle but there's no real
// browser window around — i.e. Expo Router's Node.js pre-render pass.
// On native (iOS/Android), Platform.OS is never 'web', so this is
// always false there and AsyncStorage is used completely normally.
const isServerRender = Platform.OS === 'web' && typeof window === 'undefined';

// AsyncStorage's own web implementation reaches directly for
// `window.localStorage` with no safety check at all. That's fine in an
// actual browser, but crashes instantly during Expo Router's Node-side
// pre-render step, where `window` doesn't exist yet. This wrapper just
// no-ops during that specific moment instead of crashing.
const ssrSafeStorage = {
  getItem: (key: string) => {
    if (isServerRender) return Promise.resolve(null);
    return AsyncStorage.getItem(key);
  },
  setItem: (key: string, value: string) => {
    if (isServerRender) return Promise.resolve();
    return AsyncStorage.setItem(key, value);
  },
  removeItem: (key: string) => {
    if (isServerRender) return Promise.resolve();
    return AsyncStorage.removeItem(key);
  },
};

export const supabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      storage: ssrSafeStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
)