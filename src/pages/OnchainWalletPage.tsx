import React, { useState } from 'react';
import { generateKeys, type Network } from '@utexo/rgb-sdk-core';
import { useStore } from '../store';
import { useActiveWallet } from '../hooks/useActiveWallet';
import { openOnchainWallet, onchainDefaults, type OnchainWallet } from '../lib/onchain';
import { saveSessions, setUrlWallet } from '../lib/session';
import { downloadBytes, json, parseAmounts } from '../lib/utils';
import { Section } from '../components/Section';
import { Field, inputCls, selectCls, textareaCls } from '../components/Field';
import { Btn } from '../components/Btn';
import { OutputBox } from '../components/OutputBox';

const networks: Network[] = ['testnet', 'testnet4', 'signet', 'regtest', 'utexo', 'mainnet'];

function Input({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (value: string) => void; type?: string;
}) {
  return <Field label={label}><input aria-label={label} type={type} className={inputCls} value={value} onChange={(e) => onChange(e.target.value)} /></Field>;
}

export function OnchainWalletPage() {
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

  return <div>
    <h1 className="text-[#58a6ff] text-2xl font-bold mb-1">RGB On-chain Wallet</h1>
    <p className="text-[#8b949e] text-sm mb-6">UTEXOWallet + RgbLibWeb · Bitcoin and RGB assets · RGB_L1</p>
    <Section title="Create / restore wallet" hint="Each profile has its own wallet storage. Keep the mnemonic and a wallet backup to recover RGB assets. Demo sessions store the mnemonic in this browser.">
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
      <Btn onClick={createWallet} disabled={busy || sdkStatus !== 'ready'}>{busy ? 'Opening…' : 'Open on-chain wallet'}</Btn>
      <OutputBox value={output} />
    </Section>
    {active?.type === 'onchain'
      ? <WalletOperations key={active.id} wallet={active.instance} id={active.id} label={active.label} />
      : <p className="text-[#8b949e]">Create or select an on-chain wallet to use these operations.</p>}
  </div>;
}

