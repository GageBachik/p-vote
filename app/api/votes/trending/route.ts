import { NextRequest, NextResponse } from 'next/server';
import { getTrendingVotes } from '@/app/lib/db/votes';
import { getTrendingVotesAnalytics } from '@/app/lib/db/analytics';

// GET /api/votes/trending - Get trending votes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const useAnalytics = searchParams.get('use_analytics') === 'true';

    if (useAnalytics) {
      // Use analytics-based trending (more sophisticated)
      const votes = await getTrendingVotesAnalytics(limit);
      return NextResponse.json({
        success: true,
        data: votes,
        method: 'analytics',
      });
    } else {
      // Use simple participant count trending
      const votes = await getTrendingVotes(limit);
      return NextResponse.json({
        success: true,
        data: votes,
        method: 'simple',
      });
    }
  } catch (error) {
    console.error('Error fetching trending votes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch trending votes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}