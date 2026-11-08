const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");

function setup(platform = "android") {
  const hooks = [];
  let cursor = 0;
  let effects = [];
  let lastResponse = null;
  let ready = false;
  const listeners = { ready: new Set(), state: new Set(), notification: new Set() };
  const routes = [];
  const auth = { session: { user: { id: "alice" } }, isLoading: false, initialize: () => () => {} };
  const settings = { isHydrated: false, themePreference: "system" };
  const addListener = (name, fn) => {
    listeners[name].add(fn);
    return () => listeners[name].delete(fn);
  };
  const navigationRef = { isReady: () => ready, addListener };
  const dependencies = {
    react: {
      useRef: (value) => {
        const index = cursor++;
        hooks[index] ??= { current: value };
        return hooks[index];
      },
      useEffect: (fn, deps) => {
        const index = cursor++;
        const previous = hooks[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
          effects.push(() => {
            previous?.cleanup?.();
            hooks[index] = { deps, cleanup: fn() };
          });
        }
      },
    },
    "react/jsx-runtime": { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) },
    "react-native": { Platform: { OS: platform }, useColorScheme: () => "light" },
    "expo-router": { DefaultTheme: { colors: {} }, router: { push: (route) => {
      assert.ok(ready && settings.isHydrated && !auth.isLoading && auth.session);
      routes.push(route);
    } }, useNavigationContainerRef: () => navigationRef },
    "expo-router/stack": { Stack: { Protected: "Protected", Screen: "Screen" } },
    "@/lib/notifications-module": { get Notifications() { return platform === "web" ? null : dependencies["expo-notifications"]; } },
    "expo-notifications": {
      DEFAULT_ACTION_IDENTIFIER: "tap",
      getLastNotificationResponse: () => {
        assert.notEqual(platform, "web");
        return lastResponse;
      },
      addNotificationResponseReceivedListener: (fn) => ({ remove: addListener("notification", fn) }),
    },
    "expo-splash-screen": { preventAutoHideAsync: async () => {}, hideAsync: async () => {} },
    nativewind: { colorScheme: { set() {} } },
    "@/store/use-auth-store": { useAuthStore: (select) => select(auth) },
    "@/store/use-settings-store": { useSettingsStore: (select) => select(settings) },
    "@/lib/network": { initializeNetworkMonitoring() {} },
    "@/lib/push-notifications": { registerPushToken: async () => {} },
    "@/constants/theme": { resolveTheme: () => "light", themeColors: { light: {} }, themeVariables: { light: {} } },
  };
  const { outputText } = ts.transpileModule(readFileSync("app/_layout.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)((name) => dependencies[name] ?? {}, module, module.exports);
  const emit = (name, value) => [...listeners[name]].forEach((fn) => fn(value));
  return {
    auth, settings, routes, listeners,
    render() {
      cursor = 0;
      effects = [];
      const tree = module.exports.default();
      effects.forEach((fn) => fn());
      return tree;
    },
    tap(id = "notification") {
      lastResponse = { actionIdentifier: "tap", notification: { request: {
        identifier: id, content: { data: { groupId: "group" } },
      } } };
      emit("notification", lastResponse);
    },
    setReady(value) { ready = value; emit("ready"); },
    emitState() { emit("state"); },
    unmount() { hooks.forEach((hook) => hook?.cleanup?.()); },
  };
}

test("cold-start tap waits for settings and navigation, then opens exactly once", () => {
  const h = setup();
  h.tap();
  assert.equal(h.render(), null);
  assert.deepEqual(h.routes, []);
  h.settings.isHydrated = true;
  h.render();
  assert.deepEqual(h.routes, []);
  h.setReady(true);
  h.emitState();
  h.render();
  assert.deepEqual(h.routes, ["/groups/group"]);
});

test("tap received during loading survives listener changes and sign-in", () => {
  const h = setup();
  h.auth.session = null;
  h.auth.isLoading = true;
  h.render();
  h.tap();
  h.setReady(true);
  h.settings.isHydrated = true;
  h.auth.isLoading = false;
  h.render();
  assert.deepEqual(h.routes, []);
  h.auth.session = { user: { id: "alice" } };
  h.render();
  h.emitState();
  assert.deepEqual(h.routes, ["/groups/group"]);
  h.tap("next-notification");
  assert.equal(h.routes.length, 2);
  h.unmount();
  assert.ok(Object.values(h.listeners).every((set) => set.size === 0));
});

test("web never reads native notification responses or registers listeners", () => {
  const h = setup("web");
  h.tap();
  h.settings.isHydrated = true;
  h.setReady(true);
  h.render();
  assert.deepEqual(h.routes, []);
  assert.ok(Object.values(h.listeners).every((set) => set.size === 0));
});
