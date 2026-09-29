import { View } from "react-native";

type PaymentDateFieldProps = {
  value: string;
  maxDate: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function PaymentDateField({ value, maxDate, onChange, disabled = false }: PaymentDateFieldProps) {
  return (
    <View>
      <input
        aria-label="Paid on"
        className="field w-full cursor-pointer outline-none"
        type="date"
        disabled={disabled}
        value={value}
        max={maxDate}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </View>
  );
}
