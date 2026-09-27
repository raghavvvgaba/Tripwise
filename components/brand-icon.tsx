import { Image, useColorScheme } from "react-native";

import { resolveTheme } from "@/constants/theme";
import { useSettingsStore } from "@/store/use-settings-store";

export function BrandIcon({ size = 40 }: { size?: number }) {
  const systemColorScheme = useColorScheme();
  const preference = useSettingsStore((state) => state.themePreference);
  const source = resolveTheme(preference, systemColorScheme) === "dark"
    ? require("../assets/tripwise-icon-dark.png")
    : require("../assets/tripwise-icon-light.png");

  return <Image source={source} resizeMode="cover" style={{ width: size, height: size, borderRadius: size / 4 }} />;
}
