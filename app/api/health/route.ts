import { NextRequest, NextResponse } from 'next/server';
import { healthCheck } from '@/app/lib/db/connection';

// GET /api/health - Health check endpoint
export async function GET() {
  try {
    const health = await healthCheck();
    
    const status = health.database === 'connected' ? 200 : 503;
    
    return NextResponse.json({
      success: health.database === 'connected',
      status: 'ok',
      timestamp: health.timestamp,
      services: {
        database: health.database,
        api: 'ok',
      },
      version: '1.0.0',
    }, { status });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json({
      success: false,
      status: 'error',
      timestamp: new Date().toISOString(),
      services: {
        database: 'error',
        api: 'ok',
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 503 });
  }
}