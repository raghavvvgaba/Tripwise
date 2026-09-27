import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { useThemeColors } from "@/constants/theme";

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
};

export function EmptyState({ icon, title, message }: EmptyStateProps) {
  const colors = useThemeColors();
  return (
    <View className="card items-center gap-3 px-8 py-10">
      <View className="h-16 w-16 items-center justify-center rounded-2xl bg-brand-50">
        <Ionicons name={icon} size={30} color={colors["brand-700"]} />
      </View>
      <Text className="text-center text-lg font-bold text-ink">{title}</Text>
      <Text className="text-center text-sm leading-5 text-muted">{message}</Text>
    </View>
  );
}
