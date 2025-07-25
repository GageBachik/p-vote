"use client";

import { ReactNode } from "react";

interface TerminalProps {
  header: string;
  className?: string;
  children: ReactNode;
  glowColor?: "green" | "pink" | "cyan";
}

export function Terminal({ header, className = "", children, glowColor = "green" }: TerminalProps) {
  const glowClass = {
    green: "neon-glow-green",
    pink: "neon-glow-pink", 
    cyan: "neon-glow-cyan"
  }[glowColor];

  return (
    <div className={`terminal-window ${glowClass} ${className}`}>
      <div className="terminal-header">
        {header}
      </div>
      {children}
    </div>
  );
}