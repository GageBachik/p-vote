import { NextRequest, NextResponse } from 'next/server';
import { getPlatformAnalyticsSimple } from '@/app/lib/db/analytics-simple';

// GET /api/analytics - Get platform-wide analytics
export async function GET(request: NextRequest) {
  try {
    // Get simplified platform analytics that actually work
    const platformAnalytics = await getPlatformAnalyticsSimple();

    return NextResponse.json({
      success: true,
      data: {
        platform: platformAnalytics,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error fetching platform analytics:', error);
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