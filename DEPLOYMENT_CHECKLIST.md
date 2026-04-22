# Praxis v2 Deployment Checklist

## Current Status
- iOS app building via EAS (Build ID: 7fecb334-faf0-466b-bfaf-5f7873848285)
- Updates disabled in app.json ✓

## Step 1: Wait for iOS Build to Complete
Monitor progress:
```bash
eas build --status --build-id 7fecb334-faf0-466b-bfaf-5f7873848285
```

Expected time: 30-45 minutes on free tier.

## Step 2: Submit to TestFlight (once build FINISHED)
```bash
eas submit --platform ios --latest
```

This uploads the IPA to App Store Connect. Version will be 2.0.0, build number 2.

## Step 3: Deploy Supabase Migrations
```bash
cd /Users/michaelcrystal/Desktop/merge/praxis-v2
supabase db push
```

This deploys:
- push_tokens table
- likes table
- comments table  
- messages table
- ai_insights cache table
- increment_articles_read RPC
- update_reading_streak RPC
- user_badges table
- RLS policies on all tables

## Step 4: Set OpenAI API Key
```bash
supabase secrets set OPENAI_API_KEY=sk-...
```

Get API key from your OpenAI account at https://platform.openai.com/api-keys

## Step 5: Deploy Edge Functions
```bash
supabase functions deploy ai-insights
supabase functions deploy notify-follower
supabase functions deploy notify-message
supabase functions deploy award-badge
```

## Step 6: Verify in App Store Connect
1. Go to https://appstoreconnect.apple.com
2. Select Praxis → TestFlight
3. Wait for app processing (5-10 minutes)
4. Invite testers (internal or external)

## Step 7: Monitor for Issues
Check:
- App launches without SIGABRT crash ✓
- Feed loads articles ✓
- Swipe to explore works ✓
- Likes/comments work ✓
- Push notifications trigger ✓
- Chat works (Realtime) ✓
- Reading streaks count ✓
- Badges award correctly ✓

## Troubleshooting

### Build stuck in queue
Free tier queues can be slow. Use `/eas-cli` dashboard to check queue position.

### App crashes on launch
- Check app logs in TestFlight → Diagnostics
- Should NOT have SIGABRT from Expo Updates (disabled)
- Check Supabase Auth status

### Notifications not sending
- Verify push_tokens table populated
- Check Edge Functions logs in Supabase dashboard
- Verify Expo certificates in eas.json

### AI insights not working
- Set OPENAI_API_KEY (Step 4)
- Check ai-insights function logs
- Verify cache is working in ai_insights table

## Important Notes
- App uses Expo Router deep linking (praxis://)
- All RLS policies enforce user isolation
- Chat uses Realtime subscriptions (messages table)
- Badge notifications trigger via edge function
- Push tokens stored per device + user + platform
