import { sql } from './connection';
import type {
  VoteParticipant,
  CreateParticipantData,
} from './types';

// Add a participant to a vote
export async function addParticipant(data: CreateParticipantData): Promise<VoteParticipant> {
  const result = await sql`
    INSERT INTO vote_participants (
      vote_id,
      voter_pubkey,
      vote_choice,
      vote_power,
      vote_tx_signature
    ) VALUES (
      ${data.vote_id},
      ${data.voter_pubkey},
      ${data.vote_choice || null},
      ${data.vote_power || null},
      ${data.vote_tx_signature || null}
    )
    ON CONFLICT (vote_id, voter_pubkey) 
    DO UPDATE SET
      vote_choice = EXCLUDED.vote_choice,
      vote_power = EXCLUDED.vote_power,
      vote_tx_signature = EXCLUDED.vote_tx_signature,
      participated_at = NOW()
    RETURNING *
  `;

  return result[0] as VoteParticipant;
}

// Get participant by vote and voter
export async function getParticipant(
  vote_id: string,
  voter_pubkey: string
): Promise<VoteParticipant | null> {
  const result = await sql`
    SELECT * FROM vote_participants 
    WHERE vote_id = ${vote_id} AND voter_pubkey = ${voter_pubkey}
  `;

  return result.length > 0 ? (result[0] as VoteParticipant) : null;
}

// Get all participants for a vote
export async function getParticipantsByVote(
  vote_id: string,
  limit = 100,
  offset = 0
): Promise<VoteParticipant[]> {
  const result = await sql`
    SELECT * FROM vote_participants 
    WHERE vote_id = ${vote_id}
    ORDER BY participated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return result as VoteParticipant[];
}

// Get participant count by vote choice
export async function getParticipantCounts(vote_id: string): Promise<{
  yes: number;
  no: number;
  total: number;
}> {
  const result = await sql`
    SELECT 
      COUNT(CASE WHEN vote_choice = 'yes' THEN 1 END) as yes_count,
      COUNT(CASE WHEN vote_choice = 'no' THEN 1 END) as no_count,
      COUNT(*) as total_count
    FROM vote_participants 
    WHERE vote_id = ${vote_id} AND vote_choice IS NOT NULL
  `;

  const row = result[0];
  return {
    yes: parseInt(row.yes_count || '0'),
    no: parseInt(row.no_count || '0'),
    total: parseInt(row.total_count || '0'),
  };
}

// Get all votes a user has participated in
export async function getParticipantVotes(
  voter_pubkey: string,
  limit = 50,
  offset = 0
): Promise<Array<VoteParticipant & { vote_title: string; vote_status: string }>> {
  const result = await sql`
    SELECT 
      vp.*,
      v.title as vote_title,
      v.status as vote_status
    FROM vote_participants vp
    JOIN votes v ON vp.vote_id = v.id
    WHERE vp.voter_pubkey = ${voter_pubkey}
    ORDER BY vp.participated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return result as Array<VoteParticipant & { vote_title: string; vote_status: string }>;
}

// Check if user has already voted on a specific vote
export async function hasUserVoted(
  vote_id: string,
  voter_pubkey: string
): Promise<boolean> {
  const result = await sql`
    SELECT 1 FROM vote_participants 
    WHERE vote_id = ${vote_id} 
      AND voter_pubkey = ${voter_pubkey}
      AND vote_choice IS NOT NULL
    LIMIT 1
  `;

  return result.length > 0;
}

// Update participant vote choice
export async function updateParticipantVote(
  vote_id: string,
  voter_pubkey: string,
  vote_choice: 'yes' | 'no',
  vote_power?: number,
  vote_tx_signature?: string
): Promise<VoteParticipant | null> {
  const result = await sql`
    UPDATE vote_participants 
    SET 
      vote_choice = ${vote_choice},
      vote_power = ${vote_power || null},
      vote_tx_signature = ${vote_tx_signature || null},
      participated_at = NOW()
    WHERE vote_id = ${vote_id} AND voter_pubkey = ${voter_pubkey}
    RETURNING *
  `;

  return result.length > 0 ? (result[0] as VoteParticipant) : null;
}

// Remove participant from vote
export async function removeParticipant(
  vote_id: string,
  voter_pubkey: string
): Promise<boolean> {
  const result = await sql`
    DELETE FROM vote_participants 
    WHERE vote_id = ${vote_id} AND voter_pubkey = ${voter_pubkey}
  `;

  return result.length > 0;
}

// Get recent participants across all votes
export async function getRecentParticipants(limit = 20): Promise<Array<VoteParticipant & {
  vote_title: string;
  vote_id: string;
}>> {
  const result = await sql`
    SELECT 
      vp.*,
      v.title as vote_title,
      v.id as vote_id
    FROM vote_participants vp
    JOIN votes v ON vp.vote_id = v.id
    WHERE vp.vote_choice IS NOT NULL
    ORDER BY vp.participated_at DESC
    LIMIT ${limit}
  `;

  return result as Array<VoteParticipant & {
    vote_title: string;
    vote_id: string;
  }>;
}

// Get top voters by participation count
export async function getTopVoters(limit = 10): Promise<Array<{
  voter_pubkey: string;
  vote_count: number;
  latest_vote: Date;
}>> {
  const result = await sql`
    SELECT 
      voter_pubkey,
      COUNT(*) as vote_count,
      MAX(participated_at) as latest_vote
    FROM vote_participants 
    WHERE vote_choice IS NOT NULL
    GROUP BY voter_pubkey
    ORDER BY vote_count DESC, latest_vote DESC
    LIMIT ${limit}
  `;

  return (result as Array<{ voter_pubkey: string; vote_count: string; latest_vote: Date }>).map((row) => ({
    voter_pubkey: row.voter_pubkey,
    vote_count: parseInt(row.vote_count),
    latest_vote: row.latest_vote,
  }));
}