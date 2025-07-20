import { NextRequest, NextResponse } from 'next/server';
import { getParticipant } from '@/app/lib/db/participants';
import { getVoteById } from '@/app/lib/db/votes';

// GET /api/votes/[id]/participants/[voter] - Check if voter has participated
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; voter: string }> }
) {
  try {
    const resolvedParams = await params;
    const voteId = resolvedParams.id;
    const voterPubkey = resolvedParams.voter;

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

    // Get participant data
    const participant = await getParticipant(voteId, voterPubkey);
    
    if (!participant) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Participant not found' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: participant,
    });
  } catch (error) {
    console.error('Error checking voter participation:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check voter participation',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}