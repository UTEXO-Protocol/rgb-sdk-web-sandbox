import React, { useState } from 'react';
import { accountXpubsFromMnemonic, generateKeys, type Network } from '@utexo/rgb-sdk-core';
import { useStore } from '../store';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { openOnchainWallet, onchainDefaults, type OnchainWallet } from '../lib/onchain';
import { saveSessions, setUrlWallet } from '../lib/session';
import { downloadBytes, json, parseAmounts } from '../lib/utils';
import { Section } from '../components/Section';
import { Field, inputCls, selectCls, textareaCls } from '../components/Field';
import { Btn } from '../components/Btn';
import { OutputBox } from '../components/OutputBox';
import { WalletSections, type WalletSectionId } from '../components/WalletSections';

const networks: Network[] = ['testnet', 'testnet4', 'signet', 'regtest', 'utexo', 'mainnet'];

function Input({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (value: string) => void; type?: string;
}) {
  return <Field label={label}><input aria-label={label} type={type} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
}

export function UtexoWalletPage() {
  const active = useActiveWallet();
  const sdkStatus = useStore((s) => s.sdkStatus);
  const [network, setNetwork] = useState<Network>('testnet');
  const [mnemonic, setMnemonic] = useState('');
  const [label, setLabel] = useState('');
  const [indexerUrl, setIndexerUrl] = useState('');
  const [proxyEndpoint, setProxyEndpoint] = useState('');
  const [vssUrl, setVssUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState('');

  async function handleGenMnemonic() {
    setBusy(true);
    try {
      setMnemonic((await generateKeys(network)).mnemonic);
      setOutput('Mnemonic generated. Save it before creating the wallet.');
    } catch (error) {
      setOutput('Error: ' + error);
    } finally {
      setBusy(false);
    }
  }

  async function createWallet() {
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const config = {
        network,
        mnemonic: mnemonic.trim() || (await generateKeys(network)).mnemonic,
        dataDir: `rgb-sdk-web-sandbox/l1/${id}`,
        indexerUrl: indexerUrl.trim(),
        proxyEndpoint: proxyEndpoint.trim(),
        vssUrl: vssUrl.trim() || null,
      };
      const instance = await openOnchainWallet(config);
      useStore.getState().addWallet({ id, label: label.trim() || `RGB ${network}`, type: 'onchain', config, instance, online: false });
      const state = useStore.getState();
      saveSessions(state.wallets, id);
      setUrlWallet(id);
      setMnemonic(config.mnemonic);
      setOutput('Wallet opened. Save the mnemonic below. Connect when ready, or restore a backup first.');
      state.addLog('RGB on-chain wallet opened', 'ok');
    } catch (error) {
      setOutput('Error: ' + error);
    } finally {
      setBusy(false);
    }
  }

  return <div className="sm:flex items-start gap-6">
    <WalletSections />
    <div className="flex-1 min-w-0">
    <h1 className="text-[#58a6ff] text-2xl font-bold mb-1">UTEXOWallet</h1>
    <p className="text-[#8b949e] text-sm mb-6">Create, fund, issue assets and send or receive Bitcoin and RGB.
      <span className="inline-block ml-2 mt-1 text-xs px-2 py-0.5 rounded bg-[#161b22] border border-[#30363d]">On-chain · RGB_L1</span>
    </p>
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-sm font-bold uppercase tracking-widest">Onchain</h2>
      <div className="flex-1 h-px bg-[#30363d]" />
    </div>
    <Section id="sec-create" title="1. Create UTEXOWallet" hint="Each profile has its own wallet storage. Keep the mnemonic and a wallet backup to recover RGB assets. Demo sessions store the mnemonic in this browser.">
      <div className="grid md:grid-cols-2 gap-x-4">
        <Input label="Wallet label" value={label} onChange={setLabel} />
        <Field label="Network"><select aria-label="Network" value={network} className={selectCls} onChange={(e) => {
          const next = e.target.value as Network;
          setNetwork(next);
          const defaults = onchainDefaults(next);
          setIndexerUrl(defaults.indexerUrl);
          setProxyEndpoint(defaults.proxyEndpoint);
        }}>{networks.map((n) => <option key={n}>{n}</option>)}</select></Field>
      </div>
      <Field label="Mnemonic (blank generates a new wallet)"><textarea aria-label="Mnemonic" className={textareaCls} value={mnemonic} onChange={(e) => setMnemonic(e.target.value)} rows={2} /></Field>
      <div className="grid md:grid-cols-2 gap-x-4">
        <Input label="Esplora URL" value={indexerUrl} onChange={setIndexerUrl} />
        <Input label="RGB proxy endpoint" value={proxyEndpoint} onChange={setProxyEndpoint} />
      </div>
      <p className="text-sm text-[#8b949e] mb-4">Blank endpoints use network defaults. Signet and mainnet require an HTTP(S) Esplora URL. Regtest uses the local RGB_L1 stand.</p>
      <Input label="VSS URL (blank disables cloud backup)" value={vssUrl} onChange={setVssUrl} />
      <div className="flex gap-2 flex-wrap">
        <Btn variant="secondary" onClick={handleGenMnemonic} disabled={busy || sdkStatus !== 'ready'}>Generate Mnemonic</Btn>
        <Btn onClick={createWallet} disabled={busy || sdkStatus !== 'ready'}>{busy ? 'Opening…' : 'Create UTEXOWallet'}</Btn>
      </div>
      <OutputBox value={output} />
    </Section>
    <WalletOperations key={active?.id ?? 'no-wallet'} wallet={active?.instance ?? null} id={active?.id ?? null} label={active?.label} network={active?.config.network} mnemonic={active?.config.mnemonic} />
    </div>
  </div>;
}

