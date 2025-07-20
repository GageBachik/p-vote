import { NextRequest, NextResponse } from 'next/server';
import { getVoteAnalyticsSimple } from '@/app/lib/db/analytics-simple';
import { getVoteById } from '@/app/lib/db/votes';

// GET /api/votes/[id]/analytics - Get analytics for a specific vote
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get('days_back') || '30');
    const summary = searchParams.get('summary') === 'true';
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

    // Use simplified analytics function
    const analyticsData = await getVoteAnalyticsSimple(resolvedParams.id);
    return NextResponse.json({
      success: true,
      data: analyticsData,
    });
  } catch (error) {
    console.error('Error fetching vote analytics:', error);
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

// POST /api/votes/[id]/analytics - Track analytics events
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const body = await request.json();
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

    // Handle different analytics events (simplified for now)
    if (body.action === 'share') {
      // For now, just return success - tracking can be implemented later
      return NextResponse.json({
        success: true,
        message: 'Share tracked successfully',
      });
    }

    return NextResponse.json(
      { 
        success: false, 
        error: 'Invalid analytics action' 
      },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error tracking analytics:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to track analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}