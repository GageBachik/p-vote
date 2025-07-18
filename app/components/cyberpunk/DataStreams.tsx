"use client";

import { useEffect, useState } from "react";

export function DataStreams() {
  const [streams, setStreams] = useState<Array<{ id: string; delay: number; right: number }>>([]);

  useEffect(() => {
    const createStream = () => {
      if (Math.random() > 0.7) {
        const newStream = {
          id: Math.random().toString(36).substring(7),
          delay: 0,
          right: Math.random() * 100
        };
        
        setStreams(prev => [...prev, newStream]);
        
        setTimeout(() => {
          setStreams(prev => prev.filter(s => s.id !== newStream.id));
        }, 3000);
      }
    };

    const interval = setInterval(createStream, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Static streams */}
      <div className="data-stream" style={{ right: '10px', animationDelay: '0s' }} />
      <div className="data-stream" style={{ right: '30px', animationDelay: '1s' }} />
      <div className="data-stream" style={{ right: '50px', animationDelay: '2s' }} />
      
      {/* Dynamic streams */}
      {streams.map(stream => (
        <div 
          key={stream.id}
          className="data-stream" 
          style={{ 
            right: `${stream.right}px`, 
            animationDelay: `${stream.delay}s` 
          }} 
        />
      ))}
    </>
  );
}