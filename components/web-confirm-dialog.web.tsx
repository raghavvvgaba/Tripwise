import { Ionicons } from "@expo/vector-icons";
import { usePathname } from "expo-router";
import { useEffect } from "react";
import { Modal, Text, View, Pressable, useColorScheme } from "react-native";

import { resolveTheme, themeColors, themeVariables } from "@/constants/theme";
import { useConfirmDialogStore } from "@/store/use-confirm-dialog-store";
import { useSettingsStore } from "@/store/use-settings-store";

export function WebConfirmDialog() {
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
      <View className="flex-1 items-center justify-center bg-black/55 px-4 py-8" style={themeVariables[scheme]}>
        {request ? (
          <View className="w-full max-w-md gap-5 rounded-3xl border border-line bg-surface p-6 shadow-2xl" accessibilityViewIsModal>
            <View className="gap-4">
              <View className={`h-12 w-12 items-center justify-center rounded-2xl ${request.destructive ? "bg-red-50 dark:bg-red-950" : "bg-brand-50"}`}>
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
            <View className="gap-3 pt-1 sm:flex-row sm:justify-end">
              <Pressable
                accessibilityRole="button"
                onPress={dismiss}
                className="min-h-11 w-full items-center justify-center rounded-xl border border-line bg-surface px-4 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-600 sm:w-auto sm:min-w-24"
              >
                <Text className="font-semibold text-ink">Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={confirm}
                className={`min-h-11 w-full items-center justify-center rounded-xl px-5 focus-visible:outline-2 focus-visible:outline-brand-600 sm:w-auto ${request.destructive ? "bg-[#B63332] hover:bg-[#9F2928]" : "bg-brand-600 hover:bg-brand-500"}`}
              >
                <Text className="font-semibold text-white">{request.actionLabel}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
