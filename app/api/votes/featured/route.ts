import { NextRequest, NextResponse } from 'next/server';
import { getFeaturedVotes } from '@/app/lib/db/votes';

// GET /api/votes/featured - Get featured votes
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');

    const votes = await getFeaturedVotes(limit);

    return NextResponse.json({
      success: true,
      data: votes,
    });
  } catch (error) {
    console.error('Error fetching featured votes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch featured votes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}