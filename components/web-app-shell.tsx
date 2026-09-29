import { Ionicons } from "@expo/vector-icons";
import { Link, usePathname } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import { useAuthStore } from "@/store/use-auth-store";
import { useThemeColors } from "@/constants/theme";
import { BrandIcon } from "@/components/brand-icon";

const navigation = [
  { href: "/" as const, label: "Groups", icon: "people-outline" as const, activeIcon: "people" as const },
  { href: "/activity" as const, label: "Activity", icon: "pulse-outline" as const, activeIcon: "pulse" as const },
  { href: "/account" as const, label: "Account", icon: "person-outline" as const, activeIcon: "person" as const },
];

function Brand() {
  return (
    <View className="flex-row items-center gap-3">
      <View className="h-10 w-10">
        <BrandIcon />
      </View>
      <Text className="text-xl font-bold tracking-tight text-ink">tripwise</Text>
    </View>
  );
}

export function WebAppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const email = useAuthStore((state) => state.session?.user.email);
  const activePage = navigation.find((item) => item.href === pathname)?.label ?? "Workspace";
  const colors = useThemeColors();

  return (
    <View className="h-dvh flex-1 bg-canvas lg:flex-row">
      <View className="hidden w-64 border-r border-line bg-surface px-5 py-7 lg:flex">
        <Link href="/" asChild>
          <Pressable accessibilityLabel="Tripwise home" className="mb-12 self-start rounded-xl">
            <Brand />
          </Pressable>
        </Link>

        <Text className="section-label mb-3 px-3">Workspace</Text>
        <View className="gap-1">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityState={{ selected: isActive }}
                  className={`min-h-12 flex-row items-center gap-3 rounded-2xl px-4 ${isActive ? "bg-brand-50" : "hover:bg-canvas"}`}
                >
                  <Ionicons name={isActive ? item.activeIcon : item.icon} size={20} color={isActive ? colors["brand-700"] : colors.muted} />
                  <Text className={`text-sm font-semibold ${isActive ? "text-brand-700" : "text-muted"}`}>
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>

        <View className="mt-auto gap-3 rounded-2xl border border-line bg-canvas p-4">
          <View className="h-8 w-8 items-center justify-center rounded-xl bg-brand-50">
            <Ionicons name="lock-closed-outline" size={17} color={colors["brand-700"]} />
          </View>
          <Text className="text-sm font-bold text-ink">Your shared workspace</Text>
          <Text className="text-xs leading-5 text-muted">
            Groups and expenses are saved to your account.
          </Text>
        </View>
      </View>

      <View className="min-w-0 flex-1">
        <View className="min-h-16 flex-row items-center justify-between border-b border-line bg-surface px-5 lg:hidden">
          <Link href="/" asChild>
            <Pressable accessibilityLabel="Tripwise home"><Brand /></Pressable>
          </Link>
          <Link href="/account" asChild>
            <Pressable accessibilityLabel="Account" className="h-9 w-9 items-center justify-center rounded-full bg-brand-50">
              <Text className="text-sm font-bold text-brand-700">{email?.[0]?.toUpperCase() ?? "?"}</Text>
            </Pressable>
          </Link>
        </View>

        <View className="hidden min-h-16 flex-row items-center justify-between border-b border-line bg-surface px-10 lg:flex">
          <Text className="text-sm font-medium text-muted">Workspace <Text className="text-line">/</Text> <Text className="font-semibold text-ink">{activePage}</Text></Text>
          <View className="flex-row items-center gap-3">
            <View className="h-8 w-8 items-center justify-center rounded-full bg-brand-50">
              <Text className="text-xs font-bold text-brand-700">{email?.[0]?.toUpperCase() ?? "?"}</Text>
            </View>
            <Text className="max-w-56 text-sm font-medium text-ink" numberOfLines={1}>{email}</Text>
          </View>
        </View>

        <View className="min-h-0 flex-1">{children}</View>

        <View className="min-h-16 flex-row border-t border-line bg-surface lg:hidden">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link key={item.href} href={item.href} asChild>
                <Pressable
                  accessibilityRole="link"
                  accessibilityState={{ selected: isActive }}
                  className="min-h-16 flex-1 items-center justify-center gap-1"
                >
                  <Ionicons name={isActive ? item.activeIcon : item.icon} size={21} color={isActive ? colors["brand-700"] : colors.muted} />
                  <Text className={`text-[11px] font-semibold ${isActive ? "text-brand-700" : "text-muted"}`}>
                    {item.label}
                  </Text>
                </Pressable>
              </Link>
            );
          })}
        </View>
      </View>
    </View>
  );
}
