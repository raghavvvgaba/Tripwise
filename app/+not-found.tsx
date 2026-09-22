import { Link } from "expo-router";
import { ScrollView, Text } from "react-native";

import { EmptyState } from "@/components/empty-state";

export default function NotFoundScreen() {
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerClassName="gap-5 px-5 py-10">
      <EmptyState emoji="🧭" title="Page not found" message="This screen does not exist or the link is no longer valid." />
      <Link href="/" className="text-center font-semibold text-brand-700">
        Back to groups
      </Link>
    </ScrollView>
  );
}
