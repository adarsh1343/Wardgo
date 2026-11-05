import { Tabs } from 'expo-router/js-tabs';
import { MemphisTabBar } from '../../components/TabBar';
import { useTheme } from '../../theme/ThemeProvider';

export default function TabLayout() {
  const { colors, reduceMotion } = useTheme();
  return (
    <Tabs
      tabBar={(props) => <MemphisTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // A brief sideways "shift" between tabs; disabled with Reduce Motion.
        animation: reduceMotion ? 'none' : 'shift',
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="wardrobe" options={{ title: 'Wardrobe' }} />
      <Tabs.Screen name="outfits" options={{ title: 'Outfits' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
