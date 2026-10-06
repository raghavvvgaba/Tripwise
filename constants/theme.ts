import { useColorScheme, type ColorSchemeName } from "react-native";
import { vars } from "nativewind";

import { useSettingsStore, type ThemePreference } from "@/store/use-settings-store";

export const themeColors = {
  light: {
    ink: "#2C254E",
    muted: "#6E658E",
    canvas: "#ECE9F5",
    surface: "#FFFFFF",
    line: "#DBD5ED",
    "brand-50": "#F4EFE6",
    "brand-100": "#ECE7F7",
    "brand-500": "#F5D298",
    "brand-600": "#E5BE7E",
    "brand-700": "#9A6B1C",
    coral: "#DC2626",
    positive: "#15803D",
  },
  dark: {
    ink: "#FFFFFF",
    muted: "#A59ECB",
    canvas: "#181528",
    surface: "#262243",
    line: "#342E5C",
    "brand-50": "#2F2843",
    "brand-100": "#3D355C",
    "brand-500": "#F5D298",
    "brand-600": "#E5BE7E",
    "brand-700": "#F5D298",
    coral: "#FB7185",
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
