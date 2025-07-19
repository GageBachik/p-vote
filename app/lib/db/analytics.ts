import { sql } from './connection';
import type { VoteAnalytics } from './types';

// Record daily analytics for a vote
export async function recordDailyAnalytics(
  vote_id: string,
  date: Date = new Date(),
  metrics: {
    new_participants?: number;
    total_views?: number;
    total_shares?: number;
    yes_votes_added?: number;
    no_votes_added?: number;
  }
): Promise<VoteAnalytics> {
  const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format

  const result = await sql`
    INSERT INTO vote_analytics (
      vote_id,
      date,
      new_participants,
      total_views,
      total_shares,
      yes_votes_added,
      no_votes_added
    ) VALUES (
      ${vote_id},
      ${dateStr},
      ${metrics.new_participants || 0},
      ${metrics.total_views || 0},
      ${metrics.total_shares || 0},
      ${metrics.yes_votes_added || 0},
      ${metrics.no_votes_added || 0}
    )
    ON CONFLICT (vote_id, date)
    DO UPDATE SET
      new_participants = vote_analytics.new_participants + EXCLUDED.new_participants,
      total_views = vote_analytics.total_views + EXCLUDED.total_views,
      total_shares = vote_analytics.total_shares + EXCLUDED.total_shares,
      yes_votes_added = vote_analytics.yes_votes_added + EXCLUDED.yes_votes_added,
      no_votes_added = vote_analytics.no_votes_added + EXCLUDED.no_votes_added
    RETURNING *
  `;

  return result[0] as VoteAnalytics;
}

// Get analytics for a specific vote
export async function getVoteAnalytics(
  vote_id: string,
  days_back = 30
): Promise<VoteAnalytics[]> {
  const result = await sql`
    SELECT * FROM vote_analytics 
    WHERE vote_id = ${vote_id}
      AND date >= CURRENT_DATE - INTERVAL '${days_back} days'
    ORDER BY date ASC
  `;

  return result as VoteAnalytics[];
}

// Get aggregated analytics for a vote
export async function getVoteAnalyticsSummary(vote_id: string): Promise<{
  total_views: number;
  total_shares: number;
  total_participants: number;
  daily_average_views: number;
  peak_day: string | null;
  peak_day_participants: number;
}> {
  const result = await sql`
    SELECT 
      COALESCE(SUM(total_views), 0) as total_views,
      COALESCE(SUM(total_shares), 0) as total_shares,
      COALESCE(SUM(new_participants), 0) as total_participants,
      COALESCE(AVG(total_views), 0) as daily_average_views,
      (
        SELECT date 
        FROM vote_analytics 
        WHERE vote_id = ${vote_id}
        ORDER BY new_participants DESC, date DESC 
        LIMIT 1
      ) as peak_day,
      (
        SELECT new_participants 
        FROM vote_analytics 
        WHERE vote_id = ${vote_id}
        ORDER BY new_participants DESC, date DESC 
        LIMIT 1
      ) as peak_day_participants
    FROM vote_analytics 
    WHERE vote_id = ${vote_id}
  `;

  const row = result[0];
  return {
    total_views: parseInt(row.total_views || '0'),
    total_shares: parseInt(row.total_shares || '0'),
    total_participants: parseInt(row.total_participants || '0'),
    daily_average_views: parseFloat(row.daily_average_views || '0'),
    peak_day: row.peak_day || null,
    peak_day_participants: parseInt(row.peak_day_participants || '0'),
  };
}

