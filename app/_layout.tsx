// Navigation themes come from expo-router itself — as of SDK 56, importing
// @react-navigation/native directly fails the build.
import {
  Stack,
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
} from 'expo-router';
import { View, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { fonts, type ThemeColors } from '../constants/theme';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { supabase } from '../lib/supabase';
import { setupNotifications, scheduleAssignmentReminders } from '../lib/notifications';
import { seedDemoData } from '../lib/demo';
import { getAssignments, getCourses } from '../storage/storage';
import { notify } from '../utils/alerts';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { SpeedInsights } from '@vercel/speed-insights/react';

// Root layout — only provides the app theme. The actual navigator lives in
// RootNavigator below, because it needs useTheme(), which only works
// *inside* the provider.
export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNavigator />
    </ThemeProvider>
  );
}

// A Stack navigator that wraps everything
// The tabs group sits inside it, and detail screens slide on top
function RootNavigator() {
  const { colors, scheme, ready } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  // React Navigation's own theme controls the background shown behind and
  // between screens (default is a light grey). Light keeps every default
  // except the background; dark maps our palette so nothing flashes white.
  const navTheme = useMemo(
    () =>
      scheme === 'dark'
        ? {
            ...DarkTheme,
            colors: {
              ...DarkTheme.colors,
              background: colors.paper,
              card: colors.card,
              text: colors.text,
              border: colors.border,
            },
          }
        : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.paper } },
    [scheme, colors],
  );

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

  // Demo mode: an anonymous user ("Try the demo") whose sample data hasn't
  // been created yet. Derived from the session on every render — once
  // seedDemoData sets demo_seeded, its updateUser call fires the auth
  // listener above with the updated user and this flips to false.
  const needsDemoSeed =
    !!session?.user.is_anonymous && !session.user.user_metadata?.demo_seeded;
  const demoUserId = needsDemoSeed ? session?.user.id : undefined;

  // Which user id seeding has already started for, so a re-render (or the
  // session object changing for the same user) can't seed twice.
  const seededFor = useRef<string | null>(null);

  useEffect(() => {
    if (!demoUserId || seededFor.current === demoUserId) return;
    seededFor.current = demoUserId;
    seedDemoData(demoUserId).catch(e => {
      console.warn('Demo seeding failed:', e);
      notify('Demo setup failed', 'Could not load the sample data. Please try again.');
      // Back to the login screen rather than leaving an empty demo account.
      supabase.auth.signOut();
    });
  }, [demoUserId]);

  // Separate from the auth-tracking effect above so notification setup
  // stays independent of session-state bookkeeping. Only runs once a
  // session actually exists (not on the signed-out or not-yet-resolved
  // states), since there's nothing to remind a signed-out user about.
  // After setup, it also sweeps every incomplete assignment and reschedules
  // its reminders (see the self-heal comment below). Skipped entirely on web,
  // where notifications are a deliberate no-op (CLAUDE.md gotcha #10) — this
  // avoids two pointless Supabase queries on every web page load. Also waits
  // while demo data is being seeded; it re-runs once seeding updates the
  // session, which is how the bulk-inserted demo assignments get reminders.
  useEffect(() => {
    if (!session || needsDemoSeed || Platform.OS === 'web') return;
    (async () => {
      try {
        await setupNotifications();

        const [assignments, courses] = await Promise.all([
          getAssignments(),
          getCourses(),
        ]);
        const courseNameById = new Map(courses.map(c => [c.id, c.name]));

        // Self-heal: reschedule reminders for every incomplete
        // assignment. scheduleAssignmentReminders already cancels any
        // existing reminders for that assignment first and skips any
        // offset whose time has already passed, so this is safe to run
        // on every launch — it's a no-op for assignments that already
        // have correct reminders, and it recovers anything that's
        // missing (e.g. after an Expo Go reinstall wipes scheduled
        // notifications).
        //
        // Soonest-due first, scheduled ONE AT A TIME: if the total ever nears
        // iOS's 64-pending-notification cap, the most urgent assignments get
        // their reminders in first. (Promise.allSettled would start every call
        // at once, so sorting wouldn't actually control the order.) ISO
        // YYYY-MM-DD strings sort correctly with localeCompare.
        const incomplete = assignments
          .filter(a => !a.completed)
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

        for (const a of incomplete) {
          // Per-assignment try/catch so one failure doesn't stop the rest
          // (same guarantee Promise.allSettled would give).
          try {
            await scheduleAssignmentReminders(a, courseNameById.get(a.courseId));
          } catch (e) {
            console.warn(`Reminder backfill failed for "${a.title}":`, e);
          }
        }
      } catch (e) {
        // e.g. offline at launch so the Supabase fetch throws. Without this
        // catch it'd be an unhandled rejection (red LogBox in dev). Harmless
        // to skip — the sweep runs again on the next launch.
        console.warn('Reminder backfill skipped:', e);
      }
    })();
  }, [session, needsDemoSeed]);

  // Also wait for the saved theme choice, so a saved "Dark" never flashes
  // light, and for demo seeding, so the tabs never mount on an empty account.
  if (session === undefined || !ready || needsDemoSeed) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.text} size="large" />
      </View>
    );
  }

  return (
    <NavigationThemeProvider value={navTheme}>
      {/* Light status-bar text on the dark theme, dark text on light */}
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack>
        {/* Signed in — the tabs group and anything it can navigate to */}
        <Stack.Protected guard={!!session}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="course/[id]"
            options={{
              title: 'Course Detail',
              headerStyle: { backgroundColor: colors.headerBg },
              headerTintColor: colors.headerText,
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
    </NavigationThemeProvider>
  );
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.paper,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
