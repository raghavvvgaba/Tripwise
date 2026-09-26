import { useColorScheme, type ColorSchemeName } from "react-native";
import { vars } from "nativewind";

import { useSettingsStore, type ThemePreference } from "@/store/use-settings-store";

export const themeColors = {
  light: {
    ink: "#17201B",
    muted: "#68736C",
    canvas: "#F5F7F5",
    surface: "#FFFFFF",
    line: "#E3E9E5",
    "brand-50": "#ECFDF5",
    "brand-100": "#D1FAE5",
    "brand-500": "#10A66A",
    "brand-600": "#078455",
    "brand-700": "#086B49",
    coral: "#F0785A",
  },
  dark: {
    ink: "#EEF4F1",
    muted: "#A9B5B1",
    canvas: "#111416",
    surface: "#1B2022",
    line: "#30393B",
    "brand-50": "#19332A",
    "brand-100": "#244637",
    "brand-500": "#40C98C",
    "brand-600": "#078455",
    "brand-700": "#80DFAC",
    coral: "#FF9B8C",
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
