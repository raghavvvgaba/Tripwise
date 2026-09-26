import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { useThemeColors } from "@/constants/theme";

type EmptyStateProps = {
  emoji?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
};

export function EmptyState({ emoji, icon, title, message }: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View className="card items-center gap-3 px-8 py-10">
      {icon ? (
        <Ionicons name={icon} size={36} color={colors["brand-700"]} />
      ) : (
        <Text className="text-4xl">{emoji}</Text>
      )}
      <Text className="text-center text-lg font-bold text-ink">{title}</Text>
      <Text className="text-center text-sm leading-5 text-muted">{message}</Text>
    </View>
  );
}
