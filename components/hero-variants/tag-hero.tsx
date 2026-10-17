import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { ScoutFriendlySvg } from "@/components/scout-friendly-svg";
import { useClayTheme } from "@/constants/clay-theme";

type BaggageTagHeroProps = {
  activeGroupsCount: number;
};

export function BaggageTagHero({ activeGroupsCount }: BaggageTagHeroProps) {
  const clay = useClayTheme();
  const formattedCount = String(activeGroupsCount).padStart(2, "0");

  return (
    <View>
      <View className="relative z-10 flex-row items-start justify-between px-1">
        <Text style={{ color: clay.textPrimary }} className="text-3xl font-black tracking-tight">
          Tripwise
        </Text>
        <View className="absolute -top-1.5 right-6 h-16 w-28" pointerEvents="none">
          <ScoutFriendlySvg pose="peek" />
        </View>
      </View>
      <View
        style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
        className="relative mt-5 overflow-hidden rounded-3xl border shadow-sm"
      >
        <View className="flex-row">
          {/* ── Left Luggage Tag Eyelet Strip ── */}
          <View
            style={{ backgroundColor: clay.isDark ? "#120F20" : "#DDD7ED" }}
            className="w-12 items-center justify-between border-r border-dashed border-white/15 py-4"
          >
            {/* ── Brass Grommet & String Loop ── */}
            <View className="items-center">
              {/* Lanyard String */}
              <View
                style={{ backgroundColor: clay.isDark ? "#F5D298" : "#9A6B1C" }}
                className="h-2.5 w-1 rounded-full opacity-60"
              />
              {/* Outer Reinforced Brass Ring */}
              <View
                style={{
                  borderColor: clay.isDark ? "#F5D298" : "#9A6B1C",
                  backgroundColor: clay.isDark ? "#1E1A33" : "#D4CCE2",
                }}
                className="h-6 w-6 items-center justify-center rounded-full border-2"
              >
                {/* Inner Cutout Hole */}
                <View
                  style={{ backgroundColor: clay.canvas }}
                  className="h-2.5 w-2.5 rounded-full border border-black/20"
                />
              </View>
            </View>

            {/* ── Vertical Flight Code Badge ── */}
            <View
              style={{
                backgroundColor: clay.isDark ? "rgba(245, 210, 152, 0.1)" : "rgba(154, 107, 28, 0.08)",
                borderColor: clay.isDark ? "rgba(245, 210, 152, 0.25)" : "rgba(154, 107, 28, 0.2)",
              }}
              className="items-center gap-1 rounded-full border px-1.5 py-2.5"
            >
              <Ionicons name="airplane" size={11} color={clay.heroAccent} />
              <Text
                style={{ color: clay.heroAccent }}
                className="text-[9px] font-black tracking-widest leading-3"
              >
                T
              </Text>
              <Text
                style={{ color: clay.heroAccent }}
                className="text-[9px] font-black tracking-widest leading-3"
              >
                R
              </Text>
              <Text
                style={{ color: clay.heroAccent }}
                className="text-[9px] font-black tracking-widest leading-3"
              >
                P
              </Text>
            </View>

            {/* ── Authentic Mini Barcode ── */}
            <View className="flex-row items-end gap-[1.5px] opacity-70">
              <View style={{ backgroundColor: clay.textMuted }} className="h-4 w-[1px]" />
              <View style={{ backgroundColor: clay.textMuted }} className="h-5 w-[2px]" />
              <View style={{ backgroundColor: clay.textMuted }} className="h-3 w-[1px]" />
              <View style={{ backgroundColor: clay.textMuted }} className="h-5 w-[2.5px]" />
              <View style={{ backgroundColor: clay.textMuted }} className="h-4 w-[1.5px]" />
              <View style={{ backgroundColor: clay.textMuted }} className="h-5 w-[1px]" />
              <View style={{ backgroundColor: clay.textMuted }} className="h-3 w-[2px]" />
            </View>
          </View>

          {/* ── Main Tag Body ── */}
          <View className="flex-1 p-5">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 gap-1">
                <Text style={{ color: clay.textMuted }} className="text-[10px] font-black uppercase tracking-wider">
                  Your travel ledger
                </Text>
                <Text style={{ color: clay.textPrimary }} className="text-lg font-black">
                  Shared trips
                </Text>
                <Text style={{ color: clay.textMuted }} className="text-xs leading-4">
                  Split costs together.
                </Text>
              </View>

              {/* Oversized Foil Number */}
              <View className="items-end">
                <Text
                  style={{
                    color: clay.isDark ? "#F5D298" : "#9A6B1C",
                    lineHeight: 48,
                  }}
                  className="text-5xl font-black tracking-tighter"
                >
                  {formattedCount}
                </Text>
                <Text
                  style={{ color: clay.textMuted }}
                  className="-mt-1 text-[9px] font-black uppercase tracking-widest"
                >
                  Active
                </Text>
              </View>
            </View>

            {/* ── Quick Action Row ── */}
            <View className="mt-4 flex-row items-center gap-2.5">
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Start expedition"
                onPress={() => router.push("/groups/create")}
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-[#F5D298] px-3 shadow-sm active:opacity-75"
              >
                <Ionicons name="add" size={18} color={clay.heroText} />
                <Text style={{ color: clay.heroText }} className="text-xs font-black uppercase">
                  New Trip
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Join group via pin"
                onPress={() => router.push("/join")}
                style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
                className="h-11 flex-1 flex-row items-center justify-center gap-2 rounded-xl border px-3 active:opacity-75"
              >
                <Ionicons name="key-outline" size={16} color={clay.textPrimary} />
                <Text style={{ color: clay.textPrimary }} className="text-xs font-bold uppercase">
                  Join Group
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
