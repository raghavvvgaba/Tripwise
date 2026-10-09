import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { useEffect } from "react";
import { Modal, Text, View, Pressable, useColorScheme } from "react-native";

import { resolveTheme, themeColors, themeVariables } from "@/constants/theme";
import { useConfirmDialogStore } from "@/store/use-confirm-dialog-store";
import { useSettingsStore } from "@/store/use-settings-store";

export function ConfirmDialog() {
  const request = useConfirmDialogStore((state) => state.request);
  const dismiss = useConfirmDialogStore((state) => state.dismiss);
  const confirm = useConfirmDialogStore((state) => state.confirm);
  const preference = useSettingsStore((state) => state.themePreference);
  const scheme = resolveTheme(preference, useColorScheme());
  const pathname = usePathname();

  useEffect(() => {
    return () => dismiss();
  }, [pathname, dismiss]);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={request !== null}
      onRequestClose={dismiss}
      accessibilityLabel={request?.title}
    >
      <View className="flex-1 items-center justify-center bg-black/60 px-5 py-8" style={themeVariables[scheme]}>
        {request ? (
          <View className="w-full max-w-sm gap-5 rounded-3xl border border-line bg-surface p-6 shadow-2xl" accessibilityViewIsModal>
            <View className="gap-4">
              <View className={`h-12 w-12 items-center justify-center rounded-2xl ${request.destructive ? "bg-red-50 dark:bg-red-950/60" : "bg-brand-50"}`}>
                <Ionicons
                  name={request.destructive ? "alert-circle-outline" : "help-circle-outline"}
                  size={26}
                  color={request.destructive ? themeColors[scheme].coral : themeColors[scheme]["brand-700"]}
                />
              </View>
              <View className="gap-2">
                <Text className="text-xl font-bold text-ink">{request.title}</Text>
                <Text className="text-sm leading-6 text-muted">{request.message}</Text>
              </View>
            </View>
            <View className="flex-row items-center justify-end gap-3 pt-2">
              <Pressable
                accessibilityRole="button"
                onPress={dismiss}
                className="min-h-11 flex-1 items-center justify-center rounded-xl border border-line bg-surface px-4 active:opacity-75 sm:flex-initial sm:min-w-24"
              >
                <Text className="font-semibold text-ink">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={confirm}
                className={`min-h-11 flex-1 items-center justify-center rounded-xl px-5 active:opacity-75 sm:flex-initial ${
                  request.destructive ? "bg-[#DC2626] dark:bg-[#FB7185]" : "bg-brand-600"
                }`}
              >
                <Text className={`font-semibold ${request.destructive ? "text-white dark:text-[#0E0C18]" : "text-[#2C254E]"}`}>
                  {request.actionLabel}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
