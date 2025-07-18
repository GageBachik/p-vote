"use client";

import { useContext } from "react";
import { Wifi, Terminal } from "lucide-react";
import { SelectedWalletAccountContext } from "../../context/SelectedWalletAccountContext";
import { Terminal as CyberTerminal } from "./Terminal";
import { GlitchText } from "./GlitchText";
import { CyberButton } from "./CyberButton";
import { CyberBalance } from "./CyberBalance";

export function DegenHeader() {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <header className="mb-8">
      <CyberTerminal header="DEGENVOTE_TERMINAL_v2.1.337 - AUTHENTICATED">
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-3xl font-bold cyber-font cyber-pulse">
                <GlitchText text="DEGENVOTE" className="cyber-green" />
                <span className="cyber-cyan ml-2">⚡</span>
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {selectedWalletAccount && (
                <div className="hidden md:flex items-center space-x-2 neon-border-green px-4 py-2 bg-cyber-dark">
                  <Wifi className="w-4 h-4 cyber-green cyber-flicker" />
                  <span className="text-sm cyber-green">WALLET_CONNECTED</span>
                  <span className="text-xs cyber-cyan">
                    {formatAddress(selectedWalletAccount.address)}
                  </span>
                </div>
              )}
              
              {selectedWalletAccount && (
                <CyberBalance account={selectedWalletAccount} />
              )}
              
              <CyberButton variant="green">
                [CREATE_VOTE]
              </CyberButton>
              
              <button className="cyber-hover p-2 cyber-pink">
                <Terminal className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </CyberTerminal>
    </header>
  );
}