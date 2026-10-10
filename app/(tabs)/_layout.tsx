import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { AnimatedTabBar, AnimatedTabButton } from "@/components/animated-tab-bar";

import { useClayTheme } from "@/constants/clay-theme";

export default function TabsLayout() {
  const clay = useClayTheme();
  const insets = useSafeAreaInsets();

  const bottomInset = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }} edges={["top"]}>
      <Tabs
        tabBar={(props) => <AnimatedTabBar {...props} />}
        backBehavior={Platform.OS === "android" ? "firstRoute" : undefined}
        screenOptions={{
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarButton: (props) => <AnimatedTabButton {...props} />,
          tabBarLabelPosition: "below-icon",
          tabBarActiveTintColor: clay.isDark ? "#F5D298" : "#2C254E",
          tabBarInactiveTintColor: clay.textMuted,
          tabBarStyle: {
            backgroundColor: clay.card,
            borderTopColor: clay.cardBorder,
            borderTopWidth: 1,
            elevation: 8,
            height: 56 + bottomInset,
            paddingTop: 8,
            paddingBottom: bottomInset,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: "700",
            marginBottom: Platform.OS === "android" ? 2 : 0,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Groups",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "people" : "people-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="activity"
          options={{
            title: "Activity",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "flash" : "flash-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: "Account",
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? "person" : "person-outline"}
                size={22}
                color={color}
              />
            ),
          }}
        />
      </Tabs>
    </SafeAreaView>
  );
}
