"use client";

import { StrictMode, useContext } from "react";
import { Theme } from "@radix-ui/themes";

import { SelectedWalletAccountContext } from "./context/SelectedWalletAccountContext";
import { Nav } from "./components/Nav";
import { ChainContextProvider } from "./context/ChainContextProvider";
import { RpcContextProvider } from "./context/RpcContextProvider";
import { SelectedWalletAccountContextProvider } from "./context/SelectedWalletAccountContextProvider";

// Cyberpunk components
import { DataStreams } from "./components/cyberpunk/DataStreams";
import { DegenHeader } from "./components/cyberpunk/DegenHeader";
import { ActiveVote } from "./components/cyberpunk/ActiveVote";
import { VoteHistory } from "./components/cyberpunk/VoteHistory";
import { useCyberpunkEffects } from "./components/cyberpunk/useCyberpunkEffects";

function DegenVoteApp() {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);
  
  // Initialize cyberpunk effects
  useCyberpunkEffects();

  return (
    <div className="min-h-screen">
      <DataStreams />
      
      {selectedWalletAccount ? (
        <>
          <DegenHeader />
          <main className="container mx-auto px-4">
            <ActiveVote />
            <VoteHistory />
          </main>
        </>
      ) : (
        <div className="min-h-screen flex flex-col">
          <Nav />
          <div className="flex-1 flex items-center justify-center">
            <div className="terminal-window neon-glow-green p-8 text-center">
              <div className="terminal-header mb-4">
                CONNECTION_REQUIRED.exe - WALLET_NOT_DETECTED
              </div>
              <p className="cyber-green text-lg cyber-font">
                {">>> CONNECT_WALLET_TO_ACCESS_DEGENVOTE_TERMINAL"}
              </p>
              <p className="cyber-cyan text-sm mt-2">
                Authentication required to participate in decentralized voting
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <StrictMode>
      <Theme>
        <ChainContextProvider>
          <SelectedWalletAccountContextProvider>
            <RpcContextProvider>
              <DegenVoteApp />
            </RpcContextProvider>
          </SelectedWalletAccountContextProvider>
        </ChainContextProvider>
      </Theme>
    </StrictMode>
  );
}
