# Post-Build Deployment Guide for Praxis v2

## When the iOS Build Completes

The cron job will detect completion and report it. The build log will show one of:
- `Build complete` / `Download link` → **Success** ✓
- `Build failed` / `error` → **Failure** ✗

## Immediate: Submit to TestFlight (Build ID: 7fecb334-faf0-466b-bfaf-5f7873848285)

Once the build completes:

```bash
cd /Users/michaelcrystal/Desktop/merge/praxis-v2
eas submit --platform ios --latest
```

This will:
- Upload the IPA to App Store Connect
- Version 2.0.0, Build 85
- Requires ~5-10 minutes for processing
- You can track progress in App Store Connect → Praxis → TestFlight

## Setup: Deploy Supabase Infrastructure

### Step 1: Deploy Database Migrations

```bash
cd /Users/michaelcrystal/Desktop/merge/praxis-v2
supabase db push
```

This creates:
- `push_tokens` - Device registration for notifications
- `likes` - Article likes  
- `comments` - Article comments
- `messages` - Chat messages (Realtime)
- `ai_insights` - AI analysis cache
- All RLS policies for user isolation
- Database functions: `increment_articles_read()`, `update_reading_streak()`
- `user_badges` table for gamification

**Project**: cglrznkcrgwalnwzkhfj

### Step 2: Configure OpenAI API Key

```bash
supabase secrets set OPENAI_API_KEY=sk-YOUR_KEY_HERE
```

Get your key from: https://platform.openai.com/api-keys

Without this, the `ai-insights` Edge Function will fail.

### Step 3: Deploy Edge Functions

```bash
# Deploy all 4 functions
supabase functions deploy ai-insights
supabase functions deploy notify-follower
supabase functions deploy notify-message
supabase functions deploy award-badge
```

**Function Details:**

1. **ai-insights** (`POST /ai-insights`)
   - Input: `{ articleId: number }`
   - Calls OpenAI gpt-4o-mini with article content
   - Returns: summary, keyPoints, sentiment, credibilityScore, entities, relatedTopics
   - Caches results in `ai_insights` table

2. **notify-follower** (Webhook trigger on `profiles` INSERT)
   - Triggered when user is followed
   - Sends Expo push notification to new followee
   - Requires Expo credentials (already configured)

3. **notify-message** (`POST /notify-message`)
   - Input: `{ senderId, recipientId, messageBody }`
   - Sends Expo push notification to message recipient
   - Called from chat screen

4. **award-badge** (`POST /award-badge`)
   - Input: `{ userId: string }`
   - Checks 9 badge conditions:
     - Reads: 10, 50, 100, 500 articles
     - Streak: 7, 30, 365 days
     - Followers: 10, 100
   - Inserts new badges in `user_badges`
   - Sends push notifications

## Testing: Invite TestFlight Testers

### In App Store Connect:
1. Go to Praxis → TestFlight
2. Wait for app processing (5-10 minutes after submission)
3. Click "+" to add testers
4. Select testers or email addresses
5. Send invitation link

### Test Checklist:
- [ ] App launches (should NOT crash with SIGABRT from Expo Updates)
- [ ] Feed displays articles
- [ ] Swipe left/right works
- [ ] Article detail loads
- [ ] Likes/comments work
- [ ] Search works
- [ ] Profile editing works
- [ ] Push notifications receive (follow, message, badge)
- [ ] Chat (Realtime) works
- [ ] Reading streak increments
- [ ] Badges award correctly
- [ ] AI analysis loads (give it 2-3 seconds)

## Troubleshooting

### App Crashes on Launch
**Symptom:** SIGABRT from ErrorRecovery.swift  
**Fix:** Already applied in app.json (`"updates": { "enabled": false }`)  
**If still crashing:** Check TestFlight → Diagnostics for detailed crash logs

### Notifications Not Sending
**Check:**
```sql
-- Verify push tokens registered
SELECT user_id, token, platform, created_at FROM push_tokens ORDER BY created_at DESC;

-- Check Edge Function logs in Supabase dashboard
-- Dashboard → Functions → notify-follower/notify-message → Logs
```

### AI Insights Not Working
**Check:**
```bash
# Verify OpenAI key is set
supabase secrets list

# Check function logs
supabase functions logs ai-insights

# Test the function manually
curl -X POST https://cglrznkcrgwalnwzkhfj.supabase.co/functions/v1/ai-insights \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"articleId": 1}'
```

### Chat Not Syncing
**Check:**
```sql
-- Verify messages table exists
SELECT COUNT(*) FROM messages;

-- Check if messages table has Realtime subscriptions enabled
-- Dashboard → Database → Realtime Replication → messages
```

## Database Verification

To verify all migrations applied correctly:

```bash
# Connect to prod database
supabase db pull

# Or manually query
supabase sql

SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
-- Should include: push_tokens, likes, comments, messages, ai_insights, user_badges
```

## Monitoring

### Supabase Dashboard
- **Database**: Check table stats and Realtime activity
- **Functions**: Monitor Edge Function logs and performance
- **Auth**: Check user signups and authentication logs
- **Storage**: Monitor if any file uploads occur

### TestFlight Metrics
- App Store Connect → Praxis → TestFlight → Metrics
- Watch for crashes, usage trends
- Note: First build is often v2.0.0 build #85

## Rollback if Needed

If Edge Function or migration causes issues:

```bash
# Rollback migrations (careful!)
supabase db reset

# Or disable a function temporarily
supabase functions delete FUNCTION_NAME

# Redeploy after fixes
supabase functions deploy FUNCTION_NAME
```

## Next Phase

After confirming TestFlight works:
1. Invite public testers
2. Monitor TestFlight Metrics for crashes
3. Fix any issues found
4. Submit to App Store for review
5. Release version 2.0.0

## Important Notes

- **Deep Linking**: Scheme is `praxis://` (configured in app.json)
- **Build Channel**: Using `production` channel for EAS
- **Auth**: Users authenticate via Supabase Auth (email + password)
- **Database Project**: cglrznkcrgwalnwzkhfj
- **EAS Project**: 6b0e82ef-a2df-4785-aa51-ad2ae216dc43
- **Bundle ID**: com.praxis.newsapp
