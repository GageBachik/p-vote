# DegenVote Database Layer

Complete database layer for the DegenVote application with Neon PostgreSQL integration.

## Features

- ✅ **Vote Management**: Create, read, update, delete votes with blockchain integration
- ✅ **Participant Tracking**: Track users who vote with blockchain transaction references
- ✅ **Analytics**: Comprehensive engagement and participation analytics
- ✅ **Filtering & Search**: Advanced filtering, sorting, and search capabilities
- ✅ **Pagination**: Efficient pagination for large datasets
- ✅ **Real-time Tracking**: View counts, share tracking, and engagement metrics

## Database Schema

### Tables

1. **`votes`** - Main votes table
   - Stores vote metadata, creator info, content, and engagement metrics
   - Links to blockchain via `vote_pubkey` and `token_address`

2. **`vote_participants`** - Participant tracking
   - Many-to-many relationship between votes and users
   - Tracks vote choices, transaction signatures, and participation timestamps

3. **`vote_analytics`** - Daily aggregated analytics
   - Engagement metrics, view counts, participation trends
   - Optimized for analytics queries and reporting

## Setup

### 1. Environment Configuration

Copy `.env.example` to `.env.local` and configure:

```bash
cp .env.example .env.local
```

Add your Neon database connection string:

```env
DATABASE_URL="postgresql://username:password@hostname/database?sslmode=require"
```

### 2. Database Initialization

Initialize the database schema:

```bash
curl -X POST http://localhost:3000/api/db/init
```

Or check initialization status:

```bash
curl http://localhost:3000/api/db/init
```

### 3. Health Check

Verify the database connection:

```bash
curl http://localhost:3000/api/health
```

## API Endpoints

### Votes

#### Create Vote
```http
POST /api/votes
Content-Type: application/json

{
  "vote_pubkey": "11111111111111111111111111111111111111111111",
  "creator_pubkey": "22222222222222222222222222222222222222222222",
  "title": "Should we implement feature X?",
  "description": "This vote is about implementing feature X...",
  "category": "development",
  "tags": ["feature", "development"],
  "blockchain_end_time": "2024-12-31T23:59:59Z",
  "visibility": "public"
}
```

#### Get Votes (with filtering)
```http
GET /api/votes?status=active&category=development&limit=20&page=1
```

Query parameters:
- `status`: `pending`, `active`, `ended`, `cancelled`
- `category`: Any category string
- `creator_pubkey`: Filter by creator
- `is_featured`: `true`/`false`
- `visibility`: `public`, `private`, `unlisted`
- `search`: Search in title/description
- `tags`: Comma-separated tags
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `sort_by`: `created_at`, `updated_at`, `total_participants`, `view_count`
- `sort_order`: `asc`, `desc`

#### Get Single Vote
```http
GET /api/votes/{id}?include_participants=true&track_view=true
```

#### Update Vote
```http
PUT /api/votes/{id}
Content-Type: application/json

{
  "status": "ended",
  "is_featured": true
}
```

#### Delete Vote
```http
DELETE /api/votes/{id}
```

### Participants

#### Add Participant
```http
POST /api/votes/{vote_id}/participants
Content-Type: application/json

{
  "voter_pubkey": "33333333333333333333333333333333333333333333",
  "vote_choice": "yes",
  "vote_power": 100.5,
  "vote_tx_signature": "transaction_signature_here"
}
```

#### Get Participants
```http
GET /api/votes/{vote_id}/participants?limit=100&include_counts=true
```

### Analytics

#### Vote Analytics
```http
GET /api/votes/{vote_id}/analytics?days_back=30&summary=true
```

#### Track Share
```http
POST /api/votes/{vote_id}/analytics
Content-Type: application/json

{
  "action": "share"
}
```

#### Platform Analytics
```http
GET /api/analytics?days_back=30&include_voters=true
```

### Special Endpoints

#### Featured Votes
```http
GET /api/votes/featured?limit=10
```

#### Trending Votes
```http
GET /api/votes/trending?limit=10&use_analytics=true
```

## Database Functions

### Vote Operations

