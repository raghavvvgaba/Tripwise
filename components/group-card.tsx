import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import type { SharedGroup } from "@/types/shared-group";

type GroupCardProps = {
  group: SharedGroup;
};

export function GroupCard({ group }: GroupCardProps) {
  return (
    <Link href={`/groups/${group.id}`} asChild>
      <Pressable className="card flex-row items-center justify-between gap-4 p-4 active:bg-canvas">
        <View className="flex-1 gap-1">
          <Text className="text-lg font-bold text-ink" numberOfLines={1}>
            {group.name}
          </Text>
          <Text className="text-sm text-muted">
            {group.currency} · {group.archivedAt ? "Archived" : "Active"}
          </Text>
        </View>
        <Text className="text-xl text-muted">›</Text>
      </Pressable>
    </Link>
  );
}
