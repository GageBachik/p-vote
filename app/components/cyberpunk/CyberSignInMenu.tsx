"use client";

import { SolanaSignIn } from "@solana/wallet-standard-features";
import type { UiWallet } from "@wallet-standard/react";
import { useWallets } from "@wallet-standard/react";
import { useContext, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { AlertTriangle } from "lucide-react";

import { SelectedWalletAccountContext } from "../../context/SelectedWalletAccountContext";
import { CyberModal } from "./CyberModal";
import { CyberSignInMenuItem } from "./CyberSignInMenuItem";
import { CyberUnconnectableWalletMenuItem } from "./CyberUnconnectableWalletMenuItem";

interface CyberSignInMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CyberSignInMenu({ isOpen, onClose }: CyberSignInMenuProps) {
  const { current: NO_ERROR } = useRef(Symbol());
  const wallets = useWallets();
  const [_, setSelectedWalletAccount] = useContext(
    SelectedWalletAccountContext
  );
  const [error, setError] = useState(NO_ERROR);

  function renderItem(wallet: UiWallet) {
    return (
      <ErrorBoundary
        fallbackRender={({ error }) => (
          <CyberUnconnectableWalletMenuItem error={error} wallet={wallet} />
        )}
        key={`wallet:${wallet.name}`}
      >
        <CyberSignInMenuItem
          onConnect={(account) => {

            console.log("Selected account", account, wallet);
            setSelectedWalletAccount(account);
            onClose();
          }}
          onError={setError}
          wallet={wallet}
        />
      </ErrorBoundary>
    );
  }

  const walletsThatSupportSignInWithSolana = [];
  for (const wallet of wallets) {
    if (wallet.features.includes(SolanaSignIn)) {
      walletsThatSupportSignInWithSolana.push(wallet);
    }
  }

  return (
    <CyberModal
      isOpen={isOpen}
      onClose={onClose}
      title="WALLET_AUTHENTICATION.exe - SELECT_PROTOCOL"
    >
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="cyber-font text-lg font-bold cyber-green mb-2">
            INITIATE_WALLET_CONNECTION
          </h3>
          <p className="text-sm cyber-cyan">
            Select your preferred wallet protocol to authenticate
          </p>
        </div>

        {walletsThatSupportSignInWithSolana.length === 0 ? (
          <div className="neon-border-orange p-4 bg-cyber-darker">
            <div className="flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 cyber-orange cyber-flicker" />
              <div>
                <div className="font-bold cyber-orange text-sm">
                  NO_COMPATIBLE_WALLETS_DETECTED
                </div>
                <div className="text-xs cyber-cyan mt-1">
                  Install a wallet that supports{" "}
                  <a
                    href="https://phantom.app/learn/developers/sign-in-with-solana"
                    target="_blank"
                    className="cyber-green hover:cyber-yellow underline"
                  >
                    Sign In With Solana
                  </a>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {walletsThatSupportSignInWithSolana.map(renderItem)}
          </div>
        )}
      </div>
    </CyberModal>
  );
}
