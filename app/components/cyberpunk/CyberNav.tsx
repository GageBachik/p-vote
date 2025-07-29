"use client";

import { useContext, useState } from "react";
import { ChevronDown, Settings } from "lucide-react";

import { ChainContext } from "../../context/ChainContext";
import { SelectedWalletAccountContext } from "../../context/SelectedWalletAccountContext";
import { CyberButton } from "./CyberButton";
import { CyberSignInMenu } from "./CyberSignInMenu";

export function CyberNav() {
  const {
    displayName: currentChainName,
    chain,
    setChain,
  } = useContext(ChainContext);
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const [isChainDropdownOpen, setIsChainDropdownOpen] = useState(false);

  const chains = [
    { id: "solana:devnet" as const, name: "DEVNET" },
    { id: "solana:testnet" as const, name: "TESTNET" },
    ...(process.env.REACT_EXAMPLE_APP_ENABLE_MAINNET === "true"
      ? [{ id: "solana:mainnet" as const, name: "MAINNET_BETA" }]
      : []),
  ];

  return (
    <nav className="sticky top-0 z-40 bg-cyber-darker border-b border-cyber-green">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-xl md:text-2xl font-bold cyber-font cyber-green">
              DEGENVOTE_SYSTEM
            </h1>

            {/* {setChain && (
              <div className="relative">
                <button
                  onClick={() => setIsChainDropdownOpen(!isChainDropdownOpen)}
                  className="cyber-hover neon-border-cyan px-3 py-1 bg-cyber-dark flex items-center space-x-2"
                >
                  <span className="text-xs cyber-cyan font-bold">
                    {currentChainName.toUpperCase()}
                  </span>
                  <ChevronDown className="w-3 h-3 cyber-cyan" />
                </button>
                
                {isChainDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 min-w-full">
                    <div className="terminal-window neon-glow-cyan">
                      <div className="terminal-header text-xs">
                        CHAIN_SELECTOR.exe
                      </div>
                      <div className="p-2 bg-cyber-dark space-y-1">
                        {chains.map(chainOption => (
                          <button
                            key={chainOption.id}
                            onClick={() => {
                              setChain(chainOption.id);
                              setIsChainDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-xs cyber-hover ${
                              chain === chainOption.id 
                                ? 'cyber-green font-bold neon-border-green' 
                                : 'cyber-cyan'
                            }`}
                          >
                            {chainOption.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )} */}
          </div>

          <div className="flex items-center space-x-3">
            {!selectedWalletAccount && (
              <CyberButton
                variant="green"
                onClick={() => setIsSignInModalOpen(true)}
              >
                [CONNECT_WALLET]
              </CyberButton>
            )}

            <button className="cyber-hover p-2 cyber-pink">
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <CyberSignInMenu
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
      />
    </nav>
  );
}
