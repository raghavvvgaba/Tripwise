// Native fetch errors can include Java exceptions and backend hostnames.
export function queryErrorMessage(error: unknown, hasData: boolean, paused = false): string | null {
  if (!error && !paused) return null;
  const message = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
    ? error.message : "";
  const networkFailure = paused || /network request failed|failed to fetch|fetch failed|UnknownHostException|Unable to resolve host|NetworkError|^offline$/i.test(message);
  if (networkFailure) {
    return hasData ? null : "This data is not saved on this device. Connect to the internet and retry.";
  }
  return message || "Could not load data. Please try again.";
}
