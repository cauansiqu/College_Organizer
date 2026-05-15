import { Stack } from 'expo-router';

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
          headerStyle: { backgroundColor: '#4A90E2' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      />
    </Stack>
  );
}