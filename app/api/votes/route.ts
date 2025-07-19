import { NextRequest, NextResponse } from 'next/server';
import { 
  createVote, 
  getVotes
} from '@/app/lib/db/votes';
import { trackNewParticipant } from '@/app/lib/db/analytics';
import type { CreateVoteData, VoteFilters, VotePaginationOptions } from '@/app/lib/db/types';

// GET /api/votes - List votes with filtering and pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse filters
    const filters: VoteFilters = {};
    if (searchParams.get('status')) filters.status = searchParams.get('status') as 'pending' | 'active' | 'ended' | 'cancelled';
    if (searchParams.get('category')) filters.category = searchParams.get('category') as string;
    if (searchParams.get('creator_pubkey')) filters.creator_pubkey = searchParams.get('creator_pubkey') as string;
    if (searchParams.get('is_featured')) filters.is_featured = searchParams.get('is_featured') === 'true';
    if (searchParams.get('visibility')) filters.visibility = searchParams.get('visibility') as 'public' | 'private' | 'unlisted';
    if (searchParams.get('search')) filters.search = searchParams.get('search') as string;
    if (searchParams.get('tags')) {
      filters.tags = searchParams.get('tags')?.split(',').filter(tag => tag.trim());
    }

    // Parse pagination
    const pagination: VotePaginationOptions = {};
    if (searchParams.get('page')) pagination.page = parseInt(searchParams.get('page')!);
    if (searchParams.get('limit')) pagination.limit = parseInt(searchParams.get('limit')!);
    if (searchParams.get('sort_by')) pagination.sort_by = searchParams.get('sort_by') as 'created_at' | 'updated_at' | 'total_participants' | 'view_count';
    if (searchParams.get('sort_order')) pagination.sort_order = searchParams.get('sort_order') as 'asc' | 'desc';

    const result = await getVotes(filters, pagination);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fetching votes:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch votes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// POST /api/votes - Create a new vote
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const requiredFields = ['vote_pubkey', 'creator_pubkey', 'title'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Missing required field: ${field}` 
          },
          { status: 400 }
        );
      }
    }

    // Validate pubkey format (basic check for 44 character base58)
    if (body.vote_pubkey.length !== 44 || body.creator_pubkey.length !== 44) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid pubkey format' 
        },
        { status: 400 }
      );
    }

    const voteData: CreateVoteData = {
      vote_pubkey: body.vote_pubkey,
      token_address: body.token_address,
      creator_pubkey: body.creator_pubkey,
      title: body.title,
      description: body.description,
      category: body.category,
      tags: body.tags,
      blockchain_end_time: body.blockchain_end_time ? new Date(body.blockchain_end_time) : undefined,
      creation_tx_signature: body.creation_tx_signature,
      visibility: body.visibility || 'public',
    };

    const vote = await createVote(voteData);

    // Track this as a new vote creation in analytics
    await trackNewParticipant(vote.id);

    return NextResponse.json({
      success: true,
      data: vote,
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating vote:', error);
    
    // Handle unique constraint violation
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Vote with this pubkey already exists' 
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create vote',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}