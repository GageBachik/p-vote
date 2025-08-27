"use client";

import React, { useState, useEffect, useContext } from "react";
import { Cpu, Users, Loader2 } from "lucide-react";
import { Terminal } from "./Terminal";
import { GlitchText } from "./GlitchText";
import { CyberButton } from "./CyberButton";
import { SelectedWalletAccountContext } from "@/app/context/SelectedWalletAccountContext";
import { RpcContext } from "@/app/context/RpcContext";
import { useActiveVotes, useVoteById } from "@/app/hooks/useVotes";
import {
  useParticipantCounts,
  submitVote,
  useHasUserVoted,
} from "@/app/hooks/useParticipants";
import { useRealTimeStats, trackVoteView } from "@/app/hooks/useAnalytics";
import { useSolanaVoting } from "@/app/hooks/useSolanaVoting";
import { VoteAmountModal } from "./VoteAmountModal";
import { Address } from "gill";
// import type { Vote } from "@/app/lib/db/types"; // Currently unused

interface ActiveVoteProps {
  selectedVoteId?: string | null;
  onVoteSelect?: (voteId: string) => void;
  refreshTrigger?: number;
}

export function ActiveVote({
  selectedVoteId,
  onVoteSelect,
  refreshTrigger,
}: ActiveVoteProps) {
  const [selectedWalletAccount] = useContext(SelectedWalletAccountContext);
  const { rpc } = useContext(RpcContext);
  const [flashHologram, setFlashHologram] = useState<boolean>(false);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);
  const [voting, setVoting] = useState<boolean>(false);
  const [updating, setUpdating] = useState<boolean>(false);
  const [updateAmount, setUpdateAmount] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const [shakeButton, setShakeButton] = useState<"yes" | "no" | null>(null);
  const [voteAmountModalOpen, setVoteAmountModalOpen] =
    useState<boolean>(false);
  const [pendingVoteType, setPendingVoteType] = useState<"yes" | "no" | null>(
    null
  );
  const [onChainData, setOnChainData] = useState<{
    title: string;
    creator: string | undefined;
    endTime: Date;
    yesVotes: number;
    noVotes: number;
    totalParticipants: number;
    isActive: boolean;
    token?: Address;
} | null>(null);
  const [redeeming, setRedeeming] = useState<boolean>(false);

  // Fetch active vote data (get 6 latest)
  const {
    votes: activeVotes,
    loading: activeVotesLoading,
    error: activeVotesError,
    refetch: refetchActiveVotes,
  } = useActiveVotes(6, refreshTrigger);

  // Fetch specific vote if selected
  const {
    vote: selectedVote,
    loading: selectedVoteLoading,
    error: selectedVoteError,
    refetch: refetchSelectedVote,
  } = useVoteById(selectedVoteId!);

  // Use selected vote if available, otherwise use latest active vote
  const activeVote = selectedVoteId ? selectedVote : activeVotes[0] || null;
  const votesLoading = selectedVoteId
    ? selectedVoteLoading
    : activeVotesLoading;
  const votesError = selectedVoteId ? selectedVoteError : activeVotesError;
  const refetchVotes = selectedVoteId
    ? refetchSelectedVote
    : refetchActiveVotes;

  // Fetch participant counts for active vote
  const { counts, refetch: refetchCounts } = useParticipantCounts(
    activeVote?.id || ""
  );

  // Check if user has voted (use mock address if no wallet)
  const mockWalletAddress = "E7pD4b6a3TKtP9w2xN1vR8sL5mJ3qY4nK6tF9cH8dA2";
  const {
    hasVoted,
    voteChoice,
    refetch: refetchVotedStatus,
  } = useHasUserVoted(
    activeVote?.id || "",
    selectedWalletAccount?.address || mockWalletAddress
  );

  // Get real-time stats
  const { stats } = useRealTimeStats(30000); // Update every 30 seconds
  // Solana voting functions
  const {
    castVote: castVoteOnChain,
    updatePosition,
    getVoteState,
    redeemWinnings,
  } = useSolanaVoting();

  // Track view when component loads and vote changes
  useEffect(() => {
    if (activeVote?.id) {
      trackVoteView(activeVote.id);
    }
  }, [activeVote?.id]);

  // Fetch on-chain vote data
  useEffect(() => {
    const fetchOnChainData = async () => {
      if (!activeVote?.vote_pubkey) return;

      try {
        const voteState = await getVoteState(activeVote.vote_pubkey);
        // Convert from lamports (or token units) to actual token amount
        // USDC has 6 decimals
        voteState.yesVotes = voteState.yesVotes / 1_000_000;
        voteState.noVotes = voteState.noVotes / 1_000_000;
        setOnChainData(voteState);
      } catch (error) {
        console.error("Failed to fetch on-chain vote data:", error);
      }
    };

    fetchOnChainData();
    // Refresh every 10 seconds
    const interval = setInterval(fetchOnChainData, 10000);
    return () => clearInterval(interval);
  }, [activeVote?.vote_pubkey, getVoteState]);

  // Calculate time remaining
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    if (!activeVote?.blockchain_end_time) return;

    const calculateTimeLeft = () => {
      const endTime = new Date(activeVote.blockchain_end_time!).getTime();
      const now = new Date().getTime();
      const difference = Math.max(0, Math.floor((endTime - now) / 1000));
      setTimeLeft(difference);
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [activeVote?.blockchain_end_time]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h_${minutes}m_${secs}s`;
  };

  // Calculate vote percentages - use on-chain data if available
  const yesAmount = onChainData?.yesVotes ?? counts.yes;
  const noAmount = onChainData?.noVotes ?? counts.no;
  const totalAmount = yesAmount + noAmount;
  const yesPercentage = totalAmount > 0 ? (yesAmount / totalAmount) * 100 : 0;
  const noPercentage = totalAmount > 0 ? (noAmount / totalAmount) * 100 : 0;

  // Check if vote is over and determine winner
  const voteIsOver = timeLeft === 0;
  const winningSide = yesAmount > noAmount ? "yes" : "no";
  const userWon = hasVoted && voteChoice === winningSide;

  const triggerShake = (voteType: "yes" | "no") => {
    setShakeButton(voteType);
    setTimeout(() => setShakeButton(null), 100);
  };

  const handleVoteClick = (voteType: "yes" | "no") => {
    if (!selectedWalletAccount?.address || !activeVote?.id) {
      triggerShake(voteType);
      return;
    }

    // Always trigger shake effect
    triggerShake(voteType);

    if (hasVoted) {
      // If already voted, just shake and return
      return;
    }

    // Open amount selection modal
    setPendingVoteType(voteType);
    setVoteAmountModalOpen(true);
  };

  const handleVote = async (voteType: "yes" | "no", amount: number) => {
    setVoting(true);
    try {
      // Step 1: Cast vote on-chain
      const onChainResult = await castVoteOnChain(
        activeVote!.vote_pubkey,
        voteType,
        amount
      );

      if (!onChainResult.success) {
        throw new Error(onChainResult.error || "On-chain vote failed");
      }

      // Step 2: Record vote in database
      const result = await submitVote(
        activeVote!.id,
        selectedWalletAccount!.address,
        voteType,
        amount, // vote power
        onChainResult.signature
      );

      if (result.success) {
        setVoteMessage(">>> VOTE_EXECUTED_SUCCESSFULLY");
        setFlashHologram(true);

        // Refresh data
        await Promise.all([
          refetchCounts(),
          refetchVotedStatus(),
          refetchVotes(),
        ]);
      } else {
        setVoteMessage(`>>> DATABASE_ERROR: ${result.error}`);
      }
    } catch (error) {
      console.error("Vote failed:", error);
      setVoteMessage(
        `>>> EXECUTION_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setVoting(false);
      setVoteAmountModalOpen(false);
      setPendingVoteType(null);
      setTimeout(() => {
        setVoteMessage(null);
        setFlashHologram(false);
      }, 3000);
    }
  };

  const handleVoteAmountConfirm = (amount: number) => {
    if (pendingVoteType) {
      handleVote(pendingVoteType, amount);
    }
  };

  const handleRedeemWinnings = async () => {
    if (!selectedWalletAccount?.address || !activeVote?.vote_pubkey) return;

    setRedeeming(true);
    try {
      const result = await redeemWinnings({
        votePubkey: activeVote.vote_pubkey,
      });

      if (result.success) {
        setVoteMessage(">>> WINNINGS_REDEEMED_SUCCESSFULLY");
        setFlashHologram(true);
      } else {
        setVoteMessage(`>>> REDEMPTION_FAILED: ${result.error}`);
      }
    } catch (error) {
      console.error("Redeem winnings failed:", error);
      setVoteMessage(
        `>>> REDEMPTION_ERROR: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setRedeeming(false);
      setTimeout(() => {
        setVoteMessage(null);
        setFlashHologram(false);
      }, 3000);
    }
  };

  const handleUpdatePosition = async () => {
    if (!selectedWalletAccount?.address || !activeVote?.id || !updateAmount)
      return;

    const amount = parseFloat(updateAmount);
    if (isNaN(amount) || amount <= 0) {
      setVoteMessage(">>> INVALID_AMOUNT: Must be greater than 0");
      return;
    }

    setUpdating(true);
    try {
      let mint = undefined;
      if (onChainData){
        if (onChainData.token) {
          mint = onChainData.token.toString();
        }
      }
      // Step 1: Update position on-chain
      const onChainResult = await updatePosition({
        votePubkey: activeVote.vote_pubkey,
        amount: amount,
        tokenMint: mint
      });

      if (!onChainResult.success) {
        throw new Error(onChainResult.error || "On-chain update failed");
      }

      // Step 2: Update the vote in database (increase the vote power)
      // For now, we'll just show success message since the DB doesn't track individual position updates
      setVoteMessage(">>> POSITION_UPDATED_SUCCESSFULLY");
      setFlashHologram(true);
      setUpdateAmount("");

      // Refresh data
      await Promise.all([refetchCounts(), refetchVotes()]);
    } catch (error) {
      console.error("Update position failed:", error);
      setVoteMessage(
        `>>> UPDATE_FAILED: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setUpdating(false);
      setTimeout(() => {
        setVoteMessage(null);
        setFlashHologram(false);
      }, 3000);
    }
  };

  // Loading state
  if (votesLoading) {
    return (
      <Terminal
        header="LOADING_VOTE_DATA.exe - INITIALIZING..."
        className="mb-8"
      >
        <div className="p-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin cyber-cyan mx-auto mb-4" />
          <p className="cyber-cyan">{">>> ACCESSING_BLOCKCHAIN_DATA..."}</p>
        </div>
      </Terminal>
    );
  }

  // Error state
  if (votesError || !activeVote) {
    return (
      <Terminal header="ERROR_404.exe - VOTE_NOT_FOUND" className="mb-8">
        <div className="p-8 text-center">
          <p className="cyber-pink mb-4">{">>> NO_ACTIVE_VOTES_DETECTED"}</p>
          <p className="cyber-cyan text-sm">
            Check back later for new voting opportunities
          </p>
        </div>
      </Terminal>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Active Vote */}
      <Terminal
        // ts-expect-error - Header is a custom prop
        header={
          <div
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            <span>{`ACTIVE_VOTE_SESSION_#${activeVote.id.slice(-6)}.exe - STATUS: ${activeVote.status?.toUpperCase()}`}</span>
            <span className="cyber-yellow">{isMinimized ? "[+]" : "[-]"}</span>
          </div>
        }
        className={`mb-8 ${flashHologram ? "hologram-effect" : ""}`}
      >
        {isMinimized ? (
          <div className="p-4 bg-cyber-dark">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold cyber-green">
                  {activeVote.title}
                </h3>
                <div className="flex gap-4 mt-2">
                  <span className="cyber-cyan">
                    YES: ${yesAmount.toFixed(2)}
                  </span>
                  <span className="cyber-pink">NO: ${noAmount.toFixed(2)}</span>
                  <span className="cyber-yellow">
                    TIME: {formatTime(timeLeft)}
                  </span>
                  {!onChainData && (
                    <span className="cyber-purple text-xs">[SYNCING...]</span>
                  )}
                </div>
              </div>
              <div className="text-sm cyber-purple">Click to expand</div>
            </div>
          </div>
        ) : (
          <div className="p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-4">
                <span className="bg-cyber-pink text-black font-bold px-3 py-1 cyber-flicker">
                  {">>> LIVE_FEED"}
                </span>
                <span className="cyber-font text-xl font-bold cyber-cyan">
                  VOTE_ID: #{activeVote.id.slice(-6)}
                </span>
              </div>
              <div className="neon-border-pink px-4 py-2 bg-cyber-darker">
                <span className="cyber-pink font-bold cyber-pulse">
                  ⏰ TIMEOUT:{" "}
                  {activeVote.blockchain_end_time
                    ? formatTime(timeLeft)
                    : "NO_LIMIT"}
                </span>
              </div>
            </div>

            <h2 className="text-2xl md:text-4xl font-bold mb-8 text-center cyber-font">
              <GlitchText
                text={`QUERY: ${activeVote.title}`}
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
                className={`cyber-hover cursor-pointer ${shakeButton === "yes" ? "cyber-shake" : ""}`}
              >
                <div className="p-6 text-center bg-cyber-dark">
                  <div className="text-5xl mb-4 cyber-pulse">🚀</div>
                  <div className="text-3xl font-bold mb-4 cyber-font cyber-green">
                    YES
                  </div>
                  <div className="text-4xl font-bold mb-4 cyber-green">
                    {yesAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-sm mb-6 cyber-cyan">
                    ${
                      !onChainData
                        ? "SYNCING"
                        : onChainData!.token!.toString() == "So11111111111111111111111111111111111111112"
                        ? "SOL_TOKENS"
                      : onChainData!.token!.toString() == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                        ? "USDC_TOKENS"
                        : onChainData!.token!.toString() == "BzrRNRZvKKHqkxXzm49eyDRG8ZRgMHoBoAzmPrPBpump"
                        ? "DVOTE_TOKENS"
                        : "VOTE_TOKENS"
                    } ({yesPercentage.toFixed(1)}%)
                  </div>

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
                    onClick={() => handleVoteClick("yes")}
                    disabled={
                      voting || !selectedWalletAccount?.address || voteIsOver
                    }
                  >
                    {voteIsOver
                      ? "[VOTE_ENDED]"
                      : voting
                        ? "[PROCESSING...]"
                        : hasVoted
                          ? "[ALREADY_VOTED]"
                          : "[EXECUTE_YES_VOTE]"}
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
                className={`cyber-hover cursor-pointer ${shakeButton === "no" ? "cyber-shake" : ""}`}
              >
                <div className="p-6 text-center bg-cyber-dark">
                  <div className="text-5xl mb-4 cyber-pulse">📉</div>
                  <div className="text-3xl font-bold mb-4 cyber-font cyber-pink">
                    NO
                  </div>
                  <div className="text-4xl font-bold mb-4 cyber-pink">
                    {noAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </div>
                  <div className="text-sm mb-6 cyber-cyan">
                    ${
                      !onChainData
                        ? "SYNCING"
                        : onChainData!.token!.toString() == "So11111111111111111111111111111111111111112"
                        ? "SOL_TOKENS"
                      : onChainData!.token!.toString() == "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
                        ? "USDC_TOKENS"
                        : onChainData!.token!.toString() == "BzrRNRZvKKHqkxXzm49eyDRG8ZRgMHoBoAzmPrPBpump"
                        ? "DVOTE_TOKENS"
                        : "VOTE_TOKENS"
                    } ({noPercentage.toFixed(1)}%)
                  </div>

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
                    onClick={() => handleVoteClick("no")}
                    disabled={
                      voting || !selectedWalletAccount?.address || voteIsOver
                    }
                  >
                    {voteIsOver
                      ? "[VOTE_ENDED]"
                      : voting
                        ? "[PROCESSING...]"
                        : hasVoted
                          ? "[ALREADY_VOTED]"
                          : "[EXECUTE_NO_VOTE]"}
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
                  <span className="font-bold cyber-cyan">TOTAL_TOKENS: </span>
                  <span className="cyber-yellow font-bold">
                    $
                    {totalAmount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
              <div className="neon-border-cyan px-6 py-4 bg-cyber-darker">
                <div className="flex items-center space-x-2">
                  <Users className="w-5 h-5 cyber-purple" />
                  <span className="font-bold cyber-cyan">PLATFORM_VOTES: </span>
                  <span className="cyber-yellow font-bold">
                    {activeVote.total_participants || 0}
                  </span>
                </div>
              </div>
              <div className="neon-border-cyan px-6 py-4 bg-cyber-darker">
                <div className="flex items-center space-x-2">
                  <span className="cyber-purple">👁️</span>
                  <span className="font-bold cyber-cyan">VIEWS: </span>
                  <span className="cyber-yellow font-bold">
                    {activeVote.view_count.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Update Position Section / Redeem Winnings Section */}
            {hasVoted && selectedWalletAccount?.address && (
              <div className="mt-8">
                {voteIsOver ? (
                  // Vote is over - show redeem winnings for winners
                  userWon ? (
                    <Terminal
                      header="REDEEM_WINNINGS.exe - CLAIM_YOUR_REWARDS"
                      glowColor="green"
                    >
                      <div className="p-6 bg-cyber-dark">
                        <p className="cyber-green mb-4 text-center font-bold text-xl">
                          {">>> CONGRATULATIONS_YOU_WON!"}
                        </p>
                        <p className="cyber-cyan mb-6 text-center">
                          {`You voted ${voteChoice?.toUpperCase()} and won!`}
                        </p>
                        <div className="max-w-md mx-auto">
                          <CyberButton
                            variant="green"
                            className="w-full py-4 px-6 text-lg"
                            onClick={handleRedeemWinnings}
                            disabled={redeeming || !activeVote?.vote_pubkey}
                          >
                            {redeeming ? "[REDEEMING...]" : "[REDEEM_WINNINGS]"}
                          </CyberButton>
                        </div>
                        {voteMessage && (
                          <div className="cyber-green font-bold text-sm mt-4 text-center">
                            {voteMessage}
                          </div>
                        )}
                      </div>
                    </Terminal>
                  ) : null // User lost, show nothing
                ) : (
                  // Vote is still active - show update position
                  <Terminal
                    header="UPDATE_POSITION.exe - ADD_MORE_TOKENS"
                    glowColor="yellow"
                  >
                    <div className="p-6 bg-cyber-dark">
                      <p className="cyber-yellow mb-4 text-center">
                        {">>> INCREASE_YOUR_POSITION_POWER"}
                      </p>
                      <div className="flex gap-4 items-center max-w-md mx-auto">
                        <input
                          type="number"
                          value={updateAmount}
                          onChange={(e) => setUpdateAmount(e.target.value)}
                          placeholder="Amount to add"
                          className="flex-1 p-3 bg-cyber-darker border border-cyber-yellow cyber-yellow cyber-font"
                          disabled={updating}
                          min="0"
                          step="0.01"
                        />
                        <CyberButton
                          variant="yellow"
                          onClick={handleUpdatePosition}
                          disabled={
                            updating ||
                            !updateAmount ||
                            parseFloat(updateAmount) <= 0
                          }
                          className="px-6"
                        >
                          {updating ? "[UPDATING...]" : "[ADD_TOKENS]"}
                        </CyberButton>
                      </div>
                      {voteMessage && (
                        <div className="cyber-yellow font-bold text-sm mt-4 text-center">
                          {voteMessage}
                        </div>
                      )}
                    </div>
                  </Terminal>
                )}
              </div>
            )}
          </div>
        )}
      </Terminal>

      {/* Other votes - minimized by default */}
      {!selectedVoteId &&
        activeVotes.slice(1).map((vote) => (
          <Terminal
            key={vote.id}
            header={
              <div
                className="flex items-center justify-between cursor-pointer"
                onClick={() => onVoteSelect?.(vote.id)}
              >
                <span>{`VOTE_#${vote.id.slice(-6)}.exe - ${vote.title}`}</span>
                <span className="cyber-yellow">[+]</span>
              </div>
            }
            className="mb-4"
          >
            <div className="p-4 bg-cyber-dark">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex gap-4 mt-2 text-sm">
                    <span className="cyber-cyan">
                      CATEGORY: {vote.category?.toUpperCase()}
                    </span>
                    <span className="cyber-yellow">
                      STATUS: {vote.status?.toUpperCase()}
                    </span>
                    <span className="cyber-purple">Click to expand</span>
                  </div>
                </div>
              </div>
            </div>
          </Terminal>
        ))}

      {/* Vote Amount Modal */}
      <VoteAmountModal
        isOpen={voteAmountModalOpen}
        onClose={() => {
          setVoteAmountModalOpen(false);
          setPendingVoteType(null);
        }}
        onConfirm={handleVoteAmountConfirm}
        voteType={pendingVoteType || "yes"}
        isLoading={voting}
      />
    </div>
  );
}
