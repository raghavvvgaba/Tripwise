"""Payment authorization/integrity regression checks against isolated PostgreSQL."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import json
import subprocess
import tempfile

DB = Path(__file__).resolve().parents[1]
USERS = [f"00000000-0000-0000-0000-{i:012d}" for i in range(1, 5)]
GROUP = "00000000-0000-0000-0000-000000000100"


def run_checks(socket):
    def sql(statement, actor=None, expected_error=None, role="authenticated"):
        prefix = "set time zone 'UTC';\n"
        if actor is not None:
            prefix += f"set role {role}; set request.jwt.claim.sub = '{actor}';\n"
        result = subprocess.run(
            ["psql", "-X", "-qAt", "-h", socket, "-p", "55439", "-d", "postgres", "-v", "ON_ERROR_STOP=1"],
            input="\\set VERBOSITY verbose\n" + prefix + statement,
            text=True, capture_output=True,
        )
        if expected_error:
            assert result.returncode != 0 and expected_error in result.stderr, result.stderr
        else:
            assert result.returncode == 0, result.stderr
        return result.stdout.strip()

    def request(key, amount=1000, allow=False, date="current_date", payer=USERS[0], recipient=USERS[1]):
        return (f"select public.record_group_payment('{GROUP}', '{payer}', '{recipient}', "
                f"{amount}, {date}, 0, '{key}', {str(allow).lower()});")

    def key(i):
        return f"00000000-0000-0000-0001-{i:012d}"

    def delete(payment, actor, expected_error=None):
        return sql(f"select public.delete_group_payment('{GROUP}', '{payment}');", actor, expected_error)

    sql("""
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to authenticated;
      create schema storage;
      create table storage.buckets (id text primary key, public boolean);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(text) returns text[] language sql immutable as
        $$ select string_to_array($1, '/') $$;
      insert into storage.buckets values ('Group-cover-images', false);
    """)
    migrations = sorted(DB.glob("[0-9][0-9]_*.sql"))
    for migration in migrations:
        if migration.name.startswith("14_"):
            # Existing third-party records survive migration, but acquire the new permissions.
            sql("insert into auth.users(id) values " + ",".join(f"('{u}')" for u in USERS) + ";")
            sql(f"insert into public.groups(id,name,currency,created_by) values ('{GROUP}','Test','INR','{USERS[1]}');")
            sql(f"insert into public.group_members(group_id,user_id) values ('{GROUP}','{USERS[0]}'), ('{GROUP}','{USERS[2]}');")
            expense = sql(f"insert into public.expenses(group_id,description,amount_minor,paid_by,split_mode,expense_date,created_by) values ('{GROUP}','Cost',30000,'{USERS[1]}','exact',current_date,'{USERS[1]}') returning id;")
            sql(f"insert into public.expense_shares values ('{expense}','{USERS[0]}',30000);")
            legacy = sql(f"select public.record_group_payment('{GROUP}','{USERS[0]}','{USERS[1]}',500,current_date,0);", USERS[2])
        sql(migration.read_text())

    assert sql(f"select count(*) from public.group_payments where id='{legacy}' and request_id is not null;") == "1"
    assert sql("select to_regprocedure('public.record_group_payment(uuid,uuid,uuid,bigint,date,integer)') is null;") == "t"
    sql(request(key(1)), USERS[2], "42501")  # Uninvolved group member.
    sql(request(key(1), payer=USERS[3]), USERS[3], "42501")  # Involved outsider.
    sql(request(key(1)), "", "42501")
    sql(request(key(1)), USERS[0], "42501", role="anon")
    sql(request(key(1), recipient=USERS[3]), USERS[0], "22023")
    sql(request(key(1), date="current_date + 1"), USERS[0], "22023")
    sql(request(key(1), amount=30001), USERS[0], "22023")
    first = sql(request(key(1)), USERS[0])
    assert sql(request(key(1)), USERS[0]) == first
    sql(request(key(1), amount=999), USERS[0], "22023")
    sql(request(key(1)), USERS[1], "22023")  # Same key, different recorder.
    sql(request(key(2)), USERS[1], "23505")
    second = sql(request(key(2), allow=True), USERS[1])
    assert sql(f"select recorded_by from public.group_payments where id='{second}';") == USERS[1]
    assert sql("select count(*) from public.group_activity where event_type='payment_recorded';") == "3"
    sql(f"update public.group_payments set amount_minor=1 where id='{first}';", USERS[0], "42501")
    sql(f"delete from public.group_payments where id='{first}';", USERS[0], "42501")
    sql(f"insert into public.group_payments(group_id,payer_id,recipient_id,amount_minor,recorded_by,payment_date) values ('{GROUP}','{USERS[0]}','{USERS[1]}',1,'{USERS[0]}',current_date);", USERS[0], "42501")
    delete(first, USERS[2], "42501")
    delete(first, USERS[3], "42501")
    delete(first, USERS[1])
    delete(first, USERS[0])  # Retry is harmless, even by the other party.
    assert sql(f"select count(*) from public.group_payments where id='{first}';", USERS[0]) == "0"
    assert sql(f"select deleted_by from public.group_payments where id='{first}';") == USERS[1]
    assert sql("select count(*) from public.group_activity where event_type='payment_deleted';", USERS[2]) == "1"
    sql(request(key(1)), USERS[0], "22023")  # Cannot resurrect a deleted request.
    delete(legacy, USERS[2], "42501")
    delete(legacy, USERS[1])
    delete(second, USERS[0])
    assert sql("select count(*) from public.group_payments;", USERS[0]) == "0"
    assert sql("select count(*) from public.group_payments;", USERS[3]) == "0"

    # Concurrent retries return one ID and write one payment/event.
    with ThreadPoolExecutor(max_workers=2) as pool:
        ids = list(pool.map(lambda _: sql(request(key(3), amount=2000), USERS[0]), range(2)))
    assert ids[0] == ids[1]
    assert sql(f"select count(*) from public.group_payments where request_id='{key(3)}';") == "1"

    # Concurrent independent identical submissions require confirmation on the loser.
    def concurrent(i):
        try:
            return sql(request(key(i), amount=3000), USERS[0])
        except AssertionError as error:
            assert "23505" in str(error), str(error)
            return "duplicate"
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(concurrent, [4, 5]))
    assert results.count("duplicate") == 1
    assert sql("select count(*) from public.group_activity where event_type='payment_recorded';") == "5"

    # Deleted payments no longer consume outstanding balance: 30000 - 5000 = 25000.
    full = sql(request(key(6), amount=25000), USERS[1])
    assert sql(request(key(6), amount=25000), USERS[1]) == full
    sql(request(key(7), amount=1), USERS[0], "22023")
    delete(full, USERS[0])
    seventh = sql(request(key(7), amount=25000), USERS[0])
    # Leave one 25000 debt outstanding so the reminder checks have a balance.
    delete(seventh, USERS[0])

    # Payment reminders: tokens, permissions, cooldown, and private activity.
    def remind(recipient, actor, expected_error=None, role="authenticated"):
        return sql(f"select public.send_payment_reminder('{GROUP}', '{recipient}');", actor, expected_error, role)

    def register(token, actor, expected_error=None, role="authenticated"):
        return sql(f"select public.register_push_token('{token}', 'android');", actor, expected_error, role)

    register("tok-a", USERS[0])
    register("tok-a", USERS[0])  # Re-registering is idempotent.
    assert sql("select count(*) from public.push_tokens;", USERS[0]) == "1"
    assert sql("select count(*) from public.push_tokens;", USERS[2]) == "0"
    # Direct writes are closed; registration only goes through the RPC.
    sql(f"insert into public.push_tokens(user_id, token, platform) values ('{USERS[0]}', 'tok-b', 'android');", USERS[2], "42501")
    sql(f"insert into public.push_tokens(user_id, token, platform) values ('{USERS[2]}', 'tok-b', 'android');", USERS[2], "42501")
    register("tok-b", "", "42501")  # No session.
    register("tok-b", USERS[2], "42501", role="anon")
    # A shared device moves to whoever signs in; the previous account loses it.
    register("tok-shared", USERS[2])
    register("tok-shared", USERS[0])
    assert sql("select count(*) from public.push_tokens;", USERS[2]) == "0"
    assert sql("select count(*) from public.push_tokens;", USERS[0]) == "2"
    sql("delete from public.push_tokens where token='tok-shared';", USERS[0])
    # The Edge Function looks up and prunes tokens as service_role.
    assert sql(f"select count(*) from public.push_tokens where user_id='{USERS[0]}';", "", role="service_role") == "1"
    register("tok-stale", USERS[2])
    sql("delete from public.push_tokens where token='tok-stale';", "", role="service_role")
    assert sql("select count(*) from public.push_tokens where token='tok-stale';") == "0"
    sql(f"delete from public.push_tokens where user_id='{USERS[0]}';", USERS[2])
    assert sql("select count(*) from public.push_tokens;", USERS[0]) == "1"

    remind(USERS[0], "", "42501")  # No session.
    remind(USERS[0], USERS[0], "42501", role="anon")
    remind(USERS[0], USERS[3], "42501")  # Caller not in the group.
    remind(USERS[3], USERS[1], "This person is not a member")  # Recipient not in the group.
    remind(USERS[1], USERS[1], "Invalid reminder details")  # Self reminder.
    remind(USERS[0], USERS[2], "does not owe you money")  # Caller is not owed anything.
    def reserve():
        return json.loads(remind(USERS[0], USERS[1]))

    def finish(attempt, sent, actor="", role="service_role", expected_error=None):
        return sql(f"select public.finish_payment_reminder('{attempt}', {str(sent).lower()});", actor, expected_error, role)

    pending = reserve()
    assert pending['amountMinor'] == 25000
    assert sql("select count(*) from public.group_activity where event_type='reminder_sent';") == "0"
    remind(USERS[0], USERS[1], "already being sent")
    finish(pending['attemptId'], True, USERS[1], "authenticated", "42501")
    finish(pending['attemptId'], False, USERS[0], "authenticated", "42501")
    finish(pending['attemptId'], True, "", "anon", "42501")
    sql("select * from app_private.payment_reminder_attempts;", USERS[1], "42501")
    assert finish(pending['attemptId'], False) == "t"
    assert sql("select count(*) from public.group_activity where event_type='reminder_sent';") == "0"
    # Failure permits an immediate retry, and stale callbacks cannot affect it.
    retry = reserve()
    assert retry['attemptId'] != pending['attemptId']
    assert finish(pending['attemptId'], True) == "f"
    # Abandoned reservations expire; only the replacement may be finalized.
    sql("update app_private.payment_reminder_attempts set reserved_at = now() - interval '6 minutes';")
    replacement = reserve()
    assert finish(retry['attemptId'], False) == "f"
    assert finish(replacement['attemptId'], True) == "t"
    assert finish(replacement['attemptId'], True) == "t"  # Idempotent completion.
    assert finish(replacement['attemptId'], False) == "f"  # Cannot release sent pushes.
    remind(USERS[0], USERS[1], "A reminder was already sent")  # Daily cooldown.
    sql("update app_private.payment_reminder_attempts set sent_at = now() - interval '25 hours';")
    # Two simultaneous new requests reserve exactly one attempt.
    def concurrent_reminder(_):
        try:
            return reserve()
        except AssertionError as error:
            assert "already being sent" in str(error), str(error)
            return None
    with ThreadPoolExecutor(max_workers=2) as pool:
        attempts = list(pool.map(concurrent_reminder, range(2)))
    assert attempts.count(None) == 1
    winner = next(attempt for attempt in attempts if attempt)
    assert winner['amountMinor'] == 25000
    assert finish(winner['attemptId'], True) == "t"
    # Only the sender and the reminded person see reminder events.
    assert sql("select count(*) from public.group_activity where event_type='reminder_sent';", USERS[1]) == "2"
    assert sql("select count(*) from public.group_activity where event_type='reminder_sent';", USERS[0]) == "2"
    assert sql("select count(*) from public.group_activity where event_type='reminder_sent';", USERS[2]) == "0"
    sql(f"delete from public.push_tokens where user_id='{USERS[0]}';", USERS[0])
    assert sql("select count(*) from public.push_tokens;", USERS[0]) == "0"

    sql(f"update public.groups set deleted_at=now() where id='{GROUP}';")
    sql(request(key(8)), USERS[0], "42501")
    delete(ids[0], USERS[0], "42501")
    assert sql("select count(*) from public.group_payments;", USERS[0]) == "0"
    assert sql("select count(*) from public.group_activity where event_type in ('payment_recorded','payment_deleted');", USERS[0]) == "0"
    print("PASS: migration, permissions, dates, balances, retries, duplicates, concurrent writes, deletion, reminders, Activity and RLS")


with tempfile.TemporaryDirectory(prefix="tripwise-payments-") as temp:
    data = str(Path(temp) / "data")
    subprocess.run(["initdb", "-D", data, "-A", "trust", "--no-sync"], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["pg_ctl", "-D", data, "-l", str(Path(temp) / "server.log"), "-o", f"-c listen_addresses='' -k {temp} -p 55439", "-w", "start"], check=True, stdout=subprocess.DEVNULL)
    try:
        run_checks(temp)
    finally:
        subprocess.run(["pg_ctl", "-D", data, "-m", "immediate", "-w", "stop"], check=True, stdout=subprocess.DEVNULL)
