import { router, Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { PrimaryButton } from "@/components/primary-button";
import { useGroupsStore } from "@/store/use-groups-store";

export default function JoinGroupScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const group = useGroupsStore((state) => state.groups.find((item) => item.inviteCode === code));

  if (!group) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <EmptyState icon="link-outline" title="Invite unavailable" message="Ask a group member for a fresh link." />
      </ScrollView>
    );
  }

  function previewJoin() {
    router.dismissTo(`/groups/${group!.id}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: "You're invited" }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="w-full max-w-2xl self-center gap-6 px-5 pb-12 pt-6 md:px-8 lg:py-10"
        showsVerticalScrollIndicator={false}
      >
        <View className="items-center gap-3">
          <View className="h-24 w-24 items-center justify-center rounded-[32px] border border-brand-100 bg-brand-50">
            <Text className="text-3xl font-extrabold tracking-tight text-brand-700">
              {group.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View className="items-center gap-1">
            <Text className="text-sm font-medium text-brand-700">You've been invited to</Text>
            <Text className="text-center text-3xl font-bold tracking-tight text-ink">{group.name}</Text>
            <Text className="text-sm text-muted">{group.members.length} people are already in this group</Text>
          </View>
          <View className="flex-row justify-center pt-1">
            {group.members.slice(0, 5).map((member, index) => (
              <View key={member.id} className={index === 0 ? "" : "-ml-2"}>
                <MemberAvatar member={member} />
              </View>
            ))}
          </View>
        </View>

        <View className="card gap-3 p-5">
          <Text className="text-center text-lg font-bold text-ink">Invite preview</Text>
          <Text className="text-center text-sm leading-5 text-muted">
            Group joining will be available when shared groups are connected to Supabase.
          </Text>
          <PrimaryButton label="Back to demo group" onPress={previewJoin} />
        </View>
      </ScrollView>
    </>
  );
}
