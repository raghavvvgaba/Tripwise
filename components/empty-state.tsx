import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { ScoutMascot, type ScoutPose } from "@/components/scout-mascot";
import { useClayTheme } from "@/constants/clay-theme";

type EmptyStateProps = {
  icon: keyof typeof Ionicons.glyphMap;
  mascot?: ScoutPose;
  title: string;
  message: string;
};

export function EmptyState({ icon, mascot, title, message }: EmptyStateProps) {
  const clay = useClayTheme();
  return (
    <View
      style={{ backgroundColor: clay.card, borderColor: clay.cardBorder }}
      className="items-center gap-3 rounded-3xl border px-8 py-10 shadow-sm"
    >
      {mascot ? (
        <ScoutMascot pose={mascot} />
      ) : (
        <View
          style={{ backgroundColor: clay.squircle, borderColor: clay.cardBorder }}
          className="h-16 w-16 items-center justify-center rounded-2xl border"
        >
          <Ionicons name={icon} size={28} color={clay.isDark ? "#F5D298" : "#9A6B1C"} />
        </View>
      )}
      <Text style={{ color: clay.textPrimary }} className="text-center text-lg font-black">
        {title}
      </Text>
      <Text style={{ color: clay.textMuted }} className="text-center text-sm leading-5">
        {message}
      </Text>
    </View>
  );
}
