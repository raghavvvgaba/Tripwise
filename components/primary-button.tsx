import { Ionicons } from "@expo/vector-icons";
import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

import { useClayTheme } from "@/constants/clay-theme";

type PrimaryButtonProps = ComponentProps<typeof Pressable> & {
  label: string;
  icon?: ComponentProps<typeof Ionicons>["name"];
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

export function PrimaryButton({
  label,
  icon,
  loading = false,
  variant = "primary",
  disabled,
  className = "",
  style,
  ...props
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const clay = useClayTheme();

  const containerStyle =
    variant === "danger"
      ? {
          backgroundColor: clay.isDark ? "rgba(251, 113, 133, 0.12)" : "#FEE2E2",
          borderColor: clay.isDark ? "rgba(251, 113, 133, 0.25)" : "#FECACA",
        }
      : variant === "secondary"
        ? {
            backgroundColor: clay.card,
            borderColor: clay.cardBorder,
          }
        : undefined;

  const textColor =
    variant === "primary"
      ? clay.heroText
      : variant === "danger"
        ? clay.errorText
        : clay.textPrimary;

  const baseClasses =
    variant === "primary"
      ? "bg-[#F5D298] shadow-sm active:opacity-75"
      : variant === "secondary"
        ? "border active:opacity-75"
        : "border active:opacity-75";

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={[containerStyle, style as object]}
      className={`min-h-14 flex-row items-center justify-center rounded-2xl px-5 ${icon ? "gap-2" : ""} ${baseClasses} ${isDisabled ? "opacity-50" : ""} ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={19} color={textColor} /> : null}
          <Text
            style={{ color: textColor }}
            className={`text-base ${variant === "primary" ? "font-extrabold" : "font-bold"}`}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
