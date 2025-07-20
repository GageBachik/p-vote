"use client";

import { useState, useEffect, useCallback } from 'react';

interface PlatformAnalytics {
  total_votes_created: number;
  total_participants: number;
  total_views: number;
  total_shares: number;
  daily_stats: Array<{
    date: string;
    new_votes: number;
    new_participants: number;
    total_views: number;
    total_shares: number;
  }>;
}

interface VoteStats {
  total_votes: number;
  active_votes: number;
  total_participants: number;
  categories: Array<{ category: string; count: number }>;
  recent_activity: number;
}

interface TopVoter {
  voter_pubkey: string;
  vote_count: number;
  latest_vote: Date;
}

interface AnalyticsData {
  platform: PlatformAnalytics;
  vote_stats: VoteStats;
  top_voters?: TopVoter[];
  period_days: number;
}

interface UseAnalyticsResult {
  data: AnalyticsData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

// Hook for getting platform analytics
export function useAnalytics(
  daysBack = 30,
  includeVoters = false
): UseAnalyticsResult {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const searchParams = new URLSearchParams();
      searchParams.set('days_back', daysBack.toString());
      if (includeVoters) {
        searchParams.set('include_voters', 'true');
      }

      const response = await fetch(`/api/analytics?${searchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch analytics: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch analytics');
      }

      setData(result.data);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [daysBack, includeVoters]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    data,
    loading,
    error,
    refetch: fetchAnalytics,
  };
}

// Hook for real-time stats (refreshes more frequently)
export function useRealTimeStats(refreshInterval = 10000) {
  const [stats, setStats] = useState<VoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setError(null);

      const response = await fetch('/api/analytics?days_back=1');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch real-time stats: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch real-time stats');
      }

      setStats(result.data.vote_stats);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    
    const interval = setInterval(fetchStats, refreshInterval);
    return () => clearInterval(interval);
  }, [fetchStats, refreshInterval]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}

// Function to track a vote view
export async function trackVoteView(voteId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/votes/${voteId}/view`, {
      method: 'POST',
    });

    return response.ok;
  } catch {
    return false;
  }
}

// Function to track a vote share
export async function trackVoteShare(voteId: string): Promise<boolean> {
  try {
    const response = await fetch(`/api/votes/${voteId}/share`, {
      method: 'POST',
    });

    return response.ok;
  } catch {
    return false;
  }
}