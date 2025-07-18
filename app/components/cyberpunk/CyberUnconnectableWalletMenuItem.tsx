"use client";

import type { UiWallet } from '@wallet-standard/react';
import { AlertTriangle } from 'lucide-react';

interface CyberUnconnectableWalletMenuItemProps {
  error: unknown;
  wallet: UiWallet;
}

export function CyberUnconnectableWalletMenuItem({ error, wallet }: CyberUnconnectableWalletMenuItemProps) {
  return (
    <div className="w-full neon-border-pink p-3 bg-cyber-darker flex items-center space-x-3 opacity-75">
      <div className="flex items-center space-x-3 flex-1">
        <AlertTriangle className="w-5 h-5 cyber-pink cyber-flicker" />
        <span className="cyber-pink font-bold text-left">
          {wallet.name.toUpperCase()}
        </span>
      </div>
      <span className="text-xs cyber-orange">
        [ERROR]
      </span>
    </div>
  );
}