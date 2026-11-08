# Database SQL

For a fresh Supabase database, run these files in order in the SQL Editor:

1. `00_groups.sql`
2. `01_group_invites.sql`
3. `02_short_invite_codes.sql`
4. `03_group_member_names.sql`
5. `04_group_expenses.sql`
6. `05_group_deletion.sql`
7. `06_expense_editing.sql`
8. `07_expense_deletion.sql`
9. `08_group_payments.sql`
10. `09_payment_dates.sql`
11. `10_group_covers.sql`
12. `11_group_cover_policy_fix.sql`
13. `12_group_cover_thumbnails.sql`
14. `13_remove_group_archiving.sql`
15. `14_payment_safety.sql`
16. `15_payment_reminders.sql`
17. `16_keep_alive_ping.sql`
18. `17_push_tokens_service_role.sql`

Each file is intended to run once. Future schema changes should get a new numbered file; do not edit an earlier file after it has been applied to a database.

## Existing databases

Do not rerun `00_groups.sql` on a database that already has the groups tables. If that database ran the original `groups-schema.sql` before its RLS correction, run `legacy/group-membership-rls-fix.sql` once. Then run `01_group_invites.sql` only if the invite changes have not already been applied.

The legacy patch is kept for existing databases. Its changes are already included in `00_groups.sql` for fresh databases.

Run `02_short_invite_codes.sql` after `01_group_invites.sql` on existing databases. It replaces UUID invite codes with eight-letter codes; previously shared UUID links stop working. Apply this file before running an app build that expects short codes.

Run `03_group_member_names.sql` after `02_short_invite_codes.sql`. It adds a member-only function that returns names from Supabase Auth metadata. Apply it before running an app build that shows the group member list.

Run `04_group_expenses.sql` after `03_group_member_names.sql`. It adds shared expenses, member-only read policies, and an atomic add-expense function. Apply it before running an app build that adds shared expenses. Existing SQL files should not be rerun.

Run `05_group_deletion.sql` after `04_group_expenses.sql`. It replaces personal archiving with shared, reversible deletion, returns previously archived memberships to active groups, records group and expense activity, and blocks invites and new expenses while a group is deleted. Apply it before running an app build with Delete group or Activity recovery.

Run `06_expense_editing.sql` after `05_group_deletion.sql`. It adds edit attribution, an atomic member-only edit function, and expense edit events in Activity. Apply it before running an app build that edits shared expenses.

Run `07_expense_deletion.sql` after `06_expense_editing.sql`. It adds permanent, member-only expense deletion. Expense shares are removed, earlier Activity entries remain as unlinked snapshots, and a deletion event is recorded for all group members. There is no expense restore action.

Run `08_group_payments.sql` after `07_expense_deletion.sql`. It adds recorded group payments, a member-only payment function that checks current balances, and payment events in Activity. Payments remain in a deleted group and return when the group is restored. Apply it before running an app build with shared settlements.

Run `09_payment_dates.sql` after `08_group_payments.sql`. It adds the date the payment happened, backfills existing payments with their UTC recording date, and validates new dates against the recorder's local day. Activity remains ordered by its `created_at` recording time.

Create a private Storage bucket named exactly `Group-cover-images`, then run `10_group_covers.sql` after `09_payment_dates.sql` has been applied. It adds a cover path on shared groups and member-only Storage policies to the existing bucket. Configure the bucket to accept JPG, PNG, and WebP files up to 4 MB. Apply the SQL before running an app build with group cover photos.

Run `11_group_cover_policy_fix.sql` after `10_group_covers.sql`. It repairs the Storage policies to check the uploaded object's path instead of the group's name. Apply this repair even when all three cover policies already exist; counting policy names does not verify their conditions.

Run `12_group_cover_thumbnails.sql` after `11_group_cover_policy_fix.sql`, before running the app with compressed covers. New photo uploads save a JPEG cover with a maximum dimension of 1200 pixels and a cropped 300-pixel-wide card thumbnail. Both paths are saved together, and active files are protected from cleanup. Existing photos keep using their original cover until replaced; no automatic backfill is performed.

Run `13_remove_group_archiving.sql` after `12_group_cover_thumbnails.sql`. It removes the retired membership archive column and updates the add-expense function to rely on membership and the existing deleted-group guard. Shared deletion, recovery, expenses, and payments are preserved. Archive references in earlier SQL files remain only as migration history; do not rerun or rewrite those files.

These files are currently applied manually through the SQL Editor; the numbers document their order but do not track which files a database has run.

Run `14_payment_safety.sql` after `13_remove_group_archiving.sql`, before running this app build. It replaces the old payment RPC signature: only the sender or recipient may record or delete a payment. Request IDs make retries idempotent, and identical active payment details require explicit confirmation. Deletion excludes the payment from balances and lists and adds an Activity event. The internal cancelled row retains its request ID to prevent retries from recreating it; there is no restore action.

Run `15_payment_reminders.sql` after `14_payment_safety.sql`, before an app build with payment reminders. It adds the `push_tokens` table (each Expo push token belongs to one user; `register_push_token` claims it for whoever signed in last, and users can only read or delete their own), private reminder attempts, the `reminder_sent` Activity event visible only to the sender and the reminded person, and the `send_payment_reminder` RPC. The RPC checks membership and the same greedy settlement matching as the app, then reserves an attempt per (group, debtor, creditor). Only the service-role `finish_payment_reminder` RPC can confirm or release that attempt. Expo acceptance creates Activity and starts the 24-hour cooldown; failed sends release the attempt for immediate retry. Pending attempts expire after five minutes if the worker stops or cleanup fails. Reminders are hidden while the group is deleted, like payments.

Expo acceptance does not prove delivery to the phone. If a network response is lost after Expo accepted a push, a retry can send another notification; this flow cannot guarantee exactly-once delivery across Expo and Postgres. If database finalization fails after acceptance, the function retries finalization once and retains the pending reservation instead of releasing it.

## Payment reminder Edge Function

The `supabase/functions/send-payment-reminder` function is deployed separately from the app: run `supabase functions deploy send-payment-reminder` from the repo root (or paste the code into a new function in the Supabase dashboard). It uses the platform's built-in `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` secrets, so no extra secrets are required. Delivering pushes on Android additionally needs the FCM credential uploaded once via `npx eas credentials`; iOS needs an Apple developer account and APNs keys.

## Local payment regression checks

With PostgreSQL binaries (`initdb`, `pg_ctl`, `psql`) installed, run `python3 DB/tests/payment_safety.py`. It creates and removes an isolated temporary database, uses local Auth/Storage stubs, applies all numbered migrations, and checks payment permissions, duplicate/concurrent requests, deletion, reminders (tokens, cooldown, settlement amounts, private visibility), Activity, and date/balance validation. It does not connect to Supabase.
