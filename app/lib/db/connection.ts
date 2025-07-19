import { neon } from '@neondatabase/serverless';

// Get database URL from environment variables
const getDatabaseUrl = (): string => {
  const url = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL;
  
  if (!url) {
    throw new Error(
      'Database URL not found. Please set DATABASE_URL or NEON_DATABASE_URL environment variable.'
    );
  }
  
  return url;
};

// Create Neon SQL client
export const sql = neon(getDatabaseUrl());

// Database connection test
export const testConnection = async (): Promise<boolean> => {
  try {
    const result = await sql`SELECT 1 as test`;
    return result.length > 0 && result[0].test === 1;
  } catch (error) {
    console.error('Database connection test failed:', error);
    return false;
  }
};

// Initialize database schema
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Enable UUID extension
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    
    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database schema:', error);
    throw error;
  }
};

// Health check function for API routes
export const healthCheck = async () => {
  const isConnected = await testConnection();
  return {
    database: isConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  };
};