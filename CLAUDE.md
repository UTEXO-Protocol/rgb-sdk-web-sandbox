# Repository guide

## Commands

- `npm ci`: install the locked dependencies, including the tracked SDK snapshots.
- `npm run dev`: Vite on port 5173.
- `npm run typecheck`: TypeScript.
- `npm run build`: TypeScript and production build.
- `npm run test:e2e`: Playwright against dev and production preview (build first).
- `npm run sdk:pack`: build and pack sibling core/facade/web checkouts into `vendor/`.
  Follow with `npm install --force` and commit the snapshots, manifest and lockfile.

## SDKs

The primary `/onchain` screen uses the local, unpublished `@utexo/rgb-sdk`
facade over the local `@utexo/rgb-sdk-web` `RgbLibWeb` engine (`RGB_L1`). Its
shared contract and key helpers come from `@utexo/rgb-sdk-core`.

The existing `/utexo-wallet`, `/lsp-apay`, `/backup` screens still use the
registry RLN SDK, pinned under `@utexo/rgb-sdk-web-legacy`. Never change these
imports to the new package: the new engine has no Lightning or begin/sign/end
API. `@utexo/rgb-sdk-core-legacy` is the matching old core for those flows.

## Lifecycle and persistence

`src/lib/onchain.ts` constructs `new UTEXOWallet({ engine: new RgbLibWeb(config) })`
and calls `init()` only, closing the instance on failed initialization. The
facade owns the engine. Do not init/destroy `wallet.engine` independently.

`src/store.ts` owns live instances, wrapped for activity logging. `onchain`
entries have a separate config and type from legacy `utexo`/`rln` entries.
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
`@utexo/rgb-sdk-web`, `@utexo/rgb-lib-wasm`, `@utexo/rgb-sdk-web-legacy` and
`@utexo/rln-wasm` out of Vite dependency optimization. Legacy dependencies
still need node polyfills, WASM and top-level-await plugins, in that order
before React. Keep the RGB_L1 stand proxies separate from legacy LSP proxies.

## UI

Reuse `Section`, `Field`, `Btn`, `OutputBox` and existing colors. The on-chain
page uses typed facade calls and engine backup extensions. Legacy pages keep
their existing workflows. Browser tests use real WASM and IndexedDB without
requiring external services; funded network flows need a separate live stand.
