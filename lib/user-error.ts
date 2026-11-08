// Translate only known conditions. Never display arbitrary server/native messages.
// Original errors (including payment codes) remain intact for callers and diagnostics.
const authMessages = new Map<string, string>([
  ["invalid_credentials", "Your sign-in details are incorrect. Please try again."],
  ["email_not_confirmed", "Please confirm your email address before signing in."],
  ["email_address_invalid", "Please enter a valid email address."],
  ["email_exists", "An account already uses this email address. Try signing in or use another address."],
  ["user_already_exists", "An account already uses this email address. Try signing in or use another address."],
  ["weak_password", "Please choose a stronger password with a mix of letters, numbers, and symbols."],
  ["same_password", "Choose a new password that is different from your current password."],
  ["reauthentication_needed", "Please sign in again before changing your password."],
  ["reauthentication_not_valid", "We couldn't verify your identity. Please sign in again and retry."],
  ["session_not_found", "Your session has expired. Please sign in again."],
  ["session_expired", "Your session has expired. Please sign in again."],
  ["refresh_token_not_found", "Your session has expired. Please sign in again."],
  ["refresh_token_already_used", "Your session has expired. Please sign in again."],
  ["bad_jwt", "Your session has expired. Please sign in again."],
  ["flow_state_expired", "This sign-in attempt has expired. Please start again."],
  ["flow_state_not_found", "This sign-in attempt has expired. Please start again."],
  ["otp_expired", "This sign-in link has expired. Please request a new one."],
  ["bad_code_verifier", "We couldn't complete sign-in. Please start again."],
  ["bad_oauth_callback", "We couldn't complete Google sign-in. Please start again."],
  ["bad_oauth_state", "We couldn't complete Google sign-in. Please start again."],
  ["access_denied", "Sign-in was not completed. Please try again when you're ready."],
  ["over_request_rate_limit", "Too many attempts. Please wait a few minutes and try again."],
  ["over_email_send_rate_limit", "Too many emails requested. Please wait a few minutes and try again."],
]);

