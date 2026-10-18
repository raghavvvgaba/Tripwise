const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const ts = require("typescript");
const { setImmediate } = require("node:timers");

function loadModule(file, dependencies = {}) {
  const { outputText } = ts.transpileModule(readFileSync(path.join(path.dirname(require.resolve("../package.json")), file), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => dependencies[name] ?? (name === "./user-error" ? messages : require(name)), module, module.exports,
  );
  return module.exports;
}
const messages = loadModule("lib/user-error.ts");
const { friendlyErrorMessage, isNetworkError } = messages;
const { queryErrorMessage } = loadModule("lib/query-error.ts");
const rawNetwork = 'fetch failed: java.net.UnknownHostException: Unable to resolve host "private.example.test"';
const rawDatabase = 'new row violates row-level security policy for table "group_payments"';
const flush = () => new Promise((resolve) => setImmediate(resolve));

test("unknown exceptions, API objects, and callback text never become user copy", () => {
  for (const error of [new Error(rawDatabase), { message: rawDatabase, code: "XX000" }, rawDatabase,
    null, undefined, {}, { code: "__proto__", message: "constructor" },
    { message: "Sign in required\nsecret diagnostic" }, { message: 'Could not connect to private.example.test' }]) {
    assert.equal(friendlyErrorMessage(error, "Could not save this expense. Please try again."),
      "Could not save this expense. Please try again.");
  }
});

test("native, web, timeout, and auth fetch failures receive connection guidance", () => {
  for (const message of [rawNetwork, "Network request failed", "Failed to fetch", "Load failed",
    "The Internet connection appears to be offline.", "The network connection was lost.", "ETIMEDOUT", "Request timed out"]) {
    assert.equal(isNetworkError({ message }), true);
    assert.equal(friendlyErrorMessage({ message }), "We couldn't connect. Check your internet connection and try again.");
  }
  assert.equal(isNetworkError({ name: "AuthRetryableFetchError", message: "opaque" }), true);
});

test("known auth codes override provider diagnostics with useful guidance", () => {
  for (const [code, expected] of [
    ["invalid_credentials", /sign-in details are incorrect/], ["email_not_confirmed", /confirm your email/],
    ["email_address_invalid", /valid email/], ["weak_password", /stronger password/],
    ["same_password", /different from your current/], ["session_expired", /sign in again/],
    ["flow_state_expired", /start again/], ["over_email_send_rate_limit", /wait a few minutes/],
  ]) {
    const text = friendlyErrorMessage({ code, message: "private provider diagnostic" });
    assert.match(text, expected);
    assert.doesNotMatch(text, /private|diagnostic/);
  }
});

test("permission, expired-session, changed-data, and throttling errors are friendly", () => {
  for (const [error, expected] of [
    [{ code: "42501", message: rawDatabase }, /permission/], [{ status: 401, message: "JWT expired" }, /sign in again/],
    [{ code: "PGRST301", message: "JWT invalid" }, /sign in again/], [{ status: 429 }, /wait a few minutes/],
    [{ code: "23503", message: 'constraint "expense_fk"' }, /data has changed/],
    [{ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }, /no longer available/],
  ]) assert.match(friendlyErrorMessage(error), expected);
});

test("known validation stays actionable while internal payment fields stay hidden", () => {
  assert.match(friendlyErrorMessage({ message: "Split amounts must add up to the expense total" }), /shares must add up/);
  assert.match(friendlyErrorMessage({ message: "This expense changed since you opened it. Reopen it and try again." }), /Reopen it/);
  assert.match(friendlyErrorMessage({ message: "This invite code is invalid." }), /Check the code/);
  assert.match(friendlyErrorMessage({ message: "Invalid time zone offset" }), /device's date and time/);
  assert.doesNotMatch(friendlyErrorMessage({ message: "A payment request ID is required" }), /request ID/);
  assert.match(friendlyErrorMessage({ message: "The compressed photo is too large. Choose a smaller image." }), /smaller image/);
});

test("queries sanitize database errors with and without cached data", () => {
  for (const hasData of [true, false]) {
    assert.equal(queryErrorMessage({ message: rawDatabase }, hasData), "Could not load data. Please try again.");
    assert.match(queryErrorMessage({ code: "42501", message: rawDatabase }, hasData), /permission/);
  }
  assert.equal(queryErrorMessage({ message: rawNetwork }, true), null);
  assert.match(queryErrorMessage({ message: rawNetwork }, false), /Connect to the internet/);
});

for (const platform of ["android", "web"]) {
  test(`${platform} alert boundary never displays backend diagnostics`, (t) => {
    const calls = [];
    if (platform === "web") {
      const previous = global.window;
      global.window = { alert: (text) => calls.push(text) };
      t.after(() => { global.window = previous; });
    }
    const { showError } = loadModule("utils/dialogs.ts", {
      "react-native": { Platform: { OS: platform }, Alert: { alert: (...args) => calls.push(args.join("\n\n")) } },
      "@/lib/user-error": messages,
      "@/store/use-confirm-dialog-store": {},
    });
    showError("Could not delete expense", { message: rawDatabase });
    assert.equal(calls[0], "Could not delete expense\n\nPlease try again.");
    showError("Could not delete expense", new Error(rawNetwork));
    assert.match(calls[1], /Check your internet connection/);
    assert.doesNotMatch(calls.join(" "), /java|private.example|row-level|group_payments/);
  });
}

// Execute real screen event handlers with mocked native controls and hook state.
// This checks rendered feedback and retry behavior without a device or new deps.
function screenHarness(file, overrides = {}) {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useEffect: (effect) => effects.push(effect),
  };
  const jsx = (type, props) => ({ type, props });
  const native = Object.fromEntries(["Text", "View", "TextInput", "Pressable", "ScrollView", "ActivityIndicator", "KeyboardAvoidingView"].map((name) => [name, name]));
  native.Platform = { OS: "android" };
  native.Keyboard = { addListener: () => ({ remove() {} }) };
  const screen = loadModule(file, {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": native,
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView", useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) },
    "@expo/vector-icons": { Ionicons: "Ionicons" },
    "expo-router": { Stack: { Screen: "Screen" }, router: { replace() {}, dismissTo() {} }, useLocalSearchParams: () => ({}) },
    "expo-linking": { useURL: () => null },
    "@/components/brand-icon": { BrandIcon: "BrandIcon" },
    "@/components/google-icon": { GoogleIcon: "GoogleIcon" },
    "@/components/update-banner": { UpdateBanner: "UpdateBanner" },
    "@/components/empty-state": { EmptyState: "EmptyState" },
    "@/components/payment-date-field": { PaymentDateField: "PaymentDateField" },
    "@/constants/clay-theme": { useClayTheme: () => ({}) },
    "@/lib/user-error": messages,
    "@/lib/group-invites": { isInviteCode: () => false },
    "@/store/use-auth-store": { useAuthStore: (select) => select({ session: null }) },
    ...overrides,
  }).default;
  return {
    render() { cursor = 0; effects = []; return screen(); },
    effects() { effects.forEach((effect) => effect()); },
  };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === "string") return tree;
  if (!tree || typeof tree !== "object") return "";
  if (Array.isArray(tree)) return tree.map(text).join(" ");
  return text(tree.props?.children);
}
function find(tree, predicate) {
  const result = nodes(tree).find(predicate);
  assert.ok(result, "Expected control is rendered");
  return result;
}

