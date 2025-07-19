-- DegenVote Database Schema
-- Designed for Neon Serverless PostgreSQL

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Votes table - stores metadata for each vote
CREATE TABLE IF NOT EXISTS votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Solana blockchain identifiers
    vote_pubkey VARCHAR(44) UNIQUE NOT NULL, -- Base58 encoded pubkey (32 bytes = 44 chars)
    token_address VARCHAR(44), -- Token used for voting
    creator_pubkey VARCHAR(44) NOT NULL, -- Who created the vote
    
    -- Vote content and metadata
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    tags TEXT[], -- Array of tags for filtering
    
    -- Participation tracking
    total_participants INTEGER DEFAULT 0,
    unique_voters TEXT[] DEFAULT '{}', -- Array of voter pubkeys
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    blockchain_end_time TIMESTAMP WITH TIME ZONE, -- From blockchain endTimestamp
    
    -- Status and visibility
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('pending', 'active', 'ended', 'cancelled')),
    is_featured BOOLEAN DEFAULT FALSE,
    visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'unlisted')),
    
    -- Analytics and engagement
    view_count INTEGER DEFAULT 0,
    share_count INTEGER DEFAULT 0,
    
    -- Blockchain transaction data
    creation_tx_signature VARCHAR(88), -- Base58 encoded signature
    confirmation_status VARCHAR(20) DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'finalized')),
    
    -- Indexes for common queries
    CONSTRAINT valid_vote_pubkey CHECK (char_length(vote_pubkey) = 44),
    CONSTRAINT valid_creator_pubkey CHECK (char_length(creator_pubkey) = 44)
);

-- Vote participants table - tracks individual voting activity
CREATE TABLE IF NOT EXISTS vote_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vote_id UUID REFERENCES votes(id) ON DELETE CASCADE,
    voter_pubkey VARCHAR(44) NOT NULL,
    
    -- Voting details
    vote_choice VARCHAR(10), -- 'yes', 'no', or null if just viewing
    vote_power DECIMAL(18, 9), -- Amount of tokens used to vote
    
    -- Transaction data
    vote_tx_signature VARCHAR(88), -- Transaction that recorded the vote
    
    -- Timestamps
    participated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate votes per user per vote
    UNIQUE(vote_id, voter_pubkey),
    
    CONSTRAINT valid_voter_pubkey CHECK (char_length(voter_pubkey) = 44),
    CONSTRAINT valid_vote_choice CHECK (vote_choice IN ('yes', 'no') OR vote_choice IS NULL)
);

-- Vote analytics table - for tracking engagement metrics
CREATE TABLE IF NOT EXISTS vote_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vote_id UUID REFERENCES votes(id) ON DELETE CASCADE,
    
    -- Daily aggregated stats
    date DATE NOT NULL,
    new_participants INTEGER DEFAULT 0,
    total_views INTEGER DEFAULT 0,
    total_shares INTEGER DEFAULT 0,
    
    -- Vote choice distribution for the day
    yes_votes_added INTEGER DEFAULT 0,
    no_votes_added INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(vote_id, date)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_votes_status ON votes(status);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_creator ON votes(creator_pubkey);
CREATE INDEX IF NOT EXISTS idx_votes_category ON votes(category);
CREATE INDEX IF NOT EXISTS idx_votes_featured ON votes(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_votes_pubkey ON votes(vote_pubkey);

CREATE INDEX IF NOT EXISTS idx_participants_vote_id ON vote_participants(vote_id);
CREATE INDEX IF NOT EXISTS idx_participants_voter ON vote_participants(voter_pubkey);
CREATE INDEX IF NOT EXISTS idx_participants_choice ON vote_participants(vote_choice);

CREATE INDEX IF NOT EXISTS idx_analytics_vote_date ON vote_analytics(vote_id, date);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
CREATE TRIGGER update_votes_updated_at 
    BEFORE UPDATE ON votes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update total_participants count
CREATE OR REPLACE FUNCTION update_vote_participants_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE votes 
        SET total_participants = (
            SELECT COUNT(*) FROM vote_participants 
            WHERE vote_id = NEW.vote_id AND vote_choice IS NOT NULL
        ),
        unique_voters = (
            SELECT array_agg(DISTINCT voter_pubkey) 
            FROM vote_participants 
            WHERE vote_id = NEW.vote_id
        )
        WHERE id = NEW.vote_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE votes 
        SET total_participants = (
            SELECT COUNT(*) FROM vote_participants 
            WHERE vote_id = OLD.vote_id AND vote_choice IS NOT NULL
        ),
        unique_voters = (
            SELECT array_agg(DISTINCT voter_pubkey) 
            FROM vote_participants 
            WHERE vote_id = OLD.vote_id
        )
        WHERE id = OLD.vote_id;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        UPDATE votes 
        SET total_participants = (
            SELECT COUNT(*) FROM vote_participants 
            WHERE vote_id = NEW.vote_id AND vote_choice IS NOT NULL
        ),
        unique_voters = (
            SELECT array_agg(DISTINCT voter_pubkey) 
            FROM vote_participants 
            WHERE vote_id = NEW.vote_id
        )
        WHERE id = NEW.vote_id;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ language 'plpgsql';

-- Trigger to automatically update participant counts
CREATE TRIGGER update_vote_participants_count_trigger
    AFTER INSERT OR UPDATE OR DELETE ON vote_participants
    FOR EACH ROW
    EXECUTE FUNCTION update_vote_participants_count();