const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const query = require("@tanstack/react-query");

function loadModule(file, dependencies = {}) {
  const source = readFileSync(path.join(path.dirname(require.resolve("../package.json")), file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => dependencies[name] ?? require(name), module, module.exports,
  );
  return module.exports;
}

function setup(t, overrides = {}) {
  const { createQueryClient } = loadModule("lib/query-client.ts");
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  const members = [{ userId: "alice", name: "Alice" }, { userId: "bob", name: "Bob" }];
  let expenses = [{ id: "expense", groupId: "trip", amountMinor: 10000, paidById: "alice",
    shares: [{ userId: "alice", amountMinor: 5000 }, { userId: "bob", amountMinor: 5000 }], updatedAt: "first" }];
  let payments = [];
  const reads = { members: 0, expenses: 0, payments: 0, detail: 0 };
  let session = { user: { id: "alice" } };
  const focusCallbacks = [];
  const cleanups = [];
  t.after(() => { cleanups.forEach((cleanup) => cleanup()); client.clear(); });
  const backend = {
    getGroupMembers: async () => { reads.members++; return members; },
    listGroupExpenses: async () => { reads.expenses++; return expenses; },
    listGroupPayments: async () => { reads.payments++; return payments; },
    getGroupExpense: async (_, id) => { reads.detail++; return expenses.find((expense) => expense.id === id); },
    createGroupExpense: async (input) => { expenses = [...expenses, { ...input, id: "new" }]; return "new"; },
    updateGroupExpense: async (input) => { expenses = expenses.map((expense) => expense.id === input.expenseId
      ? { ...expense, amountMinor: input.amountMinor, updatedAt: "second" } : expense); },
    deleteGroupExpense: async (_, id) => { expenses = expenses.filter((expense) => expense.id !== id); },
    recordGroupPayment: async (input) => { payments = [...payments, { ...input, id: "payment" }]; },
    deleteGroupPayment: async (_, id) => { payments = payments.filter((payment) => payment.id !== id); },
    ...overrides,
  };
  const options = loadModule("lib/group-data-query.ts", {
    "@/lib/expenses": backend, "@/lib/payments": backend, "@/lib/group-invites": backend,
  });
  const auth = Object.assign((select) => select({ session }), { getState: () => ({ session }) });
  const activity = loadModule("lib/activity-query.ts", { "@/lib/activity": { listGroupActivity: async () => ({ events: [], hasMore: false }) } });
  const refreshActivity = loadModule("lib/refresh-activity.ts", {
    "@/lib/activity-query": activity, "@/store/use-auth-store": { useAuthStore: auth },
  });
  const dependencies = {
    "@/lib/query-error": loadModule("lib/query-error.ts", {}),
    "@/lib/refresh-activity": refreshActivity,
    "@/lib/expenses": backend, "@/lib/payments": backend,
    "@/lib/group-data-query": options, "@/store/use-auth-store": { useAuthStore: auth },
    react: { useCallback: (fn) => fn },
    "expo-router": { useFocusEffect: (fn) => focusCallbacks.push(fn) },
    "@tanstack/react-query": {
      ...query,
      useQueryClient: () => client,
      useQuery: (settings) => {
        const observer = new query.QueryObserver(client, settings);
        const unsubscribe = observer.subscribe(() => {});
        cleanups.push(() => { unsubscribe(); observer.getCurrentQuery().destroy(); });
        return observer.getCurrentResult();
      },
      useMutation: (settings) => {
        const observer = new query.MutationObserver(client, settings);
        return { mutateAsync: (variables) => observer.mutate(variables) };
      },
    },
  };
  return {
    client, options, backend, reads,
    hooks: loadModule("hooks/use-group-data.ts", dependencies),
    actions: loadModule("hooks/use-group-data-actions.ts", dependencies).useGroupDataActions("trip"),
    balances: loadModule("utils/shared-expenses.ts").getSharedMemberBalances,
    focus: () => focusCallbacks.forEach((fn) => fn()),
    switchUser: (id) => { session = id ? { user: { id } } : null; },
  };
}

async function loadLists(h) {
  h.hooks.useGroupMembers("trip");
  h.hooks.useGroupExpenses("trip");
  h.hooks.useGroupPayments("trip");
  await Promise.all([
    h.client.fetchQuery(h.options.membersQueryOptions("alice", "trip")),
    h.client.fetchQuery(h.options.expensesQueryOptions("alice", "trip")),
    h.client.fetchQuery(h.options.paymentsQueryOptions("alice", "trip")),
  ]);
}

test("navigation and multiple screens reuse fresh group reads; stale focus refreshes", async (t) => {
  const h = setup(t);
  await loadLists(h);
  await loadLists(h);
  h.focus();
  assert.deepEqual(h.reads, { members: 1, expenses: 1, payments: 1, detail: 0 });
  const key = h.options.membersQueryOptions("alice", "trip").queryKey;
  h.client.setQueryData(key, h.client.getQueryData(key), { updatedAt: Date.now() - 61000 });
  h.focus();
  await h.client.fetchQuery(h.options.membersQueryOptions("alice", "trip"));
  assert.equal(h.reads.members, 2);
});

test("expense details reuse the cached list and manual refresh errors retain data", async (t) => {
  const h = setup(t);
  await loadLists(h);
  const detail = h.hooks.useGroupExpense("trip", "expense");
  assert.equal(detail.data.id, "expense");
  assert.equal(h.reads.detail, 0);
  h.backend.getGroupExpense = async () => { throw new Error("Offline"); };
  await detail.refetch();
  const cached = h.hooks.useGroupExpense("trip", "expense");
  assert.equal(cached.data.id, "expense");
  assert.equal(cached.errorMessage, null);
});

test("create, edit, and delete refresh lists and detail caches", async (t) => {
  const h = setup(t);
  await loadLists(h);
  h.hooks.useGroupExpense("trip", "expense");
  await h.actions.createExpense({ groupId: "trip", amountMinor: 1000 });
  assert.equal(h.hooks.useGroupExpenses("trip").data.length, 2);
  await h.actions.updateExpense({ groupId: "trip", expenseId: "expense", amountMinor: 20000, expectedUpdatedAt: "first" });
  assert.equal(h.hooks.useGroupExpense("trip", "expense").data.amountMinor, 20000);
  assert.equal(h.hooks.useGroupExpense("trip", "expense").data.updatedAt, "second");
  await h.actions.deleteExpense("expense");
  assert.equal(h.hooks.useGroupExpenses("trip").data.some((expense) => expense.id === "expense"), false);
  assert.equal(h.hooks.useGroupExpense("trip", "expense").data, null);
});

test("recording and deleting payments recomputes balances from the cache", async (t) => {
  const h = setup(t);
  await loadLists(h);
  const balance = () => h.balances(h.hooks.useGroupMembers("trip").data,
    h.hooks.useGroupExpenses("trip").data, h.hooks.useGroupPayments("trip").data);
  assert.equal(balance().find((item) => item.member.userId === "bob").netMinor, -5000);
  await h.actions.recordPayment({ groupId: "trip", payerId: "bob", recipientId: "alice", amountMinor: 5000 });
  assert.equal(balance().find((item) => item.member.userId === "bob").netMinor, 0);
  await h.actions.deletePayment("payment");
  assert.equal(balance().find((item) => item.member.userId === "bob").netMinor, -5000);
});

test("failed writes preserve the cache and disabled queries do not fetch", async (t) => {
  const h = setup(t, { deleteGroupExpense: async () => { throw new Error("Denied"); } });
  h.hooks.useGroupMembers("trip", false);
  h.focus();
  assert.equal(h.reads.members, 0);
  await loadLists(h);
  await assert.rejects(h.actions.deleteExpense("expense"), /Denied/);
  assert.equal(h.hooks.useGroupExpenses("trip").data[0].id, "expense");
  assert.equal(h.client.getQueryState(h.options.expensesQueryOptions("alice", "trip").queryKey).isInvalidated, false);
});

test("late write completion cannot restore an old account's cache", async (t) => {
  let finish;
  const h = setup(t, { recordGroupPayment: () => new Promise((resolve) => { finish = resolve; }) });
  await loadLists(h);
  const saving = h.actions.recordPayment({ groupId: "trip" });
  await new Promise((resolve) => setImmediate(resolve));
  h.switchUser("bob");
  assert.equal(h.hooks.useGroupMembers("trip", false).data, undefined);
  h.client.clear();
  finish();
  await saving;
  assert.equal(h.client.getQueryCache().getAll().length, 0);
  await assert.rejects(h.actions.deletePayment("payment"), /Sign in required/);
});

test("a successful write discards an earlier read before refreshing", async (t) => {
  let finishOld;
  let reads = 0;
  const h = setup(t, { listGroupExpenses: () => {
    reads++;
    return reads === 1 ? new Promise((resolve) => { finishOld = resolve; })
      : Promise.resolve([{ id: "new", groupId: "trip" }]);
  } });
  h.hooks.useGroupExpenses("trip");
  await h.actions.createExpense({ groupId: "trip" });
  finishOld([]);
  assert.equal(h.hooks.useGroupExpenses("trip").data[0].id, "new");
});

test("every successful expense and payment change invalidates Activity; failures do not", async (t) => {
  const h = setup(t);
  const key = ["activity", "alice"];
  const writes = [
    () => h.actions.createExpense({ groupId: "trip" }),
    () => h.actions.updateExpense({ groupId: "trip", expenseId: "expense" }),
    () => h.actions.deleteExpense("expense"),
    () => h.actions.recordPayment({ groupId: "trip" }),
    () => h.actions.deletePayment("payment"),
  ];
  for (const write of writes) {
    h.client.setQueryData(key, { pages: [], pageParams: [] });
    await write();
    assert.equal(h.client.getQueryState(key).isInvalidated, true);
  }
  h.client.setQueryData(key, { pages: [], pageParams: [] });
  h.backend.createGroupExpense = async () => { throw new Error("Failed"); };
  await assert.rejects(h.actions.createExpense({ groupId: "trip" }));
  assert.equal(h.client.getQueryState(key).isInvalidated, false);
});

test("restored expense lists seed details without a network request", async (t) => {
  const policy = loadModule("lib/query-client.ts");
  const { createQueryPersistence } = loadModule("lib/query-persistence.ts", { "@/lib/query-client": policy });
  const { persistQueryClientSave, persistQueryClientRestore } = require("@tanstack/react-query-persist-client");
  let saved = null;
  const storage = { getItem: async () => saved, setItem: async (_, value) => { saved = value; }, removeItem: async () => { saved = null; } };
  const before = setup(t);
  await loadLists(before);
  const persistence = createQueryPersistence("alice", storage, () => true);
  await persistQueryClientSave({ queryClient: before.client, ...persistence.persistOptions });
  const after = setup(t, { getGroupExpense: async () => { throw new Error("Offline"); } });
  await persistQueryClientRestore({ queryClient: after.client, ...persistence.persistOptions });
  const detail = after.hooks.useGroupExpense("trip", "expense");
  assert.equal(detail.data.id, "expense");
  assert.equal(detail.dataUpdatedAt, before.client.getQueryState(before.options.expensesQueryOptions("alice", "trip").queryKey).dataUpdatedAt);
  assert.deepEqual(after.reads, { members: 0, expenses: 0, payments: 0, detail: 0 });
});

test("unavailable unsaved group data explains that internet is needed", async (t) => {
  const h = setup(t, { getGroupMembers: async () => { throw new Error("Offline"); } });
  await h.hooks.useGroupMembers("unopened").refetch();
  h.client.setDefaultOptions({ queries: { retry: false, retryOnMount: false } });
  const result = h.hooks.useGroupMembers("unopened");
  assert.equal(result.data, undefined);
  assert.match(result.errorMessage, /not saved on this device.*Connect to the internet/);
});

test("an invalidated saved list still supplies expense details over repeated offline restarts", async (t) => {
  const policy = loadModule("lib/query-client.ts");
  const { createQueryPersistence } = loadModule("lib/query-persistence.ts", { "@/lib/query-client": policy });
  const { persistQueryClientSave, persistQueryClientRestore } = require("@tanstack/react-query-persist-client");
  let saved = null;
  const storage = { getItem: async () => saved, setItem: async (_, value) => { saved = value; }, removeItem: async () => { saved = null; } };
  const persistence = () => createQueryPersistence("alice", storage, () => true).persistOptions;
  const before = setup(t);
  await loadLists(before);
  const listKey = before.options.expensesQueryOptions("alice", "trip").queryKey;
  const original = before.client.getQueryData(listKey)[0];
  await before.client.invalidateQueries({ queryKey: listKey, refetchType: "none" });
  await persistQueryClientSave({ queryClient: before.client, ...persistence() });
  for (let restart = 0; restart < 4; restart++) {
    const offline = async () => { throw new Error('Error: fetch failed: java.net.UnknownHostException: Unable to resolve host "example.test"'); };
    const h = setup(t, { getGroupExpense: offline, listGroupExpenses: offline, getGroupMembers: offline, listGroupPayments: offline });
    await persistQueryClientRestore({ queryClient: h.client, ...persistence() });
    const detail = h.hooks.useGroupExpense("trip", "expense");
    assert.deepEqual(detail.data, original);
    await Promise.all([detail.refetch(), h.hooks.useGroupExpenses("trip").refetch(), h.hooks.useGroupMembers("trip").refetch(), h.hooks.useGroupPayments("trip").refetch()]);
    assert.deepEqual(h.hooks.useGroupExpense("trip", "expense").data, original);
    assert.equal(h.hooks.useGroupExpense("trip", "expense").errorMessage, null);
    await persistQueryClientSave({ queryClient: h.client, ...persistence() });
  }
});

test("a failed detail query can recover from an invalidated list without reviving deletion markers", async (t) => {
  const h = setup(t, { getGroupExpense: async () => { throw new Error("Offline"); } });
  await loadLists(h);
  const detailKey = h.options.expenseQueryOptions("alice", "trip", "expense").queryKey;
  await assert.rejects(h.client.fetchQuery(h.options.expenseQueryOptions("alice", "trip", "expense")));
  await h.client.invalidateQueries({ queryKey: h.options.expensesQueryOptions("alice", "trip").queryKey, refetchType: "none" });
  assert.equal(h.hooks.useGroupExpense("trip", "expense").data.amountMinor, 10000);
  h.client.setQueryData(detailKey, null);
  assert.equal(h.hooks.useGroupExpense("trip", "expense").data, null);
});

test("cached reads hide native network failures while unsaved reads and permission failures remain explained", () => {
  const { queryErrorMessage } = loadModule("lib/query-error.ts");
  for (const message of ["TypeError: Network request failed", "Failed to fetch", "Error: fetch failed: java.net.UnknownHostException: Unable to resolve host example.test"]) {
    assert.equal(queryErrorMessage({ message }, true), null);
    assert.match(queryErrorMessage({ message }, false), /not saved.*Connect to the internet/);
    assert.doesNotMatch(queryErrorMessage({ message }, false), /java|example.test|TypeError/);
  }
  assert.equal(queryErrorMessage(null, true, true), null);
  assert.match(queryErrorMessage(null, false, true), /Connect to the internet/);
  assert.equal(queryErrorMessage(new Error("You no longer have access to this group."), true), "You no longer have access to this group.");
});
