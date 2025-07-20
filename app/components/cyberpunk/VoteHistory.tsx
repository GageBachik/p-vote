"use client";

import { useContext } from "react";
import { Activity, Loader2 } from "lucide-react";
import { Terminal } from "./Terminal";
import { SelectedWalletAccountContext } from "@/app/context/SelectedWalletAccountContext";
import { useUserVoteHistory } from "@/app/hooks/useParticipants";

export function VoteHistory() {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);
  const { votes, loading, error } = useUserVoteHistory(
    selectedWalletAccount?.address || '',
    20
  );

  // Format timestamp for display
  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 60) {
      return `${diffMinutes}m_ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h_ago`;
    } else {
      return `${diffDays}d_ago`;
    }
  };

  // Get emoji for vote result
  const getEmoji = (choice: 'yes' | 'no', title: string) => {
    if (choice === 'yes') {
      if (title.toLowerCase().includes('moon')) return '🌙';
      if (title.toLowerCase().includes('pump')) return '🚀';
      if (title.toLowerCase().includes('diamond')) return '💎';
      return '✅';
    } else {
      if (title.toLowerCase().includes('rug')) return '🚫';
      if (title.toLowerCase().includes('scam')) return '⚠️';
      return '❌';
    }
  };

  return (
    <Terminal 
      header={`VOTE_HISTORY.log - ${selectedWalletAccount ? 'USER_TRANSACTIONS' : 'NO_WALLET_CONNECTED'}`}
      glowColor="cyan"
    >
      <div className="p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center cyber-font">
          <Activity className="w-5 h-5 mr-2 cyber-purple" />
          <span className="cyber-cyan">TRANSACTION_LOG</span>
        </h3>
        
        {loading ? (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin cyber-cyan mx-auto mb-2" />
            <p className="cyber-cyan text-sm">{">>> LOADING_TRANSACTION_HISTORY..."}</p>
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="cyber-pink mb-2">{">>> ERROR_LOADING_HISTORY"}</p>
            <p className="cyber-cyan text-sm">{error}</p>
          </div>
        ) : !selectedWalletAccount ? (
          <div className="text-center py-8">
            <p className="cyber-yellow mb-2">{">>> WALLET_NOT_CONNECTED"}</p>
            <p className="cyber-cyan text-sm">Connect your wallet to view transaction history</p>
          </div>
        ) : votes.length === 0 ? (
          <div className="text-center py-8">
            <p className="cyber-cyan mb-2">{">>> NO_TRANSACTIONS_FOUND"}</p>
            <p className="cyber-cyan text-sm">Cast your first vote to see it here!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {votes.map((vote) => (
              <div 
                key={vote.id}
                className={`cyber-hover p-4 flex items-center justify-between bg-cyber-dark ${
                  vote.vote_choice === 'yes' ? 'neon-border-green' : 'neon-border-pink'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-2xl cyber-pulse">
                    {getEmoji(vote.vote_choice!, vote.vote_title)}
                  </span>
                  <div>
                    <div className={`font-bold ${
                      vote.vote_choice === 'yes' ? 'cyber-green' : 'cyber-pink'
                    }`}>
                      &ldquo;{vote.vote_title}&rdquo;
                    </div>
                    <div className="text-xs cyber-cyan">
                      TIMESTAMP: {formatTimestamp(vote.participated_at)}
                    </div>
                    <div className="text-xs cyber-purple">
                      STATUS: {vote.vote_status.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`text-xs font-bold px-2 py-1 ${
                    vote.vote_choice === 'yes' 
                      ? 'bg-cyber-green text-black' 
                      : 'bg-cyber-pink text-black'
                  }`}>
                    {vote.vote_choice === 'yes' ? '✅ YES_EXECUTED' : '❌ NO_EXECUTED'}
                  </span>
                  <span className="cyber-yellow font-bold">
                    {vote.vote_power ? `${vote.vote_power.toLocaleString()}_$DEGEN` : 'POWER_UNKNOWN'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Terminal>
  );
}