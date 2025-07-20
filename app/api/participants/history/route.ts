import { NextRequest, NextResponse } from 'next/server';
import { getParticipantVotes } from '@/app/lib/db/participants';

// GET /api/participants/history - Get vote history for a voter
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const voterPubkey = searchParams.get('voter_pubkey');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    if (!voterPubkey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameter: voter_pubkey' 
        },
        { status: 400 }
      );
    }

    // Validate pubkey format
    if (voterPubkey.length !== 44) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid voter pubkey format' 
        },
        { status: 400 }
      );
    }

    const votes = await getParticipantVotes(voterPubkey, limit, offset);

    return NextResponse.json({
      success: true,
      data: votes,
      pagination: {
        limit,
        offset,
        total: votes.length,
      },
    });
  } catch (error) {
    console.error('Error fetching participant vote history:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch vote history',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}