type AssetForm = { ticker: string; name: string; precision: string; amounts: string };
const initialAsset: AssetForm = { ticker: 'DEMO', name: 'Demo Asset', precision: '0', amounts: '1000' };

function AssetFields({ value, onChange, prefix = '' }: {
  value: AssetForm; onChange: (value: AssetForm) => void; prefix?: string;
}) {
  return <div className="grid md:grid-cols-2 gap-x-4">
    <Input label={`${prefix}Ticker`} value={value.ticker} onChange={(ticker) => onChange({ ...value, ticker })} />
    <Input label={`${prefix}Asset name`} value={value.name} onChange={(name) => onChange({ ...value, name })} />
    <Input label={`${prefix}Precision`} value={value.precision} onChange={(precision) => onChange({ ...value, precision })} />
    <Input label={`${prefix}Issue amounts (comma separated)`} value={value.amounts} onChange={(amounts) => onChange({ ...value, amounts })} />
  </div>;
}

function WalletOperations({ wallet, id, label, network, mnemonic }: {
  wallet: OnchainWallet | null; id: string | null; label?: string; network?: Network; mnemonic?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [outputs, setOutputs] = useState<Partial<Record<WalletSectionId, string>>>({});
  const [lastResult, setLastResult] = useState<WalletSectionId | null>(null);
  const [address, setAddress] = useState('');
  const [btcAmount, setBtcAmount] = useState('1000');
  const [feeRate, setFeeRate] = useState('2');
  const [fundAmount, setFundAmount] = useState('1');
  const [utxoNum, setUtxoNum] = useState('5');
  const [utxoSize, setUtxoSize] = useState('');
  const [utxoFee, setUtxoFee] = useState('2');
  const [assetId, setAssetId] = useState('');
  const [nia, setNia] = useState(initialAsset);
  const [ifa, setIfa] = useState(initialAsset);
  const [inflation, setInflation] = useState('1000');
  const [inflateAssetId, setInflateAssetId] = useState('');
  const [inflateFee, setInflateFee] = useState('2');
  const [receiveAssetId, setReceiveAssetId] = useState('');
  const [receiveAmount, setReceiveAmount] = useState('');
  const [receiveDuration, setReceiveDuration] = useState('');
  const [witness, setWitness] = useState(true);
  const [sendAssetId, setSendAssetId] = useState('');
  const [sendAmount, setSendAmount] = useState('');
  const [sendFee, setSendFee] = useState('2');
  const [donation, setDonation] = useState(false);
  const [invoice, setInvoice] = useState('');
  const [decodeInvoice, setDecodeInvoice] = useState('');
  const [witnessSats, setWitnessSats] = useState('1000');
  const [transferAssetId, setTransferAssetId] = useState('');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [batchIdx, setBatchIdx] = useState('');
  const [validateAssetId, setValidateAssetId] = useState('');
  const [validateAmount, setValidateAmount] = useState('');
  const [showMnemonic, setShowMnemonic] = useState(false);

  async function run(section: WalletSectionId, method: string, action: (wallet: OnchainWallet) => unknown | Promise<unknown>, online = false) {
    if (!wallet || !id || busy) return;
    setBusy(true);
    setLastResult(section);
    setOutputs((previous) => ({ ...previous, [section]: method + '\nRunning…' }));
    try {
      const result = await action(wallet);
      setOutputs((previous) => ({ ...previous, [section]: method + '\n' + (result === undefined ? 'Done' : json(result)) }));
      if (online) useStore.getState().updateWallet(id, { online: true });
      useStore.getState().addLog(method + ' completed', 'ok');
    } catch (error) {
      setOutputs((previous) => ({ ...previous, [section]: method + '\nError: ' + error }));
      useStore.getState().addLog(method + ': ' + error, 'err');
    } finally {
      setBusy(false);
    }
  }

  function result(section: WalletSectionId) {
    return <div role={lastResult === section ? 'status' : undefined} aria-live={lastResult === section ? 'polite' : 'off'}>
      <OutputBox label="Operation result" value={outputs[section] ?? ''} />
    </div>;
  }

  const issueParams = (form: AssetForm) => ({ ...form, precision: Number(form.precision), amounts: parseAmounts(form.amounts) });

  return <>
    {wallet ? <div className="bg-[#0d2818] border border-[#238636] rounded-lg p-4 mb-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="font-semibold text-[#3fb950]">Active: {label}</h2>
        <span className="text-xs text-[#8b949e]">{network} · RGB_L1</span>
        <Btn variant="secondary" onClick={() => setShowMnemonic((show) => !show)}>{showMnemonic ? 'Hide mnemonic' : 'Show mnemonic'}</Btn>
      </div>
      {showMnemonic && <OutputBox label="Active wallet mnemonic" value={mnemonic ?? ''} />}
    </div> : <p className="text-sm text-[#d29922] mb-6">Create or select a wallet to enable the operations below.</p>}
    <fieldset disabled={busy || !wallet} className="min-w-0">
      <Section id="sec-online" title="2. Connect" hint="Connect to the indexer before online operations. Restore a backup first if needed; connecting closes the restore window until you reopen the wallet.">
        <Btn onClick={() => run('online', 'unlock', (w) => w.unlock(), true)}>Connect</Btn>
        {result('online')}
      </Section>
      <Section id="sec-info" title="3. Wallet Info" hint="Read the receive address, Bitcoin balances and UTXOs. Cached balance reads local state without connecting.">
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => run('info', 'getAddress', (w) => w.getAddress())}>Get address</Btn>
          <Btn onClick={() => run('info', 'getBtcBalance', (w) => w.getBtcBalance(), true)}>BTC balance</Btn>
          <Btn variant="secondary" onClick={() => run('info', 'getBtcBalance (offline)', (w) => w.getBtcBalance({ skipSync: true }))}>Cached balance</Btn>
          <Btn variant="secondary" onClick={() => run('info', 'listUnspents', (w) => w.listUnspents(), true)}>Unspents</Btn>
          <Btn variant="secondary" onClick={() => run('info', 'getNetworkInfo', (w) => w.getNetworkInfo())}>Network info</Btn>
          <Btn variant="secondary" onClick={() => run('info', 'estimateFeeRate', (w) => w.estimateFeeRate(6), true)}>Estimate fee (6 blocks)</Btn>
        </div>
        {result('info')}
      </Section>
      <Section id="sec-fund" title="4. Fund Wallet" hint="Send Bitcoin to this wallet's receive address before issuing assets or making transfers. On regtest, the local faucet funds the wallet and mines confirmations.">
        <div className="flex flex-wrap gap-2 mb-4">
          <Btn variant="secondary" onClick={() => run('fund', 'getAddress', (w) => w.getAddress())}>Get funding address</Btn>
        </div>
        <Input label="Regtest funding amount (BTC)" value={fundAmount} onChange={setFundAmount} />
        <Btn disabled={network !== 'regtest'} onClick={() => run('fund', 'fundWallet', async (w) => {
          if (network !== 'regtest') throw new Error('The local faucet is only available on regtest');
          const amount = fundAmount.trim();
          if (!/^\d+(\.\d{1,8})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount) <= 0) {
            throw new Error('Enter a positive BTC amount with at most 8 decimal places');
          }
          const address = await w.getAddress();
          const response = await fetch('/rgb-l1-regtest/fund', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ address, amount }), signal: AbortSignal.timeout(30_000),
          });
          if (!response.ok) throw new Error(`Regtest faucet: HTTP ${response.status}`);
          return response.json();
        })}>Fund regtest wallet</Btn>
        {network !== 'regtest' && <p className="text-xs text-[#8b949e] mt-3">Use an external faucet or send BTC to the funding address on {network ?? 'your chosen network'}.</p>}
        {result('fund')}
      </Section>
      <Section id="sec-send-btc" title="5. Send BTC" hint="The wallet signs and broadcasts in one call. Amount is in sats; fee rate is in sat/vB.">
        <Input label="BTC recipient address" value={address} onChange={setAddress} />
        <div className="grid md:grid-cols-2 gap-x-4">
          <Input label="BTC amount (sats)" value={btcAmount} onChange={setBtcAmount} />
          <Input label="Fee rate (sat/vB)" value={feeRate} onChange={setFeeRate} />
        </div>
        <Btn onClick={() => run('send-btc', 'sendBtc', (w) => w.sendBtc({ address, amount: Number(btcAmount), feeRate: Number(feeRate) }), true)}>Send BTC</Btn>
        {result('send-btc')}
      </Section>
      <Section id="sec-utxos" title="6. Create UTXOs" hint="Create colorable UTXOs for RGB allocations. Wait for confirmation before issuing assets or creating blinded invoices.">
        <div className="grid md:grid-cols-2 gap-x-4">
          <Input label="Number of allocation UTXOs" value={utxoNum} onChange={setUtxoNum} />
          <Input label="UTXO size (sats; optional)" value={utxoSize} onChange={setUtxoSize} />
          <Input label="UTXO fee rate (sat/vB)" value={utxoFee} onChange={setUtxoFee} />
        </div>
        <Btn onClick={() => run('utxos', 'createUtxos', (w) => w.createUtxos({
          num: Number(utxoNum), size: utxoSize.trim() ? Number(utxoSize) : undefined, feeRate: Number(utxoFee),
        }), true)}>Create UTXOs</Btn>
        {result('utxos')}
      </Section>
      <Section id="sec-sync" title="7. Sync" hint="Sync updates Bitcoin and UTXO state. Refresh advances pending RGB transfers; run it on both wallets until a transfer is Settled.">
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => run('sync', 'syncWallet', (w) => w.syncWallet(), true)}>Sync</Btn>
          <Btn variant="secondary" onClick={() => run('sync', 'refresh', (w) => w.refresh(), true)}>Refresh transfers</Btn>
        </div>
        {result('sync')}
      </Section>
      <Section id="sec-nia" title="8. Issue NIA Asset" hint="Issue a non-inflatable asset with a fixed supply. Amounts are in the asset's smallest units.">
        <AssetFields value={nia} onChange={setNia} />
        <Btn onClick={() => run('nia', 'issueAssetNia', (w) => w.issueAssetNia(issueParams(nia)))}>Issue NIA</Btn>
        {result('nia')}
      </Section>
      <Section id="sec-ifa" title="9. Issue / Inflate IFA Asset" hint="Issue an inflatable asset or increase its supply using an existing inflation allocation.">
        <AssetFields value={ifa} onChange={setIfa} prefix="IFA " />
        <Input label="Inflation amounts (comma separated)" value={inflation} onChange={setInflation} />
        <Btn onClick={() => run('ifa', 'issueAssetIfa', (w) => w.issueAssetIfa({ ...issueParams(ifa), inflationAmounts: parseAmounts(inflation), rejectListUrl: null }))}>Issue IFA</Btn>
        <div className="grid md:grid-cols-2 gap-x-4 mt-5 pt-5 border-t border-[#30363d]">
          <Input label="Asset ID to inflate" value={inflateAssetId} onChange={setInflateAssetId} />
          <Input label="Inflation fee rate (sat/vB)" value={inflateFee} onChange={setInflateFee} />
        </div>
        <Btn variant="secondary" disabled={!inflateAssetId.trim()} onClick={() => run('ifa', 'inflate', (w) => w.inflate({ assetId: inflateAssetId.trim(), inflationAmounts: parseAmounts(inflation), feeRate: Number(inflateFee) }), true)}>Inflate IFA</Btn>
        {result('ifa')}
      </Section>
      <Section id="sec-assets" title="10. List Assets" hint="List this wallet's assets or inspect the settled, future and spendable balance of one asset.">
        <Input label="Asset ID for balance" value={assetId} onChange={setAssetId} />
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={() => run('assets', 'listAssets', (w) => w.listAssets())}>List assets</Btn>
          <Btn variant="secondary" disabled={!assetId.trim()} onClick={() => run('assets', 'getAssetBalance', (w) => w.getAssetBalance(assetId.trim()))}>Asset balance</Btn>
        </div>
        {result('assets')}
      </Section>
      <Section id="sec-receive" title="11. Receive RGB Assets" hint="A witness invoice needs no existing UTXO. A blinded invoice needs a free allocation UTXO. Share the complete invoice with the sender.">
        <div className="grid md:grid-cols-2 gap-x-4">
          <Input label="Receive asset ID (optional)" value={receiveAssetId} onChange={setReceiveAssetId} />
          <Input label="Receive amount (smallest units)" value={receiveAmount} onChange={setReceiveAmount} />
          <Input label="Invoice duration (seconds; optional)" value={receiveDuration} onChange={setReceiveDuration} />
        </div>
        <p className="text-sm text-[#8b949e] mb-4">For a specific asset, enter its amount. Leave both fields blank for an open invoice.</p>
        <label className="block text-sm mb-4"><input type="checkbox" checked={witness} onChange={(e) => setWitness(e.target.checked)} /> Witness invoice</label>
        <Btn disabled={Boolean(receiveAssetId.trim()) && !receiveAmount.trim()} onClick={() => run('receive', 'onchainReceive', (w) => w.onchainReceive({
          assetId: receiveAssetId.trim() || undefined,
          amount: receiveAmount.trim() ? Number(receiveAmount) : undefined,
          durationSeconds: receiveDuration.trim() ? Number(receiveDuration) : undefined,
          witness, minConfirmations: 1,
        }), true)}>Create RGB invoice</Btn>
        {result('receive')}
      </Section>
      <Section id="sec-send-rgb" title="12. Send RGB Assets" hint="Paste the recipient's RGB invoice. For an open invoice, enter the asset ID and amount. If the invoice already contains them, the fields may stay blank. A witness invoice also needs an output amount in sats.">
        <Field label="RGB invoice"><textarea aria-label="RGB invoice" className={textareaCls} value={invoice} onChange={(e) => setInvoice(e.target.value)} /></Field>
        <div className="grid md:grid-cols-2 gap-x-4">
          <Input label="Send asset ID (optional)" value={sendAssetId} onChange={setSendAssetId} />
          <Input label="RGB amount (smallest units)" value={sendAmount} onChange={setSendAmount} />
          <Input label="RGB fee rate (sat/vB)" value={sendFee} onChange={setSendFee} />
          <Input label="Witness output (sats; blank for blinded invoice)" value={witnessSats} onChange={setWitnessSats} />
        </div>
        <label className="block text-sm mb-4"><input type="checkbox" checked={donation} onChange={(e) => setDonation(e.target.checked)} /> Donation mode (skip recipient acknowledgement)</label>
        <Btn onClick={() => run('send-rgb', 'onchainSend', (w) => w.onchainSend({
          invoice: invoice.trim(), assetId: sendAssetId.trim() || undefined,
          donation,
          amount: sendAmount.trim() ? Number(sendAmount) : undefined, feeRate: Number(sendFee), minConfirmations: 1,
          witnessData: witnessSats.trim() ? { amountSat: Number(witnessSats) } : undefined,
        }), true)}>Send RGB</Btn>
        {result('send-rgb')}
      </Section>
      <Section id="sec-transfers" title="13. Transactions & Transfers" hint="Inspect Bitcoin transactions and RGB transfer history. An empty asset filter lists all transfers.">
        <Input label="Asset ID (blank lists all transfers)" value={transferAssetId} onChange={setTransferAssetId} />
        <div className="flex gap-2 flex-wrap mb-5">
          <Btn onClick={() => run('transfers', 'listTransactions', (w) => w.listTransactions(), true)}>Transactions</Btn>
          <Btn variant="secondary" onClick={() => run('transfers', 'listTransfers', (w) => w.listTransfers(transferAssetId.trim() || undefined))}>List transfers</Btn>
        </div>
        <Input label="Batch transfer index to fail" value={batchIdx} onChange={setBatchIdx} />
        <Btn variant="danger" disabled={!batchIdx.trim()} onClick={() => run('transfers', 'failTransfers', (w) => w.failTransfers({ batchTransferIdx: Number(batchIdx), noAssetOnly: false }), true)}>Fail transfer</Btn>
        {result('transfers')}
      </Section>
      <Section id="sec-keys" title="14. Wallet Keys" hint="Inspect the active wallet's public identity, network and vanilla/colored account xpubs. Use the Keys page in the top menu to validate a mnemonic.">
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={() => run('keys', 'getWalletIdentity', (w) => w.getWalletIdentity())}>Wallet identity</Btn>
          <Btn variant="secondary" onClick={() => run('keys', 'accountXpubsFromMnemonic', async (w) => {
            if (!mnemonic) throw new Error('The active wallet has no saved mnemonic');
            const network = w.getNetwork();
            return { network, ...await accountXpubsFromMnemonic(network, mnemonic) };
          })}>Account xpubs</Btn>
        </div>
        {result('keys')}
      </Section>
      <Section id="sec-validate" title="15. Validate Balance" hint="Check whether the wallet has enough spendable units of an asset before sending.">
        <div className="grid md:grid-cols-2 gap-x-4">
          <Input label="Asset ID to validate" value={validateAssetId} onChange={setValidateAssetId} />
          <Input label="Required asset amount" value={validateAmount} onChange={setValidateAmount} />
        </div>
        <Btn disabled={!validateAssetId.trim() || !validateAmount.trim()} onClick={() => run('validate', 'validateBalance', async (w) => {
          const amount = Number(validateAmount);
          if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('Enter a positive whole amount in the asset’s smallest units');
          const balance = await w.getAssetBalance(validateAssetId.trim());
          if (balance.spendable < amount) throw new Error(`Insufficient spendable balance: ${balance.spendable} < ${amount}`);
          return { valid: true, spendable: balance.spendable, required: amount };
        })}>Check spendable balance</Btn>
        {result('validate')}
      </Section>
      <Section id="sec-crypto" title="16. Decode RGB Invoice" hint="Inspect an invoice's network, recipient and asset details before sending.">
        <Field label="Invoice to decode"><textarea aria-label="Invoice to decode" className={textareaCls} value={decodeInvoice} onChange={(e) => setDecodeInvoice(e.target.value)} /></Field>
        <Btn onClick={() => run('crypto', 'decodeRGBInvoice', (w) => w.decodeRGBInvoice({ invoice: decodeInvoice.trim() }))}>Decode invoice</Btn>
        {result('crypto')}
      </Section>
      <Section id="sec-backup" title="17. Backup / Restore" hint="Restore after opening, before Connect or online operations. For a fresh profile, create another wallet with the same mnemonic. Existing state requires explicit overwrite.">
        <Input label="Backup password" type="password" value={password} onChange={setPassword} />
        <Field label="Backup file"><input aria-label="Backup file" type="file" className="w-full min-w-0 text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <label className="block text-sm mb-4"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Overwrite existing wallet state when restoring</label>
        <div className="flex gap-2 flex-wrap">
          <Btn disabled={!password} onClick={() => run('backup', 'exportBackup', async (w) => {
            const bytes = await w.exportBackup({ password });
            downloadBytes(bytes, `rgb-l1-${id}.backup`);
            return { bytes: bytes.length, downloaded: true };
          })}>Download backup</Btn>
          <Btn variant="secondary" disabled={!password || !file} onClick={() => run('backup', 'restoreBackup', async (w) => {
            if (!file) throw new Error('Choose a backup file');
            await w.restoreBackup({ bytes: new Uint8Array(await file.arrayBuffer()), password, overwrite });
          })}>Restore file</Btn>
        </div>
        <div className="flex gap-2 flex-wrap mt-5 pt-5 border-t border-[#30363d]">
          <Btn onClick={() => run('backup', 'backupToVss', (w) => w.backupToVss())}>Back up to VSS</Btn>
          <Btn variant="secondary" onClick={() => run('backup', 'getVssBackupInfo', (w) => w.getVssBackupInfo())}>VSS backup info</Btn>
          <Btn variant="secondary" onClick={() => run('backup', 'restoreFromVss', (w) => w.restoreFromVss({ overwrite }))}>Restore from VSS</Btn>
        </div>
        {result('backup')}
      </Section>
    </fieldset>
  </>;
}
