"use client";

import type { UiWallet, UiWalletAccount } from "@wallet-standard/react";
import React, { useCallback } from "react";

interface CyberSignInMenuItemProps {
  onError(err: unknown): void;
  onConnect(account: UiWalletAccount | undefined): void;
  wallet: UiWallet;
}

export function CyberSignInMenuItem({
  onConnect,
  onError,
  wallet,
}: CyberSignInMenuItemProps) {
  const handleConnectClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      try {
        // Ensure the wallet is ready and has accounts
        if (!wallet.accounts.length) {
          // @ts-expect-error Some wallets may not have a connect method
          await wallet.connect?.(); // Some wallets may require this
        }
        const account = wallet.accounts[0]; // Or let the user choose one
        onConnect(account);
      } catch (e) {
        onError(e);
      }
    },
    [wallet, onConnect, onError]
  );

  return (
    <button
      onClick={handleConnectClick}
      className="w-full cyber-hover neon-border-green p-3 bg-cyber-dark flex items-center space-x-3"
    >
      <div className="flex items-center space-x-3 flex-1">
        <img src={wallet.icon} alt={wallet.name} className="w-5 h-5" />
        <span className="cyber-green font-bold text-left">
          {wallet.name.toUpperCase()}
        </span>
      </div>
      <span className="text-xs cyber-cyan">[CONNECT]</span>
    </button>
  );
}
