import { useColorScheme, type ColorSchemeName } from "react-native";
import { vars } from "nativewind";

import { useSettingsStore, type ThemePreference } from "@/store/use-settings-store";

export const themeColors = {
  light: {
    ink: "#1A1A1A",
    muted: "#6B7280",
    canvas: "#F7F7F8",
    surface: "#FFFFFF",
    line: "#E5E7EB",
    "brand-50": "#FFF8EB",
    "brand-100": "#FEECC2",
    "brand-500": "#B8860B",
    "brand-600": "#996F09",
    "brand-700": "#7A5807",
    coral: "#F97316",
    positive: "#16A34A",
  },
  dark: {
    ink: "#F1F1F3",
    muted: "#9CA3AF",
    canvas: "#0F1115",
    surface: "#1A1D23",
    line: "#2A2D35",
    "brand-50": "#2A2411",
    "brand-100": "#3D351A",
    "brand-500": "#D4A017",
    "brand-600": "#B8860B",
    "brand-700": "#F0CE5E",
    coral: "#FB923C",
    positive: "#4ADE80",
  },
} as const;

function hexToRgb(hex: string) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(" ");
}

export const themeVariables = {
  light: vars(Object.fromEntries(Object.entries(themeColors.light).map(([name, hex]) => [`--color-${name}`, hexToRgb(hex)]))),
  dark: vars(Object.fromEntries(Object.entries(themeColors.dark).map(([name, hex]) => [`--color-${name}`, hexToRgb(hex)]))),
};

export function resolveTheme(preference: ThemePreference, systemColorScheme: ColorSchemeName) {
  if (preference === "system") return systemColorScheme === "dark" ? "dark" : "light";
  return preference;
}

export function useThemeColors() {
  const systemColorScheme = useColorScheme();
  const preference = useSettingsStore((state) => state.themePreference);
  return themeColors[resolveTheme(preference, systemColorScheme)];
}
