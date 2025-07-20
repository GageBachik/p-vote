import { NextRequest, NextResponse } from 'next/server';
import { getRealTimeStats } from '@/app/lib/db/analytics-simple';

// GET /api/analytics/realtime - Get real-time platform statistics
export async function GET(request: NextRequest) {
  try {
    const stats = await getRealTimeStats();

    return NextResponse.json({
      success: true,
      data: stats,
      timestamp: new Date().toISOString(),
      cache_duration: 30, // 30 seconds cache recommended
    });
  } catch (error) {
    console.error('Error fetching real-time stats:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch real-time statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}