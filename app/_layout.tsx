import { Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { colors, fonts } from '../constants/theme';
import { supabase } from '../lib/subapase';
import { setupNotifications } from '../lib/notifications';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Root layout — a Stack navigator that wraps everything
// The tabs group sits inside it, and detail screens slide on top
export default function RootLayout() {
  // undefined = session not resolved yet, null = signed out, Session = signed in.
  // Keeping "not resolved yet" distinct from "signed out" is what lets us
  // show a loading state instead of flashing the login screen on startup.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Separate from the auth-tracking effect above so notification setup
  // stays independent of session-state bookkeeping. Only runs once a
  // session actually exists (not on the signed-out or not-yet-resolved
  // states), since there's nothing to remind a signed-out user about.
  useEffect(() => {
    if (session) {
      setupNotifications();
    }
  }, [session]);

  if (session === undefined) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.ink} size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack>
        {/* Signed in — the tabs group and anything it can navigate to */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="course/[id]"
            options={{
              title: 'Course Detail',
              headerStyle: { backgroundColor: colors.ink },
              headerTintColor: colors.paper,
              headerTitleStyle: { fontFamily: fonts.display, fontWeight: '400' as const },
            }}
          />
        </Stack.Protected>

        {/* Signed out — login/signup */}
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      {Platform.OS === 'web' && <SpeedInsights />}
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
