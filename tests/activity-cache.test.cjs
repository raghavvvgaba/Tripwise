const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");
const { QueryClient, InfiniteQueryObserver } = require("@tanstack/react-query");

function loadModule(file, dependencies) {
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}

function setup(t) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  let events = Array.from({ length: 45 }, (_, i) => ({ id: String(i) }));
  let fail = false;
  const reads = [];
  const options = loadModule("lib/activity-query.ts", { "@/lib/activity": {
    listGroupActivity: async (offset) => {
      reads.push(offset);
      if (fail) throw new Error("Offline");
      return { events: events.slice(offset, offset + 20), hasMore: offset + 20 < events.length };
    },
  } });
  const observer = new InfiniteQueryObserver(client, options.activityQueryOptions("alice"));
  const unsubscribe = observer.subscribe(() => {});
  t.after(() => { unsubscribe(); client.clear(); });
  return { client, options, observer, reads,
    offline: () => { fail = true; }, prepend: () => { events = [{ id: "new" }, ...events]; } };
}

test("fresh navigation retains all loaded Activity pages and deduplicates reads", async (t) => {
  const h = setup(t);
  await Promise.all([h.client.fetchInfiniteQuery(h.options.activityQueryOptions("alice")),
    h.client.fetchInfiniteQuery(h.options.activityQueryOptions("alice"))]);
  await h.observer.fetchNextPage();
  await h.client.fetchInfiniteQuery(h.options.activityQueryOptions("alice"));
  await h.client.refetchQueries({ queryKey: ["activity", "alice"], stale: true, type: "active" });
  assert.deepEqual(h.reads, [0, 20]);
  assert.equal(h.observer.getCurrentResult().data.pages.length, 2);
  await h.observer.fetchNextPage();
  assert.equal(h.observer.getCurrentResult().hasNextPage, false);
});

test("refresh rebuilds pagination from the first page after a new event", async (t) => {
  const h = setup(t);
  await h.observer.refetch();
  await h.observer.fetchNextPage();
  h.prepend();
  await h.client.invalidateQueries({ queryKey: ["activity", "alice"] });
  const ids = h.observer.getCurrentResult().data.pages.flatMap((page) => page.events.map((event) => event.id));
  assert.equal(ids[0], "new");
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(h.reads.slice(-2), [0, 20]);
});

test("failed next-page and manual refresh reads retain the visible timeline", async (t) => {
  const h = setup(t);
  await h.observer.refetch();
  const cached = h.observer.getCurrentResult().data;
  h.offline();
  await h.observer.fetchNextPage();
  assert.equal(h.observer.getCurrentResult().isFetchNextPageError, true);
  assert.equal(h.observer.getCurrentResult().data, cached);
  await h.observer.refetch();
  assert.equal(h.observer.getCurrentResult().isRefetchError, true);
  assert.equal(h.observer.getCurrentResult().data, cached);
});

test("Activity is account-scoped and an empty page cannot loop pagination", async (t) => {
  const h = setup(t);
  await h.observer.refetch();
  assert.equal(h.client.getQueryData(h.options.activityQueryKey("bob")), undefined);
  const options = h.options.activityQueryOptions(null);
  assert.equal(options.enabled, false);
  assert.equal(options.getNextPageParam({ events: [], hasMore: true }, [], 20), undefined);
});

test("invalidation discards a pre-write read and ignores an account change", async (t) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  t.after(() => client.clear());
  let currentUser = "alice";
  const activityQueryKey = (id) => ["activity", id];
  const { refreshActivity } = loadModule("lib/refresh-activity.ts", {
    "@/lib/activity-query": { activityQueryKey },
    "@/store/use-auth-store": { useAuthStore: { getState: () => ({ session: { user: { id: currentUser } } }) } },
  });
  const key = activityQueryKey("alice");
  let resolveOld;
  const oldRead = client.fetchQuery({ queryKey: key, queryFn: () => new Promise((resolve) => { resolveOld = resolve; }) }).catch(() => {});
  await refreshActivity(client, "alice");
  resolveOld({ pages: ["old"] });
  await oldRead;
  assert.equal(client.getQueryData(key), undefined);
  assert.equal(client.getQueryState(key).isInvalidated, true);
  client.setQueryData(key, { pages: ["saved"] });
  currentUser = "bob";
  await refreshActivity(client, "alice");
  assert.equal(client.getQueryState(key).isInvalidated, false);
});

test("Activity hook deduplicates rows, shares member names, and reflects current group state", async (t) => {
  const query = require("@tanstack/react-query");
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  t.after(() => client.clear());
  const event = { id: "event", groupId: "trip", actorId: "bob", eventType: "payment_recorded", paymentFromId: "alice", paymentToId: "bob" };
  const activity = loadModule("lib/activity-query.ts", { "@/lib/activity": {
    listGroupActivity: async () => ({ events: [event], hasMore: true }),
  } });
  let group = { id: "trip", name: "Trip", deletedAt: null };
  let fetching = false;
  let nextReads = 0;
  let forcedGroups = false;
  let refetches = 0;
  const callbacks = [];
  const { useActivity } = loadModule("hooks/use-activity.ts", {
    "@tanstack/react-query": { ...query, useQueryClient: () => client,
      useInfiniteQuery: () => ({ data: { pages: [{ events: [event] }, { events: [event] }] },
        hasNextPage: true, isFetching: fetching, fetchNextPage: async () => { nextReads++; },
        refetch: async () => { refetches++; } }),
      useQueries: ({ queries }) => { assert.equal(queries.length, 1); return [{ data: [{ userId: "bob", name: "Bob" }] }]; },
    },
    react: { useCallback: (fn) => fn },
    "expo-router": { useFocusEffect: (fn) => callbacks.push(fn) },
    "@/lib/query-error": loadModule("lib/query-error.ts", {}),
    "@/lib/activity-query": activity,
    "@/lib/group-data-query": { membersQueryOptions: (_, id) => ({ queryKey: ["members", id] }) },
    "@/store/use-auth-store": { useAuthStore: (select) => select({ session: { user: { id: "alice" } } }) },
    "@/hooks/use-shared-groups": { useSharedGroups: () => ({ groups: [group], loadGroups: async (force) => { forcedGroups = force; } }) },
  });
  let result = useActivity();
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].actorName, "Bob");
  assert.equal(result.items[0].payerName, "you");
  assert.equal(result.items[0].recipientName, "Bob");
  group = { ...group, deletedAt: "today" };
  fetching = true;
  result = useActivity();
  assert.equal(result.items[0].group.deletedAt, "today");
  await result.loadMore();
  assert.equal(nextReads, 0);
  fetching = false;
  await useActivity().loadMore();
  assert.equal(nextReads, 1);
  await result.refresh();
  assert.equal(forcedGroups, true);
  assert.equal(refetches, 1);
  assert.equal(callbacks.length, 3);
});
