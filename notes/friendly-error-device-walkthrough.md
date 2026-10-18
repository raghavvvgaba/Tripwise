# Friendly-error Android walkthrough — 18 October 2026

## Result

The original walkthrough passed 75 native UI assertions and found one cover-photo file-read failure. After the approved fix, four additional Android checks passed, including actual system photo selection, native JPEG processing/reads, both uploads, and the group update against the local backend fixture. The original file-read failure is resolved.

This is a walkthrough of the audited error surfaces, not a claim that every app feature or the production backend passed end to end.

## Environment and method

- Pixel 10 Android 17 emulator, Expo Go, installed project Expo SDK 57.
- A temporary clean emulator using the same installed system image and cached Expo Go APK confirmed the current production-JavaScript fixture build for the final photo checks.
- Real native screens, inputs, buttons, confirmation dialogs, alerts, clipboard, and Android share-sheet cancellation were exercised through Android UI automation.
- A local HTTP fixture backend and disposable accounts/groups supplied controlled Auth, REST, RPC, and Storage responses. Native picker/clipboard/share exceptions were injected at their API boundaries when the OS failure could not be triggered reliably.
- Real Supabase accounts, credentials, groups, expenses, and payments were not modified. The local session fixture used memory storage, separate from real authentication storage.
- Native query failures, permission failures, session errors, server failures, validation messages, and network-shaped exceptions were checked for Java exceptions, hostnames, table/constraint names, and other raw diagnostic text.

## Fixes retained after the walkthrough

1. Auth service outages are no longer automatically described as a device connection problem merely because the SDK uses `AuthRetryableFetchError`. Numeric nonzero HTTP status distinguishes those from a transport failure.
2. Sign In/Register tabs initialize their shadow styling in both modes. Switching modes had triggered a NativeWind component-upgrade/render failure; repeated mode toggles passed after the fix.
3. Sign-out feedback respects the actual local session. The installed SDK can remove the local session while returning a remote sign-out error; the app no longer shows a misleading failure alert over the sign-in screen in that case. Retained-session and thrown-error cases remain covered by regression tests.

## Cover-photo failure resolved after approval

Location: `lib/group-covers.ts`, `uploadImage`.

The native image-processing step produced a local file URI. Its subsequent global `fetch(uri)` returned 404 with 14 bytes, so the existing response check rejected it and no upload was attempted. Accepting status zero would not fix this observed failure; that experimental guard was removed.

Installed the SDK-compatible `expo-file-system` version `~57.0.7` with Expo's installer. Native uploads now call `new File(uri).arrayBuffer()`; web keeps its existing fetch path. The 4 MB byte limit, JPEG content type, unique paths, thumbnail generation, and remote-file cleanup remain in place. SDK 57 package source/types verified the File API because the versioned documentation endpoint was unavailable.

The approved follow-up used Android 17 / Expo Go and a development-JavaScript Metro bundle on port 8094, with local fixture Auth/REST/Storage. No binary bytes or image-processing output were substituted. Native cover/thumbnail requests contained JPEG signatures (`ffd8ff`) and 25,004 / 5,075 bytes for the picker-asset fixture. Selecting the freshly generated synthetic green photo in the actual Android picker produced JPEG uploads of 857 / 845 bytes. Both paths reached the group PATCH and successful UI state.

| Follow-up check | Result |
| --- | --- |
| Native bytes reach failing Storage request; friendly feedback | PASS |
| Both native uploads succeed, group update fails; friendly feedback and both paths cleaned up | PASS |
| Retry succeeds with native cover and thumbnail bytes | PASS |
| Actual Android photo selection, native processing/reads, two uploads, group update | PASS |

Evidence and inspected request metadata are in `.expo/friendly-error-walkthrough/filesystem-followup/`. The original four controlled-binary checks remain listed as historical evidence below; the follow-up checks above now exercise real native bytes.

## Validation after removing test wiring

