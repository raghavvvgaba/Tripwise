import { Alert, Platform } from "react-native";

import { friendlyErrorMessage } from "@/lib/user-error";

import { useConfirmDialogStore } from "@/store/use-confirm-dialog-store";

export function confirmAction(
  title: string,
  message: string,
  actionLabel: string,
  onConfirm: () => void,
  destructive = true,
) {
  useConfirmDialogStore.getState().show({ title, message, actionLabel, onConfirm, destructive });
}

export function showError(title: string, error: unknown, fallback = "Please try again.") {
  const message = friendlyErrorMessage(error, fallback);
  if (Platform.OS === "web") {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
}
