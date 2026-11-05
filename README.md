# Wardgo — Memphis × Pixel‑Art Wardrobe & Outfit Stylist

Wardgo is an iPhone app for cataloguing your clothes and getting a weather‑aware outfit every morning. You photograph your clothes, shoes and accessories. Wardgo checks today's forecast and suggests an outfit from what you actually own. You can lock the pieces you like and regenerate the rest, save favorites, and organise outfits into albums.

Everything is free: no account, no paid AI, no backend. Your photos and wardrobe data stay on your phone. The only thing that leaves the device is a rounded location sent to a free weather service (and only if you turn weather on).

> **Status: feature‑complete beta, not production‑ready.** All core features are implemented. Automated tests, type checks and lint pass, and the iOS JavaScript bundle builds. **It has not yet been tested on a physical iPhone**; see [Testing](#testing) for exactly what was and wasn't verified.

---

## Contents

1. [What it does](#what-it-does)
2. [The look: Memphis × pixel art](#the-look-memphis--pixel-art)
3. [Feature list](#feature-list)
4. [Technology stack](#technology-stack)
5. [Prerequisites](#prerequisites)
6. [Installation and setup](#installation-and-setup)
7. [Running on your iPhone](#running-on-your-iphone)
8. [Project structure](#project-structure)
9. [Architecture and data model](#architecture-and-data-model)
10. [Outfit recommendation algorithm](#outfit-recommendation-algorithm)
11. [Weather integration](#weather-integration)
12. [Design system and assets](#design-system-and-assets)
13. [Privacy and local data](#privacy-and-local-data)
14. [Testing](#testing)
15. [Cost and distribution](#cost-and-distribution)
16. [Troubleshooting](#troubleshooting)
17. [Roadmap and contributing](#roadmap-and-contributing)

---

## What it does

**The problem:** you own plenty of clothes but default to the same few outfits, or get the weather wrong. Most outfit apps need an account, upload your photos, or charge a subscription.

**Wardgo's answer:**

- **Digital wardrobe.** Photograph each piece and tag its color, warmth, rain suitability, formality and style.
- **Today.** Shows the forecast and a suggested outfit built only from your own clothes.
- **Locks.** Love the jeans but not the shirt? Lock the jeans and tap **Regenerate**. The jeans are guaranteed to stay.
- **Saved outfits and albums.** Keep combinations you like, mark what you wore, and group them into albums (Work, Date night, Travel…).

---

## The look: Memphis × pixel art

The interface mixes two vocabularies, each with a clear job:

| Memphis design provides… | Pixel art provides… |
|---|---|
| Composition: asymmetric headers, overlapping accents | Iconography: every icon is an original 12×12 sprite |
| Shapes: circles, triangles, zigzags, squiggles, dot grids, checkerboards | Weather: 16×16 sun, moon, clouds, rain, snow, storm, fog |
| Color blocking: cobalt, coral, mustard, mint on warm cream | Character: a little tee mascot in empty states, sparkles on success |
| "Sticker" surfaces: bold outlines with hard offset shadows | Retro details: pixel‑font date stamps, counters and tags |

**Photos always win.** Clothing photos sit on plain white tiles with no patterns behind them. Decoration lives in headers, borders and empty states, never on top of photos, text or buttons.

---

## Feature list

Legend: ✅ implemented and covered by automated tests · 🟢 implemented, verified by type check, lint and bundle but not yet run on a device · 🟡 partial · ⏳ planned

### Wardrobe
- 🟢 Add items from the **camera** or **photo library**. Several photos per item, with a choosable main photo.
- 🟢 Photos are resized (1400 px plus a 420 px thumbnail) and **copied into permanent app storage**.
- ✅ Fields: name, category and subcategory, main and secondary colors, pattern, material, seasons, formality (1–5), warmth (1–5), rain suitability, style tags, notes, favorite, availability, date added.
- ✅ Search by name; filter by category, color, style, season, favorites and availability; sort by newest, oldest or A–Z.
- 🟢 Item detail page, edit, delete (warns if the item is used in saved outfits), favorite, mark unavailable ("in the laundry").
- 🟢 "Style this piece": builds today's outfit around an item with that item locked.

### Today and recommendations
- 🟢 Weather card: temperature, feels‑like, high/low, rain chance, wind, summary, last update time, and a **LIVE** or **STALE** badge.
- ✅ Local recommendation engine using weather, warmth, season, colors, style, formality, occasion, preferences, favorites, feedback and wear history.
- ✅ Plain‑English "Why this outfit" explanations.
- ✅ **Locked‑item regeneration**: lock any number of items, regenerate everything unlocked or a single category, with undo.
- ✅ Tune controls: more casual/formal, neutral/colorful, lighter/warmer, conservative/adventurous, avoid recently worn.
- 🟢 Occasion chips (Everyday, Work, Date night, Active, Formal).
- 🟢 "Wore it today" (wear log) and "Not for me" (dislike feedback, then regenerate).
- ✅ Works offline: no weather means seasonal defaults, clearly labelled.

### Saved outfits and albums
- ✅ Save outfits as **references** to wardrobe items (never copies).
- 🟢 Rename, favorite, notes, occasion and style tags, weather context, wear history, delete.
- ✅ Albums: create, rename, describe, reorder, delete (the outfits survive), choose a cover. An outfit can be in many albums.
- ✅ A deleted wardrobe item shows as "REMOVED: Grey jeans" in saved outfits; nothing is silently substituted.

### Settings and data
- 🟢 Theme (match iPhone, light, dark), °C/°F, weather location (GPS or city search), refresh frequency.
- 🟢 Style profile: preferred and avoided styles and colors, default and typical occasions, temperature comfort, accessory limit.
- 🟢 History screen: wear log, likes and dislikes (each can be undone), past suggestions.
- 🟢 Optional daily **morning reminder** (local notification).
- ✅ **Export and restore** a full backup (records and photos) with merge or replace modes; ✅ delete all data.

### Not implemented yet
- ⏳ Dresses and jumpsuits as a single piece that fills both top and bottom.
- ⏳ Background removal from photos (no free on‑device option in Expo Go).
- ⏳ Drag‑and‑drop album reordering (arrow buttons are used instead).
- ⏳ Custom app icon and splash in the pixel style (Expo Go shows its own icon anyway).

---

## Technology stack

| Tool | Version | What it does here |
|---|---|---|
| **React Native** | 0.86 | Builds a native iOS UI from JavaScript/TypeScript. |
| **Expo SDK** | 57 | A toolkit around React Native: camera, files, SQLite, notifications… and **Expo Go**, which runs the app on your iPhone without Xcode. |
| **TypeScript** | 6.0, `strict` + `noUncheckedIndexedAccess` | Catches mistakes before running the app. |
| **Expo Router** | 57 | File‑based navigation: every file in `src/app/` is a screen. |
| **expo-sqlite** | 57 | On‑device SQL database for items, outfits, albums and history. |
| **expo-file-system** | 57 | Permanent storage for photos and writing backup files. |
| **expo-image-picker** / **expo-image-manipulator** | 57 | Take or pick photos; resize them and make thumbnails. |
| **expo-image** | 57 | Fast cached image display in grids. |
| **expo-location** | 57 | Optional "use my location" for weather. |
| **expo-notifications** | 57 | Optional local morning reminder. |
| **expo-sharing** / **expo-document-picker** | 57 | Save a backup via the iOS share sheet; pick one to restore. |
| **expo-haptics**, **expo-crypto**, **react-native-svg** | — | Tactile feedback, UUIDs, and drawing pixel art and Memphis shapes. |
| **@expo-google-fonts** (Archivo Black, DM Sans, Silkscreen) | — | Bundled open‑license fonts. |
| **Jest** + **jest-expo** + **React Native Testing Library** | 29 / 57 / 14 | Unit, database and UI smoke tests. |
| **ESLint** (`eslint-config-expo`) | 9 | Code‑quality checks. |

Weather comes from **Open‑Meteo**, a free API that needs no key. The recommendation engine is plain TypeScript with no AI service.

---

## Prerequisites

| You need | Notes |
|---|---|
| **Windows 10 or 11** | Developed on Windows 11. |
| **Node.js LTS** (20, 22 or 24) | https://nodejs.org. Built with Node 24.21. Running the *tests* needs **Node 22.5 or newer**, because they use Node's built‑in SQLite. |
| **npm** | Comes with Node. Built with npm 11. |
| **VS Code** (or any editor) | Recommended extensions: ESLint, Expo Tools. |
| **Git** | Optional but recommended. |
| **iPhone with Expo Go** | Expo Go **57.x** (e.g. 57.0.9), which runs **SDK 57** projects. See [Expo Go version](#expo-go-version). |
| **Apple Account** | Only needed to download Expo Go from the App Store. **No paid Apple Developer membership is needed.** |

**You do NOT need a Mac or Xcode** for this workflow. Expo Go is a prebuilt app that loads your JavaScript over Wi‑Fi from your PC.

---

## Installation and setup

Open **PowerShell** or the VS Code terminal in the project folder.

```powershell
# 1. Install dependencies (exact versions come from package-lock.json)
npm install

# 2. Check the project and dependency versions are healthy and match Expo SDK 57
npm run doctor

# 3. Start the development server (shows a QR code)
npm start
```

All the scripts in `package.json`:

| Command | What it does |
|---|---|
| `npm start` | Starts the Expo dev server for Expo Go. |
| `npm run start:clear` | Same, but clears the bundler cache (fixes odd stale‑code issues). |
| `npm run tunnel` | Starts the server through a tunnel, for when the phone can't reach your PC on the LAN. |
| `npm test` | Runs all Jest tests once. |
| `npm run test:watch` | Re‑runs tests as you edit. |
| `npm run typecheck` | TypeScript check (`tsc --noEmit`). |
| `npm run lint` | ESLint via `expo lint`. |
| `npm run doctor` | `expo-doctor`: dependency and config diagnostics. |
| `npm run check` | typecheck, lint and tests in one go. |

**Adding packages:** always use `npx expo install <package>`, never plain `npm install <package>`. That picks the version that matches SDK 57. On Windows, dev dependencies need quoting: `npx expo install some-package "--" --dev`.

**Common setup issues**

- *`npm install` fails with `ERESOLVE`.* Delete `node_modules` and run `npm install` again. If it persists, run `npx expo install --fix`.
- *npm warns "install scripts not yet covered by allowScripts".* This is an npm 11 safety notice. The app and tests work without approving those scripts.
- *`npm test` fails with "Cannot find module 'node:sqlite'".* Your Node version is older than 22.5. Upgrade Node.

---

## Running on your iPhone

1. **Install Expo Go** from the App Store and open it once.
2. **Start the server** on your PC: `npm start`. Wait for the QR code.
3. **Scan the QR code** with the iPhone's **Camera app** and tap the banner. It opens in Expo Go.
4. **Same network.** Your PC and iPhone must be on the same Wi‑Fi. Guest networks and some university or office networks block device‑to‑device traffic.
5. **Can't connect?** Stop the server (Ctrl+C) and run `npm run tunnel`. The first time, the Expo CLI offers to install `@expo/ngrok` (free). The tunnel is slower but works across networks.
6. **Windows Firewall.** The first `npm start` usually triggers a firewall prompt for Node.js. Allow it on **Private** networks. If you dismissed it, open *Windows Security → Firewall & network protection → Allow an app through firewall* and tick **Node.js** for Private. Also make sure your Wi‑Fi is set to a **Private** network in Windows settings.
7. **After restarting the server**, Expo Go usually reconnects by itself. If not, shake the phone (or three‑finger long‑press) to open the developer menu and tap *Reload*, or rescan the QR code. Recent projects also appear on Expo Go's home screen.

The first time you add a piece, iOS asks for camera access, *for Expo Go*. Choosing from the library uses the iOS photo picker, which needs no library permission.

<a id="expo-go-version"></a>
### Expo Go version

This project targets **Expo SDK 57** (`expo@~57.0.30`, React Native 0.86.3, React 19.2.3), so it runs in **Expo Go 57.x**, for example 57.0.9.

- Check the SDK your Expo Go supports in its settings screen.
- If Expo Go says the project's SDK isn't supported, your Expo Go and this project are on different SDKs.
- The App Store normally carries only the *latest* Expo Go. If yours updates to SDK 58 or later, upgrade the project to match: `npx expo install expo@^58.0.0`, then `npx expo install --fix`, then `npm run check`. The SDK 58 tab bar API differs (see `src/components/TabBar.tsx`).

> **Expo Go is not your installed app.** Expo Go is a development runtime: Wardgo runs *inside* it while your PC serves the code. Your data (SQLite database and photos) lives inside Expo Go's storage for this project and persists between launches. But **deleting Expo Go deletes Wardgo's data**, so export a backup first. A standalone "Wardgo" app on your home screen is a separate step; see [Cost and distribution](#cost-and-distribution).

---

## Project structure

```
Wardgo/
├── app.json                  Expo config: name, scheme, plugins, iOS permission texts
├── package.json              Dependencies and npm scripts
├── tsconfig.json             Strict TypeScript settings
├── eslint.config.js          ESLint (Expo config + one documented override)
├── AGENTS.md                 Notes from the Expo template for AI coding tools
├── assets/                   App icon/splash images (Expo defaults for now)
├── src/
│   ├── app/                  ── Screens (Expo Router: file = route) ──
│   │   ├── _layout.tsx       Root: fonts, SQLite + migrations, theme, stack, reminder taps
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx   Bottom tabs with the custom Memphis tab bar
│   │   │   ├── index.tsx     Today (weather + outfit + locks + regenerate)
│   │   │   ├── wardrobe.tsx  Wardrobe grid, search, filters
│   │   │   ├── outfits.tsx   Saved / Favorites / Albums
│   │   │   └── settings.tsx  Preferences, reminder, backup/restore, delete data
│   │   ├── item/new.tsx      Add item (modal)
│   │   ├── item/[id].tsx     Item details
│   │   ├── item/edit/[id].tsx Edit item (modal)
│   │   ├── outfit/[id].tsx   Saved outfit details
│   │   ├── album/[id].tsx    Album details
│   │   ├── location.tsx      GPS or city search
│   │   ├── style-profile.tsx Style and color preferences
│   │   └── history.tsx       Wear log, feedback, past suggestions
│   ├── assets/pixel/sprites.ts  All original pixel art (as text grids)
│   ├── components/           Reusable UI: AppText, Button, Chip, Sticker, Sheet, Field,
│   │   │                     ItemPhoto, EmptyState, Feedback (Banner/PipMeter/SaveBurst), TabBar
│   │   ├── memphis/          SVG shapes (Squiggle, Zigzag, DotGrid, Triangle…) + header accents
│   │   └── pixel/            PixelArt renderer (+ run‑length merging)
│   ├── database/
│   │   ├── db.ts             Small Db interface + expo-sqlite adapter
│   │   ├── migrations.ts     Schema and migration runner (PRAGMA user_version)
│   │   └── repositories/     items, outfits, albums, history (wear/feedback/log), preferences
│   ├── engine/               ── Pure TypeScript, no Expo/React imports ──
│   │   ├── catalog.ts        Categories, slots, colors, styles, occasions
│   │   ├── weather.ts        Weather codes → icons; forecast → clothing needs
│   │   ├── harmony.ts        Color and style compatibility
│   │   ├── scoring.ts        Per‑item and per‑combination scores
│   │   ├── recommend.ts      generateOutfit, regenerateOutfit, validateRegeneration
│   │   ├── session.ts        Locks + undo state machine (reducer)
│   │   └── random.ts         Seeded RNG for reproducible results
│   ├── features/             Screen logic and feature components
│   │   ├── app/AppState.tsx  DB + preferences context, useLiveQuery
│   │   ├── today/            useTodayOutfit, useWeather, WeatherCard, TuneSheet
│   │   ├── wardrobe/         ItemForm, ItemTile, filter.ts
│   │   ├── outfits/          PieceCard (with lock), OutfitCard, OutfitCollage
│   │   └── albums/           AlbumCover
│   ├── services/
│   │   ├── weather/          openMeteo.ts (API client), weatherService.ts (cache)
│   │   ├── location/         Foreground location
│   │   ├── storage/          images.ts, pickPhoto.ts, backup.ts, backupFormat.ts
│   │   └── notifications/    Morning reminder
│   ├── theme/                tokens.ts (colors, spacing, radii, fonts), ThemeProvider
│   ├── types/models.ts       Shared domain types
│   └── utils/                Dates, IDs
└── tests/                    Jest tests (see Testing)
```

> The spec suggested an `app/` folder at the project root. The Expo templates and their guidance use `src/app/`, and Expo Router picks that up automatically. Everything else follows the suggested layout.

---

## Architecture and data model

```
UI (src/app, src/features, src/components)
        │  calls
        ▼
Hooks: useTodayOutfit, useWeather, useLiveQuery
        │                         │
        ▼                         ▼
engine/ (pure TS)          database/repositories ── SQLite (wardgo.db)
                           services/storage      ── documents/wardrobe-images/
                           services/weather      ── api.open-meteo.com
```

The engine knows nothing about React, SQLite or Expo. It receives plain data and returns plain data, which is why it can be tested thoroughly.

### SQLite tables (`src/database/migrations.ts`)

| Table | Purpose | Key relationships |
|---|---|---|
| `items` | Wardrobe pieces | `id` is a UUID (TEXT PRIMARY KEY); CHECK constraints on category, formality 1–5, warmth 1–5, rain |
| `item_images` | Photo file names per item, ordered | `item_id → items` **ON DELETE CASCADE** |
| `outfits` | Saved outfits | — |
| `outfit_items` | One row per slot in an outfit | `outfit_id → outfits` CASCADE; `item_id → items` **ON DELETE SET NULL** plus an `item_name` snapshot |
| `albums` | Albums with order (`position`) and cover | `cover_outfit_id → outfits` SET NULL |
| `album_outfits` | Many‑to‑many album ↔ outfit | both sides CASCADE (deleting an album deletes **links only**) |
| `wear_events`, `wear_event_items` | What was worn when | `outfit_id` SET NULL; items CASCADE |
| `feedback` | Likes and dislikes of combinations or items | — |
| `recommendation_log` | Last 200 suggestions | — |
| `preferences` | Key/value JSON (settings, today's outfit state) | — |
| `weather_cache` | Last forecast | — |

`PRAGMA foreign_keys = ON` is set on every connection, so these rules are enforced by SQLite itself, not just by app code.

**How outfits reference clothes.** An outfit is a map of *slot → wardrobe item ID*. Slots are `top`, `outerwear`, `bottom`, `footwear`, and accessory slots (`watch`, `headwear`, `eyewear`, `neckwear`, `belt`, `bag`, `jewelry`, `gloves`, `other`), so an outfit never has two watches. Saving an outfit writes only IDs; no item is copied.

**Deleting an item that is used in outfits.** The `outfit_items.item_id` becomes `NULL` and the stored `item_name` remains. The outfit shows "REMOVED · Grey jeans". Nothing crashes and nothing is substituted.

**Where photos live.** `<app documents>/wardrobe-images/<uuid>.jpg` and `<uuid>_t.jpg` (thumbnail). The database stores **only file names**; full paths are rebuilt at runtime because iOS can change the app container path between installs and updates. Each photo is written to a temp file and *moved* into place, so an interrupted import never leaves a half‑written file under a referenced name. On startup, unreferenced photos older than one hour (left by a crash or a cancelled form) are cleaned up.

**Migrations.** `PRAGMA user_version` stores the schema version. On launch, `migrate()` runs every migration newer than that version, each in its own transaction. To change the schema, **append** a new `{ version: 2, sql: ... }` entry and never edit an old one. A database from a *newer* app version is refused rather than corrupted.

**Separation of scoring and UI.** `src/engine/*` contains all recommendation logic. `features/today/engineContext.ts` loads data from the database and builds the engine's input. `useTodayOutfit` connects the result to the UI.

---

## Outfit recommendation algorithm

Code: `src/engine/scoring.ts`, `recommend.ts`, `weather.ts`, `harmony.ts`.

1. **Climate.** The forecast becomes an *effective temperature*: 60% feels‑like plus 40% of the day's mid‑point. It is shifted ±3 °C for "I run cold/hot" and ±4 °C for the "warmer/lighter" tune control. That puts the day in a band (freezing, cold, cool, mild, warm, hot) with an ideal warmth (1–5) for tops, bottoms and outer layers, and decides whether an outer layer is *required*, *optional* or *unwanted*. Rain (≥ 50% probability or a wet weather code) and wind (≥ 30 km/h) are flagged.
2. **Weather filtering.** Each subcategory has a wearable temperature range (shorts ≥ 17 °C, sandals ≥ 18 °C and never in rain, parkas ≤ 10 °C…). Items outside it are *ineligible*. Ineligible items are never chosen as replacements; for a fresh outfit, they're used only when there's no alternative, and you'll see a warning.
3. **Item score** (additive, each part with a reason): warmth distance from ideal, rain suitability, season tags, formality vs. occasion (Everyday 2, Work 3.5, Date 3, Active 1, Formal 4.6, ±0.9 from the tune control), preferred and avoided styles and colors, favorites, your likes and dislikes, and **recency** (worn today or yesterday −2.5, within 3 days −1.2, within a week −0.4; stronger with "avoid recently worn").
4. **Combination score.** The top 6 candidates per core slot are combined (outer layer optional when allowed), then scored for **color harmony** (neutrals pair with anything; analogous and complementary hues are good; clashing hues and more than two bold colors are penalised unless you asked for "more colorful"), **style coherence** (shared tags; clashes like formal + sporty are penalised), formality spread, pattern clashes, **liked/disliked combinations** (a dislike is −6, effectively excluded) and **recently worn combinations**.
5. **Choice.** A small seeded random jitter keeps results varied. The final pick is weighted among options within 1.2 points of the best, so a clear penalty is never overridden by luck. Accessories are then added greedily up to your accessory limit, only if they help.
6. **Explanation.** The top reasons become the "Why this outfit" lines.

### Locked items: the guarantee

`regenerateOutfit(ctx, { current, lockedIds, scope })`:

- Locked IDs are passed explicitly. Their slots are **fixed** and never become candidates.
- `scope: { kind: 'all' }` re‑picks every unlocked slot (current items are discouraged so things actually change). `scope: { kind: 'slot', slot }` changes **only** that slot and excludes its current item.
- Before returning, `validateRegeneration()` checks that every locked ID is still in its slot, that nothing outside a single‑slot scope changed, that all items exist and sit in their correct slot, that no item appears twice, and that newly chosen items are available. Any violation **rejects the result**.
- The session reducer (`session.ts`) re‑checks locks before committing and keeps the previous outfit until a regeneration succeeds. Undo keeps up to 20 steps.
- **No valid replacement?** You get a specific message, e.g. "No valid replacement for the watch. This is your only watch item." or "…Your other shoes items are marked unavailable.", and the outfit stays as it was.

### Changing the scoring

All the weights are plain numbers in `scoring.ts` (`scoreItem`, `scoreCombination`), `harmony.ts` and `weather.ts` (temperature bands and ideals). Temperature ranges per item type are in `catalog.ts` (`SUBCATEGORIES`). After changing anything, run `npm test`. The tests in `tests/regenerate.test.ts` and `tests/weather-scoring.test.ts` lock in the behaviour that must not regress.

---

## Weather integration

| | |
|---|---|
| **Provider** | [Open‑Meteo](https://open-meteo.com) |
| **Endpoints** | `https://api.open-meteo.com/v1/forecast` (current conditions plus today's high/low, rain chance and weather code), `https://geocoding-api.open-meteo.com/v1/search` (city search) |
| **Configuration** | None. **No API key, no account, no secrets.** |
| **Free tier** (checked Oct 2026 at open-meteo.com/en/terms) | Non‑commercial use; 600 calls/min, 5,000/hour, 10,000/day, 300,000/month, per IP. Wardgo makes at most a few calls per hour, only while open. |
| **Licence** | Data is CC BY 4.0, so the app shows "Weather: Open‑Meteo.com" on the weather card and in Settings. |
| **Commercial use** | Not allowed on the free API. If you ever sell the app or add ads or subscriptions, you'd need a paid Open‑Meteo plan or another provider. |

**Location.** Weather is off until you choose a location in Settings → Weather (or tap "Set location" on Today):

- *Use current location* requests **When In Use** permission at that moment, never at launch.
- *Search a city* needs no permission at all. This is the fallback if you deny location.

Coordinates are **rounded to 2 decimals (~1 km)** before being sent.

**Caching and offline.** The last forecast is saved in SQLite. Weather refreshes on open and when the app returns to the foreground, if older than your chosen interval (30 min / 1 h / 3 h / manual). Pull down on Today to force a refresh. Data older than 3 hours, or from a previous day, shows **STALE**. If the network fails, the cached forecast is used with a note. With no forecast at all, outfits fall back to a typical temperature for the current season (hemisphere‑aware) and say so.

**Troubleshooting weather.** See [Weather is unavailable](#weather-is-unavailable).

---

## Design system and assets

**Colors** (`src/theme/tokens.ts`). Components use *roles*, not raw hex values:

| Role | Light | Dark | Used for |
|---|---|---|---|
| bg / surface | cream `#FFF4E0` / `#FFFDF7` | aubergine `#17141F` / `#221E2D` | Backgrounds, cards |
| text / border | ink `#1B1A1F` | cream `#FFF4E0` / `#F2E6CF` | Text, outlines |
| shadow | ink | violet `#5B4BDB` | Hard offset "sticker" shadows |
| primary | cobalt `#2347E8` | `#7A93FF` | Main actions, selected chips |
| secondary | coral `#FF5A7A` | `#FF7A94` | Favorites, playful accents |
| highlight | mustard `#F6B91A` | `#FFC94A` | **Locks**, status badges, active tab |
| mint | `#3DD6B5` | `#58E6C8` | Success, "wore it" |
| lilac / sky / pink | pastels | deep tints | Quiet panels (weather card, empty states) |

Dark mode is its own palette: deep aubergine with cream ink and slightly brighter accents. It is not an inversion. Text‑on‑color pairs were chosen for WCAG AA contrast.

**Typography.** **Archivo Black** for display headings, **DM Sans** for all body text, **Silkscreen** (pixel) *only* for short labels: dates, counters, tags such as "LOCKED". All three are SIL Open Font License fonts bundled via `@expo-google-fonts`, which permits redistribution. If a font fails to load, iOS falls back to the system font and the app still runs. Text respects Dynamic Type with per‑style caps so layouts don't break.

**Shapes and components.** "Sticker" surfaces with 2.5 pt outlines and hard `boxShadow` offsets. Corners are chosen deliberately: *soft* (14), *sharp* (4), *pill*, and asymmetric *ticket* corners. Buttons press *into* their shadow. Each category has its own marker shape: top ● circle, bottom ■ square, shoes ticket, accessory ◆ diamond. Each tab has its own active badge shape.

**Pixel art** (`src/assets/pixel/sprites.ts`). **All sprites are original to this project**, drawn as text grids. `.` is transparent, `X` takes the icon color, and other letters map to a small palette. There are 34 UI icons (12×12), 9 weather sprites (16×16), and decorative sprites (tee mascot, empty album, sparkle, heart). `PixelArt.tsx` merges horizontal runs into a few SVG rectangles and draws them at **integer point coordinates**, so edges stay crisp at any scale.

*To add or update artwork:* add a grid to `ICONS`, `WEATHER_SPRITES` or `SPRITES`, then run `npm test`. `tests/sprites.test.ts` fails if any row has the wrong width or uses an unknown color letter.

**Memphis graphics** (`src/components/memphis/`). `Squiggle`, `Zigzag`, `DotGrid`, `Triangle`, `Ring`, `Disc`, `HalfDisc`, `Checker` and `StripeBar`, composed into per‑screen header clusters by `MemphisAccent`.

**Motion.** Tab shift transition, the tab badge pops, the lock icon wiggles, the regenerate dice spins in four 90° steps, changed pieces "pop", and saving shows a pixel sparkle burst. All are brief, and all are disabled or simplified when iOS **Reduce Motion** is on.

**Accessibility rules for decoration.** Decorative SVGs are hidden from VoiceOver and never take touches. Locked state is shown by icon (closed vs. open padlock), text ("Locked" vs. "Lock"), border and tag, never by color alone. Selected chips show a check mark. Touch targets are at least 44 pt.

---

## Privacy and local data

**Stored on the phone (inside Expo Go's sandbox for this project):** the SQLite database `wardgo.db` and the `wardrobe-images/` folder.

**Sent off the phone:** only *rounded* coordinates (or a city search term) to Open‑Meteo, and only if you enable weather. Open‑Meteo sees your IP address like any web request. **Never sent:** photos, wardrobe details, outfits, history. There is no analytics, no ads, no account, and no AI service.

**Permissions** (each requested only when you use the feature):

| Permission | When it's requested |
|---|---|
| Camera | When you tap *Take a photo* |
| Location | When you tap *Use current location* |
| Notifications | When you turn on the reminder |

The photo library uses the iOS system picker, which needs no permission.

**Export.** Settings → *Export backup* writes one `.json` file containing every record plus base64 photos, then opens the share sheet. Save it to Files, iCloud Drive, or AirDrop it to a computer.

**Restore.** Settings → *Restore from backup*, pick the file, then choose a mode:

- **Merge** keeps what's on the phone and adds anything missing. Duplicate IDs are skipped.
- **Replace all** wipes current data first.

Restore is validated and transactional. Damaged records are skipped with a warning, photos missing from the archive leave the item without a photo, broken links are repaired, and if anything fails the database rolls back and newly written photos are removed.

**Delete everything.** Settings → *Delete all data* (double confirmation). Deleting Expo Go also deletes all Wardgo data.

**Limitations.** App storage is **not a backup**. Expo Go updates normally keep data, but reinstalling Expo Go, resetting the phone, or a storage problem can lose it. Export regularly. Backups are unencrypted JSON, so treat them like your photo album. Very large wardrobes produce large files: roughly 150–250 KB per photo.

---

## Testing

### Automated tests (all executed on Windows, Node 24.21: **8 suites, 126 tests, all passing**)

```powershell
npm test            # all tests
npm run typecheck   # passes with no errors
npm run lint        # passes with no errors or warnings
npm run doctor      # 20/20 checks passed
```

| Suite | What it covers |
|---|---|
| `tests/regenerate.test.ts` | **Locking:** one lock, multiple locks, locked accessories, regenerate only the top, single accessory swap, refusing to swap a locked slot, no replacement available, everything locked, unavailable items, locked item that later became unavailable, 30× repeated regeneration (locks hold, variety happens), insufficient inventory, validation rejecting moved, dropped or out‑of‑scope changes, **undo** (single, multiple, after failure, lock survival), replace and deleted‑item pruning. |
| `tests/weather-scoring.test.ts` | Cold rain → outer layer and boots, no shorts or sandals; hot → no layers; no‑weather fallback; comfort and warmth shifts; disliked combinations avoided; recently worn avoided; avoided colors; color harmony. |
| `tests/database.test.ts` | Migrations (idempotent, refuses newer DB, foreign keys on), item CRUD with images, constraints, outfits referencing items, saving with a missing item rolls back, **deleting an item leaves a named placeholder**, outfits in multiple albums, deleting an album keeps outfits, reorder, cover cleanup, wear history, feedback, preferences sanitising. Runs real SQL on Node's built‑in SQLite. |
| `tests/backup.test.ts` | Invalid archives rejected, malformed rows and unsafe filenames dropped, **round‑trip into a clean store**, missing images, merge with duplicate IDs, dangling references repaired, failed restore rolls back. |
| `tests/wardrobe-filter.test.ts` | Search, every filter, sorting, and a **600‑item wardrobe** generating an outfit in well under the 1.5 s budget. |
| `tests/weather-service.test.ts` | Open‑Meteo parsing against a real response shape, malformed payloads, coordinate rounding, stale rules. |
| `tests/sprites.test.ts` | Every sprite is rectangular, correctly sized and uses known colors. |
| `tests/ui.test.tsx` | Components render in light and dark mode; all icons render; buttons, chips and the lock **switch** expose correct accessibility roles and states; the weather card shows live, stale and no‑location states; Reduce Motion. |

Coverage (from `npx jest --coverage`, counting only files the tests load): engine ~88% statements, `backupFormat` ~91%, repositories ~78%. Screens and native‑module wrappers (camera, file system, notifications) are **not** unit‑tested; they need device testing.

### Also verified (Windows)
- `npx expo export --platform ios` bundles the whole app with no errors (3.3 MB Hermes bytecode).
- `npm start` serves a valid SDK 57 manifest (`exposdk:57.0.0`) and the iOS dev bundle (HTTP 200), which is exactly what Expo Go requests.

### Still to test on a physical iPhone (not yet done)
Work through this list once on your phone:

1. Add 3+ items with the **camera** and 3+ from the **library**. Force‑quit Expo Go, reopen, and check the photos and data are still there.
2. Set a location (both GPS and city search). Deny location once and check city search still works. Toggle airplane mode and check the stale/offline messaging.
3. On Today: lock 2 items, regenerate 10× (locked items never change), swap a single category, undo several times, tune "warmer", change occasion.
4. Save, favorite, rename and mark worn; create 2 albums; add one outfit to both; delete one album and check the outfit survives; delete an item used in an outfit and check "REMOVED" appears.
5. Turn on the reminder for 2 minutes from now, lock the phone, tap the notification, and check it opens Today.
6. Export a backup to Files, delete all data, restore with *Replace all*, and check everything comes back including photos.
7. Toggle dark mode, Larger Text (Settings → Accessibility → Display & Text Size), Reduce Motion and VoiceOver.

---

## Cost and distribution

| Thing | Cost |
|---|---|
| Node, npm, VS Code, Expo CLI, Expo Go, all libraries used | Free |
| Open‑Meteo weather and geocoding | Free for non‑commercial use (limits above) |
| SQLite, file storage, recommendation engine | On‑device, free |
| Tunnel (`@expo/ngrok`) | Free |
| Apple Account (to download Expo Go) | Free |

The app has **no paid AI**: recommendations are deterministic TypeScript rules running on the phone.

**Expo Go limitations.** It runs only libraries already built into Expo Go (everything this app uses is). It needs your PC's dev server to load the app; it can't run on its own away from your PC. It must match the SDK version (57). Local notifications work, but remote push notifications don't. Data belongs to Expo Go's sandbox.

**A standalone iOS app is a different step**, and it is *not* automatically free:

- iOS only installs apps **signed** with an Apple certificate and a provisioning profile.
- **EAS Build** (Expo's cloud build) can produce an iOS build from Windows. Its free tier has limited monthly builds; check expo.dev/pricing for current limits. However, signing a build to install on a real iPhone (ad‑hoc, TestFlight or App Store) requires the **paid Apple Developer Program** (about US$99/year at the time of writing).
- The free alternative, signing with a free Apple Account in Xcode, requires **a Mac**. Those builds expire after about 7 days.
- **A successful cloud build (`.ipa`) does not mean you can install it for free.** Without valid signing for your device, iOS refuses to install it.

The code is kept compatible with a future standalone build: permission texts and plugins are in `app.json`, and no Expo Go‑only shortcuts are used. When you're ready, set your own `ios.bundleIdentifier` in `app.json` (the placeholder is `com.example.wardgo`) and follow https://docs.expo.dev/deploy/build-project/.

---

## Troubleshooting

**QR code doesn't connect / "Could not connect to development server".**
Check both devices are on the same Wi‑Fi (not a guest network) and the firewall allows Node.js on Private networks. Try `npm run tunnel`. VPNs on either device often block the connection.

**Windows Firewall blocks the server.**
Windows Security → Firewall & network protection → *Allow an app through firewall* → tick **Node.js JavaScript Runtime** for *Private*. Set your Wi‑Fi to *Private* in Settings → Network & Internet.

**Expo Go says the project is incompatible / needs a different SDK.**
This project is **SDK 57** and needs Expo Go 57.x — see [Expo Go version](#expo-go-version). Then run `npm run doctor`. If a package was installed with plain npm, run `npx expo install --fix`.

**Images disappear after restarting.**
Photos are copied into `documents/wardrobe-images` and survive restarts. If you see "NO PHOTO" tiles, the file is missing: either Expo Go was reinstalled (data is lost unless you have a backup), or the photo was imported but the item never saved (cleaned up after an hour). Restore from a backup.

**"Wardgo could not open its database" / SQLite initialization fails.**
Force‑quit Expo Go and reopen. If you recently ran a *newer* version of this code and went back to an older one, the database is refused on purpose ("newer than this app understands"). Run the newer code, or export, reinstall Expo Go and restore. Run `npm run start:clear` if the bundle seems stale.

<a id="weather-is-unavailable"></a>**Weather is unavailable.**
Check the phone has internet. Pull down on Today to retry. If you're on a restrictive network, Open‑Meteo may be blocked. Outfits still work using seasonal defaults. Check the location is set (Settings → Weather).

**Location permission is denied.**
Use *Search for a city* instead, or enable it later: iOS Settings → **Expo Go** → Location → *While Using the App*. In Expo Go, permissions belong to Expo Go, not to Wardgo.

**Notifications behave differently than expected.**
The reminder is a *scheduled local notification*. iOS shows it at the chosen time, but **no app code runs in the background**, so it can't fetch weather or pick an outfit at that moment. That happens when you open the app. Check iOS Settings → Expo Go → Notifications. Focus modes can hide it. If you reinstall Expo Go, toggle the reminder off and on again.

**Locked items change unexpectedly.**
This should be impossible: every regeneration is validated and rejected if a locked item moves. Possible causes: the item was *deleted* (it's removed from the outfit and you'll see a message), or you tapped the lock again (the button shows "Lock" vs "Locked"). Undo restores the previous outfit. If you can reproduce it, run `npm test -- regenerate` and file the steps.

**Database restore fails.**
Make sure the file is a Wardgo `.json` backup and wasn't renamed or edited. "Newer version" means update the app. Very large backups need free storage roughly 2× the file size. A failed restore changes nothing; your current data is intact.

**`npm test` fails with "node:sqlite".** Upgrade Node to 22.5 or newer (LTS 24 recommended).

---

## Roadmap and contributing

**Next improvements**
- Run the iPhone checklist above and fix whatever it finds.
- Dresses and jumpsuits (a piece that fills top and bottom).
- Pixel‑style app icon and splash screen.
- Drag‑to‑reorder albums (`react-native-gesture-handler` is available in Expo Go).
- Calendar view of wear history and "most worn / never worn" insights.
- Optional encrypted backups.
- Tests for the screen hooks (`useTodayOutfit`) with a mocked database.

**Adding a feature without breaking the architecture**
1. **Domain or logic first.** Put rules in `src/engine` (pure functions, no imports from Expo or React) and add tests in `tests/`.
2. **Persistence.** Add a migration (new version number, append‑only), then a repository function in `src/database/repositories`. If the data must be backed up, add the table and columns to `BACKUP_TABLES` in `backupFormat.ts`.
3. **Side effects** (network, files, permissions) go in `src/services`.
4. **UI.** Screens in `src/app`, feature components in `src/features/<feature>`, reusable pieces in `src/components`. Use theme roles (`useTheme().colors`) and existing components (`Sticker`, `Button`, `Chip`, `PixelIcon`) so the look stays consistent. Hide decoration from VoiceOver.
5. After any write, call `notifyDataChanged()` so open screens refresh.
6. Before committing: `npm run check`. Then update this README.

**Licence note.** `LICENSE` is still the MIT licence file that came with the Expo template (copyright Expo). Replace it with the licence you want for your own project. Fonts are SIL OFL; the pixel art and Memphis graphics are original to this project; weather data is CC BY 4.0 from Open‑Meteo.
