"use client";

import { useState, useContext } from "react";
import { Clock, Coins, Vote, Loader2, AlertTriangle } from "lucide-react";
import { CyberModal } from "./CyberModal";
import { CyberButton } from "./CyberButton";
import { Terminal } from "./Terminal";
import { SelectedWalletAccountContext } from "@/app/context/SelectedWalletAccountContext";
import { RpcContext } from "@/app/context/RpcContext";
import { useSolanaVoting } from "@/app/hooks/useSolanaVoting";
import { blockhash, isAddress } from "gill";
import { RpcContextProvider } from "@/app/context/RpcContextProvider";
import { useWalletAccountTransactionSendingSigner } from "@solana/react";

interface CreateVoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoteCreated?: (voteId: string) => void;
}

interface VoteFormData {
  title: string;
  description: string;
  category: string;
  duration: "custom" | "1h" | "1d" | "1w";
  customDuration: number;
  customUnit: "minutes" | "hours" | "days";
  selectedToken: string;
  initialVote?: "yes" | "no";
  tags: string[];
}

const VOTE_CATEGORIES = [
  "defi",
  "nft",
  "meme",
  "governance",
  "protocol",
  "market",
  "general",
];

const DURATION_OPTIONS = [
  { value: "1h", label: "1 Hour", duration: 1 * 60 * 60 * 1000 },
  { value: "1d", label: "1 Day", duration: 24 * 60 * 60 * 1000 },
  { value: "1w", label: "1 Week", duration: 7 * 24 * 60 * 60 * 1000 },
  { value: "custom", label: "Custom", duration: 0 },
];

