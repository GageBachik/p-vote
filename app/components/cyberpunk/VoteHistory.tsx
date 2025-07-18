"use client";

import { Activity } from "lucide-react";
import { Terminal } from "./Terminal";

interface HistoryItem {
  id: string;
  title: string;
  timestamp: string;
  result: 'yes' | 'no';
  amount: number;
  emoji: string;
}

export function VoteHistory() {
  const historyItems: HistoryItem[] = [
    {
      id: "1",
      title: "ETH_TO_10K_QUERY.exe",
      timestamp: "2h_ago",
      result: "yes",
      amount: 2420,
      emoji: "💎"
    },
    {
      id: "2", 
      title: "BAN_RUGS_QUERY.exe",
      timestamp: "5h_ago",
      result: "no",
      amount: 1337,
      emoji: "🚫"
    },
    {
      id: "3",
      title: "MOON_MISSION_QUERY.exe", 
      timestamp: "1d_ago",
      result: "yes",
      amount: 6969,
      emoji: "🌙"
    }
  ];

  return (
    <Terminal 
      header="VOTE_HISTORY.log - RECENT_TRANSACTIONS"
      glowColor="cyan"
    >
      <div className="p-6">
        <h3 className="text-xl font-bold mb-4 flex items-center cyber-font">
          <Activity className="w-5 h-5 mr-2 cyber-purple" />
          <span className="cyber-cyan">TRANSACTION_LOG</span>
        </h3>
        
        <div className="space-y-4">
          {historyItems.map((item) => (
            <div 
              key={item.id}
              className={`cyber-hover p-4 flex items-center justify-between bg-cyber-dark ${
                item.result === 'yes' ? 'neon-border-green' : 'neon-border-pink'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl cyber-pulse">{item.emoji}</span>
                <div>
                  <div className={`font-bold ${
                    item.result === 'yes' ? 'cyber-green' : 'cyber-pink'
                  }`}>
                    &ldquo;{item.title}&rdquo;
                  </div>
                  <div className="text-xs cyber-cyan">
                    TIMESTAMP: {item.timestamp}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`text-xs font-bold px-2 py-1 ${
                  item.result === 'yes' 
                    ? 'bg-cyber-green text-black' 
                    : 'bg-cyber-pink text-black'
                }`}>
                  {item.result === 'yes' ? '✅ YES_EXECUTED' : '❌ NO_EXECUTED'}
                </span>
                <span className="cyber-yellow font-bold">
                  {item.amount.toLocaleString()}_$DEGEN
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Terminal>
  );
}