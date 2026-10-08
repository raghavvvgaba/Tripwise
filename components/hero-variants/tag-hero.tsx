import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useClayTheme } from "@/constants/clay-theme";

type BaggageTagHeroProps = {
  activeGroupsCount: number;
};

export function BaggageTagHero({ activeGroupsCount }: BaggageTagHeroProps) {
  const clay = useClayTheme();
  const formattedCount = String(activeGroupsCount).padStart(2, "0");

  return (
    <View
      style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
      className="relative overflow-hidden rounded-3xl border shadow-sm"
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
      <View pointerEvents="none" className="absolute right-28 top-5 gap-1 opacity-15">
        <View style={{ backgroundColor: clay.heroAccent }} className="h-0.5 w-16 rounded-full" />
        <View style={{ backgroundColor: clay.heroAccent }} className="h-0.5 w-20 rounded-full" />
        <View style={{ backgroundColor: clay.heroAccent }} className="h-0.5 w-14 rounded-full" />
      </View>

      <View className="flex-row">
        {/* ── Left Luggage Tag Eyelet Strip ── */}
        <View
          style={{ backgroundColor: clay.isDark ? "#1C1832" : "#DDD7ED" }}
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
                backgroundColor: clay.isDark ? "#282142" : "#D4CCE2",
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
          {/* Metadata Top Bar */}
          <View className="flex-row items-center justify-between">
            <Text
              style={{ color: clay.textMuted }}
              className="text-[10px] font-black uppercase tracking-wider"
            >
              LOG 02 · EXPEDITION
            </Text>
            <Text
              style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }}
              className="text-[10px] font-black uppercase tracking-wider"
            >
              VERIFIED
            </Text>
          </View>

          {/* Hero Typography & Giant Display Numeral */}
          <View className="my-2 flex-row items-center justify-between">
            <View className="gap-0.5">
              <Text
                style={{ color: clay.textPrimary }}
                className="text-2xl font-black tracking-tight"
              >
                Tripwise
              </Text>
              <Text style={{ color: clay.textMuted }} className="text-xs font-semibold">
                Baggage & Split Ledger
              </Text>

              {/* Tilted Stamp Badge */}
              <View
                style={{
                  borderColor: clay.isDark ? "rgba(245, 210, 152, 0.4)" : "rgba(154, 107, 28, 0.4)",
                  backgroundColor: clay.isDark ? "rgba(245, 210, 152, 0.08)" : "rgba(154, 107, 28, 0.08)",
                }}
                className="mt-2 -rotate-3 self-start rounded-md border border-dashed px-2 py-0.5"
              >
                <Text
                  style={{ color: clay.isDark ? "#F5D298" : "#9A6B1C" }}
                  className="text-[9px] font-black uppercase tracking-wider"
                >
                  ✓ APPROVED // TW
                </Text>
              </View>
            </View>

            {/* Oversized Foil Number */}
            <View className="items-end">
              <Text
                style={{
                  color: clay.isDark ? "#F5D298" : "#9A6B1C",
                  lineHeight: 56,
                }}
                className="text-6xl font-black tracking-tighter"
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
                Join PIN
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </View>
  );
}
