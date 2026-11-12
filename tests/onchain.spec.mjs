import { test, expect } from '@playwright/test';

// Real WASM + IndexedDB, without a chain, proxy, VSS server or external network.
test('on-chain profiles reopen, keep wallet state, and restore encrypted backups', async ({ page, baseURL }, testInfo) => {
  const errors = [];
  const wasm = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    if (response.url().includes('.wasm')) wasm.push({ url: response.url(), status: response.status() });
  });
  await page.route('**/*', (route) => new URL(route.request().url()).origin === baseURL ? route.continue() : route.abort());
  await page.goto('/onchain');
  await page.getByLabel('Wallet label', { exact: true }).fill('Alice');
  await page.getByRole('button', { name: 'Open on-chain wallet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Active: Alice', exact: true })).toBeVisible();
  // An older session that cannot currently reopen must survive saves/removals.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('rgb_wallet_sessions'));
    saved.push({ id: 'legacy-unavailable', label: 'Legacy saved', type: 'utexo', config: { network: 'regtest', mnemonic: '', indexerUrl: '', transportEndpoint: '', masterFingerprint: '', xpubVan: '', xpubCol: '' } });
    localStorage.setItem('rgb_wallet_sessions', JSON.stringify(saved));
  });
  const mnemonic = await page.getByLabel('Mnemonic', { exact: true }).inputValue();
  expect(mnemonic.split(' ').length).toBeGreaterThanOrEqual(12);
  await page.getByRole('button', { name: 'Wallet identity', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('RGB_L1');
  const identity = await page.getByRole('status').locator('pre').textContent();
  await page.getByRole('button', { name: 'Get address', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('tb1');
  await page.getByRole('button', { name: 'Cached balance', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('vanilla');
  await page.getByRole('button', { name: 'List assets', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('nia');

  await page.getByLabel('Backup password', { exact: true }).fill('browser-test-backup');
  const downloading = page.waitForEvent('download');
  // Observe errors immediately instead of waiting for a missing download.
  const [download] = await Promise.all([
    downloading,
    (async () => {
      await page.getByRole('button', { name: 'Download backup', exact: true }).click();
      await expect(page.getByRole('status')).toContainText('downloaded');
    })(),
  ]);
  const backup = testInfo.outputPath('wallet.backup');
  await download.saveAs(backup);
  await expect(page.getByRole('status')).toContainText('downloaded');
  await page.getByRole('button', { name: /^SDK Calls/ }).click();
  await page.getByRole('button', { name: /^exportBackup / }).click();
  await expect(page.locator('pre').filter({ hasText: '[redacted]' })).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'browser-test-backup' })).toHaveCount(0);
  await page.getByRole('button', { name: /^SDK Calls/ }).click();
  // A restore must recover the address cursor, not just the mnemonic's identity.
  await page.getByRole('button', { name: 'Get address', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('tb1');
  const addressAfterBackup = await page.getByRole('status').locator('pre').textContent();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Active: Alice', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Wallet identity', exact: true }).click();
  await expect(page.getByRole('status').locator('pre')).toHaveText(identity);

  // Same mnemonic, a different dataDir: no storage collision with Alice.
  await page.getByLabel('Wallet label', { exact: true }).fill('Restored');
  await page.getByLabel('Mnemonic', { exact: true }).fill(mnemonic);
  await page.getByRole('button', { name: 'Open on-chain wallet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Active: Restored', exact: true })).toBeVisible();
  await page.getByLabel('Backup file', { exact: true }).setInputFiles(backup);
  await page.getByLabel('Backup password', { exact: true }).fill('browser-test-backup');
  await page.getByRole('button', { name: 'Restore file', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('restoreBackup\nDone');
  await page.getByRole('button', { name: 'Wallet identity', exact: true }).click();
  await expect(page.getByRole('status').locator('pre')).toHaveText(identity);
  await page.getByRole('button', { name: 'Get address', exact: true }).click();
  await expect(page.getByRole('status').locator('pre')).toHaveText(addressAfterBackup);
  await page.getByLabel('Active wallet', { exact: true }).selectOption({ label: 'Alice' });
  await expect(page.getByRole('heading', { name: 'Active: Alice', exact: true })).toBeVisible();
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByTitle('Remove active wallet', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Active: Restored', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Active: Restored', exact: true })).toBeVisible();
  const sessions = await page.evaluate(() => JSON.parse(localStorage.getItem('rgb_wallet_sessions')));
  expect(sessions).toHaveLength(2);
  expect(sessions.find((entry) => entry.id === 'legacy-unavailable')).toEqual({
    id: 'legacy-unavailable', label: 'Legacy saved', type: 'utexo',
    config: { network: 'regtest', mnemonic: '', indexerUrl: '', transportEndpoint: '', masterFingerprint: '', xpubVan: '', xpubCol: '' },
  });
  await expect(page.getByLabel('Active wallet').locator('option')).toHaveText(['Restored']);
  expect(sessions.find((entry) => entry.label === 'Restored').type).toBe('onchain');

  expect(wasm.some((r) => r.url.includes('rgb_lib_wasm') && r.status === 200)).toBe(true);
  expect(wasm.some((r) => r.url.includes('rln_wasm'))).toBe(false);
  expect(errors).toEqual([]);
});

test('failed initialization is recoverable and removed routes return home', async ({ page }) => {
  await page.goto('/onchain');
  await page.getByLabel('Mnemonic', { exact: true }).fill('invalid mnemonic');
  await page.getByRole('button', { name: 'Open on-chain wallet', exact: true }).click();
  await expect(page.getByText(/Error:.*mnemonic/i).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open on-chain wallet', exact: true })).toBeEnabled();
  await page.getByLabel('Mnemonic', { exact: true }).fill('');
  await page.getByLabel('Wallet label', { exact: true }).fill('Recovered');
  await page.getByRole('button', { name: 'Open on-chain wallet', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Active: Recovered', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(['Home', 'On-chain Wallet', 'Keys']);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await expect(page.getByRole('main').getByRole('link')).toHaveText([
    /On-chain Wallet/, /Keys/,
  ]);
  for (const route of ['/utexo-wallet', '/lsp-apay', '/backup']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('RGB SDK Web Demo');
    await expect(page).toHaveURL((url) => url.pathname === '/');
  }
});
