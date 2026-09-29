import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Platform, Pressable, Text, useColorScheme, View } from "react-native";

import { resolveTheme, useThemeColors } from "@/constants/theme";
import { useSettingsStore } from "@/store/use-settings-store";
import { formatPaymentDate, localDateString, parseLocalDate } from "@/utils/date";

type PaymentDateFieldProps = {
  value: string;
  maxDate: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function PaymentDateField({ value, maxDate, onChange, disabled = false }: PaymentDateFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const colors = useThemeColors();
  const themePreference = useSettingsStore((state) => state.themePreference);
  const systemColorScheme = useColorScheme();
  const selectedDate = parseLocalDate(value) ?? new Date();
  const maximumDate = parseLocalDate(maxDate) ?? new Date();

  function openPicker() {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: selectedDate,
        mode: "date",
        maximumDate,
        onValueChange: (_event, date) => onChange(localDateString(date)),
      });
    } else {
      setIsOpen((open) => !open);
    }
  }

  return (
    <View className="gap-2">
      <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Paid on ${formatPaymentDate(value)}`} onPress={openPicker} className="field flex-row items-center justify-between gap-3">
        <Text className="font-semibold text-ink">{value === maxDate ? `Today, ${formatPaymentDate(value)}` : formatPaymentDate(value)}</Text>
        <Ionicons name="calendar-outline" size={20} color={colors["brand-700"]} />
      </Pressable>
      {Platform.OS === "ios" && isOpen && !disabled ? (
        <View className="card overflow-hidden p-2">
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="inline"
            maximumDate={maximumDate}
            themeVariant={resolveTheme(themePreference, systemColorScheme)}
            onValueChange={(_event, date) => onChange(localDateString(date))}
          />
        </View>
      ) : null}
    </View>
  );
}