test("sign-in renders friendly feedback for returned API errors and rejected requests", async () => {
  for (const error of [{ code: "invalid_credentials", message: "private auth diagnostic" }, new Error(rawNetwork)]) {
    const h = screenHarness("app/sign-in.tsx", {
      "@/lib/supabase": { supabase: { auth: { signInWithPassword: async () => {
        if (error instanceof Error) throw error;
        return { error };
      } } } },
    });
    let tree = h.render();
    find(tree, (node) => node.props.autoComplete === "email").props.onChangeText("test@example.test");
    find(tree, (node) => node.props.autoComplete === "current-password").props.onChangeText("example-password");
    tree = h.render();
    find(tree, (node) => node.type === "Pressable" && node.props.disabled === false && text(node) === "Sign In").props.onPress();
    await flush();
    const output = text(h.render());
    assert.match(output, error instanceof Error ? /Check your internet connection/ : /sign-in details are incorrect/);
    assert.doesNotMatch(output, /private auth|UnknownHostException|private.example/);
  }
});

test("native OAuth callback descriptions are never rendered, even when URL controlled", () => {
  const h = screenHarness("app/sign-in.tsx", {
    "expo-linking": { useURL: () => "tripwise://sign-in#error=server_error&error_description=private_diagnostic", parse: () => ({ queryParams: {} }) },
    "@/lib/supabase": { supabase: {} },
  });
  h.render(); h.effects();
  const output = text(h.render());
  assert.match(output, /Could not complete Google sign-in/);
  assert.doesNotMatch(output, /private_diagnostic|server_error/);
});

