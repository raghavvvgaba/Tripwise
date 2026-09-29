import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { RouteModal } from "@/components/route-modal";
import { SharedExpenseForm } from "@/components/shared-expense-form";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";

export default function AddExpenseScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId?: string }>();
  const group = useSharedGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const isLoading = useSharedGroupsStore((state) => state.isLoading);
  const userId = useSharedGroupsStore((state) => state.userId);

  if (group) {
    if (group.deletedAt || !userId) {
      return <RouteModal title="Add expense">{() => (
        <ScrollView contentContainerClassName="px-5 py-8">
          <EmptyState icon="trash-outline" title="Expense unavailable" message="Restore this group before adding an expense." />
        </ScrollView>
      )}</RouteModal>;
    }
    return <SharedExpenseForm key={`${group.id}:${expenseId ?? "new"}`} group={group} currentUserId={userId} expenseId={expenseId} />;
  }

  if (isLoading) {
    return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;
  }

  return (
    <RouteModal title="Add expense">{() => (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <EmptyState icon="search-outline" title="Group not found" message="Return to your groups and try again." />
      </ScrollView>
    )}</RouteModal>
  );
}
