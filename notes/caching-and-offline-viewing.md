# Caching and offline viewing

## What each part does

- **Backend:** provides the latest data.
- **TanStack Query:** fetches data and holds it in memory for screens to display.
- **AsyncStorage:** saves a copy on the device so it survives closing the app.

Screens always read from TanStack Query. They do not read AsyncStorage directly.

## When the app is online

```text
Backend → TanStack Query → Screens
                 ↓
            AsyncStorage
```

1. TanStack Query fetches data from the backend when needed.
2. Screens display the cached result.
3. The persistence adapter saves a copy to AsyncStorage automatically.
4. A successful refresh updates both the memory cache and the saved copy.

## When the app reopens

```text
AsyncStorage → TanStack Query → Screens
```

1. Restore the saved copy into TanStack Query before mounting screens.
2. Display the saved data.
3. Refresh from the backend when needed and internet is available.
4. Keep existing data visible if the refresh fails.

Without internet, users can view previously saved data. Data that was never
loaded still needs an internet connection.

## The two time limits

- **60 seconds — freshness:** after this, data becomes stale and is eligible
  for refreshing. This is not a timer that fetches every 60 seconds.
- **24 hours — saved-data expiry:** older saved results are not restored.

A refresh needs a trigger, such as opening a screen, returning to the app,
reconnecting, or pulling to refresh. Changes such as adding an expense can
also mark affected data stale and trigger a refresh.

Restored data keeps its original fetch time. Reopening the app does not start
a new 60-second freshness period. If the restored data is already stale,
it can refresh immediately while the saved data stays visible.

## Accounts and scope

- Saved copies are separate for each account.
- Logout or an account switch clears the previous account's saved copy and
  memory cache. Pending saves must not recreate a deleted copy.
- Phase 1 saves **groups only**. Group details and Activity come later.
- This provides **offline viewing**. Creating or editing data offline needs
  a separate queue and syncing feature.

## Remember the flow

**Backend gives updates. TanStack Query serves screens. AsyncStorage survives restarts.**