function WalletOperations({ wallet, id, label }: { wallet: OnchainWallet; id: string; label: string }) {
  const [busy, setBusy] = useState(false);
  const [output, setOutput] = useState('');
  const [address, setAddress] = useState('');
  const [btcAmount, setBtcAmount] = useState('1000');
  const [feeRate, setFeeRate] = useState('2');
  const [utxoNum, setUtxoNum] = useState('5');
  const [assetId, setAssetId] = useState('');
  const [ticker, setTicker] = useState('DEMO');
  const [name, setName] = useState('Demo Asset');
  const [precision, setPrecision] = useState('0');
  const [amounts, setAmounts] = useState('1000');
  const [inflation, setInflation] = useState('1000');
  const [amount, setAmount] = useState('');
  const [witness, setWitness] = useState(true);
  const [invoice, setInvoice] = useState('');
  const [witnessSats, setWitnessSats] = useState('1000');
  const [password, setPassword] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [batchIdx, setBatchIdx] = useState('');

  async function run(method: string, action: () => unknown | Promise<unknown>, online = false) {
    setBusy(true);
    try {
      const result = await action();
      setOutput(method + '\n' + (result === undefined ? 'Done' : json(result)));
      if (online) useStore.getState().updateWallet(id, { online: true });
      useStore.getState().addLog(method + ' completed', 'ok');
    } catch (error) {
      setOutput(method + '\nError: ' + error);
      useStore.getState().addLog(method + ': ' + error, 'err');
    } finally {
      setBusy(false);
    }
  }

  const issue = { ticker, name, precision: Number(precision), amounts: parseAmounts(amounts) };
  return <>
    <Section title={`Active: ${label}`} hint="Opening and offline reads leave the backup restore window open. Connect, sync or an online operation closes it until the wallet is reopened.">
      <div className="flex flex-wrap gap-2">
        <Btn disabled={busy} onClick={() => run('unlock', () => wallet.unlock(), true)}>Connect</Btn>
        <Btn disabled={busy} onClick={() => run('getAddress', () => wallet.getAddress())}>Get address</Btn>
        <Btn disabled={busy} onClick={() => run('getWalletIdentity', () => wallet.getWalletIdentity())}>Wallet identity</Btn>
        <Btn disabled={busy} onClick={() => run('getNetworkInfo', () => wallet.getNetworkInfo())}>Network info</Btn>
        <Btn disabled={busy} onClick={() => run('getBtcBalance', () => wallet.getBtcBalance(), true)}>BTC balance</Btn>
        <Btn disabled={busy} onClick={() => run('getBtcBalance (offline)', () => wallet.getBtcBalance({ skipSync: true }))}>Cached balance</Btn>
        <Btn disabled={busy} onClick={() => run('listUnspents', () => wallet.listUnspents(), true)}>Unspents</Btn>
        <Btn disabled={busy} onClick={() => run('listTransactions', () => wallet.listTransactions(), true)}>Transactions</Btn>
        <Btn disabled={busy} onClick={() => run('syncWallet', () => wallet.syncWallet(), true)}>Sync</Btn>
        <Btn disabled={busy} onClick={() => run('refresh', () => wallet.refresh(), true)}>Refresh transfers</Btn>
        <Btn disabled={busy} onClick={() => run('estimateFeeRate', () => wallet.estimateFeeRate(6), true)}>Estimate fee (6 blocks)</Btn>
      </div>
      <div role="status" aria-live="polite"><OutputBox label="Operation result" value={output} /></div>
    </Section>
    <fieldset disabled={busy}>
      <Section title="Bitcoin" hint="Amounts are in sats; fee rate is in sat/vB. The wallet signs and broadcasts in one call.">
        <div className="grid md:grid-cols-3 gap-x-4">
          <Input label="BTC recipient address" value={address} onChange={setAddress} />
          <Input label="BTC amount (sats)" value={btcAmount} onChange={setBtcAmount} />
          <Input label="Fee rate (sat/vB)" value={feeRate} onChange={setFeeRate} />
        </div>
        <Btn onClick={() => run('sendBtc', () => wallet.sendBtc({ address, amount: Number(btcAmount), feeRate: Number(feeRate) }), true)}>Send BTC</Btn>
        <div className="mt-4"><Input label="Number of allocation UTXOs" value={utxoNum} onChange={setUtxoNum} /></div>
        <Btn onClick={() => run('createUtxos', () => wallet.createUtxos({ num: Number(utxoNum), feeRate: Number(feeRate) }), true)}>Create UTXOs</Btn>
      </Section>
      <Section title="Assets" hint="Create allocation UTXOs and let them confirm before issuing. Asset amounts are in the smallest units.">
        <Input label="Asset ID (blank lists all transfers)" value={assetId} onChange={setAssetId} />
        <div className="flex gap-2 flex-wrap mb-4">
          <Btn onClick={() => run('listAssets', () => wallet.listAssets())}>List assets</Btn>
          <Btn disabled={!assetId.trim()} onClick={() => run('getAssetBalance', () => wallet.getAssetBalance(assetId.trim()))}>Asset balance</Btn>
          <Btn onClick={() => run('listTransfers', () => wallet.listTransfers(assetId.trim() || undefined))}>List transfers</Btn>
        </div>
        <div className="grid md:grid-cols-3 gap-x-4">
          <Input label="Ticker" value={ticker} onChange={setTicker} />
          <Input label="Asset name" value={name} onChange={setName} />
          <Input label="Precision" value={precision} onChange={setPrecision} />
          <Input label="Issue amounts (comma separated)" value={amounts} onChange={setAmounts} />
          <Input label="Inflation amounts (comma separated)" value={inflation} onChange={setInflation} />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={() => run('issueAssetNia', () => wallet.issueAssetNia(issue))}>Issue NIA</Btn>
          <Btn onClick={() => run('issueAssetIfa', () => wallet.issueAssetIfa({ ...issue, inflationAmounts: parseAmounts(inflation), rejectListUrl: null }))}>Issue IFA</Btn>
          <Btn disabled={!assetId.trim()} onClick={() => run('inflate', () => wallet.inflate({ assetId: assetId.trim(), inflationAmounts: parseAmounts(inflation), feeRate: Number(feeRate) }), true)}>Inflate IFA</Btn>
        </div>
      </Section>
      <Section title="Receive / send RGB" hint="A witness invoice needs no existing UTXO. A blinded invoice needs a free allocation UTXO. Refresh both wallets until the transfer is Settled.">
        <Input label="RGB amount (blank accepts any amount)" value={amount} onChange={setAmount} />
        <label className="block mb-4"><input type="checkbox" checked={witness} onChange={(e) => setWitness(e.target.checked)} /> Witness invoice</label>
        <Btn onClick={() => run('onchainReceive', async () => {
          const result = await wallet.onchainReceive({ assetId: assetId.trim() || undefined, amount: amount.trim() ? Number(amount) : undefined, witness, minConfirmations: 1 });
          setInvoice(result.invoice);
          return result;
        }, true)}>Create RGB invoice</Btn>
        <div className="mt-4"><Field label="RGB invoice"><textarea aria-label="RGB invoice" className={textareaCls} value={invoice} onChange={(e) => setInvoice(e.target.value)} /></Field></div>
        <Input label="Witness output (sats; blank for blinded invoice)" value={witnessSats} onChange={setWitnessSats} />
        <div className="flex gap-2 flex-wrap">
          <Btn onClick={() => run('decodeRGBInvoice', () => wallet.decodeRGBInvoice({ invoice: invoice.trim() }))}>Decode invoice</Btn>
          <Btn onClick={() => run('onchainSend', () => wallet.onchainSend({
            invoice: invoice.trim(), assetId: assetId.trim() || undefined,
            amount: amount.trim() ? Number(amount) : undefined, feeRate: Number(feeRate), minConfirmations: 1,
            witnessData: witnessSats.trim() ? { amountSat: Number(witnessSats) } : undefined,
          }), true)}>Send RGB</Btn>
        </div>
        <div className="mt-4"><Input label="Batch transfer index to fail" value={batchIdx} onChange={setBatchIdx} /></div>
        <Btn variant="danger" disabled={!batchIdx.trim()} onClick={() => run('failTransfers', () => wallet.failTransfers({ batchTransferIdx: Number(batchIdx), noAssetOnly: false }), true)}>Fail transfer</Btn>
      </Section>
      <Section title="Backup / restore" hint="Restore after opening, before Connect or online operations. To restore into a fresh profile, create another wallet with the same mnemonic. Existing state requires explicit overwrite.">
        <Input label="Backup password" type="password" value={password} onChange={setPassword} />
        <Field label="Backup file"><input aria-label="Backup file" type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <label className="block mb-4"><input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} /> Overwrite existing wallet state when restoring</label>
        <div className="flex gap-2 flex-wrap">
          <Btn disabled={!password} onClick={() => run('exportBackup', async () => {
            const bytes = await wallet.exportBackup({ password });
            downloadBytes(bytes, `rgb-l1-${id}.backup`);
            return { bytes: bytes.length, downloaded: true };
          })}>Download backup</Btn>
          <Btn disabled={!password || !file} onClick={() => run('restoreBackup', async () => {
            if (!file) throw new Error('Choose a backup file');
            await wallet.restoreBackup({ bytes: new Uint8Array(await file.arrayBuffer()), password, overwrite });
          })}>Restore file</Btn>
          <Btn onClick={() => run('backupToVss', () => wallet.backupToVss())}>Back up to VSS</Btn>
          <Btn onClick={() => run('getVssBackupInfo', () => wallet.getVssBackupInfo())}>VSS backup info</Btn>
          <Btn onClick={() => run('restoreFromVss', () => wallet.restoreFromVss({ overwrite }))}>Restore from VSS</Btn>
        </div>
      </Section>
    </fieldset>
  </>;
}
