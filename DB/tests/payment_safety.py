"""Payment authorization/integrity regression checks against isolated PostgreSQL."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
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
    sql(request(key(7), amount=25000), USERS[0])

    sql(f"update public.groups set deleted_at=now() where id='{GROUP}';")
    sql(request(key(8)), USERS[0], "42501")
    delete(ids[0], USERS[0], "42501")
    assert sql("select count(*) from public.group_payments;", USERS[0]) == "0"
    assert sql("select count(*) from public.group_activity where event_type in ('payment_recorded','payment_deleted');", USERS[0]) == "0"
    print("PASS: migration, permissions, dates, balances, retries, duplicates, concurrent writes, deletion, Activity and RLS")


with tempfile.TemporaryDirectory(prefix="tripwise-payments-") as temp:
    data = str(Path(temp) / "data")
    subprocess.run(["initdb", "-D", data, "-A", "trust", "--no-sync"], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["pg_ctl", "-D", data, "-l", str(Path(temp) / "server.log"), "-o", f"-c listen_addresses='' -k {temp} -p 55439", "-w", "start"], check=True, stdout=subprocess.DEVNULL)
    try:
        run_checks(temp)
    finally:
        subprocess.run(["pg_ctl", "-D", data, "-m", "immediate", "-w", "stop"], check=True, stdout=subprocess.DEVNULL)