test("uncertain payment retry keeps the same request ID and duplicate confirmation", async () => {
  const calls = [];
  const backend = { rpc: async () => ({ error: null }) };
  const payments = loadModule("lib/payments.ts", { "@/lib/supabase": { supabase: backend } });
  const h = screenHarness("app/groups/[groupId]/record-payment.tsx", {
    "expo-router": { Stack: { Screen: "Screen" }, router: { dismissTo() {} }, useLocalSearchParams: () => ({ groupId: "trip", payerId: "alice", recipientId: "bob", amountMinor: "1000" }) },
    "@/lib/payments": { ...payments, createPaymentRequestId: () => "same-request" },
    "@/hooks/use-shared-groups": { useSharedGroups: () => ({ groups: [{ id: "trip", currency: "INR" }], userId: "alice" }) },
    "@/hooks/use-group-data": {
      useGroupMembers: () => ({ data: [{ userId: "alice", name: "Alice" }, { userId: "bob", name: "Bob" }] }),
      useGroupExpenses: () => ({ data: [] }), useGroupPayments: () => ({ data: [] }),
    },
    "@/hooks/use-group-data-actions": { useGroupDataActions: () => ({ recordPayment: async (input, duplicate) => {
      calls.push({ input, duplicate });
      if (calls.length === 1) throw new payments.PaymentError(rawNetwork, "");
      if (calls.length === 2) throw new payments.PaymentError("private duplicate diagnostic", "23505");
    } }) },
    "@/utils/shared-expenses": { getSharedMemberBalances: (members) => members.map((member, i) => ({ member, netMinor: i === 0 ? -1000 : 1000 })) },
    "@/utils/money": loadModule("utils/money.ts"),
    "@/utils/date": loadModule("utils/date.ts"),
  });
  find(h.render(), (node) => node.props.accessibilityLabel === "Record payment").props.onPress();
  await flush();
  let tree = h.render();
  assert.match(text(tree), /couldn't confirm whether this payment was recorded/);
  assert.doesNotMatch(text(tree), /UnknownHostException|private.example/);
  find(tree, (node) => node.props.accessibilityLabel === "Retry payment").props.onPress();
  await flush();
  tree = h.render();
  assert.match(text(tree), /Similar payment already recorded/);
  assert.doesNotMatch(text(tree), /private duplicate diagnostic/);
  find(tree, (node) => node.props.accessibilityLabel === "Record another payment").props.onPress();
  await flush();
  assert.equal(calls.length, 3);
  assert.strictEqual(calls[0].input, calls[1].input);
  assert.strictEqual(calls[1].input, calls[2].input);
  assert.equal(calls[0].duplicate, false);
  assert.equal(calls[2].duplicate, true);
});

test("successful join with failed refresh retries the refresh without joining again", async () => {
  let joins = 0;
  let reads = 0;
  const navigations = [];
  const h = screenHarness("app/join/[code].tsx", {
    "expo-router": { Stack: { Screen: "Screen" }, router: { replace: (url) => navigations.push(url) }, useLocalSearchParams: () => ({ code: "ABCDEFGH" }) },
    "@tanstack/react-query": { useQueryClient: () => ({ invalidateQueries: async () => {} }) },
    "@/lib/group-data-query": { groupDataKey: () => ["group-data", "alice", "trip"] },
    "@/lib/refresh-activity": { refreshActivity: async () => {} },
    "@/store/use-auth-store": { useAuthStore: (select) => select({ session: { user: { id: "alice" } } }) },
    "@/hooks/use-shared-groups": { useSharedGroups: () => ({ groups: [], loadGroups: async () => {
      reads++;
      if (reads === 1) throw new Error(rawNetwork);
      return [{ id: "trip" }];
    } }) },
    "@/lib/group-invites": {
      isInviteCode: () => true, normalizeInviteCode: (code) => code,
      previewGroupInvite: async () => ({ groupId: "trip", name: "Trip", currency: "INR", memberCount: 2 }),
      acceptGroupInvite: async () => { joins++; return "trip"; },
    },
  });
  h.render(); h.effects(); await flush();
  find(h.render(), (node) => node.type === "Pressable" && /Join Group/.test(text(node))).props.onPress();
  await flush();
  let tree = h.render();
  assert.match(text(tree), /You joined, but your groups could not refresh/);
  assert.doesNotMatch(text(tree), /UnknownHostException|private.example/);
  find(tree, (node) => node.type === "Pressable" && text(node) === "Refresh groups").props.onPress();
  await flush();
  assert.equal(joins, 1);
  assert.equal(reads, 2);
  assert.deepEqual(navigations, ["/groups/trip"]);
});

for (const [file, action, expected] of [
  ["app/account/change-email.tsx", "changeEmail", /Could not update your email/],
  ["app/account/change-password.tsx", "changePassword", /Could not update your password/],
]) {
  test(`${action} renders a friendly fallback for plain API error objects`, async () => {
    const h = screenHarness(file, {
      "@/lib/account-auth": { [action]: async () => { throw { code: "unexpected_code", message: rawDatabase }; } },
    });
    const tree = h.render();
    const inputs = nodes(tree).filter((node) => node.type === "TextInput");
    for (const input of inputs) input.props.onChangeText(action === "changeEmail" ? "new@example.test" : "new-password");
    const submit = find(h.render(), (node) => node.type === "Pressable" && node.props.disabled === false);
    submit.props.onPress(); await flush();
    const output = text(h.render());
    assert.match(output, expected);
    assert.doesNotMatch(output, /row-level|group_payments|unexpected_code/);
  });
}


test("auth service errors do not blame the device connection", () => {
  const error = { name: "AuthRetryableFetchError", status: 503, message: "private auth service diagnostic" };
  assert.equal(isNetworkError(error), false);
  assert.equal(friendlyErrorMessage(error, "Could not sign in. Please try again."), "Could not sign in. Please try again.");
  assert.equal(isNetworkError({ ...error, status: 0 }), true);
});


for (const outcome of ["cleared", "retained", "thrown"]) {
  test(`sign-out ${outcome} session shows accurate feedback`, async () => {
    let session = { user: { id: "alice", email: "alice@example.test", user_metadata: { name: "Alice" } } };
    const alerts = [];
    const authStore = Object.assign((select) => select({ session }), { getState: () => ({ session }) });
    const h = screenHarness("app/(tabs)/account.tsx", {
      "@/store/use-auth-store": { useAuthStore: authStore },
      "@/lib/supabase": { supabase: { auth: { signOut: async () => {
        if (outcome === "cleared") session = null;
        if (outcome === "thrown") throw new Error(rawNetwork);
        return { error: { message: rawDatabase } };
      } } } },
      "@/store/use-currency-store": { useCurrencyStore: (select) => select({ defaultCurrency: "INR", setDefaultCurrency() {} }) },
      "@/store/use-settings-store": { useSettingsStore: (select) => select({ themePreference: "system", setThemePreference() {} }) },
      "@/hooks/use-shared-groups": { useSharedGroups: () => ({ groups: [] }) },
      "@/package.json": { version: "test" },
      "@/utils/dialogs": { showError: (...args) => alerts.push(args) },
      "@/utils/money": loadModule("utils/money.ts"),
    });
    find(h.render(), (node) => node.type === "Pressable" && /Sign out/.test(text(node))).props.onPress();
    await flush();
    assert.equal(alerts.length, outcome === "cleared" ? 0 : 1);
  });
}