export function CreateVoteModal({
  isOpen,
  onClose,
  onVoteCreated,
}: CreateVoteModalProps) {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);
  const { rpc } = useContext(RpcContext);
  const { getWalletTokens, createVoteTransaction, castVote } =
    useSolanaVoting();
  const [currentStep, setCurrentStep] = useState(1);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableTokens, setAvailableTokens] = useState<
    Array<{
      mint: string;
      symbol: string;
      balance: number;
      decimals: number;
      name: string;
    }>
  >([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  const [formData, setFormData] = useState<VoteFormData>({
    title: "",
    description: "",
    category: "general",
    duration: "1d",
    customDuration: 1,
    customUnit: "hours",
    selectedToken: "USDC",
    tags: [],
  });
  const [initialVoteAmount, setInitialVoteAmount] = useState<string>("");

  // Fetch user's tokens from wallet
  const fetchWalletTokens = async () => {
    if (!selectedWalletAccount?.address) return;

    setLoadingTokens(true);
    try {
      const tokens = await getWalletTokens();
      setAvailableTokens(tokens);
    } catch (err) {
      console.error("Failed to fetch wallet tokens:", err);
      setError("Failed to load wallet tokens");
    } finally {
      setLoadingTokens(false);
    }
  };

  const handleStepForward = () => {
    if (currentStep === 1) {
      if (!formData.title.trim()) {
        setError("Vote title is required");
        return;
      }
      fetchWalletTokens();
    }
    setCurrentStep((prev) => Math.min(prev + 1, 3));
    setError(null);
  };

  const handleStepBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
    setError(null);
  };

  const calculateEndTime = () => {
    const now = new Date();
    if (formData.duration === "custom") {
      const multiplier = {
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
      }[formData.customUnit];
      return new Date(now.getTime() + formData.customDuration * multiplier);
    } else {
      const option = DURATION_OPTIONS.find(
        (opt) => opt.value === formData.duration
      );
      return new Date(now.getTime() + (option?.duration || 0));
    }
  };

  const handleCreateVote = async () => {
    // Use mock wallet address for testing if no wallet connected
    const mockWalletAddress = "E7pD4b6a3TKtP9w2xN1vR8sL5mJ3qY4nK6tF9cH8dA2";
    const walletAddress = selectedWalletAccount?.address || mockWalletAddress;

    if (!walletAddress) {
      setError("Unable to get wallet address");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
      // Step 1: Create on-chain vote
      const txResult = await createVoteTransaction({
        title: formData.title,
        description: formData.description,
        endTime: calculateEndTime(),
        tokenMint:
          formData.selectedToken === "SOL" ? undefined : formData.selectedToken,
        blockhash: latestBlockhash.blockhash,
        initialVote: formData.initialVote ? {
          choice: formData.initialVote,
          amount: parseFloat(initialVoteAmount) || 1
        } : undefined,
      });

      if (!txResult.success) {
        throw new Error(txResult.error || "On-chain transaction failed");
      }

      console.log("walletAddress", walletAddress, isAddress(walletAddress));
      console.log(
        "formData.selectedToken",
        formData.selectedToken,
        isAddress(formData.selectedToken)
      );
      // Step 2: Store in database
      const voteData = {
        vote_pubkey: txResult.votePubkey!,
        token_address:
          formData.selectedToken === "SOL" ? null : formData.selectedToken,
        creator_pubkey: walletAddress,
        title: formData.title,
        description: formData.description || null,
        category: formData.category,
        tags: formData.tags.length > 0 ? formData.tags : null,
        blockchain_end_time: calculateEndTime().toISOString(),
        creation_tx_signature: txResult.signature!,
        visibility: "public",
      };

      const response = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(voteData),
      });

      const result = await response.json();
      console.log("result", result);
      if (!result.success) {
        throw new Error(result.error || "Failed to store vote in database");
      }

      // Step 3: Cast initial vote if selected (already included in combined transaction)
      if (formData.initialVote && result.data.id && txResult.initialVoteSignature) {
        // Parse the amount, default to 1 if not provided
        const amount = parseFloat(initialVoteAmount) || 1;
        
        // Store the initial vote in database (transaction already executed)
        await fetch(`/api/votes/${result.data.id}/participants`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            voter_pubkey: walletAddress,
            vote_choice: formData.initialVote,
            vote_power: amount,
            vote_tx_signature: txResult.initialVoteSignature,
          }),
        });
      }

      // Success!
      if (onVoteCreated) {
        onVoteCreated(result.data.id);
      }

      // Reset form and close modal
      setFormData({
        title: "",
        description: "",
        category: "general",
        duration: "1d",
        customDuration: 1,
        customUnit: "hours",
        selectedToken: "SOL",
        tags: [],
      });
      setCurrentStep(1);
      onClose();
    } catch (err) {
      console.error("Failed to create vote:", err);
      setError(err instanceof Error ? err.message : "Failed to create vote");
    } finally {
      setIsCreating(false);
    }
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag.trim()],
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleClose = () => {
    setCurrentStep(1);
    setError(null);
    setFormData({
      title: "",
      description: "",
      category: "general",
      duration: "1d",
      customDuration: 1,
      customUnit: "hours",
      selectedToken: "SOL",
      tags: [],
    });
    onClose();
  };

  return (
    <CyberModal
      isOpen={isOpen}
      onClose={handleClose}
      title={`CREATE_VOTE_SESSION.exe - STEP_${currentStep}/3`}
    >
      <div className="space-y-6">
        {/* Progress Bar */}
        <div className="flex items-center justify-between">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step <= currentStep
                    ? "bg-cyber-green text-black"
                    : "bg-cyber-dark border border-cyber-cyan cyber-cyan"
                }`}
              >
                {step}
              </div>
              {step < 3 && (
                <div
                  className={`w-12 h-1 mx-2 ${
                    step < currentStep ? "bg-cyber-green" : "bg-cyber-dark"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <Terminal header="STEP_1: VOTE_DETAILS.cfg" glowColor="green">
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-bold cyber-cyan mb-2">
                    VOTE_TITLE *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        title: e.target.value,
                      }))
                    }
                    placeholder="Will $PEPE reach $1?"
                    className="w-full p-2 bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-font text-sm"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold cyber-cyan mb-2">
                    DESCRIPTION
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Additional context for your vote..."
                    className="w-full p-2 bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-font text-sm h-20 resize-none"
                    maxLength={500}
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold cyber-cyan mb-2">
                    CATEGORY
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full p-2 bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-font text-sm"
                  >
                    {VOTE_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.toUpperCase()}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold cyber-cyan mb-2">
                    TAGS (optional)
                  </label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.tags.map((tag) => (
                      <span
                        key={tag}
                        className="bg-cyber-green text-black px-2 py-1 text-xs font-bold"
                      >
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-red-500"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <input
                    type="text"
                    placeholder="Add tags (press Enter)"
                    className="w-full p-2 bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-font text-sm"
                    onKeyPress={(e) => {
                      if (e.key === "Enter") {
                        addTag(e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                </div>
              </div>
            </Terminal>
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <Terminal header="STEP_2: TIMING_AND_TOKEN.cfg" glowColor="cyan">
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-bold cyber-cyan mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    VOTE_DURATION
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {DURATION_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            duration: option.value as
                              | "custom"
                              | "1h"
                              | "1d"
                              | "1w",
                          }))
                        }
                        className={`p-2 text-sm font-bold cyber-font ${
                          formData.duration === option.value
                            ? "bg-cyber-cyan text-black"
                            : "bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-hover"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  {formData.duration === "custom" && (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="number"
                        min="1"
                        value={formData.customDuration}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            customDuration: parseInt(e.target.value) || 1,
                          }))
                        }
                        className="w-20 p-2 bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-font text-sm"
                      />
                      <select
                        value={formData.customUnit}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            customUnit: e.target.value as
                              | "minutes"
                              | "hours"
                              | "days",
                          }))
                        }
                        className="flex-1 p-2 bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-font text-sm"
                      >
                        <option value="minutes">MINUTES</option>
                        <option value="hours">HOURS</option>
                        <option value="days">DAYS</option>
                      </select>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-bold cyber-cyan mb-2">
                    <Coins className="w-4 h-4 inline mr-1" />
                    PAYMENT_TOKEN
                  </label>
                  {loadingTokens ? (
                    <div className="flex items-center justify-center p-4">
                      <Loader2 className="w-4 h-4 animate-spin cyber-cyan mr-2" />
                      <span className="cyber-cyan text-sm">
                        LOADING_TOKENS...
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {/* <button
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            selectedToken: "SOL",
                          }))
                        }
                        className={`w-full p-3 text-left cyber-font text-sm ${
                          formData.selectedToken === "SOL"
                            ? "bg-cyber-green text-black"
                            : "bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-hover"
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold">SOL</span>
                          <span>Native Solana</span>
                        </div>
                      </button> */}
                      {availableTokens.map((token) => (
                        <button
                          key={token.mint}
                          onClick={() =>
                            setFormData((prev) => ({
                              ...prev,
                              selectedToken: token.mint,
                            }))
                          }
                          className={`w-full p-3 text-left cyber-font text-sm ${
                            formData.selectedToken === token.mint
                              ? "bg-cyber-green text-black"
                              : "bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-hover"
                          }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-bold">{token.symbol}</span>
                              <div className="text-xs opacity-75">
                                {token.name}
                              </div>
                            </div>
                            <span>
                              {token.balance.toFixed(
                                token.decimals > 6 ? 2 : token.decimals
                              )}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Terminal>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <Terminal
              header="STEP_3: CONFIRMATION_AND_DEPLOY.exe"
              glowColor="pink"
            >
              <div className="p-4 space-y-4">
                <div className="bg-cyber-darker p-3 border border-cyber-cyan">
                  <h4 className="cyber-cyan font-bold mb-2">VOTE_SUMMARY:</h4>
                  <div className="space-y-1 text-sm">
                    <div>
                      <span className="cyber-yellow">TITLE:</span>{" "}
                      {formData.title}
                    </div>
                    <div>
                      <span className="cyber-yellow">CATEGORY:</span>{" "}
                      {formData.category.toUpperCase()}
                    </div>
                    <div>
                      <span className="cyber-yellow">DURATION:</span>{" "}
                      {formData.duration === "custom"
                        ? `${formData.customDuration} ${formData.customUnit.toUpperCase()}`
                        : DURATION_OPTIONS.find(
                            (opt) => opt.value === formData.duration
                          )?.label}
                    </div>
                    <div>
                      <span className="cyber-yellow">TOKEN:</span>{" "}
                      {formData.selectedToken === "SOL"
                        ? "SOL"
                        : availableTokens.find(
                            (t) => t.mint === formData.selectedToken
                          )?.symbol || "Unknown"}
                    </div>
                    <div>
                      <span className="cyber-yellow">END_TIME:</span>{" "}
                      {calculateEndTime().toLocaleString()}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold cyber-cyan mb-2">
                    <Vote className="w-4 h-4 inline mr-1" />
                    CAST_INITIAL_VOTE (optional)
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          initialVote: undefined,
                        }))
                      }
                      className={`p-2 text-sm font-bold cyber-font ${
                        !formData.initialVote
                          ? "bg-cyber-cyan text-black"
                          : "bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-hover"
                      }`}
                    >
                      NO_VOTE
                    </button>
                    <button
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, initialVote: "yes" }))
                      }
                      className={`p-2 text-sm font-bold cyber-font ${
                        formData.initialVote === "yes"
                          ? "bg-cyber-green text-black"
                          : "bg-cyber-dark border border-cyber-green cyber-green cyber-hover"
                      }`}
                    >
                      YES
                    </button>
                    <button
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, initialVote: "no" }))
                      }
                      className={`p-2 text-sm font-bold cyber-font ${
                        formData.initialVote === "no"
                          ? "bg-cyber-pink text-black"
                          : "bg-cyber-dark border border-cyber-pink cyber-pink cyber-hover"
                      }`}
                    >
                      NO
                    </button>
                  </div>
                </div>
                
                {/* Token amount input - shows when vote choice is selected */}
                {formData.initialVote && (
                  <div className="mt-4">
                    <label className="block text-sm font-bold cyber-cyan mb-2">
                      <Coins className="w-4 h-4 inline mr-1" />
                      VOTE_AMOUNT_TOKENS
                    </label>
                    <input
                      type="number"
                      value={initialVoteAmount}
                      onChange={(e) => setInitialVoteAmount(e.target.value)}
                      placeholder="Amount to vote with (default: 1)"
                      className="w-full p-2 bg-cyber-dark border border-cyber-cyan cyber-cyan cyber-font text-sm"
                      min="0"
                      step="0.01"
                    />
                    <div className="text-xs cyber-yellow mt-1">
                      Enter the amount of {formData.selectedToken === "SOL" ? "SOL" : availableTokens.find(t => t.mint === formData.selectedToken)?.symbol || "tokens"} to vote with
                    </div>
                  </div>
                )}
              </div>
            </Terminal>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-cyber-dark border border-cyber-pink p-3">
            <div className="flex items-center text-cyber-pink">
              <AlertTriangle className="w-4 h-4 mr-2" />
              <span className="text-sm font-bold">ERROR: {error}</span>
            </div>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <CyberButton
            variant="cyan"
            onClick={handleStepBack}
            disabled={currentStep === 1}
          >
            [BACK]
          </CyberButton>

          <div className="flex gap-2">
            <CyberButton variant="pink" onClick={handleClose}>
              [CANCEL]
            </CyberButton>

            {currentStep < 3 ? (
              <CyberButton variant="green" onClick={handleStepForward}>
                [NEXT]
              </CyberButton>
            ) : (
              <CyberButton
                variant="green"
                onClick={handleCreateVote}
                disabled={isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1" />
                    [DEPLOYING...]
                  </>
                ) : (
                  "[CREATE_VOTE]"
                )}
              </CyberButton>
            )}
          </div>
        </div>
      </div>
    </CyberModal>
  );
}
