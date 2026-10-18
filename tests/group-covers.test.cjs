const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");

function setup(platform = "android", options = {}) {
  const uploads = [], removals = [], reads = [];
  const bytes = new Uint8Array([255, 216, 255]).buffer;
  const context = {
    resize() {}, crop() {},
    async renderAsync() { return { width: 1024, height: 768, async saveAsync() { return { uri: "file:///cache/generated.jpg" }; } }; },
  };
  const dependencies = {
    "react-native": { Platform: { OS: platform } },
    "expo-file-system": { File: class {
      constructor(uri) { reads.push(uri); }
      async arrayBuffer() {
        if (options.readError) throw options.readError;
        return options.large ? new ArrayBuffer(4 * 1024 * 1024 + 1) : bytes;
      }
    } },
    "expo-image-manipulator": { ImageManipulator: { manipulate: () => context }, SaveFormat: { JPEG: "jpeg" } },
    "@/lib/supabase": { supabase: { storage: { from: () => ({
      async upload(...args) { uploads.push(args); return { error: options.failThumbnail && uploads.length === 2 ? new Error("Storage rejected thumbnail") : null }; },
      async remove(paths) { removals.push(paths); return { error: null }; },
    }) } } },
  };
  const { outputText } = ts.transpileModule(readFileSync(require.resolve("../lib/group-covers.ts"), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", "fetch", outputText)(
    (name) => dependencies[name], module, module.exports,
    async () => { assert.equal(platform, "web", "native files must not use fetch"); return { ok: !options.webReadError, arrayBuffer: async () => bytes }; },
  );
  return { ...module.exports, uploads, removals, reads, bytes };
}

test("native cover and thumbnail upload the file reader's exact bytes as JPEG", async () => {
  const s = setup(); const paths = await s.uploadGroupCover("group", { uri: "file:///photo.jpg" });
  assert.equal(s.reads.length, 2);
  assert.equal(s.uploads.length, 2);
  assert.equal(s.uploads[0][0], paths.coverPath);
  assert.equal(s.uploads[1][0], paths.coverThumbnailPath);
  for (const [, body, config] of s.uploads) {
    assert.equal(body, s.bytes);
    assert.deepEqual(config, { contentType: "image/jpeg", upsert: false });
  }
});

test("native file read rejection and oversized bytes never reach Storage", async () => {
  for (const options of [{ readError: new Error("missing file") }, { large: true }]) {
    const s = setup("android", options);
    await assert.rejects(s.uploadGroupCover("group", { uri: "file:///photo.jpg" }), /missing file|too large/);
    assert.equal(s.uploads.length, 0);
    assert.equal(s.removals[0].length, 2);
  }
});

test("failed thumbnail upload cleans up both generated remote paths", async () => {
  const s = setup("android", { failThumbnail: true });
  await assert.rejects(s.uploadGroupCover("group", { uri: "file:///photo.jpg" }), /Storage rejected/);
  assert.deepEqual(s.removals[0], s.uploads.map(([path]) => path));
});

test("web keeps fetching generated image URIs and rejects unreadable responses", async () => {
  const s = setup("web"); await s.uploadGroupCover("group", { uri: "blob:photo" });
  assert.equal(s.reads.length, 0); assert.equal(s.uploads.length, 2);
  const failed = setup("web", { webReadError: true });
  await assert.rejects(failed.uploadGroupCover("group", { uri: "blob:photo" }), /Could not read/);
  assert.equal(failed.uploads.length, 0);
});
