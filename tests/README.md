# Cat-ime automated tests

Headless tests run in Node (no browser). They load the same IIFE modules the app uses, with a mocked `localStorage` and minimal DOM.

## Run

```bash
node --test tests/*.test.mjs
# or, if npm is available:
npm test
```

## What is covered

| Suite | Module | Topics |
|-------|--------|--------|
| `storage.test.mjs` | `catime-storage.js` | My List, episode Follow, CW cap, IDs, legacy migration |
| `app-data.test.mjs` | `catime-app-data.js` | Backup format, import/export round-trip, merge plan, account keys |
| `api.test.mjs` | `catime-api.js` | GraphQL cache keys, TTL, size limits, fetch dedupe |
| `features.test.mjs` | `catime-features.js` | Ratings, queue, routes, share URL, bulk watched |
| `integration.test.mjs` | cross-module | Account switch, full backup restore |
| `ui.test.mjs` | `catime-ui.js` | Status text, empty states, keyboard shortcuts |
| `comments.test.mjs` | static | Comment HTML escape + length limits |
| `html-sanity.test.mjs` | `index.html` | Script order, watch buttons, backup wiring |
| `mobile-layout.test.mjs` | `index.html` | Viewport, breakpoints, watch/comments mobile CSS |
| `perf-load.test.mjs` | `index.html` | Lazy home load, deferred watch fetches |
| `player-autonext.test.mjs` | `index.html` | Auto-next default on, mark watched before advance |

## Player auto-next check (before commit/push)

1. Run `node --test tests/player-autonext.test.mjs` (or full suite).
2. In the browser on **Watch** with **Megaplay**: finish an episode or run in the console (with a show loaded):

```js
// Simulates player "episode ended" — should mark current ep watched and go to next
triggerPlayerAutoNext(curEp);
```

3. Confirm: current episode ticked as watched, next episode loads, **Auto next** is on in settings.

## Mobile bug test (before commit/push)

Automated tests catch missing mobile CSS patterns; they **do not** prove layout looks correct in a real browser.

1. Run `node --test tests/*.test.mjs` (includes `mobile-layout.test.mjs`).
2. Open the app at **375px** and **390px** width (DevTools device toolbar or a phone).
3. Confirm each changed screen **works** (tap targets, scroll, no broken JS) and **looks good** (no horizontal page scroll, readable text, balanced spacing).

Focus areas: nav hamburger, home carousels, watch player + episode list + comments, detail drawer, list table, auth/settings modals.

## Not covered (manual / future)

- Supabase auth and live `user_app_data` sync
- Video iframe / embed players
- AniList network responses (except API cache mock)
- Service worker install in real browser
- Pixel-perfect visual regression (use manual mobile pass above)

Add tests in `tests/*.test.mjs` when you add behavior to `js/*.js` modules.
