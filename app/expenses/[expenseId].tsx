import { useLocalSearchParams } from "expo-router";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useClayTheme } from "@/constants/clay-theme";
import { EmptyState } from "@/components/empty-state";
import { SharedExpenseDetails } from "@/components/shared-expense-details";
import { useSharedGroups } from "@/hooks/use-shared-groups";

export default function ExpenseDetailsScreen() {
  const clay = useClayTheme();
  const { expenseId, groupId } = useLocalSearchParams<{ expenseId: string; groupId: string }>();
  const { groups, isLoading } = useSharedGroups();
  const group = groups.find((item) => item.id === groupId);

  if (group?.deletedAt) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
          <EmptyState icon="trash-outline" title="Group deleted" message="Restore the group to see its expenses again." />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (group && expenseId) {
    return <SharedExpenseDetails key={expenseId} group={group} expenseId={expenseId} />;
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F5D298" size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: clay.canvas }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="px-5 py-8">
        <EmptyState icon="receipt-outline" title="Expense not found" message="It may no longer be available in this group." />
      </ScrollView>
    </SafeAreaView>
  );
}
