import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { ScrollView, Share, Text, TextInput, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { MemberAvatar } from "@/components/member-avatar";
import { PrimaryButton } from "@/components/primary-button";
import { useGroupsStore } from "@/store/use-groups-store";

export default function InviteScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const group = useGroupsStore((state) => state.groups.find((item) => item.inviteCode === code));
  const addPlaceholderMember = useGroupsStore((state) => state.addPlaceholderMember);
  const [name, setName] = useState("");

  if (!group) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <EmptyState emoji="🔗" title="Invite expired" message="Ask a group member for a fresh invite link." />
      </ScrollView>
    );
  }

  const inviteUrl = `https://tripwise.app/join/${group.inviteCode}`;

  async function shareInvite() {
    await Share.share({
      title: `Join ${group?.name} on Tripwise`,
      message: `Join ${group?.name} on Tripwise to view and add trip expenses: ${inviteUrl}`,
      url: inviteUrl,
    });
  }

  function addMember() {
    if (!name.trim()) return;
    addPlaceholderMember(group!.id, name);
    setName("");
  }

  return (
    <>
      <Stack.Screen options={{ title: `Invite to ${group.name}` }} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-6 px-5 pb-12 pt-5"
      >
        <View className="items-center gap-3 py-2">
          <View className="h-20 w-20 items-center justify-center rounded-3xl border border-brand-100 bg-brand-50">
            <Text className="text-2xl font-extrabold tracking-tight text-brand-700">
              {group.name.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <Text className="text-center text-xl font-bold text-ink">Bring everyone into one group</Text>
          <Text className="max-w-sm text-center text-sm leading-5 text-muted">
            Share one link. New members will be able to view the group and add expenses after sign-in is connected.
          </Text>
        </View>

        <View className="card gap-3 p-4">
          <Text className="section-label">Invite link</Text>
          <Text selectable className="rounded-xl bg-canvas p-3 text-sm font-medium text-ink">
            {inviteUrl}
          </Text>
          <PrimaryButton label="Share on WhatsApp or more" onPress={shareInvite} />
          <Link href={`/join/${group.inviteCode}`} asChild>
            <PrimaryButton label="Preview join experience" variant="secondary" />
          </Link>
        </View>

        <View className="gap-3">
          <Text className="section-label px-1">Members · {group.members.length}</Text>
          <View className="card px-4">
            {group.members.map((member, index) => (
              <View key={member.id}>
                <View className="flex-row items-center gap-3 py-3">
                  <MemberAvatar member={member} />
                  <View className="flex-1">
                    <Text className="font-semibold text-ink">{member.name}</Text>
                    <Text className="text-xs text-muted">{member.isPlaceholder ? "Placeholder member" : "Joined"}</Text>
                  </View>
                </View>
                {index < group.members.length - 1 ? <View className="h-px bg-line" /> : null}
              </View>
            ))}
          </View>
        </View>

        <View className="gap-3">
          <Text className="section-label px-1">Add without an account</Text>
          <TextInput
            className="field"
            placeholder="Friend's name"
            placeholderTextColor="#9AA39D"
            value={name}
            onChangeText={setName}
            onSubmitEditing={addMember}
            returnKeyType="done"
          />
          <PrimaryButton label="Add placeholder member" variant="secondary" onPress={addMember} disabled={!name.trim()} />
        </View>

        <PrimaryButton label="Done" onPress={() => router.dismissTo(`/groups/${group.id}`)} />
      </ScrollView>
    </>
  );
}
