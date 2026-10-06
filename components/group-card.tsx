import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useClayTheme } from "@/constants/clay-theme";
import { GroupCover } from "@/components/group-cover";
import type { SharedGroup } from "@/types/shared-group";

type GroupCardProps = {
  group: SharedGroup;
};

export function GroupCard({ group }: GroupCardProps) {
  const clay = useClayTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open ${group.name} group, ${group.currency}`}
      onPress={() => router.push(`/groups/${group.id}`)}
      style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
      className="min-h-32 flex-row items-center gap-4 overflow-hidden rounded-3xl border p-3.5 shadow-sm active:opacity-75"
    >
      <GroupCover group={group} compact />

      <View className="min-w-0 flex-1 gap-2 py-1">
        <Text
          style={{ color: clay.textPrimary }}
          className="text-lg font-black tracking-tight"
          numberOfLines={2}
        >
          {group.name}
        </Text>
        <View
          style={{ backgroundColor: clay.badgeNeutralBg }}
          className="self-start rounded-full px-2.5 py-1"
        >
          <Text style={{ color: clay.textMuted }} className="text-xs font-bold">
            {group.currency} · Shared group
          </Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={clay.textMuted} />
    </Pressable>
  );
}
