import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";

import { EmptyState } from "@/components/empty-state";
import { SharedExpenseDetails } from "@/components/shared-expense-details";
import { useSharedGroupsStore } from "@/store/use-shared-groups-store";

export default function ExpenseDetailsScreen() {
  const { expenseId, groupId } = useLocalSearchParams<{ expenseId: string; groupId: string }>();
  const group = useSharedGroupsStore((state) => state.groups.find((item) => item.id === groupId));
  const isLoading = useSharedGroupsStore((state) => state.isLoading);

  if (group?.deletedAt) {
    return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
      <EmptyState icon="trash-outline" title="Group deleted" message="Restore the group to see its expenses again." />
    </ScrollView>;
  }
  if (group && expenseId) return <SharedExpenseDetails key={expenseId} group={group} expenseId={expenseId} />;
  if (isLoading) return <View className="flex-1 items-center justify-center"><ActivityIndicator /></View>;

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
      <EmptyState icon="receipt-outline" title="Expense not found" message="It may no longer be available in this group." />
    </ScrollView>
  );
}
