"use client";

import { ReactNode } from "react";

interface CyberButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: "green" | "pink" | "cyan";
  className?: string;
  disabled?: boolean;
}

export function CyberButton({ 
  children, 
  onClick, 
  variant = "green", 
  className = "",
  disabled = false 
}: CyberButtonProps) {
  const variantClasses = {
    green: "neon-glow-green bg-cyber-green text-black",
    pink: "neon-glow-pink bg-cyber-pink text-black", 
    cyan: "neon-glow-cyan bg-cyber-cyan text-black"
  }[variant];

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`cyber-hover font-bold py-2 px-4 cyber-font ${variantClasses} ${className} ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
    >
      {children}
    </button>
  );
}