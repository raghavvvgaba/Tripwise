import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { MemberAvatar } from "@/components/member-avatar";
import { useGroupsStore } from "@/store/use-groups-store";
import type { Group } from "@/types/models";
import { getGroupTotal, getMemberBalances } from "@/utils/balances";
import { formatMoney } from "@/utils/money";

type GroupCardProps = {
  group: Group;
};

export function GroupCard({ group }: GroupCardProps) {
  const currentUserId = useGroupsStore((state) => state.currentUserId);
  const currentBalance = getMemberBalances(group).find(
    (balance) => balance.member.id === currentUserId,
  );
  const net = currentBalance?.net ?? 0;

  return (
    <Link href={`/groups/${group.id}`} asChild>
      <Pressable className="card gap-4 p-4 active:bg-canvas">
        <View className="flex-row items-center gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-lg font-bold text-ink" numberOfLines={1}>
              {group.name}
            </Text>
            <Text className="text-sm text-muted">
              {group.members.length} members · {formatMoney(getGroupTotal(group), group.currency)} spent
            </Text>
          </View>
          <Text className="text-xl text-muted">›</Text>
        </View>

        <View className="h-px bg-line" />

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center">
            {group.members.slice(0, 4).map((member, index) => (
              <View key={member.id} className={index === 0 ? "" : "-ml-2"}>
                <MemberAvatar member={member} size="sm" />
              </View>
            ))}
          </View>
          <View className="items-end gap-0.5">
            <Text className="text-xs text-muted">Your balance</Text>
            <Text
              selectable
              className={`text-sm font-bold ${net > 0.009 ? "text-brand-700" : net < -0.009 ? "text-coral" : "text-muted"}`}
            >
              {net > 0.009
                ? `You are owed ${formatMoney(net, group.currency)}`
                : net < -0.009
                  ? `You owe ${formatMoney(net, group.currency)}`
                  : "All settled"}
            </Text>
          </View>
        </View>
      </Pressable>
    </Link>
  );
}
