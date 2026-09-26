import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { colors, fonts } from '../../constants/theme';
// TEMP DEBUG [tabbar-debug] — imports below are only for the diagnostic log.
import { useEffect } from 'react';
import { PixelRatio, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function Layout() {
  // TEMP DEBUG [tabbar-debug] — remove once tab bar clipping is diagnosed.
  // The tab bar library already pads by insets.bottom by default, so this
  // checks whether the inset is actually being reported on the affected
  // phone (bottom=0 would explain clipping) and whether a large system font
  // scale is making labels taller than the bar's fixed 49px.
  const insets = useSafeAreaInsets();
  useEffect(() => {
    console.log(
      `[tabbar-debug] platform=${Platform.OS} insets top=${insets.top} bottom=${insets.bottom} left=${insets.left} right=${insets.right} fontScale=${PixelRatio.getFontScale()}`,
    );
  }, [insets.top, insets.bottom, insets.left, insets.right]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.ink,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card },
        headerStyle: { backgroundColor: colors.ink },
        headerTintColor: colors.paper,
        headerTitleStyle: { fontFamily: fonts.display, fontWeight: '400' as const },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="courses"
        options={{
          title: 'Courses',
          tabBarLabel: 'Courses',
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="book-open" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="assignments"
        options={{
          title: 'Assignments',
          tabBarLabel: 'Assignments',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="assignment" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="grades"
        options={{
          title: 'Grades',
          tabBarLabel: 'Grades',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="grade" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}