const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");
const query = require("@tanstack/react-query");

function loadModule(file, dependencies) {
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => dependencies[name] ?? require(name), module, module.exports,
  );
  return module.exports;
}

// Real Zustand state and TanStack Query; only native connectivity IO is mocked.
test("connectivity pauses and resumes queries/mutations and refreshes on foreground", { timeout: 3000 }, async (t) => {
  const { useNetworkStore } = loadModule("store/use-network-store.ts", {});
  let emit;
  let onAppState;
  let refreshes = 0;
  let cleanups = 0;
  let appCleanups = 0;
  const netInfo = {
    addEventListener(listener) { emit = listener; return () => { cleanups++; }; },
    refresh() { refreshes++; emit({ isConnected: true, isInternetReachable: true }); return Promise.resolve(); },
  };
  const { initializeNetworkMonitoring } = loadModule("lib/network.ts", {
    "@react-native-community/netinfo": { __esModule: true, default: netInfo },
    "@/store/use-network-store": { useNetworkStore },
    "react-native": {
      Platform: { OS: "ios" },
      AppState: { addEventListener(_event, listener) {
        onAppState = listener;
        return { remove() { appCleanups++; } };
      } },
    },
  });
  query.onlineManager.setOnline(true);
  const client = new query.QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.mount();
  t.after(() => {
    client.unmount();
    client.clear();
    query.onlineManager.setEventListener(() => () => {});
    query.onlineManager.setOnline(true);
  });
  initializeNetworkMonitoring();
  emit({ isConnected: null, isInternetReachable: null });
  assert.equal(useNetworkStore.getState().isOnline, null);
  assert.equal(query.onlineManager.isOnline(), true);

  emit({ isConnected: false, isInternetReachable: false });
  let reads = 0;
  const observer = new query.QueryObserver(client, {
    queryKey: ["connectivity-test"], queryFn: async () => { reads++; return "data"; },
  });
  const unsubscribe = observer.subscribe(() => {});
  t.after(unsubscribe);
  assert.equal(observer.getCurrentResult().fetchStatus, "paused");
  assert.equal(useNetworkStore.getState().isOnline, false);
  assert.equal(reads, 0);
  // Connected Wi-Fi with no internet must remain paused.
  emit({ isConnected: true, isInternetReachable: false });
  assert.equal(query.onlineManager.isOnline(), false);
  // A transient unknown status must not turn an offline device online.
  emit({ isConnected: null, isInternetReachable: null });
  assert.equal(query.onlineManager.isOnline(), false);

  const fetched = new Promise((resolve) => {
    const stop = observer.subscribe((result) => {
      if (result.isSuccess) { stop(); resolve(); }
    });
  });
  emit({ isConnected: true, isInternetReachable: null });
  await fetched;
  assert.equal(reads, 1);
  assert.equal(useNetworkStore.getState().isOnline, true);

  emit({ isConnected: false, isInternetReachable: null });
  let writes = 0;
  const mutation = new query.MutationObserver(client, {
    mutationFn: async () => { writes++; return "saved"; },
  });
  const saving = mutation.mutate();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(writes, 0);
  assert.equal(mutation.getCurrentResult().isPaused, true);
  onAppState("background");
  assert.equal(refreshes, 0);
  onAppState("active");
  assert.equal(await saving, "saved");
  assert.equal(refreshes, 1);
  assert.equal(writes, 1);
  assert.equal(useNetworkStore.getState().isOnline, true);

  initializeNetworkMonitoring();
  assert.equal(cleanups, 1);
  assert.equal(appCleanups, 1);
});
