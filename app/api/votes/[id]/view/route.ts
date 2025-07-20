import { NextRequest, NextResponse } from 'next/server';
import { trackVoteView } from '@/app/lib/db/analytics';
import { incrementViewCount, getVoteById } from '@/app/lib/db/votes';

// POST /api/votes/[id]/view - Track a view for a vote
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

    // Track view in analytics and increment counter
    await Promise.all([
      trackVoteView(voteId),
      incrementViewCount(voteId)
    ]);

    return NextResponse.json({
      success: true,
      message: 'View tracked successfully',
    });
  } catch (error) {
    console.error('Error tracking vote view:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to track view',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}