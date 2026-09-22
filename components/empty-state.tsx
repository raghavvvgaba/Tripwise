import { Text, View } from "react-native";

type EmptyStateProps = {
  emoji: string;
  title: string;
  message: string;
};

export function EmptyState({ emoji, title, message }: EmptyStateProps) {
  return (
    <View className="card items-center gap-3 px-8 py-10">
      <Text className="text-4xl">{emoji}</Text>
      <Text className="text-center text-lg font-bold text-ink">{title}</Text>
      <Text className="text-center text-sm leading-5 text-muted">{message}</Text>
    </View>
  );
}
