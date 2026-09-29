import { Ionicons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { useThemeColors } from "@/constants/theme";
import { GroupCover } from "@/components/group-cover";
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
        <GroupCover group={group} compact />

        <View className="min-w-0 flex-1 gap-2 py-1">
          <Text className="text-xl font-bold tracking-tight text-ink" numberOfLines={2}>
            {group.name}
          </Text>
          <View className="self-start rounded-full bg-canvas px-2.5 py-1">
            <Text className="text-xs font-semibold text-muted">
              {group.currency} · Shared group
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
      </Pressable>
    </Link>
  );
}
