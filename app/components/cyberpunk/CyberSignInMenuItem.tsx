"use client";

import { useSignIn } from '@solana/react';
import type { UiWallet, UiWalletAccount } from '@wallet-standard/react';
import React, { useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface CyberSignInMenuItemProps {
  onError(err: unknown): void;
  onSignIn(account: UiWalletAccount | undefined): void;
  wallet: UiWallet;
}

export function CyberSignInMenuItem({ onSignIn, onError, wallet }: CyberSignInMenuItemProps) {
  const signIn = useSignIn(wallet);
  const [isSigningIn, setIsSigningIn] = useState(false);
  
  const handleSignInClick = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      try {
        setIsSigningIn(true);
        try {
          const { account } = await signIn({
            statement: 'Welcome to DegenVote - Cyberpunk Terminal Access',
          });
          onSignIn(account);
        } finally {
          setIsSigningIn(false);
        }
      } catch (e) {
        onError(e);
      }
    },
    [signIn, onSignIn, onError],
  );

  return (
    <button
      onClick={handleSignInClick}
      disabled={isSigningIn}
      className="w-full cyber-hover neon-border-green p-3 bg-cyber-dark flex items-center space-x-3 disabled:opacity-50"
    >
      <div className="flex items-center space-x-3 flex-1">
        {isSigningIn ? (
          <Loader2 className="w-5 h-5 cyber-green animate-spin" />
        ) : (
          <img
            src={wallet.icon}
            alt={wallet.name}
            className="w-5 h-5"
          />
        )}
        <span className="cyber-green font-bold text-left">
          {isSigningIn ? 'CONNECTING...' : wallet.name.toUpperCase()}
        </span>
      </div>
      <span className="text-xs cyber-cyan">
        {isSigningIn ? '>>>' : '[CONNECT]'}
      </span>
    </button>
  );
}