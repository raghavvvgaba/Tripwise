import { Alert, Platform } from "react-native";

import { useConfirmDialogStore } from "@/store/use-confirm-dialog-store";

export function confirmAction(
  title: string,
  message: string,
  actionLabel: string,
  onConfirm: () => void,
  destructive = true,
) {
  if (Platform.OS === "web") {
    useConfirmDialogStore.getState().show({ title, message, actionLabel, onConfirm, destructive });
    return;
  }

  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: actionLabel, style: destructive ? "destructive" : "default", onPress: onConfirm },
  ]);
}

export function showError(title: string, message: string) {
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}
