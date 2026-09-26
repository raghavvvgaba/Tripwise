import { useColorScheme } from "react-native";
import { vars } from "nativewind";

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
    ink: "#EAF3EC",
    muted: "#A3B5A8",
    canvas: "#0E1711",
    surface: "#18251C",
    line: "#35483A",
    "brand-50": "#173C2A",
    "brand-100": "#245338",
    "brand-500": "#42C884",
    "brand-600": "#078455",
    "brand-700": "#94E5B0",
    coral: "#FFA183",
  },
} as const;

function hexToRgb(hex: string) {
  return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16)).join(" ");
}

export const themeVariables = {
  light: vars(Object.fromEntries(Object.entries(themeColors.light).map(([name, hex]) => [`--color-${name}`, hexToRgb(hex)]))),
  dark: vars(Object.fromEntries(Object.entries(themeColors.dark).map(([name, hex]) => [`--color-${name}`, hexToRgb(hex)]))),
};

export function useThemeColors() {
  const systemColorScheme = useColorScheme();
  return themeColors[systemColorScheme === "dark" ? "dark" : "light"];
}
