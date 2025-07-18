"use client";

import { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface CyberModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function CyberModal({ isOpen, onClose, title, children }: CyberModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="terminal-window neon-glow-green">
          <div className="terminal-header flex items-center justify-between">
            <span>{title}</span>
            <button
              onClick={onClose}
              className="cyber-hover p-1 cyber-pink ml-4"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6 bg-cyber-dark">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}