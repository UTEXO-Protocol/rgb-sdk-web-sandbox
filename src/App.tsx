import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { useStore } from './store';
import { autoRestore, getSavedActiveWalletId, setUrlWallet } from './lib/session';
import { OnchainWalletPage } from './pages/OnchainWalletPage';
import { HomePage } from './pages/HomePage';
import { KeysPage } from './pages/KeysPage';

function App() {
  const setSdkStatus = useStore((s) => s.setSdkStatus);
  const addLog = useStore((s) => s.addLog);
  const setWallets = useStore((s) => s.setWallets);
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    setSdkStatus('loading');
    Promise.resolve()
      .then(async () => {
        const { wallets: restored, errors } = await autoRestore();
        if (restored.length > 0) {
          // URL param > sessionStorage > last wallet
          const urlId = new URLSearchParams(window.location.search).get('wallet');
          const savedId = getSavedActiveWalletId();
          const activeId =
            (urlId && restored.find((w) => w.id === urlId))
              ? urlId
              : (savedId && restored.find((w) => w.id === savedId))
              ? savedId
              : (restored[restored.length - 1]?.id ?? null);
          setWallets(restored, activeId);
          if (activeId) setUrlWallet(activeId);
          addLog(restored.length + ' wallet(s) restored from session', 'ok');
        }
        for (const { label, error } of errors) {
          addLog('Restore failed — "' + label + '": ' + error, 'err');
        }
        setSdkStatus('ready');
        addLog('SDK ready', 'ok');
      })
      .catch((e) => {
        setSdkStatus('error', String(e));
        addLog('SDK init failed: ' + e, 'err');
      });
  }, []);

  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/onchain" element={<OnchainWalletPage />} />
          <Route path="/keys" element={<KeysPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;
