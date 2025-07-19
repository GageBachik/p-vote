import { sql } from './connection';
import type {
  Vote,
  CreateVoteData,
  UpdateVoteData,
  VoteFilters,
  VotePaginationOptions,
  PaginatedVotes,
  VoteWithParticipants,
  VoteStats,
  VoteParticipant,
} from './types';

// Create a new vote
export async function createVote(data: CreateVoteData): Promise<Vote> {
  const result = await sql`
    INSERT INTO votes (
      vote_pubkey,
      token_address,
      creator_pubkey,
      title,
      description,
      category,
      tags,
      blockchain_end_time,
      creation_tx_signature,
      visibility
    ) VALUES (
      ${data.vote_pubkey},
      ${data.token_address || null},
      ${data.creator_pubkey},
      ${data.title},
      ${data.description || null},
      ${data.category || null},
      ${data.tags || []},
      ${data.blockchain_end_time || null},
      ${data.creation_tx_signature || null},
      ${data.visibility || 'public'}
    )
    RETURNING *
  `;

  return result[0] as Vote;
}

// Get vote by ID
export async function getVoteById(id: string): Promise<Vote | null> {
  const result = await sql`
    SELECT * FROM votes WHERE id = ${id}
  `;

  return result.length > 0 ? (result[0] as Vote) : null;
}

// Get vote by pubkey
export async function getVoteByPubkey(pubkey: string): Promise<Vote | null> {
  const result = await sql`
    SELECT * FROM votes WHERE vote_pubkey = ${pubkey}
  `;

  return result.length > 0 ? (result[0] as Vote) : null;
}

// Update vote
export async function updateVote(id: string, data: UpdateVoteData): Promise<Vote | null> {
  // For now, let's handle common update fields individually to avoid dynamic SQL
  if (data.title !== undefined) {
    await sql`UPDATE votes SET title = ${data.title} WHERE id = ${id}`;
  }
  if (data.description !== undefined) {
    await sql`UPDATE votes SET description = ${data.description} WHERE id = ${id}`;
  }
  if (data.status !== undefined) {
    await sql`UPDATE votes SET status = ${data.status} WHERE id = ${id}`;
  }
  if (data.is_featured !== undefined) {
    await sql`UPDATE votes SET is_featured = ${data.is_featured} WHERE id = ${id}`;
  }
  if (data.visibility !== undefined) {
    await sql`UPDATE votes SET visibility = ${data.visibility} WHERE id = ${id}`;
  }
  if (data.confirmation_status !== undefined) {
    await sql`UPDATE votes SET confirmation_status = ${data.confirmation_status} WHERE id = ${id}`;
  }
  if (data.blockchain_end_time !== undefined) {
    await sql`UPDATE votes SET blockchain_end_time = ${data.blockchain_end_time} WHERE id = ${id}`;
  }
  if (data.category !== undefined) {
    await sql`UPDATE votes SET category = ${data.category} WHERE id = ${id}`;
  }
  if (data.tags !== undefined) {
    await sql`UPDATE votes SET tags = ${data.tags} WHERE id = ${id}`;
  }

  return getVoteById(id);
}

