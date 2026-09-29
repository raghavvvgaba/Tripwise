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

These files are currently applied manually through the SQL Editor; the numbers document their order but do not track which files a database has run.
