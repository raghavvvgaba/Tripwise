import type { CurrencyCode } from "@/types/models";

export type CurrencyConfig = {
  code: CurrencyCode;
  symbol: string;
  label: string;
  locale: string;
};

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  { code: "INR", symbol: "₹", label: "Indian Rupee", locale: "en-IN" },
  { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US" },
  { code: "EUR", symbol: "€", label: "Euro", locale: "de-DE" },
  { code: "GBP", symbol: "£", label: "British Pound", locale: "en-GB" },
];

const currencyMap: Record<CurrencyCode, CurrencyConfig> = {
  INR: { code: "INR", symbol: "₹", label: "Indian Rupee", locale: "en-IN" },
  USD: { code: "USD", symbol: "$", label: "US Dollar", locale: "en-US" },
  EUR: { code: "EUR", symbol: "€", label: "Euro", locale: "de-DE" },
  GBP: { code: "GBP", symbol: "£", label: "British Pound", locale: "en-GB" },
};

export function getCurrencyConfig(code: CurrencyCode = "INR"): CurrencyConfig {
  return currencyMap[code] ?? currencyMap.INR;
}

export function getCurrencySymbol(code: CurrencyCode = "INR"): string {
  return getCurrencyConfig(code).symbol;
}

export function formatMoney(amount: number, currency: CurrencyCode = "INR", showSign = false) {
  const config = getCurrencyConfig(currency);
  const absolute = Math.abs(amount);
  const value = new Intl.NumberFormat(config.locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(absolute) ? 0 : 2,
  }).format(absolute);

  if (!showSign || amount === 0) {
    return `${config.symbol}${value}`;
  }

  return `${amount > 0 ? "+" : "−"}${config.symbol}${value}`;
}

export function roundMoney(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function parseMoneyToMinor(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(trimmed)) return null;

  const [whole, decimal = ""] = trimmed.split(/[.,]/);
  const amount = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return Number.isSafeInteger(amount) ? amount : null;
}
