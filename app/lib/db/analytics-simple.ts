import { sql } from './connection';

// Simplified platform analytics that works
export async function getPlatformAnalyticsSimple(): Promise<{
  total_votes: number;
  total_participants: number;
  total_views: number;
  active_votes: number;
}> {
  try {
    // Get vote counts
    const voteResult = await sql`
      SELECT 
        COUNT(*) as total_votes,
        COUNT(CASE WHEN status = 'active' THEN 1 END) as active_votes
      FROM votes
    `;

    // Get participant counts
    const participantResult = await sql`
      SELECT COUNT(DISTINCT voter_pubkey) as total_participants
      FROM vote_participants
    `;

    // console.log("participantResult", participantResult);

    // Get view counts from votes table
    const viewResult = await sql`
      SELECT COALESCE(SUM(view_count), 0) as total_views
      FROM votes
    `;

    return {
      total_votes: parseInt(voteResult[0]?.total_votes || '0'),
      active_votes: parseInt(voteResult[0]?.active_votes || '0'),
      total_participants: parseInt(participantResult[0]?.total_participants || '0'),
      total_views: parseInt(viewResult[0]?.total_views || '0'),
    };
  } catch (error) {
    console.error('Error in getPlatformAnalyticsSimple:', error);
    return {
      total_votes: 0,
      total_participants: 0,
      total_views: 0,
      active_votes: 0,
    };
  }
}

// Get real-time stats
export async function getRealTimeStats(): Promise<{
  total_votes: number;
  total_participants: number;
  active_votes: number;
  recent_activity: number;
}> {
  try {
    const result = await sql`
      SELECT 
        COUNT(DISTINCT v.id) as total_votes,
        COUNT(DISTINCT p.voter_pubkey) as total_participants,
        COUNT(CASE WHEN v.status = 'active' THEN 1 END) as active_votes,
        COUNT(CASE WHEN v.created_at >= NOW() - INTERVAL '24 hours' THEN 1 END) as recent_activity
      FROM votes v
      LEFT JOIN vote_participants p ON v.id = p.vote_id
    `;

    return {
      total_votes: parseInt(result[0]?.total_votes || '0'),
      total_participants: parseInt(result[0]?.total_participants || '0'),
      active_votes: parseInt(result[0]?.active_votes || '0'),
      recent_activity: parseInt(result[0]?.recent_activity || '0'),
    };
  } catch (error) {
    console.error('Error in getRealTimeStats:', error);
    return {
      total_votes: 0,
      total_participants: 0,
      active_votes: 0,
      recent_activity: 0,
    };
  }
}

// Get simplified vote analytics
export async function getVoteAnalyticsSimple(vote_id: string): Promise<{
  vote_id: string;
  total_participants: number;
  yes_votes: number;
  no_votes: number;
  view_count: number;
}> {
  try {
    // Get vote info and view count
    const voteResult = await sql`
      SELECT view_count FROM votes WHERE id = ${vote_id}
    `;

    // Get participant breakdown
    const participantResult = await sql`
      SELECT 
        COUNT(*) as total_participants,
        COUNT(CASE WHEN vote_choice = 'yes' THEN 1 END) as yes_votes,
        COUNT(CASE WHEN vote_choice = 'no' THEN 1 END) as no_votes
      FROM vote_participants 
      WHERE vote_id = ${vote_id}
    `;

    return {
      vote_id,
      total_participants: parseInt(participantResult[0]?.total_participants || '0'),
      yes_votes: parseInt(participantResult[0]?.yes_votes || '0'),
      no_votes: parseInt(participantResult[0]?.no_votes || '0'),
      view_count: parseInt(voteResult[0]?.view_count || '0'),
    };
  } catch (error) {
    console.error('Error in getVoteAnalyticsSimple:', error);
    return {
      vote_id,
      total_participants: 0,
      yes_votes: 0,
      no_votes: 0,
      view_count: 0,
    };
  }
}