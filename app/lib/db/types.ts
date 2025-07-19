// Database types for DegenVote

export interface Vote {
  id: string;
  vote_pubkey: string;
  token_address?: string;
  creator_pubkey: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  total_participants: number;
  unique_voters: string[];
  created_at: Date;
  updated_at: Date;
  blockchain_end_time?: Date;
  status: VoteStatus;
  is_featured: boolean;
  visibility: VoteVisibility;
  view_count: number;
  share_count: number;
  creation_tx_signature?: string;
  confirmation_status: ConfirmationStatus;
}

export interface CreateVoteData {
  vote_pubkey: string;
  token_address?: string;
  creator_pubkey: string;
  title: string;
  description?: string;
  category?: string;
  tags?: string[];
  blockchain_end_time?: Date;
  creation_tx_signature?: string;
  visibility?: VoteVisibility;
}

export interface UpdateVoteData {
  title?: string;
  description?: string;
  category?: string;
  tags?: string[];
  status?: VoteStatus;
  is_featured?: boolean;
  visibility?: VoteVisibility;
  blockchain_end_time?: Date;
  confirmation_status?: ConfirmationStatus;
}

export interface VoteParticipant {
  id: string;
  vote_id: string;
  voter_pubkey: string;
  vote_choice?: 'yes' | 'no';
  vote_power?: number;
  vote_tx_signature?: string;
  participated_at: Date;
}

export interface CreateParticipantData {
  vote_id: string;
  voter_pubkey: string;
  vote_choice?: 'yes' | 'no';
  vote_power?: number;
  vote_tx_signature?: string;
}

export interface VoteAnalytics {
  id: string;
  vote_id: string;
  date: Date;
  new_participants: number;
  total_views: number;
  total_shares: number;
  yes_votes_added: number;
  no_votes_added: number;
  created_at: Date;
}

export interface VoteFilters {
  status?: VoteStatus;
  category?: string;
  creator_pubkey?: string;
  is_featured?: boolean;
  visibility?: VoteVisibility;
  tags?: string[];
  search?: string; // Search in title and description
}

export interface VotePaginationOptions {
  page?: number;
  limit?: number;
  sort_by?: 'created_at' | 'updated_at' | 'total_participants' | 'view_count';
  sort_order?: 'asc' | 'desc';
}

export interface PaginatedVotes {
  votes: Vote[];
  total_count: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

export type VoteStatus = 'pending' | 'active' | 'ended' | 'cancelled';
export type VoteVisibility = 'public' | 'private' | 'unlisted';
export type ConfirmationStatus = 'pending' | 'confirmed' | 'finalized';

export interface VoteWithParticipants extends Vote {
  participants: VoteParticipant[];
}

export interface VoteStats {
  total_votes: number;
  active_votes: number;
  total_participants: number;
  categories: Array<{ category: string; count: number }>;
  recent_activity: number; // votes created in last 24h
}