- `npm run typecheck`: passed.
- `node --test tests/*.test.cjs`: 64 passed, 0 failed (including four new cover-upload regression tests).
- `npm run lint -- --no-cache`: 30 existing errors and 2 warnings remain.
- Focused lint on the new error helper, regression tests, sign-in, account, and cover-upload fixes: 0 errors, 0 warnings.
- `git diff --check`: passed.
- Backend/native test wiring was restored from exact saved originals; only the verified sign-in tab styling fix was reapplied to the saved sign-in source. The auth-outage and sign-out fixes and their regression tests remain.
- Temporary fixture servers, ports, picker wiring, and Android QA photos were removed. The main checkout was kept separate.
- `expo install --check`: the added file-system version is compatible; eight existing package patch mismatches remain.
- `expo-doctor`: 18/21 checks passed. Existing failures concern `newArchEnabled` config schema, missing direct peers `expo-font` / `react-native-worklets`, and those patch mismatches. No unrelated dependency upgrades were made.

## Coverage limits and tooling observations

- No physical-device, iOS, release-APK, real Google consent, real email delivery, or production database-policy/transaction validation is claimed.
- Expo Router emitted a development-mode cold-deep-link warning about updating before mount. No dependency code was patched to suppress it. A production-JavaScript fixture build was independently confirmed on the clean emulator.
- Expo Go cached older experiences and some cold launches returned to Android Home. An extra connection-refused probe and actual photo-picker-cancel probe were not counted as completed checks. Controlled native network failures and picker error handlers were exercised as listed below; actual Android share-sheet cancellation was completed.

## Recorded UI assertions

Screenshots and raw/reviewed results are in the ignored local QA directory: `/Users/raghavvvgaba/Coding/Splitwise/.expo/friendly-error-walkthrough`. Screenshots use disposable fixture data. Superseded or not-reached attempts are excluded from this table.

