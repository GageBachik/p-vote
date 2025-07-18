"use client";

import { useState, useEffect } from "react";
import { Cpu, Users } from "lucide-react";
import { Terminal } from "./Terminal";
import { GlitchText } from "./GlitchText";
import { CyberButton } from "./CyberButton";

interface VoteData {
  id: number;
  question: string;
  yesVotes: number;
  noVotes: number;
  timeLeft: number; // in seconds
  poolSize: number;
  activeUsers: number;
}

export function ActiveVote() {
  const [flashHologram, setFlashHologram] = useState<boolean>(false);
  const [voteData, setVoteData] = useState<VoteData>({
    id: 420,
    question: "PUMP $PEPE TO MOON?",
    yesVotes: 1234,
    noVotes: 567,
    timeLeft: 2 * 3600 + 34 * 60 + 12, // 2h 34m 12s
    poolSize: 1801,
    activeUsers: 69
  });

  const [voteMessage, setVoteMessage] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setVoteData(prev => ({
        ...prev,
        timeLeft: Math.max(0, prev.timeLeft - 1)
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h_${minutes}m_${secs}s`;
  };

  const totalVotes = voteData.yesVotes + voteData.noVotes;
  const yesPercentage = totalVotes > 0 ? (voteData.yesVotes / totalVotes) * 100 : 0;
  const noPercentage = totalVotes > 0 ? (voteData.noVotes / totalVotes) * 100 : 0;

  const handleVote = (_voteType: 'yes' | 'no') => {
    setVoteMessage('>>> VOTE_EXECUTED_SUCCESSFULLY');
    setFlashHologram(true);
  
    setTimeout(() => {
      setVoteMessage(null);
      setFlashHologram(false);
    }, 200); // Effect lasts 1 second
  };

  return (
    <Terminal 
      header="ACTIVE_VOTE_SESSION_#420.exe - STATUS: LIVE" 
      className={`mb-8 ${flashHologram ? 'hologram-effect' : ''}`}
    >
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <span className="bg-cyber-pink text-black font-bold px-3 py-1 cyber-flicker">
              {">>> LIVE_FEED"}
            </span>
            <span className="cyber-font text-xl font-bold cyber-cyan">
              VOTE_ID: #{voteData.id}
            </span>
          </div>
          <div className="neon-border-pink px-4 py-2 bg-cyber-darker">
            <span className="cyber-pink font-bold cyber-pulse">
              ⏰ TIMEOUT: {formatTime(voteData.timeLeft)}
            </span>
          </div>
        </div>
        
        <h2 className="text-2xl md:text-4xl font-bold mb-8 text-center cyber-font">
          <GlitchText 
            text={`QUERY: ${voteData.question}`} 
            className="cyber-green"
          />
          <span className="cyber-orange ml-2">🚀</span>
        </h2>
        
        {/* Vote Interface */}
        <div className="grid md:grid-cols-2 gap-8 mb-8">
          {/* YES Terminal */}
          <Terminal 
            header="VOTE_YES.exe - EXECUTING..."
            glowColor="green"
            className="cyber-hover cursor-pointer"
          >
            <div className="p-6 text-center bg-cyber-dark">
              <div className="text-5xl mb-4 cyber-pulse">🚀</div>
              <div className="text-3xl font-bold mb-4 cyber-font cyber-green">YES</div>
              <div className="text-4xl font-bold mb-4 cyber-green">{voteData.yesVotes.toLocaleString()}</div>
              <div className="text-sm mb-6 cyber-cyan">$DEGEN_TOKENS ({yesPercentage.toFixed(1)}%)</div>
              
              {/* Cyber Progress Bar */}
              <div className="cyber-progress h-4 mb-6">
                <div 
                  className="bg-cyber-green h-full neon-glow-green transition-all duration-500" 
                  style={{ width: `${yesPercentage}%` }}
                />
              </div>
              
              <CyberButton 
                variant="green" 
                className="w-full py-3 px-6"
                onClick={() => handleVote('yes')}
              >
                [EXECUTE_YES_VOTE]
              </CyberButton>
              
              {voteMessage && (
                <div className="cyber-green font-bold text-sm mt-2">
                  {voteMessage}
                </div>
              )}
            </div>
          </Terminal>
          
          {/* NO Terminal */}
          <Terminal 
            header="VOTE_NO.exe - EXECUTING..."
            glowColor="pink"
            className="cyber-hover cursor-pointer"
          >
            <div className="p-6 text-center bg-cyber-dark">
              <div className="text-5xl mb-4 cyber-pulse">📉</div>
              <div className="text-3xl font-bold mb-4 cyber-font cyber-pink">NO</div>
              <div className="text-4xl font-bold mb-4 cyber-pink">{voteData.noVotes.toLocaleString()}</div>
              <div className="text-sm mb-6 cyber-cyan">$DEGEN_TOKENS ({noPercentage.toFixed(1)}%)</div>
              
              {/* Cyber Progress Bar */}
              <div className="cyber-progress h-4 mb-6">
                <div 
                  className="bg-cyber-pink h-full neon-glow-pink transition-all duration-500" 
                  style={{ width: `${noPercentage}%` }}
                />
              </div>
              
              <CyberButton 
                variant="pink" 
                className="w-full py-3 px-6"
                onClick={() => handleVote('no')}
              >
                [EXECUTE_NO_VOTE]
              </CyberButton>
              
              {voteMessage && (
                <div className="cyber-pink font-bold text-sm mt-2">
                  {voteMessage}
                </div>
              )}
            </div>
          </Terminal>
        </div>
        
        {/* System Stats */}
        <div className="flex flex-wrap justify-center gap-6 text-center">
          <div className="neon-border-cyan px-6 py-4 bg-cyber-darker">
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 cyber-purple" />
              <span className="font-bold cyber-cyan">POOL_SIZE: </span>
              <span className="cyber-yellow font-bold">{voteData.poolSize.toLocaleString()}_$DEGEN</span>
            </div>
          </div>
          <div className="neon-border-cyan px-6 py-4 bg-cyber-darker">
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 cyber-purple" />
              <span className="font-bold cyber-cyan">ACTIVE_USERS: </span>
              <span className="cyber-yellow font-bold">{voteData.activeUsers}</span>
            </div>
          </div>
        </div>
      </div>
    </Terminal>
  );
}