import { Alert, Platform } from "react-native";

export function confirmAction(
  title: string,
  message: string,
  actionLabel: string,
  onConfirm: () => void,
  destructive = true,
) {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
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
