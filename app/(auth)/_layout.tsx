import { Stack } from 'expo-router';

// Auth group layout — just hides the stack header, same role as (tabs)/_layout.tsx.
// One screen today (the login/signup toggle), but this leaves room to add
// more auth screens (e.g. password reset) later without restructuring.
export default function AuthLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
