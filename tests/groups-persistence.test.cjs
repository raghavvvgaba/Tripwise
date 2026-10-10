const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");
const { persistQueryClientSave, persistQueryClientRestore, persistQueryClientSubscribe } = require("@tanstack/react-query-persist-client");

function loadModule(file, dependencies = {}) {
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    fileName: file,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => dependencies[name] ?? require(name), module, module.exports);
  return module.exports;
}
const policy = loadModule("lib/query-client.ts");
const { createGroupsPersistence } = loadModule("lib/groups-persistence.ts", { "@/lib/query-client": policy });
const group = { id: "trip", name: "Trip", currency: "INR", coverPath: null,
  coverThumbnailPath: null, deletedAt: null, createdAt: "2026-10-08" };

function setup(t) {
  const values = new Map();
  const storage = {
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
    removeItem: async (key) => { values.delete(key); },
  };
  let currentUser = "alice";
  const clients = [];
  t.after(() => clients.forEach((client) => client.clear()));
  return { values, storage,
    client: () => { const client = policy.createQueryClient(); clients.push(client); return client; },
    persistence: (userId = "alice") => createGroupsPersistence(userId, storage, () => userId === currentUser),
    switchUser: (id) => { currentUser = id; },
  };
}
const options = (queryClient, persistence) => ({ queryClient, ...persistence.persistOptions });

async function seed(h) {
  const client = h.client();
  const persistence = h.persistence();
  client.setQueryData(["groups", "alice"], [group]);
  await persistQueryClientSave(options(client, persistence));
  return { client, persistence, key: [...h.values.keys()][0] };
}

test("restart restores only this account's groups, with original freshness and 24-hour retention", async (t) => {
  const h = setup(t);
  const { client, persistence } = await seed(h);
  client.setQueryData(["activity", "alice"], { pages: ["private activity"] });
  client.setQueryData(["groups", "bob"], [{ ...group, name: "Bob's group" }]);
  const snapshot = { ...options(client, persistence), persister: h.persistence().persistOptions.persister };
  await persistQueryClientSave(snapshot);
  const restored = h.client();
  await persistQueryClientRestore(options(restored, h.persistence()));
  assert.deepEqual(restored.getQueryData(["groups", "alice"]), [group]);
  assert.equal(restored.getQueryData(["activity", "alice"]), undefined);
  assert.equal(restored.getQueryData(["groups", "bob"]), undefined);
  assert.equal(restored.getQueryState(["groups", "alice"]).dataUpdatedAt,
    client.getQueryState(["groups", "alice"]).dataUpdatedAt);
  assert.equal(restored.getQueryCache().find({ queryKey: ["groups", "alice"] }).gcTime, policy.GROUPS_CACHE_MAX_AGE);
  let reads = 0;
  await restored.fetchQuery({ queryKey: ["groups", "alice"], queryFn: async () => { reads++; throw new Error("Offline"); } });
  assert.equal(reads, 0);
  assert.deepEqual(JSON.parse([...h.values.values()][0]).clientState.mutations, []);
});

test("failed offline refresh keeps the last successful groups across another restart", async (t) => {
  const h = setup(t);
  const client = h.client();
  client.setQueryData(["groups", "alice"], [group]);
  await assert.rejects(client.fetchQuery({ queryKey: ["groups", "alice"], staleTime: 0,
    retry: false, queryFn: async () => { throw new Error("Offline"); } }));
  await persistQueryClientSave(options(client, h.persistence()));
  const restored = h.client();
  await persistQueryClientRestore(options(restored, h.persistence()));
  assert.deepEqual(restored.getQueryData(["groups", "alice"]), [group]);
  assert.equal(restored.getQueryState(["groups", "alice"]).status, "success");
  assert.equal(restored.getQueryState(["groups", "alice"]).error, null);
});

test("expired snapshots and changed cache versions are removed", async (t) => {
  const h = setup(t);
  const { key } = await seed(h);
  const original = h.values.get(key);
  for (const change of [{ timestamp: Date.now() - policy.GROUPS_CACHE_MAX_AGE - 1 }, { buster: "older-version" }]) {
    h.values.set(key, JSON.stringify({ ...JSON.parse(original), ...change }));
    const restored = h.client();
    await persistQueryClientRestore(options(restored, h.persistence()));
    assert.equal(restored.getQueryData(["groups", "alice"]), undefined);
    assert.equal(h.values.has(key), false);
  }
});

test("a recently saved snapshot cannot extend an old groups result's expiry", async (t) => {
  const h = setup(t);
  const { key } = await seed(h);
  const snapshot = JSON.parse(h.values.get(key));
  snapshot.clientState.queries[0].state.dataUpdatedAt = Date.now() - policy.GROUPS_CACHE_MAX_AGE - 1;
  h.values.set(key, JSON.stringify(snapshot));
  const restored = h.client();
  await persistQueryClientRestore(options(restored, h.persistence()));
  assert.equal(restored.getQueryData(["groups", "alice"]), undefined);
});

