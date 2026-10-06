const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const query = require("@tanstack/react-query");

// Exercise the production hooks with the real QueryClient/MutationObserver.
// Only React/navigation and backend IO are replaced; no test library is needed.
function loadModule(file, dependencies) {
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
  const { createQueryClient } = loadModule("lib/query-client.ts", {});
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } });
  t.after(() => client.clear());
  let session = { user: { id: "alice" } };
  let reads = 0;
  let groups = [{ id: "one", name: "Trip", currency: "INR", deletedAt: null }];
  const backend = {
    listGroups: async () => { reads++; return groups.map((group) => ({ ...group })); },
    createGroup: async (name, currency) => {
      const group = { id: "two", name, currency, deletedAt: null };
      groups = [group, ...groups];
      return group;
    },
    deleteSharedGroup: async (id) => {
      groups = groups.map((group) => group.id === id ? { ...group, deletedAt: "today" } : group);
      return "today";
    },
    restoreSharedGroup: async (id) => {
      groups = groups.map((group) => group.id === id ? { ...group, deletedAt: null } : group);
    },
    updateGroupCover: async (id, coverPath, coverThumbnailPath) => {
      groups = groups.map((group) => group.id === id ? { ...group, coverPath, coverThumbnailPath } : group);
    },
    ...overrides,
  };
  const auth = Object.assign((select) => select({ session }), { getState: () => ({ session }) });
  const options = loadModule("lib/groups-query.ts", { "@/lib/groups": backend });
  const hooks = loadModule("hooks/use-shared-groups.ts", {
    "@/lib/groups": backend,
    "@/lib/groups-query": options,
    "@/lib/group-data-query": { groupDataKey: (userId, groupId) => ["group-data", userId, groupId] },
    "@/store/use-auth-store": { useAuthStore: auth },
    react: { useCallback: (fn) => fn },
    "expo-router": { useFocusEffect: () => {} },
    "@tanstack/react-query": {
      ...query,
      useQueryClient: () => client,
      useQuery: (settings) => new query.QueryObserver(client, settings).getCurrentResult(),
      useMutation: (settings) => {
        const observer = new query.MutationObserver(client, settings);
        return { mutateAsync: (variables) => observer.mutate(variables) };
      },
    },
  });
  return {
    client, hooks, backend, options,
    reads: () => reads,
    switchUser: (id) => { session = id ? { user: { id } } : null; },
  };
}

test("fresh navigation reads share data and stale reads refetch", async (t) => {
  const h = setup(t);
  await h.hooks.useSharedGroups().loadGroups();
  await h.hooks.useSharedGroups().loadGroups();
  assert.equal(h.reads(), 1);
  const settings = h.options.groupsQueryOptions("alice");
  h.client.setQueryData(settings.queryKey, h.client.getQueryData(settings.queryKey), {
    updatedAt: Date.now() - settings.staleTime - 1,
  });
  await h.hooks.useSharedGroups().loadGroups();
  assert.equal(h.reads(), 2);
});

test("concurrent screens share one in-flight request", async (t) => {
  const h = setup(t);
  const first = h.hooks.useSharedGroups().loadGroups();
  const second = h.hooks.useSharedGroups().loadGroups();
  await Promise.all([first, second]);
  assert.equal(h.reads(), 1);
});

test("manual refresh bypasses freshness and errors preserve cached data", async (t) => {
  const h = setup(t);
  const cached = await h.hooks.useSharedGroups().loadGroups();
  await h.hooks.useSharedGroups().loadGroups(true);
  assert.equal(h.reads(), 2);
  h.backend.listGroups = async () => { throw new Error("Offline"); };
  await assert.rejects(h.hooks.useSharedGroups().loadGroups(true), /Offline/);
  const screen = h.hooks.useSharedGroups();
  assert.deepEqual(screen.groups, cached);
  assert.equal(screen.error, null);
  assert.equal(screen.refreshError, "Offline");
  assert.equal(screen.isLoading, false);
});

test("group mutations update and invalidate the shared cache", async (t) => {
  const h = setup(t);
  await h.hooks.useSharedGroups().loadGroups();
  const actions = h.hooks.useGroupActions();
  await actions.createGroup("New trip", "INR");
  let groups = h.client.getQueryData(["groups", "alice"]);
  assert.equal(groups[0].id, "two");
  assert.equal(h.client.getQueryState(["groups", "alice"]).isInvalidated, true);
  await actions.deleteGroup("one");
  assert.equal(h.client.getQueryData(["groups", "alice"]).find((g) => g.id === "one").deletedAt, "today");
  await actions.restoreGroup("one");
  assert.equal(h.client.getQueryData(["groups", "alice"]).find((g) => g.id === "one").deletedAt, null);
  await actions.setCover("one", "cover.jpg", "thumb.jpg");
  assert.equal(h.client.getQueryData(["groups", "alice"]).find((g) => g.id === "one").coverThumbnailPath, "thumb.jpg");
});

test("account keys isolate data and late mutations cannot repopulate a cleared cache", async (t) => {
  let finish;
  const h = setup(t, { createGroup: () => new Promise((resolve) => { finish = resolve; }) });
  await h.hooks.useSharedGroups().loadGroups();
  const saving = h.hooks.useGroupActions().createGroup("Late", "INR");
  await new Promise((resolve) => setImmediate(resolve));
  h.switchUser("bob");
  assert.deepEqual(h.hooks.useSharedGroups().groups, []);
  h.client.clear();
  finish({ id: "late", name: "Late", currency: "INR" });
  await saving;
  assert.equal(h.client.getQueryCache().getAll().length, 0);
  h.switchUser(null);
  await assert.rejects(h.hooks.useSharedGroups().loadGroups(), /Sign in required/);
});

test("post-join forced refresh discards an older in-flight snapshot", async (t) => {
  let finishOld;
  let reads = 0;
  const h = setup(t, { listGroups: () => {
    reads++;
    return reads === 1 ? new Promise((resolve) => { finishOld = resolve; })
      : Promise.resolve([{ id: "joined", name: "Joined trip" }]);
  } });
  const oldRead = h.hooks.useSharedGroups().loadGroups().catch(() => undefined);
  const joined = await h.hooks.useSharedGroups().loadGroups(true);
  finishOld([]);
  await oldRead;
  assert.equal(joined[0].id, "joined");
  assert.equal(h.client.getQueryData(["groups", "alice"])[0].id, "joined");
});