// Get platform-wide analytics
export async function getPlatformAnalytics(days_back = 30): Promise<{
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
}> {
  // Get aggregated totals
  const totalsResult = await sql`
    SELECT 
      COUNT(DISTINCT v.id) as total_votes,
      COALESCE(SUM(va.new_participants), 0) as total_participants,
      COALESCE(SUM(va.total_views), 0) as total_views,
      COALESCE(SUM(va.total_shares), 0) as total_shares
    FROM votes v
    LEFT JOIN vote_analytics va ON v.id = va.vote_id
    WHERE v.created_at >= CURRENT_DATE - INTERVAL '${days_back} days'
  `;

  // Get daily breakdown
  const dailyResult = await sql`
    WITH date_series AS (
      SELECT generate_series(
        CURRENT_DATE - INTERVAL '${days_back} days',
        CURRENT_DATE,
        '1 day'::interval
      )::date as date
    ),
    daily_votes AS (
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as new_votes
      FROM votes
      WHERE created_at >= CURRENT_DATE - INTERVAL '${days_back} days'
      GROUP BY DATE(created_at)
    ),
    daily_analytics AS (
      SELECT 
        date,
        SUM(new_participants) as new_participants,
        SUM(total_views) as total_views,
        SUM(total_shares) as total_shares
      FROM vote_analytics
      WHERE date >= CURRENT_DATE - INTERVAL '${days_back} days'
      GROUP BY date
    )
    SELECT 
      ds.date,
      COALESCE(dv.new_votes, 0) as new_votes,
      COALESCE(da.new_participants, 0) as new_participants,
      COALESCE(da.total_views, 0) as total_views,
      COALESCE(da.total_shares, 0) as total_shares
    FROM date_series ds
    LEFT JOIN daily_votes dv ON ds.date = dv.date
    LEFT JOIN daily_analytics da ON ds.date = da.date
    ORDER BY ds.date ASC
  `;

  const totals = totalsResult[0];
  return {
    total_votes_created: parseInt(totals.total_votes || '0'),
    total_participants: parseInt(totals.total_participants || '0'),
    total_views: parseInt(totals.total_views || '0'),
    total_shares: parseInt(totals.total_shares || '0'),
    daily_stats: (dailyResult as Array<{
      date: string;
      new_votes: string;
      new_participants: string;
      total_views: string;
      total_shares: string;
    }>).map((row) => ({
      date: row.date,
      new_votes: parseInt(row.new_votes || '0'),
      new_participants: parseInt(row.new_participants || '0'),
      total_views: parseInt(row.total_views || '0'),
      total_shares: parseInt(row.total_shares || '0'),
    })),
  };
}

// Track when a user views a vote (increment view count)
export async function trackVoteView(vote_id: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  await sql`
    INSERT INTO vote_analytics (vote_id, date, total_views)
    VALUES (${vote_id}, ${today}, 1)
    ON CONFLICT (vote_id, date)
    DO UPDATE SET total_views = vote_analytics.total_views + 1
  `;
}

// Track when a user shares a vote
export async function trackVoteShare(vote_id: string): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  await sql`
    INSERT INTO vote_analytics (vote_id, date, total_shares)
    VALUES (${vote_id}, ${today}, 1)
    ON CONFLICT (vote_id, date)
    DO UPDATE SET total_shares = vote_analytics.total_shares + 1
  `;
}

// Track when a new participant joins a vote
export async function trackNewParticipant(vote_id: string, is_new_vote = false): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  
  // Track new participant
  // const updateFields = { new_participants: 1 }; // Unused for now
  
  if (is_new_vote) {
    // If this is a vote (not just viewing), also increment vote counts
    // This would be called from the participant tracking functions
  }
  
  await sql`
    INSERT INTO vote_analytics (vote_id, date, new_participants)
    VALUES (${vote_id}, ${today}, 1)
    ON CONFLICT (vote_id, date)
    DO UPDATE SET new_participants = vote_analytics.new_participants + 1
  `;
}

// Get trending votes based on recent activity
export async function getTrendingVotesAnalytics(limit = 10): Promise<Array<{
  vote_id: string;
  vote_title: string;
  recent_activity_score: number;
  recent_participants: number;
  recent_views: number;
}>> {
  const result = await sql`
    SELECT 
      v.id as vote_id,
      v.title as vote_title,
      COALESCE(SUM(va.new_participants * 3 + va.total_views), 0) as recent_activity_score,
      COALESCE(SUM(va.new_participants), 0) as recent_participants,
      COALESCE(SUM(va.total_views), 0) as recent_views
    FROM votes v
    LEFT JOIN vote_analytics va ON v.id = va.vote_id
    WHERE v.status = 'active' 
      AND v.visibility = 'public'
      AND va.date >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY v.id, v.title
    HAVING COALESCE(SUM(va.new_participants * 3 + va.total_views), 0) > 0
    ORDER BY recent_activity_score DESC
    LIMIT ${limit}
  `;

  return (result as Array<{
    vote_id: string;
    vote_title: string;
    recent_activity_score: string;
    recent_participants: string;
    recent_views: string;
  }>).map((row) => ({
    vote_id: row.vote_id,
    vote_title: row.vote_title,
    recent_activity_score: parseInt(row.recent_activity_score || '0'),
    recent_participants: parseInt(row.recent_participants || '0'),
    recent_views: parseInt(row.recent_views || '0'),
  }));
}

// Clean up old analytics data (keep only last N days)
export async function cleanupOldAnalytics(days_to_keep = 365): Promise<number> {
  const result = await sql`
    DELETE FROM vote_analytics 
    WHERE date < CURRENT_DATE - INTERVAL '${days_to_keep} days'
  `;

  return result.length;
}