| Check | Result | Observed expected feedback / state |
| --- | --- | --- |
| Sign in invalid credentials | PASS | Your sign-in details are incorrect. |
| Sign in unconfirmed email | PASS | Please confirm your email address before signing in. |
| Sign in rate limited | PASS | Too many attempts. |
| Sign in unknown backend error | PASS | Could not sign in. |
| Sign in thrown native network failure | PASS | We couldn't connect. |
| Registration weak password | PASS | Please choose a stronger password |
| Registration unknown backend failure | PASS | Could not create your account. |
| Registration confirmation feedback | PASS | Account created. Check your email |
| Google browser launch failure | PASS | Google sign-in failed. |
| Google callback description sanitization | PASS | Could not complete Google sign-in. |
| Google expired callback | PASS | This sign-in attempt has expired. |
| Sign in recovers with successful retry | PASS | QA Active |
| Groups unknown backend failure | PASS | Could not load data. |
| Groups expired session | PASS | Your session has expired. |
| Groups permission failure | PASS | You don't have permission |
| Deleted groups load failure | PASS | Could not load data. |
| Members load failure | PASS | Could not load data. |
| Expenses load failure | PASS | Could not load data. |
| Expense details load failure | PASS | Could not load data. |
| Expense form members load failure | PASS | Could not load data. |
| Activity initial load failure | PASS | Could not load data. |
| Groups unavailable offline with no saved data | PASS | This data is not saved on this device. |
| Groups failed refresh retains existing list | PASS | Could not refresh groups: |
| Balances payment-query failure | PASS | Could not load data. |
| Settlements payment-query failure | PASS | Could not load data. |
| Change email unknown server error | PASS | Could not update your email. |
| Change email network failure | PASS | We couldn't connect. |
| Change password rejected password | PASS | different from your current password |
| Change password network failure | PASS | We couldn't connect. |
| Sign out completes locally despite remote error | PASS | Welcome to Tripwise |
| Create group unknown backend failure | PASS | Could not create group |
| Create group network failure | PASS | We couldn't connect. |
| Add expense unknown backend failure | PASS | Could not save the expense. |
| Add expense network failure | PASS | We couldn't connect. |
| Edit expense concurrent change | PASS | This expense changed since you opened it. |
| Edit expense unknown backend failure | PASS | Could not save the expense. |
| Delete expense permission failure | PASS | You don't have permission |
| Delete group unknown backend failure | PASS | Could not delete group |
| Restore from Deleted groups unknown failure | PASS | Could not restore group |
| Restore from group detail permission failure | PASS | You don't have permission |
| Restore from Activity unknown failure | PASS | Could not restore group |
| Invite load unknown backend error | PASS | Could not load invite. |
| Invite load recovers after retry | PASS | QA Active |
| Invite clipboard native failure | PASS | Could not copy code |
| Invite clipboard unavailable guidance | PASS | Copying isn't available right now. |
| Invite native clipboard recovery | PASS | Copied |
| Invite native share failure | PASS | Could not share invite |
| Invite cancelled share stays on invite | PASS | QA Active |
| Join preview unknown backend failure | PASS | Could not load invite. |
| Join unavailable invite | PASS | This invite code is unavailable. |
| Join invalid code | PASS | This invite code is invalid. |
| Join accept unknown backend error | PASS | Could not join group. |
| Joined successfully but refresh failed | PASS | You joined, but your groups could not refresh. |
| Post-join refresh retry recovery | PASS | QA Active |
| Photo library native failure | PASS | Could not open photo library |
| Cover native image-processing failure | PASS | Could not upload cover photo |
| Cover upload storage failure (controlled binary fixture) | PASS | Could not upload cover photo |
| Payment uncertain network failure | PASS | We couldn't confirm whether this payment was recorded. |
| Payment uncertain save remains retryable | PASS | Retry Payment |
| Payment duplicate confirmation | PASS | Similar payment already recorded |
| Payment explicit duplicate recovery | PASS | QA Active |
| Payment retry preserves request identity | PASS | QA Active |
| Payment balances changed validation | PASS | Balances changed. Refresh the group and try again. |
| Payment internal request field sanitized | PASS | Please return to the group, refresh, and try recording the payment again. |
| Payment unknown server failure preserves uncertainty | PASS | We couldn't confirm whether this payment was recorded. |
| Delete payment permission failure | PASS | You don't have permission |
| Activity next-page error | PASS | Could not load data. |
| Activity pagination retry recovery | PASS | QA activity 20 |
| Activity refresh error retains timeline | PASS | Could not load data. |
| Repeated sign-in registration toggles do not crash | PASS | Welcome to Tripwise |
| Actual Android share sheet cancellation | PASS | QA Active |
| Disposable account sign-out cleanup | PASS | Welcome to Tripwise |
| Real native generated-photo file read (original run) | FAILED, FIXED | Native File API and four passing follow-up checks above |
| Cover group-update failure (controlled binary fixture) | PASS | Could not save cover photo |
| Remove cover permission failure (controlled binary fixture) | PASS | You don't have permission |
| Cover photo recovery after failures (controlled binary fixture) | PASS | Edit |

## Integration into main — 18 October 2026

Transferred the feature commit onto main after its seven newer commits. Automatic screen merges retained the newer light theme, Scout illustrations, offline support, Account update banner, and password-input fix. The lockfile conflict was resolved by keeping main's dependencies and adding `expo-file-system`; no unrelated package versions changed in the lockfile. The screen-test harness now mocks main's existing update-banner import.

- Combined typecheck: passed.
- Combined regression suite: 70 passed, 0 failed.
- Full lint: the same 30 existing errors and 2 warnings.
- Android 17 / Expo Go smoke test on merged main: seven checks passed (Register mode, Sign In mode, friendly rejected sign-in, Account render, Scout invite error, invite retry, and native cover/thumbnail upload plus group update).
- Smoke test used local fixture Auth/REST/Storage and disposable data. Native JPEG bytes were not substituted. No production backend or physical-device proof is claimed.
- Temporary client/picker wiring restored byte-for-byte and fixture servers/ports removed. Integration evidence remains ignored in `.expo/friendly-error-integration/`; original walkthrough evidence was preserved in `.expo/friendly-error-walkthrough/` before archiving the feature worktree.
