# Community Feedback System

A Reddit-style community feedback page that can be used independently across different services.

## Features

- Reddit-style interface with upvote/downvote system
- Nested comments on posts
- Service-specific filtering via `serviceName` parameter
- Independent Supabase database for feedback
- Real-time voting and commenting
- User authentication integration
- Mobile-responsive design

## Setup

### 1. Database Setup

Create a new Supabase project for feedback or use an existing one with separate tables.

Set up the following environment variables:
```bash
NEXT_PUBLIC_FEEDBACK_SUPABASE_URL=your_feedback_supabase_url
NEXT_PUBLIC_FEEDBACK_SUPABASE_ANON_KEY=your_feedback_supabase_anon_key
```

### 2. Run Database Migration

Execute the SQL in `supabase/feedback-migrations/001_create_feedback_tables.sql` in your feedback Supabase project.

### 3. Usage

```tsx
import CommunityFeedback from '@/components/community-feedback'

export default function YourPage() {
  const currentUser = {
    id: 'user-id',
    email: 'user@example.com',
    name: 'User Name'
  }

  return (
    <CommunityFeedback 
      serviceName="Your Service Name" 
      currentUser={currentUser}
    />
  )
}
```

## Props

- `serviceName`: String identifier for your service (used to filter feedback)
- `currentUser`: User object with id, email (optional), name (optional). Pass null for anonymous viewing.

## Database Schema

### feedback_posts
- `id`: UUID primary key
- `user_id`: UUID of the user
- `service_name`: Service identifier for filtering
- `title`: Post title
- `content`: Post content
- `upvotes`: Number of upvotes
- `downvotes`: Number of downvotes
- `created_at`: Timestamp
- `updated_at`: Timestamp
- `user_email`: Optional user email
- `user_name`: Optional user name

### feedback_comments
- `id`: UUID primary key
- `post_id`: Reference to feedback_posts
- `user_id`: UUID of the user
- `content`: Comment content
- `upvotes`: Number of upvotes
- `downvotes`: Number of downvotes
- `created_at`: Timestamp
- `user_email`: Optional user email
- `user_name`: Optional user name

### feedback_votes
- `id`: UUID primary key
- `user_id`: UUID of the user
- `post_id`: Reference to feedback_posts (nullable)
- `comment_id`: Reference to feedback_comments (nullable)
- `vote_type`: 'upvote' or 'downvote'
- `created_at`: Timestamp

## Integration with Other Websites

This component is designed to be completely independent. To use it in other projects:

1. Copy the following files:
   - `components/community-feedback.tsx`
   - `lib/feedback-supabase.ts`
   - `supabase/feedback-migrations/001_create_feedback_tables.sql`

2. Install dependencies:
   ```bash
   npm install @supabase/supabase-js date-fns
   ```

3. Set up environment variables for the feedback database

4. Use the component with your service-specific `serviceName`

The component will automatically filter and display only feedback for your specific service.