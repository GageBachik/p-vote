"use client";

import { StrictMode, useContext, useState } from "react";

import { SelectedWalletAccountContext } from "./context/SelectedWalletAccountContext";
import { CyberNav } from "./components/cyberpunk/CyberNav";
import { ChainContextProvider } from "./context/ChainContextProvider";
import { RpcContextProvider } from "./context/RpcContextProvider";
import { SelectedWalletAccountContextProvider } from "./context/SelectedWalletAccountContextProvider";

// Cyberpunk components
import { DataStreams } from "./components/cyberpunk/DataStreams";
import { DegenHeader } from "./components/cyberpunk/DegenHeader";
import { ActiveVote } from "./components/cyberpunk/ActiveVote";
import { VoteHistory } from "./components/cyberpunk/VoteHistory";
import { useCyberpunkEffects } from "./components/cyberpunk/useCyberpunkEffects";
import { CyberSignInMenu } from "./components/cyberpunk/CyberSignInMenu";
import { ToastContainer, useToasts } from "./components/cyberpunk/Toast";

function DegenVoteApp() {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);
  const [isSignInModalOpen, setIsSignInModalOpen] = useState(false);
  const { toasts, addToast, removeToast } = useToasts();
  
  // Initialize cyberpunk effects
  useCyberpunkEffects();

  return (
    <div className="min-h-screen">
      <DataStreams />
      
      {selectedWalletAccount ? (
        <>
          <DegenHeader 
            onVoteCreated={(voteId) => {
              addToast({
                type: 'success',
                title: 'VOTE_CREATED_SUCCESSFULLY',
                message: `Vote ID: ${voteId.slice(-8)}`
              });
            }}
          />
          <main className="container mx-auto px-4">
            <ActiveVote />
            <VoteHistory />
          </main>
        </>
      ) : (
        <div className="min-h-screen flex flex-col">
          <CyberNav />
          <div className="flex-1 flex items-center justify-center">
            <div className="terminal-window neon-glow-green p-8 text-center">
              <div 
                className="terminal-header mb-4 cyber-hover cursor-pointer"
                onClick={() => setIsSignInModalOpen(true)}
              >
                CONNECTION_REQUIRED.exe - WALLET_NOT_DETECTED
              </div>
              <p className="cyber-green text-lg cyber-font mb-4">
                {">>> CONNECT_WALLET_TO_ACCESS_DEGENVOTE_TERMINAL"}
              </p>
              <p className="cyber-cyan text-sm mb-6">
                Authentication required to participate in decentralized voting
              </p>
              <button
                onClick={() => setIsSignInModalOpen(true)}
                className="cyber-hover neon-glow-green bg-cyber-green text-black font-bold py-3 px-6 cyber-font"
              >
                [INITIATE_CONNECTION]
              </button>
            </div>
          </div>
        </div>
      )}
      
      <CyberSignInMenu 
        isOpen={isSignInModalOpen}
        onClose={() => setIsSignInModalOpen(false)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

export default function Home() {
  return (
    <StrictMode>
      <ChainContextProvider>
        <SelectedWalletAccountContextProvider>
          <RpcContextProvider>
            <DegenVoteApp />
          </RpcContextProvider>
        </SelectedWalletAccountContextProvider>
      </ChainContextProvider>
    </StrictMode>
  );
}
