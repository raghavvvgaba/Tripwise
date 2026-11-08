const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");

function setup({ platform = "android", token = "this-phone", projectId = "project", tokenError = null, deleteError = null } = {}) {
  const rows = [
    { user_id: "alice", token: "this-phone" },
    { user_id: "alice", token: "other-phone" },
    { user_id: "bob", token: "this-phone" },
  ];
  const tokenCalls = [];
  const rpcCalls = [];
  let databaseCalls = 0;
  const dependencies = {
    "react-native": { Platform: { OS: platform } },
    "expo-constants": { __esModule: true, default: { expoConfig: { extra: { eas: { projectId } } } } },
    "@/lib/notifications-module": { get Notifications() { return platform === "web" ? null : dependencies["expo-notifications"]; } },
    "expo-notifications": {
      setNotificationHandler() {},
      AndroidImportance: { MAX: 5 },
      setNotificationChannelAsync: async () => {},
      getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
      getExpoPushTokenAsync: async (options) => {
        tokenCalls.push(options);
        if (tokenError) throw tokenError;
        return { data: token };
      },
    },
    "@/lib/supabase": { supabase: { rpc: async (name, args) => {
      rpcCalls.push([name, args]);
      return { error: null };
    }, from: (table) => {
      databaseCalls += 1;
      assert.equal(table, "push_tokens");
      const filters = [];
      const query = {
        delete: () => query,
        eq: (column, value) => { filters.push([column, value]); return query; },
        then: (resolve, reject) => {
          if (!deleteError) {
            for (let i = rows.length - 1; i >= 0; i -= 1) {
              if (filters.every(([column, value]) => rows[i][column] === value)) rows.splice(i, 1);
            }
          }
          return Promise.resolve({ error: deleteError }).then(resolve, reject);
        },
      };
      return query;
    } } },
  };
  const { outputText } = ts.transpileModule(readFileSync("lib/push-notifications.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "process", outputText)(
    (name) => dependencies[name], module, module.exports, { env: { EXPO_OS: platform } },
  );
  return {
    register: module.exports.registerPushToken,
    unregister: module.exports.unregisterPushTokens,
    rows, tokenCalls, rpcCalls, databaseCalls: () => databaseCalls,
  };
}

test("registration claims this device's token through the RPC", async () => {
  const h = setup({ platform: "ios" });
  await h.register();
  assert.deepEqual(h.rpcCalls, [["register_push_token", { p_token: "this-phone", p_platform: "ios" }]]);
  assert.equal(h.databaseCalls(), 0);
});

test("web registration does nothing", async () => {
  const h = setup({ platform: "web" });
  await h.register();
  assert.equal(h.rpcCalls.length, 0);
  assert.equal(h.tokenCalls.length, 0);
});

test("sign-out preserves other devices and other users' registrations", async () => {
  const h = setup();
  await h.unregister("alice");
  assert.deepEqual(h.rows, [
    { user_id: "alice", token: "other-phone" },
    { user_id: "bob", token: "this-phone" },
  ]);
  assert.deepEqual(h.tokenCalls, [{ projectId: "project" }]);
});

test("web sign-out does not request or delete push tokens", async () => {
  const h = setup({ platform: "web" });
  await h.unregister("alice");
  assert.equal(h.tokenCalls.length, 0);
  assert.equal(h.databaseCalls(), 0);
});

for (const options of [{ token: "" }, { projectId: "" }, { tokenError: new Error("offline") }]) {
  test(`missing device token never falls back to deleting all tokens: ${JSON.stringify(options)}`, async () => {
    const h = setup(options);
    if (options.tokenError) await assert.rejects(h.unregister("alice"), /offline/);
    else await h.unregister("alice");
    assert.equal(h.databaseCalls(), 0);
    assert.equal(h.rows.length, 3);
  });
}

test("database deletion failures propagate to the best-effort sign-out caller", async () => {
  const error = new Error("database unavailable");
  const h = setup({ deleteError: error });
  await assert.rejects(h.unregister("alice"), error);
  assert.equal(h.rows.length, 3);
});
