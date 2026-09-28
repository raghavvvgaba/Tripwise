import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useThemeColors } from "@/constants/theme";
import type { SharedGroup } from "@/types/shared-group";

type GroupCardProps = {
  group: SharedGroup;
};

export function GroupCard({ group }: GroupCardProps) {
  const colors = useThemeColors();

  return (
    <Link href={`/groups/${group.id}`} asChild>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${group.name} group, ${group.currency}`}
        className="card min-h-32 flex-row items-center gap-4 overflow-hidden p-3 active:bg-canvas"
      >
        <View className="h-28 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#FB6B21]">
          <View className="absolute -left-12 -top-10 h-24 w-40 rotate-[28deg] bg-[#FFB292]" />
          <View className="absolute -bottom-12 -left-12 h-20 w-40 -rotate-[28deg] bg-[#FF9B72]" />
          <Ionicons name="airplane-outline" size={43} color="#FFFFFF" />
        </View>

        <View className="min-w-0 flex-1 gap-2 py-1">
          <Text className="text-xl font-bold tracking-tight text-ink" numberOfLines={2}>
            {group.name}
          </Text>
          <View className="self-start rounded-full bg-canvas px-2.5 py-1">
            <Text className="text-xs font-semibold text-muted">
              {group.archivedAt ? `Archived · ${group.currency}` : `${group.currency} · Shared group`}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </Link>
  );
}
