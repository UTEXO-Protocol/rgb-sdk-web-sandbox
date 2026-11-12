import { test, expect } from '@playwright/test';

const helper = process.env.RGB_E2E_HELPER || 'http://127.0.0.1:8080';
const indexer = process.env.RGB_E2E_INDEXER || 'http://127.0.0.1:8094/regtest/api';
const proxy = process.env.RGB_E2E_PROXY_HTTP || 'http://127.0.0.1:3002/json-rpc';
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchJson(url, body) {
  const response = await fetch(url, {
    ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function indexed(height) {
  await expect.poll(async () => Number(await (await fetch(`${indexer}/blocks/tip/height`)).text()), {
    timeout: 30_000, message: `Esplora must index block ${height}; check its connection to bitcoind`,
  }).toBeGreaterThanOrEqual(height);
}

async function mine() {
  // A wallet broadcasts through Esplora's node; allow propagation to the miner.
  for (let round = 0; round < 5; round++) {
    await pause(1500);
    const { height } = await fetchJson(`${helper}/mine`, { blocks: 1 });
    await indexed(height);
    if ((await fetchJson(`${indexer}/mempool`)).count === 0) return;
  }
  throw new Error('Transactions remain in the Esplora mempool after mining');
}

async function action(page, label, method) {
  const button = page.getByRole('button', { name: label, exact: true });
  const calls = page.getByRole('button', { name: /^SDK Calls/ });
  const before = await calls.textContent();
  await button.click();
  await expect(calls).not.toHaveText(before, { timeout: 45_000 });
  await expect(button).toBeEnabled({ timeout: 45_000 });
  const result = page.getByRole('status').locator('pre');
  await expect(result).toContainText(`${method}\n`);
  const text = await result.textContent();
  expect(text, `${label} must succeed`).not.toContain('\nError:');
  const value = text.slice(method.length + 1);
  return value === 'Done' ? undefined : JSON.parse(value);
}

async function open(page, label) {
  await page.goto('/onchain');
  await page.getByLabel('Network', { exact: true }).selectOption('regtest');
  await page.getByLabel('Wallet label', { exact: true }).fill(label);
  // The default UI URLs exercise the app's development/preview proxies.
  if (process.env.RGB_E2E_INDEXER) await page.getByLabel('Esplora URL', { exact: true }).fill(indexer);
  if (process.env.RGB_E2E_PROXY_HTTP) await page.getByLabel('RGB proxy endpoint', { exact: true }).fill(proxy);
  await page.getByRole('button', { name: 'Open on-chain wallet', exact: true }).click();
  await expect(page.getByRole('heading', { name: `Active: ${label}`, exact: true })).toBeVisible();
  return action(page, 'Get address', 'getAddress');
}

async function settle(sender, receiver, assetId, sent, received) {
  for (let round = 0; round < 8; round++) {
    await mine();
    await action(receiver, 'Refresh transfers', 'refresh');
    await action(sender, 'Refresh transfers', 'refresh');
    await receiver.getByLabel('Asset ID (blank lists all transfers)', { exact: true }).fill(assetId);
    const outgoing = await action(sender, 'List transfers', 'listTransfers');
    const incoming = await action(receiver, 'List transfers', 'listTransfers');
    if (outgoing.some((t) => t.txid === sent.txid && t.status === 'Settled') &&
        incoming.some((t) => t.recipientId === received.recipientId && t.status === 'Settled')) return;
  }
  throw new Error('RGB transfer did not settle on both wallets');
}

test('regtest: funded BTC, UTXOs, NIA witness/blinded transfers and IFA inflation through the UI', async ({ page: sender, browser, baseURL }) => {
  test.setTimeout(240_000);
  await fetchJson(`${helper}/status`);
  expect((await fetchJson(proxy, { jsonrpc: '2.0', id: '1', method: 'server.info', params: null })).result.protocol_version).toBe('1.0');
  const receiverContext = await browser.newContext({ baseURL });
  const receiver = await receiverContext.newPage();
  try {
    const senderAddress = await open(sender, 'Alice regtest');
    const receiverAddress = await open(receiver, 'Bob regtest');
    for (const address of [senderAddress, receiverAddress]) {
      expect(address).toMatch(/^bcrt1p/);
      const { height } = await fetchJson(`${helper}/fund`, { address, amount: '1.0' });
      await indexed(height);
    }
    expect((await action(sender, 'BTC balance', 'getBtcBalance')).vanilla.settled).toBe(100_000_000);
    expect((await action(receiver, 'BTC balance', 'getBtcBalance')).vanilla.settled).toBe(100_000_000);

    await sender.getByLabel('BTC recipient address', { exact: true }).fill(receiverAddress);
    await sender.getByLabel('BTC amount (sats)', { exact: true }).fill('10000');
    const btcTxid = await action(sender, 'Send BTC', 'sendBtc');
    expect(btcTxid).toMatch(/^[0-9a-f]{64}$/);
    for (let round = 0; round < 5; round++) {
      await mine();
      if ((await fetchJson(`${indexer}/tx/${btcTxid}/status`)).confirmed) break;
    }
    expect((await fetchJson(`${indexer}/tx/${btcTxid}/status`)).confirmed).toBe(true);
    expect((await action(receiver, 'BTC balance', 'getBtcBalance')).vanilla.settled).toBe(100_010_000);
    console.log('BTC transfer confirmed:', btcTxid);

    for (const page of [sender, receiver]) {
      await page.getByLabel('Number of allocation UTXOs', { exact: true }).fill('8');
      expect(await action(page, 'Create UTXOs', 'createUtxos')).toBe(8);
    }
    await mine();
    for (const page of [sender, receiver]) {
      const unspents = await action(page, 'Unspents', 'listUnspents');
      expect(unspents.filter((u) => u.utxo.colorable)).toHaveLength(8);
    }
    const nia = await action(sender, 'Issue NIA', 'issueAssetNia');
    expect(nia.balance.settled).toBe(1000);
    await sender.getByLabel('Asset ID (blank lists all transfers)', { exact: true }).fill(nia.assetId);
    let transferred = 0;
    for (const witness of [true, false]) {
      await receiver.getByRole('checkbox', { name: 'Witness invoice', exact: true }).setChecked(witness);
      if (!witness) {
        // A named asset requires an explicit receive amount; no unusable invoice.
        await expect(receiver.getByRole('button', { name: 'Create RGB invoice', exact: true })).toBeDisabled();
        await receiver.getByLabel('RGB amount (smallest units)', { exact: true }).fill('100');
      }
      const invoice = await action(receiver, 'Create RGB invoice', 'onchainReceive');
      expect(invoice.recipientId).toContain(witness ? 'wvout:' : 'utxob:');
      await sender.getByLabel('RGB invoice', { exact: true }).fill(invoice.invoice);
      expect((await action(sender, 'Decode invoice', 'decodeRGBInvoice')).network).toBe('regtest');
      await sender.getByLabel('RGB amount (smallest units)', { exact: true }).fill('100');
      await sender.getByLabel('Witness output (sats; blank for blinded invoice)', { exact: true }).fill(witness ? '1000' : '');
      const sent = await action(sender, 'Send RGB', 'onchainSend');
      await settle(sender, receiver, nia.assetId, sent, invoice);
      transferred += 100;
      expect((await action(receiver, 'Asset balance', 'getAssetBalance')).settled).toBe(transferred);
      expect((await action(sender, 'Asset balance', 'getAssetBalance')).settled).toBe(1000 - transferred);
      console.log(`${witness ? 'Witness' : 'Blinded'} RGB transfer settled:`, sent.txid);
    }

    const ifa = await action(sender, 'Issue IFA', 'issueAssetIfa');
    expect(ifa.initialSupply).toBe(1000);
    await sender.getByLabel('Asset ID (blank lists all transfers)', { exact: true }).fill(ifa.assetId);
    await sender.getByLabel('Inflation amounts (comma separated)', { exact: true }).fill('200');
    const inflated = await action(sender, 'Inflate IFA', 'inflate');
    for (let round = 0; round < 8; round++) {
      await mine();
      await action(sender, 'Refresh transfers', 'refresh');
      if ((await action(sender, 'Asset balance', 'getAssetBalance')).settled === 1200) break;
    }
    const assets = await action(sender, 'List assets', 'listAssets');
    expect(assets.ifa.find((asset) => asset.assetId === ifa.assetId).balance.settled).toBe(1200);
    console.log('IFA inflation confirmed:', inflated.txid);

    await receiver.reload();
    await expect(receiver.getByRole('heading', { name: 'Active: Bob regtest', exact: true })).toBeVisible();
    await receiver.getByLabel('Asset ID (blank lists all transfers)', { exact: true }).fill(nia.assetId);
    expect((await action(receiver, 'Asset balance', 'getAssetBalance')).settled).toBe(200);
    const history = await action(receiver, 'List transfers', 'listTransfers');
    expect(history.filter((t) => t.status === 'Settled')).toHaveLength(2);
  } finally {
    await receiverContext.close();
  }
});
