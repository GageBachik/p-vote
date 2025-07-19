import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/app/lib/db/connection';
import { readFileSync } from 'fs';
import { join } from 'path';

// POST /api/db/init - Initialize database schema
export async function POST(_request: NextRequest) {
  try {
    // Read the schema file
    const schemaPath = join(process.cwd(), 'app', 'lib', 'db', 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');

    // Split schema into individual statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      await sql.unsafe(statement);
    }

    return NextResponse.json({
      success: true,
      message: 'Database schema initialized successfully',
      statements_executed: statements.length,
    });
  } catch (error) {
    console.error('Database initialization failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to initialize database',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET /api/db/init - Check if database is initialized
export async function GET(_request: NextRequest) {
  try {
    // Check if main tables exist
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('votes', 'vote_participants', 'vote_analytics')
    `;

    const existingTables = (tablesResult as Array<{ table_name: string }>).map((row) => row.table_name);
    const requiredTables = ['votes', 'vote_participants', 'vote_analytics'];
    const isInitialized = requiredTables.every(table => existingTables.includes(table));

    return NextResponse.json({
      success: true,
      initialized: isInitialized,
      existing_tables: existingTables,
      required_tables: requiredTables,
    });
  } catch (error) {
    console.error('Error checking database initialization:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check database status',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}