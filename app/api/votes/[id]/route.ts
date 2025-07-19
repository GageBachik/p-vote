import { NextRequest, NextResponse } from 'next/server';
import { 
  getVoteById, 
  getVoteByPubkey,
  updateVote, 
  deleteVote,
  getVoteWithParticipants
} from '@/app/lib/db/votes';
import { trackVoteView } from '@/app/lib/db/analytics';
import type { UpdateVoteData } from '@/app/lib/db/types';

// GET /api/votes/[id] - Get a specific vote by ID or pubkey
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const includeParticipants = searchParams.get('include_participants') === 'true';
    const trackView = searchParams.get('track_view') !== 'false'; // Default to true
    const resolvedParams = await params;

    let vote;
    
    // Try to get by UUID first, then by pubkey
    if (resolvedParams.id.includes('-')) {
      // Looks like a UUID
      vote = includeParticipants 
        ? await getVoteWithParticipants(resolvedParams.id)
        : await getVoteById(resolvedParams.id);
    } else {
      // Assume it's a pubkey
      vote = await getVoteByPubkey(resolvedParams.id);
    }

    if (!vote) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vote not found' 
        },
        { status: 404 }
      );
    }

    // Track view for analytics (unless explicitly disabled)
    if (trackView) {
      await trackVoteView(vote.id);
    }

    return NextResponse.json({
      success: true,
      data: vote,
    });
  } catch (error) {
    console.error('Error fetching vote:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch vote',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// PUT /api/votes/[id] - Update a vote
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
    const resolvedParams = await params;

    // Only allow updating certain fields
    const allowedFields = [
      'title', 
      'description', 
      'category', 
      'tags', 
      'status', 
      'is_featured', 
      'visibility',
      'blockchain_end_time',
      'confirmation_status'
    ];

    const updateData: UpdateVoteData = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === 'blockchain_end_time' && body[field]) {
          updateData[field] = new Date(body[field]);
        } else {
          updateData[field as keyof UpdateVoteData] = body[field];
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No valid fields to update' 
        },
        { status: 400 }
      );
    }

    const vote = await updateVote(resolvedParams.id, updateData);

    if (!vote) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vote not found' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: vote,
    });
  } catch (error) {
    console.error('Error updating vote:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to update vote',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// DELETE /api/votes/[id] - Delete a vote
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const success = await deleteVote(resolvedParams.id);

    if (!success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vote not found' 
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Vote deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting vote:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete vote',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}