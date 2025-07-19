import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAnalytics } from '@/app/lib/db/analytics';
import { getVoteStats } from '@/app/lib/db/votes';
import { getTopVoters } from '@/app/lib/db/participants';

// GET /api/analytics - Get platform-wide analytics
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('days_back') || '30');
    const includeVoters = searchParams.get('include_voters') === 'true';

    // Get platform analytics
    const platformAnalytics = await getPlatformAnalytics(daysBack);
    
    // Get vote statistics
    const voteStats = await getVoteStats();

    let topVoters;
    if (includeVoters) {
      topVoters = await getTopVoters(10);
    }

    return NextResponse.json({
      success: true,
      data: {
        platform: platformAnalytics,
        vote_stats: voteStats,
        top_voters: topVoters,
        period_days: daysBack,
      },
    });
  } catch (error) {
    console.error('Error fetching platform analytics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}