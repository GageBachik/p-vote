"use client";

import type { UiWallet, UiWalletAccount } from "@wallet-standard/react";
import { useConnect, uiWalletAccountsAreSame } from "@wallet-standard/react";
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
  const [isConnecting, connect] = useConnect(wallet);
  
  const handleConnectClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      try {
        const existingAccounts = [...wallet.accounts];
        const nextAccounts = await connect();
        
        // Try to choose the first never-before-seen account
        for (const nextAccount of nextAccounts) {
          if (!existingAccounts.some(existingAccount => 
            uiWalletAccountsAreSame(nextAccount, existingAccount)
          )) {
            onConnect(nextAccount);
            return;
          }
        }
        
        // Failing that, choose the first account in the list
        if (nextAccounts[0]) {
          onConnect(nextAccounts[0]);
        }
      } catch (e) {
        onError(e);
      }
    },
    [connect, onConnect, onError, wallet.accounts]
  );

  return (
    <button
      onClick={handleConnectClick}
      disabled={isConnecting}
      className="w-full cyber-hover neon-border-green p-3 bg-cyber-dark flex items-center space-x-3"
    >
      <div className="flex items-center space-x-3 flex-1">
        <img src={wallet.icon} alt={wallet.name} className="w-5 h-5" />
        <span className="cyber-green font-bold text-left">
          {wallet.name.toUpperCase()}
        </span>
      </div>
      <span className="text-xs cyber-cyan">
        {isConnecting ? "[CONNECTING...]" : "[CONNECT]"}
      </span>
    </button>
  );
}