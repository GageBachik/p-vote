import { NextRequest, NextResponse } from 'next/server';
import { testConnection } from '@/app/lib/db/connection';
import { createVote, getVoteById, deleteVote } from '@/app/lib/db/votes';
import { addParticipant } from '@/app/lib/db/participants';
import { trackVoteView } from '@/app/lib/db/analytics';

// GET /api/test - Run database tests
export async function GET(_request: NextRequest) {
  const tests: Array<{ name: string; success: boolean; error?: string; data?: unknown }> = [];

  try {
    // Test 1: Database connection
    try {
      const isConnected = await testConnection();
      tests.push({
        name: 'Database Connection',
        success: isConnected,
        error: isConnected ? undefined : 'Connection failed',
      });
    } catch (error) {
      tests.push({
        name: 'Database Connection',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 2: Create a test vote
    let testVote;
    try {
      const testData = {
        vote_pubkey: '11111111111111111111111111111111111111111111', // Test pubkey
        creator_pubkey: '22222222222222222222222222222222222222222222',
        title: 'Test Vote - Should be deleted',
        description: 'This is a test vote that will be automatically deleted',
        category: 'test',
        tags: ['test', 'automated'],
        visibility: 'private' as const,
      };

      testVote = await createVote(testData);
      tests.push({
        name: 'Create Vote',
        success: true,
        data: { vote_id: testVote.id },
      });
    } catch (error) {
      tests.push({
        name: 'Create Vote',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Test 3: Get vote by ID
    if (testVote) {
      try {
        const retrievedVote = await getVoteById(testVote.id);
        tests.push({
          name: 'Get Vote by ID',
          success: !!retrievedVote && retrievedVote.id === testVote.id,
          data: { found: !!retrievedVote },
        });
      } catch (error) {
        tests.push({
          name: 'Get Vote by ID',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 4: Add a participant
    if (testVote) {
      try {
        const participant = await addParticipant({
          vote_id: testVote.id,
          voter_pubkey: '33333333333333333333333333333333333333333333',
          vote_choice: 'yes',
          vote_power: 100,
        });
        tests.push({
          name: 'Add Participant',
          success: true,
          data: { participant_id: participant.id },
        });
      } catch (error) {
        tests.push({
          name: 'Add Participant',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 5: Track analytics
    if (testVote) {
      try {
        await trackVoteView(testVote.id);
        tests.push({
          name: 'Track Analytics',
          success: true,
        });
      } catch (error) {
        tests.push({
          name: 'Track Analytics',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Test 6: Clean up - delete test vote
    if (testVote) {
      try {
        const deleted = await deleteVote(testVote.id);
        tests.push({
          name: 'Delete Test Vote',
          success: deleted,
        });
      } catch (error) {
        tests.push({
          name: 'Delete Test Vote',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const allPassed = tests.every(test => test.success);
    const passedCount = tests.filter(test => test.success).length;

    return NextResponse.json({
      success: allPassed,
      summary: {
        total_tests: tests.length,
        passed: passedCount,
        failed: tests.length - passedCount,
      },
      tests,
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Test suite failed to run',
      details: error instanceof Error ? error.message : 'Unknown error',
      tests,
    }, { status: 500 });
  }
}