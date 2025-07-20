"use client";

import { useState, useEffect, useCallback } from 'react';
import type { VoteParticipant } from '@/app/lib/db/types';

interface ParticipantCounts {
  yes: number;
  no: number;
  total: number;
}

interface UseParticipantCountsResult {
  counts: ParticipantCounts;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseVoteParticipantsResult {
  participants: VoteParticipant[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface UseUserVoteHistoryResult {
  votes: Array<VoteParticipant & { vote_title: string; vote_status: string }>;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

interface VoteSubmissionResult {
  success: boolean;
  error?: string;
  participant?: VoteParticipant;
}

// Hook for getting participant counts for a vote
export function useParticipantCounts(voteId: string): UseParticipantCountsResult {
  const [counts, setCounts] = useState<ParticipantCounts>({ yes: 0, no: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCounts = useCallback(async () => {
    if (!voteId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/votes/${voteId}/participants`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch participant counts: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch participant counts');
      }

      setCounts(result.data.counts || { yes: 0, no: 0, total: 0 });

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setCounts({ yes: 0, no: 0, total: 0 });
    } finally {
      setLoading(false);
    }
  }, [voteId]);

  useEffect(() => {
    fetchCounts();
  }, [fetchCounts]);

  return {
    counts,
    loading,
    error,
    refetch: fetchCounts,
  };
}

// Hook for getting all participants of a vote
export function useVoteParticipants(voteId: string, limit = 100): UseVoteParticipantsResult {
  const [participants, setParticipants] = useState<VoteParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParticipants = useCallback(async () => {
    if (!voteId) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/votes/${voteId}/participants?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch participants: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch participants');
      }

      setParticipants(result.data.participants || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setParticipants([]);
    } finally {
      setLoading(false);
    }
  }, [voteId, limit]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  return {
    participants,
    loading,
    error,
    refetch: fetchParticipants,
  };
}

// Hook for getting user's vote history
export function useUserVoteHistory(
  voterPubkey: string, 
  limit = 50
): UseUserVoteHistoryResult {
  const [votes, setVotes] = useState<Array<VoteParticipant & { vote_title: string; vote_status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!voterPubkey) {
      setVotes([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // We need to create an API endpoint for user vote history
      // For now, let's use the general votes endpoint and filter
      const response = await fetch(`/api/participants/history?voter_pubkey=${voterPubkey}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch vote history: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch vote history');
      }

      setVotes(result.data || []);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setVotes([]);
    } finally {
      setLoading(false);
    }
  }, [voterPubkey, limit]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    votes,
    loading,
    error,
    refetch: fetchHistory,
  };
}

// Function for submitting a vote
export async function submitVote(
  voteId: string,
  voterPubkey: string,
  choice: 'yes' | 'no',
  votePower?: number,
  voteTxSignature?: string
): Promise<VoteSubmissionResult> {
  try {
    const response = await fetch(`/api/votes/${voteId}/participants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        voter_pubkey: voterPubkey,
        vote_choice: choice,
        vote_power: votePower,
        vote_tx_signature: voteTxSignature,
      }),
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      return {
        success: false,
        error: result.error || `Failed to submit vote: ${response.statusText}`,
      };
    }

    return {
      success: true,
      participant: result.data,
    };

  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error occurred',
    };
  }
}

// Hook for checking if user has voted
export function useHasUserVoted(voteId: string, voterPubkey: string) {
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkVoteStatus = useCallback(async () => {
    if (!voteId || !voterPubkey) {
      setHasVoted(false);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/votes/${voteId}/participants/${voterPubkey}`);
      
      if (response.status === 404) {
        setHasVoted(false);
        return;
      }

      if (!response.ok) {
        throw new Error(`Failed to check vote status: ${response.statusText}`);
      }

      const result = await response.json();
      setHasVoted(result.success && result.data && result.data.vote_choice !== null);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setHasVoted(false);
    } finally {
      setLoading(false);
    }
  }, [voteId, voterPubkey]);

  useEffect(() => {
    checkVoteStatus();
  }, [checkVoteStatus]);

  return {
    hasVoted,
    loading,
    error,
    refetch: checkVoteStatus,
  };
}