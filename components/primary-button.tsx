import type { ComponentProps } from "react";
import { ActivityIndicator, Pressable, Text } from "react-native";

type PrimaryButtonProps = ComponentProps<typeof Pressable> & {
  label: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "danger";
};

const containerClasses = {
  primary: "bg-brand-600 active:bg-brand-700",
  secondary: "border border-line bg-white active:bg-canvas",
  danger: "bg-red-50 active:bg-red-100",
};

const labelClasses = {
  primary: "text-white",
  secondary: "text-ink",
  danger: "text-red-600",
};

export function PrimaryButton({
  label,
  loading = false,
  variant = "primary",
  disabled,
  className = "",
  ...props
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      className={`min-h-14 flex-row items-center justify-center rounded-2xl px-5 ${containerClasses[variant]} ${isDisabled ? "opacity-50" : ""} ${className}`}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : "#17201B"} />
      ) : (
        <Text className={`text-base font-semibold ${labelClasses[variant]}`}>{label}</Text>
      )}
    </Pressable>
  );
}
