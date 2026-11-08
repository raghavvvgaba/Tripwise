const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");

// Exercise banner actions with native update IO mocked; no EAS update is published.
function setup() {
  let cursor = 0;
  const state = [];
  const platform = { OS: "android" };
  const updates = {
    isEnabled: true,
    useUpdates: () => updates.status,
    status: { isUpdatePending: true, downloadedUpdate: { updateId: "first" }, isRestarting: false },
    reloadAsync: async () => {},
  };
  const hook = (initial) => {
    const index = cursor++;
    if (!(index in state)) state[index] = initial;
    return [state[index], (value) => { state[index] = value; }];
  };
  // Web side: the waiting service worker lives in a Zustand store.
  const web = { applied: [], store: { waitingWorker: null } };
  web.store.setWaitingWorker = (worker) => { web.store.waitingWorker = worker; };
  const deps = {
    react: { useState: hook, useRef: (value) => hook({ current: value })[0] },
    "react-native": { Platform: platform, View: "View", Text: "Text", Pressable: "Pressable" },
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 24, left: 0, right: 0, bottom: 0 }) },
    "@expo/vector-icons": { Ionicons: "Icon" },
    "@/constants/theme": { useThemeColors: () => ({ "brand-700": "purple" }) },
    "expo-updates": updates,
    "@/lib/service-worker": { applyWebUpdate: (worker) => web.applied.push(worker) },
    "@/store/use-web-update-store": { useWebUpdateStore: (select) => select(web.store) },
  };
  const { outputText } = ts.transpileModule(readFileSync("components/update-banner.tsx", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "__DEV__", outputText)(
    (name) => deps[name] ?? require(name), module, module.exports, false,
  );
  // Expand function components (UpdateBanner -> platform banner -> UpdateCard) into host elements.
  const expand = (node) => (node && typeof node.type === "function" ? expand(node.type(node.props)) : node);
  return {
    updates, platform, web,
    render() {
      cursor = 0;
      return expand(module.exports.UpdateBanner());
    },
  };
}

function buttons(node) {
  if (!node || typeof node !== "object") return [];
  return [
    ...(node.type === "Pressable" ? [node.props] : []),
    ...[node.props?.children].flat().flatMap(buttons),
  ];
}

test("banner waits for a completed download and is hidden on unsupported platforms", () => {
  const app = setup();
  app.updates.status.isUpdatePending = false;
  assert.equal(app.render(), null);
  app.updates.status.isUpdatePending = true;
  assert.equal(buttons(app.render()).length, 2);
  app.platform.OS = "web";
  assert.equal(app.render(), null);
  app.platform.OS = "android";
  app.updates.isEnabled = false;
  assert.equal(app.render(), null);
});

test("Later hides only the current update and never reloads", () => {
  const app = setup();
  let reloads = 0;
  app.updates.reloadAsync = async () => { reloads++; };
  buttons(app.render())[0].onPress();
  assert.equal(app.render(), null);
  assert.equal(reloads, 0);
  app.updates.status.downloadedUpdate = { updateId: "second" };
  assert.equal(buttons(app.render()).length, 2);
});

test("Restart now reloads once and disables both buttons while applying", async () => {
  const app = setup();
  let reloads = 0;
  let finish;
  app.updates.reloadAsync = () => { reloads++; return new Promise((resolve) => { finish = resolve; }); };
  const restart = buttons(app.render())[1];
  restart.onPress();
  restart.onPress();
  assert.equal(reloads, 1);
  assert.ok(buttons(app.render()).every((button) => button.disabled));
  finish();
  await new Promise(setImmediate);
});

test("failed restart offers a retry without exposing the native error", async () => {
  const app = setup();
  let reloads = 0;
  app.updates.reloadAsync = async () => { reloads++; throw new Error("private native detail"); };
  buttons(app.render())[1].onPress();
  await new Promise(setImmediate);
  const tree = app.render();
  assert.ok(JSON.stringify(tree).includes("Couldn’t restart"));
  assert.ok(!JSON.stringify(tree).includes("private native detail"));
  assert.ok(buttons(tree).every((button) => !button.disabled));
  buttons(tree)[1].onPress();
  await new Promise(setImmediate);
  assert.equal(reloads, 2);
});

test("web banner appears only while a new service worker is waiting", () => {
  const app = setup();
  app.platform.OS = "web";
  assert.equal(app.render(), null);
  app.web.store.waitingWorker = { id: "next" };
  const tree = app.render();
  assert.ok(JSON.stringify(tree).includes("Reload Tripwise"));
  assert.equal(buttons(tree).length, 2);
});

test("web Reload now hands the waiting worker over once and Later hides the banner", () => {
  const app = setup();
  app.platform.OS = "web";
  const worker = { id: "next" };
  app.web.store.waitingWorker = worker;
  buttons(app.render())[1].onPress();
  assert.deepEqual(app.web.applied, [worker]);
  assert.ok(buttons(app.render()).every((button) => button.disabled));

  const later = setup();
  later.platform.OS = "web";
  later.web.store.waitingWorker = worker;
  buttons(later.render())[0].onPress();
  assert.equal(later.render(), null);
  assert.deepEqual(later.web.applied, []);
});
