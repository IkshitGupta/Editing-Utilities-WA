import { Tabs } from 'expo-router';

import { Icon } from '@/components/ui/icon';
import { brand, ui } from '@/theme/colors';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: brand.blue,
        tabBarInactiveTintColor: ui.muted,
        tabBarLabelStyle: { fontSize: 13, fontWeight: '600' },
        headerTintColor: brand.navy,
        headerTitleStyle: { fontWeight: '700' },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Icon name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="media"
        options={{
          title: 'Media',
          headerTitle: 'School Admin album',
          tabBarIcon: ({ color, size }) => <Icon name="images-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Icon name="settings-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
