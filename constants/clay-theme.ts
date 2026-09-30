import { useColorScheme } from "react-native";

import { useSettingsStore } from "@/store/use-settings-store";
import { resolveTheme } from "./theme";

export const clayColors = {
  dark: {
    isDark: true,
    // 60% Dominant Canvas
    canvas: "#181528",
    // 30% Secondary Surfaces
    card: "#262243",
    cardBorder: "rgba(255, 255, 255, 0.1)",
    track: "#131020",
    squircle: "#322C54",
    avatarBg: "#2C274B",
    headerBtn: "#262243",
    headerBtnBorder: "rgba(255, 255, 255, 0.1)",
    // Typography
    textPrimary: "#FFFFFF",
    textMuted: "#A59ECB",
    textSubtle: "#D0CCE8",
    // 10% Hero Accent
    heroAccent: "#F5D298",
    heroBorder: "#FDE3B8",
    heroText: "#181528",
    heroLabel: "#6F614C",
    heroDashed: "rgba(24, 21, 40, 0.25)",
    heroTagBg: "#181528",
    // Active Tab Pill
    activeTabBg: "#F5D298",
    activeTabText: "#181528",
    // Badges & Actions
    badgePositiveBg: "#183B2B",
    badgePositiveText: "#4ADE80",
    badgeNegativeBg: "#451C28",
    badgeNegativeText: "#FB7185",
    badgeNeutralBg: "rgba(255, 255, 255, 0.1)",
    badgeNeutralText: "#A59ECB",
    youBadgeBg: "rgba(245, 210, 152, 0.15)",
    youBadgeBorder: "rgba(245, 210, 152, 0.3)",
    youBadgeText: "#F5D298",
    dashedCardBg: "rgba(38, 34, 67, 0.6)",
    dashedCardBorder: "rgba(245, 210, 152, 0.4)",
    errorCardBorder: "rgba(239, 68, 68, 0.2)",
    errorText: "#FB7185",
  },
  light: {
    isDark: false,
    // 60% Dominant Canvas (Misty Twilight Lavender Mist)
    canvas: "#ECE9F5",
    // 30% Secondary Surfaces (Elevated White & Dusty Lilac)
    card: "#FFFFFF",
    cardBorder: "#DBD5ED",
    track: "#DED8EE",
    squircle: "#E8E3F5",
    avatarBg: "#E4DEF2",
    headerBtn: "#FFFFFF",
    headerBtnBorder: "#DBD5ED",
    // Typography (Rich Violet Indigo & Muted Dusty Lilac)
    textPrimary: "#2C254E",
    textMuted: "#6E658E",
    textSubtle: "#938AA8",
    // 10% Hero Accent (Signature Warm Peach)
    heroAccent: "#F5D298",
    heroBorder: "#E8C88A",
    heroText: "#2C254E",
    heroLabel: "#655947",
    heroDashed: "rgba(44, 37, 78, 0.25)",
    heroTagBg: "#2C254E",
    // Active Tab Pill (Rich Violet Pill with Crisp White text)
    activeTabBg: "#2C254E",
    activeTabText: "#FFFFFF",
    // Badges & Actions
    badgePositiveBg: "#DCFCE7",
    badgePositiveText: "#15803D",
    badgeNegativeBg: "#FFE4E6",
    badgeNegativeText: "#E11D48",
    badgeNeutralBg: "rgba(44, 37, 78, 0.08)",
    badgeNeutralText: "#6E658E",
    youBadgeBg: "rgba(245, 210, 152, 0.4)",
    youBadgeBorder: "rgba(245, 210, 152, 0.7)",
    youBadgeText: "#7A5807",
    dashedCardBg: "rgba(255, 255, 255, 0.85)",
    dashedCardBorder: "rgba(140, 120, 190, 0.45)",
    errorCardBorder: "rgba(239, 68, 68, 0.2)",
    errorText: "#DC2626",
  },
} as const;

export function useClayTheme() {
  const systemColorScheme = useColorScheme();
  const preference = useSettingsStore((state) => state.themePreference);
  const theme = resolveTheme(preference, systemColorScheme);
  return clayColors[theme];
}
