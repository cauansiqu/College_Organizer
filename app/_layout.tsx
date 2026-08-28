import { Stack } from 'expo-router';
import { colors, fonts } from '../constants/theme';

// Root layout — a Stack navigator that wraps everything
// The tabs group sits inside it, and detail screens slide on top
export default function RootLayout() {
  return (
    <Stack>
      {/* The tabs group — hides the stack header since tabs have their own */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Course detail screen — shown when navigating to /course/[id] */}
      <Stack.Screen
        name="course/[id]"
        options={{
          title: 'Course Detail',
          headerStyle: { backgroundColor: colors.ink },
          headerTintColor: colors.paper,
          headerTitleStyle: { fontFamily: fonts.display, fontWeight: '400' as const },
        }}
      />
    </Stack>
  );
}