"use client";

import { useState } from "react";
import { Coins, AlertTriangle } from "lucide-react";
import { CyberModal } from "./CyberModal";
import { CyberButton } from "./CyberButton";
import { Terminal } from "./Terminal";

interface VoteAmountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (amount: number) => void;
  voteType: "yes" | "no";
  isLoading?: boolean;
}

export function VoteAmountModal({
  isOpen,
  onClose,
  onConfirm,
  voteType,
  isLoading = false,
}: VoteAmountModalProps) {
  const [amount, setAmount] = useState<string>("1");
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    const numAmount = parseFloat(amount);
    
    if (isNaN(numAmount) || numAmount <= 0) {
      setError("Amount must be greater than 0");
      return;
    }
    
    if (numAmount > 1000000) {
      setError("Amount too large");
      return;
    }

    onConfirm(numAmount);
  };

  const handleClose = () => {
    setAmount("1");
    setError(null);
    onClose();
  };

  return (
    <CyberModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`VOTE_${voteType.toUpperCase()}.exe - CONFIRM_AMOUNT`}
    >
      <div className="space-y-6">
        <Terminal 
          header={`EXECUTE_VOTE_${voteType.toUpperCase()}.cfg`} 
          glowColor={voteType === "yes" ? "green" : "pink"}
        >
          <div className="p-4 space-y-4">
            <div className="text-center mb-4">
              <div className={`text-6xl mb-2 ${voteType === "yes" ? "cyber-green" : "cyber-pink"}`}>
                {voteType === "yes" ? "🚀" : "📉"}
              </div>
              <h3 className={`text-xl font-bold cyber-font ${voteType === "yes" ? "cyber-green" : "cyber-pink"}`}>
                VOTING {voteType.toUpperCase()}
              </h3>
            </div>

            <div>
              <label className="block text-sm font-bold cyber-cyan mb-2">
                <Coins className="w-4 h-4 inline mr-1" />
                VOTE_AMOUNT_$USDC
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="Enter amount to vote with"
                className="w-full p-3 bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-font text-sm"
                min="0"
                step="0.01"
                disabled={isLoading}
                autoFocus
              />
              <div className="text-xs cyber-yellow mt-1">
                Enter the amount of USDC tokens to vote with
              </div>
            </div>

            {/* Quick amount buttons */}
            <div className="grid grid-cols-4 gap-2">
              {[1, 10, 100, 1000].map((quickAmount) => (
                <button
                  key={quickAmount}
                  onClick={() => {
                    setAmount(quickAmount.toString());
                    setError(null);
                  }}
                  className="p-2 text-xs font-bold cyber-font bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-hover"
                  disabled={isLoading}
                >
                  {quickAmount}
                </button>
              ))}
            </div>
          </div>
        </Terminal>

        {/* Error Display */}
        {error && (
          <div className="bg-cyber-dark border border-cyber-pink p-3">
            <div className="flex items-center text-cyber-pink">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="text-sm font-bold">ERROR: {error}</span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between gap-4">
          <CyberButton
            variant="cyan"
            onClick={handleClose}
            disabled={isLoading}
          >
            [CANCEL]
          </CyberButton>

          <CyberButton
            variant={voteType === "yes" ? "green" : "pink"}
            onClick={handleConfirm}
            disabled={isLoading || !amount}
            className="flex-1"
          >
            {isLoading
              ? "[PROCESSING...]"
              : `[VOTE_${voteType.toUpperCase()}_${amount}_USDC]`}
          </CyberButton>
        </div>
      </div>
    </CyberModal>
  );
}