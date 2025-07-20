"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Vote, PaginatedVotes, VoteFilters, VotePaginationOptions } from '@/app/lib/db/types';

interface UseVotesResult {
  votes: Vote[];
  loading: boolean;
  error: string | null;
  totalCount: number;
  hasNext: boolean;
  hasPrev: boolean;
  refetch: () => Promise<void>;
}

export function useVotes(
  filters: VoteFilters = {},
  pagination: VotePaginationOptions = {}
): UseVotesResult {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrev, setHasPrev] = useState(false);

  const fetchVotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const searchParams = new URLSearchParams();
      
      // Add filters to search params
      if (filters.status) searchParams.set('status', filters.status);
      if (filters.category) searchParams.set('category', filters.category);
      if (filters.creator_pubkey) searchParams.set('creator_pubkey', filters.creator_pubkey);
      if (filters.is_featured !== undefined) searchParams.set('is_featured', filters.is_featured.toString());
      if (filters.visibility) searchParams.set('visibility', filters.visibility);
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.tags && filters.tags.length > 0) searchParams.set('tags', filters.tags.join(','));

      // Add pagination to search params
      if (pagination.page) searchParams.set('page', pagination.page.toString());
      if (pagination.limit) searchParams.set('limit', pagination.limit.toString());
      if (pagination.sort_by) searchParams.set('sort_by', pagination.sort_by);
      if (pagination.sort_order) searchParams.set('sort_order', pagination.sort_order);

      const response = await fetch(`/api/votes?${searchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch votes: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch votes');
      }

      const data: PaginatedVotes = result.data;
      setVotes(data.votes);
      setTotalCount(data.total_count);
      setHasNext(data.has_next);
      setHasPrev(data.has_prev);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setVotes([]);
      setTotalCount(0);
      setHasNext(false);
      setHasPrev(false);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination]);

  useEffect(() => {
    fetchVotes();
  }, [fetchVotes]);

  return {
    votes,
    loading,
    error,
    totalCount,
    hasNext,
    hasPrev,
    refetch: fetchVotes,
  };
}

// Hook for getting featured votes
export function useFeaturedVotes(limit = 10) {
  const [votes, setVotes] = useState<Vote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFeaturedVotes = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/votes/featured?limit=${limit}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch featured votes: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch featured votes');
      }

      setVotes(result.data);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setVotes([]);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchFeaturedVotes();
  }, [fetchFeaturedVotes]);

  return {
    votes,
    loading,
    error,
    refetch: fetchFeaturedVotes,
  };
}

// Hook for getting active votes

export function useActiveVotes(limit = 1) {
  const filters = useMemo<VoteFilters>(() => ({ status: "active" }), []);
  const pagination = useMemo<VotePaginationOptions>(
    () => ({ limit }),
    [limit]
  );

  return useVotes(filters, pagination);
}