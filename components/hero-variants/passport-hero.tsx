import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useClayTheme } from "@/constants/clay-theme";

type PassportHeroProps = {
  activeGroupsCount: number;
};

export function PassportHero({ activeGroupsCount }: PassportHeroProps) {
  const clay = useClayTheme();
  const formattedCount = String(activeGroupsCount).padStart(2, "0");

  return (
    <View
      style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
      className="relative overflow-hidden rounded-3xl border p-5 shadow-sm"
    >
      {/* ── Background Postal Cancellation Watermark ── */}
      <View pointerEvents="none" className="absolute -right-6 -top-6 rotate-12 opacity-10">
        <View
          style={{ borderColor: clay.heroAccent }}
          className="h-36 w-36 items-center justify-center rounded-full border-2 border-dashed p-2"
        >
          <View
            style={{ borderColor: clay.heroAccent }}
            className="h-28 w-28 items-center justify-center rounded-full border"
          >
            <Ionicons name="compass-outline" size={48} color={clay.heroAccent} />
            <Text
              style={{ color: clay.heroAccent }}
              className="mt-1 text-[8px] font-black uppercase tracking-widest"
            >
              Expedition
            </Text>
          </View>
        </View>
      </View>

      {/* ── Wavy Postal Cancel Lines (Decorative) ── */}
      <View pointerEvents="none" className="absolute right-24 top-6 gap-1 opacity-15">
        <View style={{ backgroundColor: clay.heroAccent }} className="h-0.5 w-16 rounded-full" />
        <View style={{ backgroundColor: clay.heroAccent }} className="h-0.5 w-20 rounded-full" />
        <View style={{ backgroundColor: clay.heroAccent }} className="h-0.5 w-14 rounded-full" />
      </View>

      {/* ── Header Row: Passport Stamp + Status Seal ── */}
      <View className="flex-row items-start justify-between">
        <View className="gap-1">
          <View className="flex-row items-center gap-1.5">
            <Ionicons name="airplane" size={12} color={clay.heroAccent} />
            <Text
              style={{ color: clay.heroAccent }}
              className="text-[10px] font-black uppercase tracking-widest"
            >
              Voyage Log · Passport
            </Text>
          </View>
          <Text
            style={{ color: clay.textPrimary }}
            className="text-2xl font-black tracking-tight"
          >
            Tripwise
          </Text>
          <Text style={{ color: clay.textMuted }} className="text-xs font-medium">
            Explore together, split fairly
          </Text>
        </View>

        {/* ── Glowing Neon Status Stamp ── */}
        <View
          style={{
            backgroundColor: clay.isDark ? "rgba(245, 210, 152, 0.12)" : "rgba(154, 107, 28, 0.1)",
            borderColor: clay.isDark ? "#F5D298" : "#9A6B1C",
          }}
          className="items-center rounded-xl border border-dashed px-3 py-1.5"
        >
          <Text
            style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }}
            className="text-xl font-black leading-none"
          >
            {formattedCount}
          </Text>
          <Text
            style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }}
            className="mt-0.5 text-[9px] font-black uppercase tracking-wider"
          >
            Active Trips
          </Text>
        </View>
      </View>

      {/* ── Perforated Divider ── */}
      <View className="my-4 flex-row items-center gap-2">
        <View
          style={{ borderColor: clay.cardBorder }}
          className="flex-1 border-t border-dashed"
        />
        <Text style={{ color: clay.textMuted }} className="text-[9px] font-bold uppercase tracking-widest">
          Quick Boarding
        </Text>
        <View
          style={{ borderColor: clay.cardBorder }}
          className="flex-1 border-t border-dashed"
        />
      </View>

      {/* ── Quick Action Row ── */}
      <View className="flex-row items-center gap-3">
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
          style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
          className="h-12 flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-4 active:opacity-75"
        >
          <Ionicons name="ticket-outline" size={18} color={clay.textPrimary} />
          <Text style={{ color: clay.textPrimary }} className="text-sm font-bold">
            Join Code
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
