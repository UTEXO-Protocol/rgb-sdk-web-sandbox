# Repository guide

## Commands

- `npm ci`: install the locked dependencies, including the tracked SDK snapshots.
- `npm run dev`: Vite on port 5173.
- `npm run typecheck`: TypeScript.
- `npm run build`: TypeScript and production build.
- `npm run test:e2e`: offline Playwright suite against dev and production preview (build first).
- `npm run test:regtest`: funded BTC/RGB flows through the UI; needs the local
  RGB_L1 stand and connected Bitcoin peers (see README).
- `npm run sdk:pack`: build and pack sibling core/facade/web checkouts into `vendor/`.
  Follow with `npm install --force` and commit the snapshots, manifest and lockfile.

## SDKs

The primary `/onchain` screen uses the local, unpublished `@utexo/rgb-sdk`
facade over the local `@utexo/rgb-sdk-web` `RgbLibWeb` engine (`RGB_L1`). Its
shared contract and key helpers come from `@utexo/rgb-sdk-core`.

This is an on-chain-only app. Do not add the old RLN SDK, Lightning/LSP/APay
screens, begin/sign/end flows or legacy package aliases. File and VSS backup
controls are part of the on-chain wallet screen.

## Lifecycle and persistence

`src/lib/onchain.ts` constructs `new UTEXOWallet({ engine: new RgbLibWeb(config) })`
and calls `init()` only, closing the instance on failed initialization. The
facade owns the engine. Do not init/destroy `wallet.engine` independently.

`src/store.ts` owns live on-chain instances, wrapped for activity logging.
Each new profile gets a unique stable `dataDir`. `src/lib/session.ts` saves
configuration to localStorage and active selection to sessionStorage/URL.
Reload reopens the same profile. Do not reinterpret legacy state or discard
sessions that failed to restore. Remove the saved entry explicitly when a
profile is removed, and close its live instance.

On-chain file/VSS restore must run after init and before an online call. Blank
VSS URL explicitly disables cloud backup. Backup passwords and bytes must not
appear in activity logs. This sandbox stores mnemonics in localStorage.

## Bundling

Resolve installed tarball packages; do not add sibling source aliases that
make TypeScript, Vite and clean installs use different SDK versions. Keep
`@utexo/rgb-sdk-web` and `@utexo/rgb-lib-wasm` out of Vite dependency
optimization. The WASM URL is handled by Vite directly; no Node polyfills,
WASM or top-level-await plugins are needed. Development proxies serve
Esplora, the RGB proxy and VSS for the RGB_L1 stand.

## UI

Reuse `Section`, `Field`, `Btn`, `OutputBox` and existing colors. The on-chain
page uses typed facade calls and engine backup extensions. Browser tests use real WASM and IndexedDB without
requiring external services; funded network flows need a separate live stand.
