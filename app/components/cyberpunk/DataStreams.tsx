"use client";

import { useEffect, useState } from "react";
import { useRealTimeStats } from "@/app/hooks/useAnalytics";

interface DataStreamItem {
  id: string;
  delay: number;
  right: number;
  data?: string;
  type?: 'vote' | 'user' | 'view' | 'share';
}

export function DataStreams() {
  const [streams, setStreams] = useState<Array<DataStreamItem>>([]);
  const { stats } = useRealTimeStats(15000); // Update every 15 seconds

  useEffect(() => {
    // Data messages for streams
    const dataMessages = [
      { type: 'vote' as const, message: `VOTES: ${stats?.total_votes || 0}` },
      { type: 'user' as const, message: `ACTIVE: ${stats?.active_votes || 0}` },
      { type: 'view' as const, message: `PARTICIPANTS: ${stats?.total_participants || 0}` },
      { type: 'share' as const, message: `RECENT: ${stats?.recent_activity || 0}` },
    ];

    const createStream = () => {
      if (Math.random() > 0.6) {
        const randomData = dataMessages[Math.floor(Math.random() * dataMessages.length)];
        const newStream: DataStreamItem = {
          id: Math.random().toString(36).substring(7),
          delay: 0,
          right: Math.random() * 100,
          data: randomData.message,
          type: randomData.type
        };
        
        setStreams(prev => [...prev, newStream]);
        
        setTimeout(() => {
          setStreams(prev => prev.filter(s => s.id !== newStream.id));
        }, 4000);
      }
    };

    const interval = setInterval(createStream, 3000);
    return () => clearInterval(interval);
  }, [stats]);

  const getStreamColor = (type?: string) => {
    switch (type) {
      case 'vote': return 'cyber-green';
      case 'user': return 'cyber-cyan';
      case 'view': return 'cyber-purple';
      case 'share': return 'cyber-pink';
      default: return 'cyber-yellow';
    }
  };

  return (
    <>
      {/* Static streams */}
      <div className="data-stream" style={{ right: '10px', animationDelay: '0s' }} />
      <div className="data-stream" style={{ right: '30px', animationDelay: '1s' }} />
      <div className="data-stream" style={{ right: '50px', animationDelay: '2s' }} />
      
      {/* Dynamic data streams with analytics */}
      {streams.map(stream => (
        <div 
          key={stream.id}
          className="data-stream relative" 
          style={{ 
            right: `${stream.right}px`, 
            animationDelay: `${stream.delay}s` 
          }}
        >
          {stream.data && (
            <div 
              className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
                         text-xs font-bold px-2 py-1 rounded cyber-font whitespace-nowrap
                         bg-black/80 border ${getStreamColor(stream.type)} 
                         animate-pulse pointer-events-none z-50`}
              style={{ 
                fontSize: '10px',
                textShadow: '0 0 5px currentColor'
              }}
            >
              {stream.data}
            </div>
          )}
        </div>
      ))}
      
      {/* Fixed analytics display in corner */}
      {stats && (
        <div className="fixed top-4 right-4 z-40 bg-black/80 border border-cyber-cyan 
                       rounded p-2 text-xs cyber-font cyber-cyan">
          <div className="space-y-1">
            <div>SYSTEM_STATUS: ONLINE</div>
            <div>VOTES: {stats.total_votes}</div>
            <div>ACTIVE: {stats.active_votes}</div>
          </div>
        </div>
      )}
    </>
  );
}