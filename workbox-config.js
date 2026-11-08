// Workbox reads the web export in dist/ and generates dist/sw.js.
// Run through `npm run build:web`. Docs: https://developer.chrome.com/docs/workbox/modules/workbox-cli
module.exports = {
  globDirectory: "dist/",
  // App shell, downloaded on install so the app opens offline.
  // Only Ionicons is precached; the other bundled icon fonts are never used.
  globPatterns: [
    "index.html",
    "_expo/static/**/*.{js,css}",
    "*.{png,ico,webmanifest}",
    "assets/node_modules/@expo/vector-icons/**/Ionicons.*.ttf",
  ],
  // Expo exports package assets under assets/node_modules, which Workbox ignores by default.
  globIgnores: ["sw.js", "workbox-*.js"],
  // The JS bundle is ~3 MB, above Workbox's 2 MB default.
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
  swDest: "dist/sw.js",
  // Every route (e.g. /groups/123) is rendered by the same index.html.
  navigateFallback: "/index.html",
  // A new version waits until the user taps "Reload" in the update banner.
  skipWaiting: false,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      // Other exported images and fonts have hashed names, so a cached copy never goes stale.
      urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/assets/"),
      handler: "CacheFirst",
      options: { cacheName: "tripwise-assets", expiration: { maxEntries: 60 } },
    },
    // Supabase API, auth and storage requests have no rule, so they always go to the network.
    // Offline data comes from the persisted React Query cache instead. Group covers use
    // signed URLs that change every 15 minutes, so caching them by URL wouldn't help.
  ],
};
