import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useClayTheme } from "@/constants/clay-theme";

type AuroraHeroProps = {
  activeGroupsCount: number;
};

export function AuroraHero({ activeGroupsCount }: AuroraHeroProps) {
  const clay = useClayTheme();

  return (
    <View
      style={{
        backgroundColor: clay.isDark ? "rgba(38, 34, 67, 0.85)" : "rgba(255, 255, 255, 0.9)",
        borderColor: clay.isDark ? "rgba(245, 210, 152, 0.25)" : "rgba(154, 107, 28, 0.2)",
      }}
      className="relative overflow-hidden rounded-3xl border p-6 shadow-lg"
    >
      {/* ── Molten Liquid Glow Orbs (Layered Background) ── */}
      <View
        pointerEvents="none"
        style={{
          backgroundColor: clay.isDark ? "#F59E0B" : "#F5D298",
          opacity: clay.isDark ? 0.22 : 0.35,
          position: "absolute",
          top: -20,
          right: -20,
          width: 140,
          height: 140,
          borderRadius: 70,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          backgroundColor: clay.isDark ? "#EC4899" : "#C084FC",
          opacity: clay.isDark ? 0.12 : 0.15,
          position: "absolute",
          bottom: -30,
          left: 10,
          width: 120,
          height: 120,
          borderRadius: 60,
        }}
      />

      {/* ── Floating Pill Badge ── */}
      <View className="flex-row items-center justify-between">
        <View
          style={{
            backgroundColor: clay.isDark ? "rgba(0, 0, 0, 0.35)" : "rgba(44, 37, 78, 0.08)",
            borderColor: clay.isDark ? "rgba(245, 210, 152, 0.3)" : "rgba(154, 107, 28, 0.25)",
          }}
          className="flex-row items-center gap-2 rounded-full border px-3 py-1"
        >
          <View className="h-2 w-2 rounded-full bg-amber-400" />
          <Text
            style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }}
            className="text-xs font-black tracking-wider"
          >
            {activeGroupsCount} {activeGroupsCount === 1 ? "ACTIVE TRIP" : "ACTIVE TRIPS"}
          </Text>
        </View>

        <Ionicons
          name="sparkles"
          size={16}
          color={clay.isDark ? "#F5D298" : "#9A6B1C"}
          style={{ opacity: 0.8 }}
        />
      </View>

      {/* ── Luminous Typography ── */}
      <View className="my-4 gap-1">
        <Text
          style={{ color: clay.textPrimary }}
          className="text-3xl font-black italic tracking-tight"
        >
          Tripwise
        </Text>
        <Text style={{ color: clay.textMuted }} className="text-xs font-semibold">
          Seamless splits under liquid light
        </Text>
      </View>

      {/* ── Action Buttons ── */}
      <View className="mt-2 flex-row items-center gap-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create group"
          onPress={() => router.push("/groups/create")}
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#F5D298] px-4 shadow-sm active:opacity-75"
        >
          <Ionicons name="add" size={20} color={clay.heroText} />
          <Text style={{ color: clay.heroText }} className="text-sm font-extrabold">
            New Trip
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Join group"
          onPress={() => router.push("/join")}
          style={{
            backgroundColor: clay.isDark ? "rgba(255, 255, 255, 0.07)" : "rgba(44, 37, 78, 0.06)",
            borderColor: clay.isDark ? "rgba(255, 255, 255, 0.15)" : "rgba(44, 37, 78, 0.12)",
          }}
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-4 active:opacity-75"
        >
          <Ionicons name="enter-outline" size={18} color={clay.textPrimary} />
          <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
            Join Group
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
