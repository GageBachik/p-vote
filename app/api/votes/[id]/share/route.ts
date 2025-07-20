import { NextRequest, NextResponse } from 'next/server';
import { trackVoteShare } from '@/app/lib/db/analytics';
import { incrementShareCount, getVoteById } from '@/app/lib/db/votes';

// POST /api/votes/[id]/share - Track a share for a vote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const voteId = resolvedParams.id;

    // Verify vote exists
    const vote = await getVoteById(voteId);
    if (!vote) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vote not found' 
        },
        { status: 404 }
      );
    }

    // Track share in analytics and increment counter
    await Promise.all([
      trackVoteShare(voteId),
      incrementShareCount(voteId)
    ]);

    return NextResponse.json({
      success: true,
      message: 'Share tracked successfully',
    });
  } catch (error) {
    console.error('Error tracking vote share:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to track share',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}