```typescript
import { 
  createVote, 
  getVotes, 
  getVoteById,
  updateVote,
  deleteVote 
} from '@/app/lib/db/votes';

// Create a vote
const vote = await createVote({
  vote_pubkey: "...",
  creator_pubkey: "...",
  title: "Vote title",
  // ... other fields
});

// Get votes with filtering
const result = await getVotes(
  { status: 'active', category: 'development' },
  { page: 1, limit: 20, sort_by: 'created_at' }
);
```

### Participant Operations

```typescript
import { 
  addParticipant, 
  getParticipantsByVote,
  hasUserVoted 
} from '@/app/lib/db/participants';

// Add participant
const participant = await addParticipant({
  vote_id: "...",
  voter_pubkey: "...",
  vote_choice: "yes",
  vote_power: 100
});

// Check if user voted
const hasVoted = await hasUserVoted(vote_id, voter_pubkey);
```

### Analytics Operations

```typescript
import { 
  trackVoteView,
  trackVoteShare,
  getVoteAnalytics 
} from '@/app/lib/db/analytics';

// Track engagement
await trackVoteView(vote_id);
await trackVoteShare(vote_id);

// Get analytics
const analytics = await getVoteAnalytics(vote_id, 30);
```

## Data Flow

### Creating a Vote

1. **Frontend**: User creates vote through UI
2. **Blockchain**: Vote transaction submitted to Solana
3. **API**: `POST /api/votes` called after blockchain confirmation
4. **Database**: Vote metadata stored with `vote_pubkey` reference
5. **Analytics**: Creation event tracked

### Participating in Vote

1. **Frontend**: User submits vote choice
2. **Blockchain**: Voting transaction on Solana
3. **API**: `POST /api/votes/{id}/participants` after confirmation
4. **Database**: Participation recorded with transaction reference
5. **Analytics**: Participation metrics updated automatically

### Real-time Updates

- View tracking: Automatic on vote page visits
- Share tracking: Manual via analytics API
- Participant counts: Updated via database triggers
- Daily analytics: Aggregated automatically

## Performance Considerations

### Indexing
- All foreign keys are indexed
- Common query patterns have composite indexes
- Pagination queries are optimized

### Caching Strategies
- Analytics data suitable for caching (daily aggregations)
- Featured/trending votes can be cached short-term
- Individual vote data cache with invalidation on updates

### Scaling
- Database supports connection pooling via Neon
- Analytics table can be partitioned by date if needed
- Participant tracking scales horizontally

## Security

### Data Validation
- All pubkeys validated for correct format (44 characters, Base58)
- SQL injection prevention via parameterized queries
- Input sanitization on all user data

### Access Control
- No authentication implemented (relies on wallet signatures)
- Rate limiting can be added at API gateway level
- Database access restricted to application layer

## Monitoring

### Health Checks
```bash
# Database health
curl http://localhost:3000/api/health

# Initialization status
curl http://localhost:3000/api/db/init
```

### Metrics to Monitor
- Database connection pool usage
- Query performance (especially analytics queries)
- API response times
- Error rates by endpoint

## Deployment

### Environment Variables
```env
DATABASE_URL="postgresql://..."
NEXT_PUBLIC_APP_URL="https://your-domain.com"
```

### Database Migration
The schema is designed to be applied incrementally. For production:

1. Run schema initialization via API
2. Verify all tables and indexes are created
3. Test with sample data
4. Monitor performance and adjust as needed

## Troubleshooting

### Common Issues

1. **Connection Errors**: Check DATABASE_URL format and credentials
2. **Schema Errors**: Ensure PostgreSQL version supports arrays and UUID
3. **Performance**: Monitor slow queries and add indexes as needed

### Debug Queries
```sql
-- Check vote counts
SELECT status, COUNT(*) FROM votes GROUP BY status;

-- Check recent activity
SELECT DATE(created_at), COUNT(*) FROM votes 
WHERE created_at > NOW() - INTERVAL '7 days' 
GROUP BY DATE(created_at);

-- Check analytics data
SELECT vote_id, SUM(total_views), SUM(new_participants) 
FROM vote_analytics 
GROUP BY vote_id 
ORDER BY SUM(new_participants) DESC;
```