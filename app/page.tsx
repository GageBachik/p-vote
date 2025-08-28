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
import { ToastContainer, useToasts } from "./components/cyberpunk/Toast";

function DegenVoteApp() {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);
  const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { toasts, addToast, removeToast } = useToasts();

  // Initialize cyberpunk effects
  useCyberpunkEffects();

  const handleVoteCreated = (voteId: string) => {
    addToast({
      type: "success",
      title: "VOTE_CREATED_SUCCESSFULLY",
      message: `Vote ID: ${voteId.slice(-8)}`,
    });
    // Trigger refresh of votes
    setRefreshTrigger(prev => prev + 1);
    // Clear selected vote to show the new one
    setSelectedVoteId(null);
  };

  return (
    <div className="min-h-screen">
      <DataStreams />

      {/* Always show navigation - CyberNav when not authenticated, DegenHeader when authenticated */}
      {selectedWalletAccount ? (
        <DegenHeader onVoteCreated={handleVoteCreated} />
      ) : (
        <CyberNav />
      )}

      {/* Always show main content regardless of authentication */}
      <main className="container mx-auto px-4">
        <ActiveVote 
          selectedVoteId={selectedVoteId} 
          onVoteSelect={setSelectedVoteId}
          refreshTrigger={refreshTrigger}
          addToast={addToast}
        />
        <VoteHistory 
          onVoteSelect={setSelectedVoteId}
          refreshTrigger={refreshTrigger}
        />
      </main>

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
