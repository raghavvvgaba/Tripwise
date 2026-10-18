import { friendlyErrorMessage, isNetworkError } from "./user-error";

export function queryErrorMessage(error: unknown, hasData: boolean, paused = false): string | null {
  if (!error && !paused) return null;
  if (paused || isNetworkError(error)) {
    return hasData ? null : "This data is not saved on this device. Connect to the internet and retry.";
  }
  return friendlyErrorMessage(error, "Could not load data. Please try again.");
}
