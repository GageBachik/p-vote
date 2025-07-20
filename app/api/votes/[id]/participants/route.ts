import { NextRequest, NextResponse } from 'next/server';
import { 
  addParticipant, 
  getParticipantsByVote,
  getParticipantCounts 
} from '@/app/lib/db/participants';
import { getVoteById } from '@/app/lib/db/votes';
import { trackNewParticipant } from '@/app/lib/db/analytics';
import type { CreateParticipantData } from '@/app/lib/db/types';
import { isAddress } from '@solana/addresses';

// GET /api/votes/[id]/participants - Get participants for a vote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');
    const includeCounts = searchParams.get('include_counts') === 'true';
    const resolvedParams = await params;

    // Verify vote exists
    const vote = await getVoteById(resolvedParams.id);
    if (!vote) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vote not found' 
        },
        { status: 404 }
      );
    }

    const participants = await getParticipantsByVote(resolvedParams.id, limit, offset);
    
    let counts;
    if (includeCounts) {
      counts = await getParticipantCounts(resolvedParams.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        participants,
        counts,
        pagination: {
          limit,
          offset,
          total: participants.length,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch participants',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/votes/[id]/participants - Add a participant to a vote
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const resolvedParams = await params;

    // Validate required fields
    if (!body.voter_pubkey) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required field: voter_pubkey' 
        },
        { status: 400 }
      );
    }

    // Validate pubkey format
    // console.log("body.voter_pubkey", body.voter_pubkey, isAddress(body.voter_pubkey))
    if (!isAddress(body.voter_pubkey)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid pubkey format' 
        },
        { status: 400 }
      );
    }

    // Verify vote exists
    const vote = await getVoteById(resolvedParams.id);
    if (!vote) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vote not found' 
        },
        { status: 404 }
      );
    }

    // Validate vote choice if provided
    if (body.vote_choice && !['yes', 'no'].includes(body.vote_choice)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid vote choice. Must be "yes" or "no"' 
        },
        { status: 400 }
      );
    }

    const participantData: CreateParticipantData = {
      vote_id: resolvedParams.id,
      voter_pubkey: body.voter_pubkey,
      vote_choice: body.vote_choice,
      vote_power: body.vote_power ? parseFloat(body.vote_power) : undefined,
      vote_tx_signature: body.vote_tx_signature,
    };

    const participant = await addParticipant(participantData);

    // Track this participation in analytics
    await trackNewParticipant(resolvedParams.id, !!body.vote_choice);

    return NextResponse.json({
      success: true,
      data: participant,
    }, { status: 201 });
  } catch (error) {
    console.error('Error adding participant:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to add participant',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}