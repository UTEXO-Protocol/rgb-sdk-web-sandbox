import { UTEXOWallet } from '@utexo/rgb-sdk';
import { RgbLibWeb } from '@utexo/rgb-sdk-web';
import type { Network } from '@utexo/rgb-sdk-core';

export type OnchainWallet = UTEXOWallet<RgbLibWeb>;

export interface OnchainConfig {
  network: Network;
  mnemonic: string;
  dataDir: string;
  indexerUrl: string;
  proxyEndpoint: string;
  vssUrl: string | null;
}

export function absoluteUrl(url: string): string {
  return url.startsWith('/') ? new URL(url, window.location.origin).href : url;
}

/** init only: keep the restore window open until the first online operation. */
export async function openOnchainWallet(config: OnchainConfig): Promise<OnchainWallet> {
  const wallet = new UTEXOWallet({
    engine: new RgbLibWeb({
      ...config,
      indexerUrl: config.indexerUrl ? absoluteUrl(config.indexerUrl) : undefined,
      proxyEndpoint: config.proxyEndpoint ? absoluteUrl(config.proxyEndpoint) : undefined,
      vssUrl: config.vssUrl ? absoluteUrl(config.vssUrl) : null,
    }),
  });
  try {
    await wallet.init();
    return wallet;
  } catch (error) {
    await wallet.destroy().catch(() => undefined);
    throw error;
  }
}

export function onchainDefaults(network: Network) {
  return network === 'regtest'
    ? {
        indexerUrl: import.meta.env.VITE_RGB_L1_INDEXER_URL ?? '/rgb-l1-esplora/regtest/api',
        proxyEndpoint: import.meta.env.VITE_RGB_L1_PROXY_URL ?? '/rgb-l1-proxy/json-rpc',
      }
    : { indexerUrl: '', proxyEndpoint: '' };
}