// Delete vote
export async function deleteVote(id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM votes WHERE id = ${id}
  `;

  return result.length > 0;
}

// Get votes with filtering and pagination
export async function getVotes(
  filters: VoteFilters = {},
  pagination: VotePaginationOptions = {}
): Promise<PaginatedVotes> {
  const {
    page = 1,
    limit = 20,
    // sort_by = 'created_at',  // TODO: Implement sorting
    // sort_order = 'desc',     // TODO: Implement sorting
  } = pagination;

  // const offset = (page - 1) * limit;  // Using in-memory pagination for now

  // TODO: Implement more complex filtering - for now just basic status filtering

  // For now, implement basic filtering and get all votes, then filter in memory
  // This is a simplified approach to avoid complex dynamic SQL issues
  let votesResult;
  let total_count;

  if (filters.status) {
    const result = await sql`SELECT * FROM votes WHERE status = ${filters.status} ORDER BY created_at DESC`;
    votesResult = result;
    total_count = result.length;
  } else {
    const result = await sql`SELECT * FROM votes ORDER BY created_at DESC`;
    votesResult = result;
    total_count = result.length;
  }

  // Apply pagination in memory
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const paginatedVotes = votesResult.slice(startIndex, endIndex);

  const votes = paginatedVotes as Vote[];
  const total_pages = Math.ceil(total_count / limit);

  return {
    votes,
    total_count,
    page,
    limit,
    total_pages,
    has_next: page < total_pages,
    has_prev: page > 1,
  };
}

// Get vote with participants
export async function getVoteWithParticipants(id: string): Promise<VoteWithParticipants | null> {
  const vote = await getVoteById(id);
  if (!vote) return null;

  const participantsResult = await sql`
    SELECT * FROM vote_participants 
    WHERE vote_id = ${id}
    ORDER BY participated_at DESC
  `;

  return {
    ...vote,
    participants: participantsResult as VoteParticipant[],
  };
}

// Get votes by creator
export async function getVotesByCreator(
  creator_pubkey: string,
  pagination: VotePaginationOptions = {}
): Promise<PaginatedVotes> {
  return getVotes({ creator_pubkey }, pagination);
}

// Get featured votes
export async function getFeaturedVotes(limit = 10): Promise<Vote[]> {
  const result = await sql`
    SELECT * FROM votes 
    WHERE is_featured = true AND status = 'active' AND visibility = 'public'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return result as Vote[];
}

// Get trending votes (most participants in last 24h)
export async function getTrendingVotes(limit = 10): Promise<Vote[]> {
  const result = await sql`
    SELECT v.* 
    FROM votes v
    LEFT JOIN vote_participants vp ON v.id = vp.vote_id
    WHERE v.status = 'active' 
      AND v.visibility = 'public'
      AND vp.participated_at > NOW() - INTERVAL '24 hours'
    GROUP BY v.id
    ORDER BY COUNT(vp.id) DESC, v.created_at DESC
    LIMIT ${limit}
  `;

  return result as Vote[];
}

// Search votes by text
export async function searchVotes(
  query: string,
  pagination: VotePaginationOptions = {}
): Promise<PaginatedVotes> {
  return getVotes({ search: query }, pagination);
}

// Increment view count
export async function incrementViewCount(id: string): Promise<void> {
  await sql`
    UPDATE votes 
    SET view_count = view_count + 1
    WHERE id = ${id}
  `;
}

// Increment share count
export async function incrementShareCount(id: string): Promise<void> {
  await sql`
    UPDATE votes 
    SET share_count = share_count + 1
    WHERE id = ${id}
  `;
}

// Update confirmation status
export async function updateConfirmationStatus(
  vote_pubkey: string,
  status: 'pending' | 'confirmed' | 'finalized'
): Promise<Vote | null> {
  const result = await sql`
    UPDATE votes 
    SET confirmation_status = ${status}
    WHERE vote_pubkey = ${vote_pubkey}
    RETURNING *
  `;

  return result.length > 0 ? (result[0] as Vote) : null;
}

// Get vote statistics
export async function getVoteStats(): Promise<VoteStats> {
  const [totalResult, activeResult, participantsResult, categoriesResult, recentResult] = await Promise.all([
    sql`SELECT COUNT(*) as count FROM votes`,
    sql`SELECT COUNT(*) as count FROM votes WHERE status = 'active'`,
    sql`SELECT COUNT(DISTINCT voter_pubkey) as count FROM vote_participants`,
    sql`
      SELECT category, COUNT(*) as count 
      FROM votes 
      WHERE category IS NOT NULL 
      GROUP BY category 
      ORDER BY count DESC
      LIMIT 10
    `,
    sql`
      SELECT COUNT(*) as count 
      FROM votes 
      WHERE created_at > NOW() - INTERVAL '24 hours'
    `,
  ]);

  return {
    total_votes: parseInt(totalResult[0].count),
    active_votes: parseInt(activeResult[0].count),
    total_participants: parseInt(participantsResult[0].count),
    categories: (categoriesResult as Array<{ category: string; count: string }>).map((row) => ({
      category: row.category,
      count: parseInt(row.count),
    })),
    recent_activity: parseInt(recentResult[0].count),
  };
}