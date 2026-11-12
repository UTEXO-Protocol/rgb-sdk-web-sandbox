import { openOnchainWallet, type OnchainConfig } from './onchain';
import type { WalletInstance } from '../store';

const SESSION_KEY = 'rgb_wallet_sessions'; // localStorage — shared across tabs
const ACTIVE_KEY = 'rgb_active_wallet_id'; // sessionStorage — per-tab

// Unknown wallet types are kept as opaque records, never opened as RGB_L1.
// Removing a UI/runtime must not delete the user's saved recovery data.
interface StoredSession {
  id: string;
  label: string;
  type: string;
  config: unknown;
}

export function saveSessions(wallets: WalletInstance[], activeWalletId: string | null): void {
  const saved: StoredSession[] = JSON.parse(localStorage.getItem(SESSION_KEY) || '[]');
  const merged = new Map(saved.map((entry) => [entry.id, entry]));
  for (const { id, label, type, config } of wallets) {
    merged.set(id, { id, label, type, config });
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify([...merged.values()]));
  if (activeWalletId) {
    sessionStorage.setItem(ACTIVE_KEY, activeWalletId);
  } else {
    sessionStorage.removeItem(ACTIVE_KEY);
  }
}

export function removeSessionEntry(id: string): void {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;
  const entries = JSON.parse(raw) as StoredSession[];
  localStorage.setItem(SESSION_KEY, JSON.stringify(entries.filter((entry) => entry.id !== id)));
}

export function getSavedActiveWalletId(): string | null {
  return sessionStorage.getItem(ACTIVE_KEY);
}

export function setUrlWallet(id: string | null): void {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('wallet', id);
  else url.searchParams.delete('wallet');
  history.replaceState(null, '', url.toString());
}

export type RestoreResult = {
  wallets: WalletInstance[];
  errors: Array<{ id: string; label: string; error: string }>;
};

export async function autoRestore(): Promise<RestoreResult> {
  try {
    const entries = JSON.parse(localStorage.getItem(SESSION_KEY) || '[]') as StoredSession[];
    const wallets: WalletInstance[] = [];
    const errors: RestoreResult['errors'] = [];
    for (const entry of entries) {
      if (entry.type !== 'onchain') continue;
      try {
        const config = entry.config as OnchainConfig;
        const instance = await openOnchainWallet(config);
        wallets.push({ id: entry.id, label: entry.label, type: 'onchain', config, instance, online: false });
      } catch (error) {
        errors.push({ id: entry.id, label: entry.label, error: String(error) });
      }
    }
    return { wallets, errors };
  } catch (error) {
    return { wallets: [], errors: [{ id: '', label: '(session parse)', error: String(error) }] };
  }
}
