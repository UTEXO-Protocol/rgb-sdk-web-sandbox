import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { selectCls } from './Field';

export const walletSections = [
  { id: 'create', label: '1 · Create wallet' },
  { id: 'online', label: '2 · Connect' },
  { id: 'info', label: '3 · Wallet info' },
  { id: 'fund', label: '4 · Fund wallet' },
  { id: 'send-btc', label: '5 · Send BTC' },
  { id: 'utxos', label: '6 · Create UTXOs' },
  { id: 'sync', label: '7 · Sync' },
  { id: 'nia', label: '8 · Issue NIA' },
  { id: 'ifa', label: '9 · Issue / inflate IFA' },
  { id: 'assets', label: '10 · List assets' },
  { id: 'receive', label: '11 · Receive RGB' },
  { id: 'send-rgb', label: '12 · Send RGB' },
  { id: 'transfers', label: '13 · Transfers' },
  { id: 'keys', label: '14 · Wallet keys' },
  { id: 'validate', label: '15 · Validate balance' },
  { id: 'crypto', label: '16 · Decode invoice' },
  { id: 'backup', label: '17 · Backup / restore' },
] as const;

export type WalletSectionId = typeof walletSections[number]['id'];

export function WalletSections() {
  const [activeSection, setActiveSection] = useState<WalletSectionId>('create');
  const { hash } = useLocation();

  useEffect(() => {
    const section = walletSections.find((item) => hash === `#sec-${item.id}`);
    if (section) document.getElementById(`sec-${section.id}`)?.scrollIntoView({ block: 'start' });
  }, [hash]);

  useEffect(() => {
    let frame = 0;
    function update() {
      frame = 0;
      let current: WalletSectionId = 'create';
      for (const section of walletSections) {
        const element = document.getElementById(`sec-${section.id}`);
        if (element && element.getBoundingClientRect().top <= 100) current = section.id;
      }
      if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = 'backup';
      setActiveSection(current);
    }
    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  function navigate(id: WalletSectionId) {
    const element = document.getElementById(`sec-${id}`);
    element?.focus({ preventScroll: true });
    element?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    });
    setActiveSection(id);
  }

  return <>
    <nav aria-label="Wallet sections" className="hidden sm:block w-44 shrink-0 sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto bg-[#161b22] border border-[#30363d] rounded-lg p-1.5">
      <div className="px-2 pt-2 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#8b949e]">Onchain</div>
      {walletSections.map((section) => (
        <button
          key={section.id}
          onClick={() => navigate(section.id)}
          aria-current={activeSection === section.id ? 'location' : undefined}
          className={'block w-full text-left px-2 py-1.5 rounded text-xs whitespace-nowrap focus-visible:outline focus-visible:outline-[#58a6ff] ' +
            (activeSection === section.id
              ? 'bg-[#0d1117] text-[#58a6ff] font-semibold'
              : 'text-[#8b949e] hover:text-[#58a6ff] hover:bg-[#0d1117]')}
        >{section.label}</button>
      ))}
    </nav>
    <div className="sm:hidden sticky top-0 z-10 bg-[#0d1117] py-3 mb-4 border-b border-[#30363d]">
      <label htmlFor="wallet-section" className="block text-xs text-[#8b949e] mb-1">Jump to section</label>
      <select id="wallet-section" className={selectCls} value={activeSection} onChange={(e) => navigate(e.target.value as WalletSectionId)}>
        {walletSections.map((section) => <option key={section.id} value={section.id}>{section.label}</option>)}
      </select>
    </div>
  </>;
}