// Exact matches cover our own validation and tracked RPC exceptions. The text
// shown is owned by the app, even when a backend message triggers the mapping.
const validationMessages = new Map<string, string>([
  ["Sign in required", "Please sign in again to continue."],
  ["Invalid group", "This group is unavailable. Return to your groups and refresh."],
  ["Group not found or access denied", "This group is unavailable or you no longer have access to it."],
  ["You no longer have access to this group.", "You no longer have access to this group."],
  ["This group is unavailable for adding expenses", "This group is unavailable. Return to your groups and refresh."],
  ["This group is unavailable for editing expenses", "This group is unavailable. Return to your groups and refresh."],
  ["This group is unavailable for deleting expenses", "This group is unavailable. Return to your groups and refresh."],
  ["This group is unavailable for payments", "This group is unavailable. Return to your groups and refresh."],
  ["Restore this group before adding an expense", "Restore this group before adding an expense."],
  ["Expense not found", "This expense is no longer available. Refresh the group and try again."],
  ["Payment not found", "This payment is no longer available. Refresh the group and try again."],
  ["This expense changed since you opened it. Reopen it and try again.", "This expense changed since you opened it. Reopen it and try again."],
  ["Balances changed. Refresh the group and try again.", "Balances changed. Refresh the group and try again."],
  ["This payment was deleted. Return to the group and refresh.", "This payment was deleted. Return to the group and refresh."],
  ["Only the sender or recipient can record this payment", "Only the person paying or receiving the payment can record it."],
  ["Only the sender or recipient can delete this payment", "Only the person paying or receiving the payment can delete it."],
  ["A payment request ID is required", "Please return to the group, refresh, and try recording the payment again."],
  ["This request ID was already used for another payment", "Please return to the group, refresh, and try recording the payment again."],
  ["Invalid time zone offset", "Please check your device's date and time settings, then try again."],
  ["Invalid payment details", "Check the people, amount, and date, then try again."],
  ["Payment date cannot be in the future", "Choose today or an earlier payment date."],
  ["Payment date cannot be in the future.", "Choose today or an earlier payment date."],
  ["Both people must belong to the group", "One of these people is no longer in the group. Refresh and try again."],
  ["Invalid expense details", "Check the expense description and amount, then try again."],
  ["Payer must belong to the group", "Choose someone in this group as the payer."],
  ["Choose at least one participant", "Choose at least one person to split this expense with."],
  ["Invalid split amounts", "Check each person's share and try again."],
  ["Participants must be unique group members", "Select each person only once, then try again."],
  ["Participants must belong to the group", "Someone selected is no longer in the group. Refresh and try again."],
  ["Split amounts cannot be negative", "Each person's share must be zero or more."],
  ["Split amounts must add up to the expense total", "The shares must add up to the expense total."],
  ["This invite code is invalid.", "This invite code is invalid. Check the code and try again."],
  ["This group is unavailable for reminders", "This group is unavailable. Return to your groups and refresh."],
  ["This person is not a member of the group", "This person is no longer in this group. Refresh and try again."],
  ["A reminder was already sent to this person today", "You've already reminded this person in the last day. Please try again later."],
  ["A reminder is already being sent to this person", "A reminder is already being sent. Please wait a moment before trying again."],
  ["This person does not owe you money right now", "This person doesn't owe you money right now. Refresh the group and try again."],
  ["Invalid reminder details", "Please refresh the group and try again."],
  ["Group membership is unavailable.", "We couldn't load this group's members. Please try again."],
  ["Group members are unavailable.", "We couldn't load this group's members. Please try again."],
  ["Both current and new passwords are required.", "Enter both your current and new passwords."],
  ["An email address is required.", "Please enter an email address."],
  ["Could not read the selected photo.", "We couldn't open this photo. Please choose another one."],
  ["Could not read the selected photo's dimensions.", "We couldn't open this photo. Please choose another one."],
  ["The compressed photo is too large. Choose a smaller image.", "This photo is too large. Please choose a smaller image."],
  ["Clipboard access is unavailable.", "Copying isn't available right now. You can select and copy the code manually."],
]);

function stringField(error: unknown, field: "message" | "code" | "name"): string {
  if (typeof error === "object" && error !== null && field in error) {
    const value = (error as Record<string, unknown>)[field];
    if (typeof value === "string") return value;
  }
  return field === "message" && typeof error === "string" ? error : "";
}

export function isNetworkError(error: unknown): boolean {
  return /network request failed|failed to fetch|fetch failed|UnknownHostException|Unable to resolve host|NetworkError|Load failed|network connection.*lost|internet connection.*offline|ECONN\w+|ENOTFOUND|ETIMEDOUT|timed? ?out|timeout|^offline$/i.test(stringField(error, "message"))
    || (stringField(error, "name") === "AuthRetryableFetchError"
      && !(typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" && error.status !== 0));
}

export function friendlyErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
  options: { networkMessage?: string } = {},
): string {
  if (isNetworkError(error)) {
    return options.networkMessage ?? "We couldn't connect. Check your internet connection and try again.";
  }
  const code = stringField(error, "code");
  const authMessage = authMessages.get(code);
  if (authMessage) return authMessage;
  const validationMessage = validationMessages.get(stringField(error, "message"));
  if (validationMessage) return validationMessage;
  const status = typeof error === "object" && error !== null && "status" in error ? error.status : null;
  if (status === 429) return "Too many attempts. Please wait a few minutes and try again.";
  if (status === 401 || code === "PGRST301" || code === "PGRST302") return "Your session has expired. Please sign in again.";
  if (status === 403 || code === "42501") return "You don't have permission to do this. Refresh and try again.";
  if (code === "PGRST116") return "This item is no longer available. Refresh and try again.";
  if (code === "23503" || code === "40001") return "This data has changed. Refresh and try again.";
  return fallback;
}
