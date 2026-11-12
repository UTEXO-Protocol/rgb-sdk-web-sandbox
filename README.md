# RGB SDK Web Playground

On-chain browser playground for the unpublished `@utexo/rgb-sdk` facade and
`@utexo/rgb-sdk-web` on-chain engine. The app constructs
`new UTEXOWallet({ engine: new RgbLibWeb(config) })` and calls the facade.

## Run

Use Node 22+ and npm:

```sh
npm ci
npm run dev
```

Open http://localhost:5173/onchain. No sibling checkout or npm release is
needed: `vendor/` contains built snapshots of `rgb-sdk-core`, `rgb-sdk`, and
`rgb-sdk-web`. `vendor/sdk-snapshots.json` records their source commits and
SHA-256 checksums; the lockfile pins their npm integrity hashes.

The on-chain screen provides wallet creation, balances, UTXOs, NIA/IFA issuance,
BTC/RGB sends, witness/blinded invoices, transfers, encrypted file backups and
VSS. The sticky left menu links to numbered operation sections, with a section
picker on small screens. Each section keeps its own result; receive, send and
asset lookup forms have independent values. Blank mnemonic generates a new wallet. Amounts are in sats or the asset's
smallest units; fees are in sat/vB. A receive invoice for a specific asset
requires an explicit amount in the form. Leave both asset ID and amount blank
for an open invoice; when sending a fixed-amount invoice, the amount can be
omitted to use its encoded value.

Wallet creation runs `init()` only. Connect or any online operation establishes
the network connection. Restore backups **before** that connection. To restore
into a fresh profile, open another wallet with the same mnemonic, select the
backup and enter its password. Each profile has a unique `dataDir`, persisted
with its configuration. Reload reopens the same IndexedDB state. Removing a
profile closes its wallet and forgets the saved session; it does not erase the
IndexedDB backup data.

This is a development sandbox: session configuration, including the mnemonic,
is saved in browser localStorage. Keep a mnemonic and encrypted state backup
outside the browser. VSS is off unless a URL is entered in the creation form.
Backup passwords and archive bytes are excluded from the SDK activity log.

## Local SDK changes

With these sibling checkouts and their development dependencies installed:

```text
rgb-sdk-split/
  rgb-sdk-core/
  rgb-sdk/
  rgb-sdk-web/
  rgb-sdk-web-sandbox/
```

Run from the sandbox:

```sh
npm run sdk:pack
npm install --force
npm run build
```

Review and commit the three `vendor/*.tgz` snapshots, the snapshot manifest and
the updated lockfile together. `sdk:pack` builds the sibling working trees; it
does not change their source files, branches or dependency declarations. A
snapshot records uncommitted changes if present. Restart Vite after repacking.

Vite and TypeScript both resolve installed packages. There are no implicit
sibling-source aliases or registry fallbacks to a different SDK implementation.
The new WASM and web SDK are excluded from dependency optimization so their
`import.meta.url` asset loading works in dev. Production emits a hashed WASM
asset automatically.

## Networks

Testnet, testnet4 and utexo can use the engine defaults. Mainnet and signet need
an HTTP(S) Esplora URL; Electrum cannot run in the browser. Regtest pre-fills the
same-origin development proxies below, for an existing RGB_L1 stand:

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_RGB_L1_INDEXER_URL` | `/rgb-l1-esplora/regtest/api` | Browser-facing Esplora URL |
| `VITE_RGB_L1_PROXY_URL` | `/rgb-l1-proxy/json-rpc` | Browser-facing RGB proxy |
| `VITE_RGB_L1_INDEXER_TARGET` | `http://127.0.0.1:8094` | Vite Esplora upstream |
| `VITE_RGB_L1_PROXY_TARGET` | `http://127.0.0.1:3002` | Vite RGB proxy upstream |
| `VITE_RGB_L1_HELPER_TARGET` | `http://127.0.0.1:8080` | Vite `/rgb-l1-regtest` faucet upstream |
| `VITE_RGB_L1_VSS_TARGET` | `http://127.0.0.1:8181` | Vite `/vss` upstream |

The new engine's `rgb-lib-wasm@1.0.0-beta.4` needs RGB proxy protocol 1.0
(rgb-proxy-server 0.4.0+). The Fund Wallet section uses the stand's helper to
fund a regtest wallet and mine its confirmations. For other networks, it shows
the wallet's receive address for external funding. Mine further blocks through
the RGB_L1 stand's helper when confirming sends or allocation transactions.
Enter `/vss` in the wallet creation form to use the local VSS proxy, or an
absolute URL for another server; blank keeps cloud backups disabled.

Development proxies are not part of a static deployment. For a deployed
regtest app, set absolute browser-accessible URLs at build time or configure
matching reverse proxies. See `.env.example` for the environment
variables.

## Scope and existing sessions

This app uses only the new on-chain SDK. Lightning, LSP/APay and the former
RLN backup screens, runtime dependencies and stand scripts have been removed.
Only Home, On-chain Wallet and Keys appear in navigation; old routes return
to Home. File and VSS backup/restore are on the on-chain wallet screen.

Existing on-chain profiles reopen normally. Saved records of other wallet
types are preserved unchanged in localStorage but never opened or converted
into on-chain wallets. Their IndexedDB state is left intact. Profiles that
fail to reopen are also retained when saving other wallets.

## Validation

```sh
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

The browser suite checks dev and production-preview builds against real WASM
and IndexedDB: initialization failure/retry, session reload, independent
profiles with the same mnemonic, encrypted backup/restore, profile removal,
preservation of older session records, and removal of legacy routes. It needs no chain,
proxy or VSS server and does not test funded transactions or VSS service calls.

Docker copies `vendor/` before `npm ci`; CI uses the same lockfile installation.

### Regtest UI integration

With the RGB_L1 stand running (bitcoind, Esplora on `:8094`, RGB proxy 0.4.0+
on `:3002`, regtest helper on `:8080`) and the miner connected to Esplora's
node, run:

```sh
npm run build
npm run test:regtest
```

This separate suite drives the actual application UI in both dev and production
preview. It funds two new wallets, sends BTC, creates allocation UTXOs, issues
NIA, settles witness and blinded RGB transfers on both sides, issues/inflates
IFA, and checks balances/history after a page reload. It mines and spends only
local regtest funds. It does not exercise VSS.

The stand must have at least 101 blocks and both Bitcoin nodes must be peers.
For the existing `rgblibweb-e2e` Docker stand, reconnect peers after a restart:

```sh
docker exec rgblibweb-e2e-bitcoind-1 bitcoin-cli -regtest -rpcuser=user -rpcpassword=default_password addnode esplora:18444 add
docker exec rgblibweb-e2e-esplora-1 cli addnode bitcoind:18444 add
```

A node already added needs no further change. `RGB_E2E_HELPER`,
`RGB_E2E_INDEXER` and `RGB_E2E_PROXY_HTTP` override the test stand endpoints;
without overrides the test exercises the app's default same-origin proxies.