test("malformed stored data is discarded and startup can recover", async (t) => {
  const h = setup(t);
  const { key } = await seed(h);
  h.values.set(key, "{broken-json");
  const restored = h.client();
  // Production restoration discards invalid data without development logging.
  const prior = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try { await assert.rejects(persistQueryClientRestore(options(restored, h.persistence()))); }
  finally { if (prior === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = prior; }
  assert.equal(h.values.has(key), false);
  assert.equal(restored.getQueryData(["groups", "alice"]), undefined);
  await restored.fetchQuery({ queryKey: ["groups", "alice"], queryFn: async () => [group] });
  assert.deepEqual(restored.getQueryData(["groups", "alice"]), [group]);
});

test("logout removes in-flight saves and prevents a throttled save recreating them", async (t) => {
  const h = setup(t);
  const client = h.client();
  const persistence = h.persistence();
  client.setQueryData(["groups", "alice"], [group]);
  let started;
  const writeStarted = new Promise((resolve) => { started = resolve; });
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  h.storage.setItem = async (key, value) => { started(); await wait; h.values.set(key, value); };
  const save = persistQueryClientSave(options(client, persistence));
  await writeStarted;
  const throttledSave = persistQueryClientSave(options(client, persistence));
  h.switchUser(null);
  const remove = persistence.remove();
  release();
  await Promise.all([save, throttledSave, remove]);
  assert.equal(h.values.size, 0);
  h.switchUser("alice");
  await persistQueryClientSave(options(client, persistence));
  assert.equal(h.values.size, 0);
});

test("switching accounts cannot restore or save the previous account", async (t) => {
  const h = setup(t);
  const { client, persistence } = await seed(h);
  h.switchUser("bob");
  const restored = h.client();
  await persistQueryClientRestore(options(restored, h.persistence("bob")));
  assert.equal(restored.getQueryData(["groups", "alice"]), undefined);
  await persistence.remove();
  await persistQueryClientSave(options(client, persistence));
  assert.equal(h.values.size, 0);
  restored.setQueryData(["groups", "bob"], [{ ...group, name: "Bob's trip" }]);
  await persistQueryClientSave(options(restored, h.persistence("bob")));
  assert.equal(h.values.size, 1);
  assert.deepEqual(JSON.parse([...h.values.values()][0]).clientState.queries[0].queryKey, ["groups", "bob"]);
});

test("cache subscription saves changes automatically and storage failure keeps memory usable", { timeout: 5000 }, async (t) => {
  const h = setup(t);
  const client = h.client();
  const persistence = h.persistence();
  let saved;
  const savedGroups = new Promise((resolve) => { saved = resolve; });
  h.storage.setItem = async (key, value) => {
    h.values.set(key, value);
    if (JSON.parse(value).clientState.queries.length === 1) saved();
  };
  const unsubscribe = persistQueryClientSubscribe(options(client, persistence));
  t.after(unsubscribe);
  client.setQueryData(["groups", "alice"], [group]);
  await savedGroups;
  unsubscribe();
  assert.equal(h.values.size, 1);
  h.storage.setItem = async () => { throw new Error("Storage unavailable"); };
  await persistQueryClientSave(options(client, h.persistence()));
  assert.deepEqual(client.getQueryData(["groups", "alice"]), [group]);
});

test("provider gates screens until restore and its auth listener clears memory and disk on logout", async (t) => {
  const h = setup(t);
  const client = h.client();
  const effects = [];
  const listeners = new Set();
  let currentUser = "alice";
  let restoring = true;
  const { QueryProvider } = loadModule("components/query-provider.tsx", {
    "@react-native-async-storage/async-storage": { __esModule: true, default: h.storage },
    "@/lib/groups-persistence": { createGroupsPersistence },
    "@/lib/query-client": { createQueryClient: () => client },
    "@/store/use-auth-store": { useAuthStore: {
      getState: () => ({ session: currentUser ? { user: { id: currentUser } } : null }),
      subscribe: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    } },
    react: { useState: (initialize) => [initialize()], useEffect: (fn) => effects.push(fn) },
    "@tanstack/react-query": { ...require("@tanstack/react-query"), useIsRestoring: () => restoring },
    "react-native": { Platform: { OS: "web" }, View: "View", ActivityIndicator: "ActivityIndicator" },
  });
  const element = QueryProvider({ children: "screens", userId: "alice" });
  const cleanups = effects.map((effect) => effect()).filter(Boolean);
  t.after(() => cleanups.forEach((cleanup) => cleanup()));
  const gate = element.props.children;
  assert.notEqual(gate.type(gate.props), "screens");
  restoring = false;
  assert.equal(gate.type(gate.props), "screens");
  client.setQueryData(["groups", "alice"], [group]);
  await persistQueryClientSave({ queryClient: client, ...element.props.persistOptions });
  assert.equal(h.values.size, 1);
  currentUser = null;
  listeners.forEach((listener) => listener());
  assert.equal(client.getQueryData(["groups", "alice"]), undefined);
  await element.props.persistOptions.persister.restoreClient();
  assert.equal(h.values.size, 0);
});
