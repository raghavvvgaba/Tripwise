# Database SQL

For a fresh Supabase database, run these files in order in the SQL Editor:

1. `00_groups.sql`
2. `01_group_invites.sql`
3. `02_short_invite_codes.sql`
4. `03_group_member_names.sql`
5. `04_group_expenses.sql`

Each file is intended to run once. Future schema changes should get a new numbered file; do not edit an earlier file after it has been applied to a database.

## Existing databases

Do not rerun `00_groups.sql` on a database that already has the groups tables. If that database ran the original `groups-schema.sql` before its RLS correction, run `legacy/group-membership-rls-fix.sql` once. Then run `01_group_invites.sql` only if the invite changes have not already been applied.

The legacy patch is kept for existing databases. Its changes are already included in `00_groups.sql` for fresh databases.

Run `02_short_invite_codes.sql` after `01_group_invites.sql` on existing databases. It replaces UUID invite codes with eight-letter codes; previously shared UUID links stop working. Apply this file before running an app build that expects short codes.

Run `03_group_member_names.sql` after `02_short_invite_codes.sql`. It adds a member-only function that returns names from Supabase Auth metadata. Apply it before running an app build that shows the group member list.

Run `04_group_expenses.sql` after `03_group_member_names.sql`. It adds shared expenses, member-only read policies, and an atomic add-expense function. Apply it before running an app build that adds shared expenses. Existing SQL files should not be rerun.

These files are currently applied manually through the SQL Editor; the numbers document their order but do not track which files a database has run.
