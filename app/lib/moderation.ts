import { supabase } from '../services/supabase';

// Blocking and reporting (App Store Guideline 1.2). Blocks are enforced
// server-side too: messages RLS, a follows guard trigger, and the push
// functions all check blocked_users — this lib is the client surface.

export const REPORT_REASONS = [
  'Harassment or hate',
  'Spam',
  'Impersonation',
  'Inappropriate content',
  'Something else',
] as const;

export async function fetchIsBlocked(myId: string, otherId: string): Promise<boolean> {
  const { data } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', myId)
    .eq('blocked_id', otherId)
    .maybeSingle();
  return Boolean(data);
}

export async function fetchBlockedIds(myId: string): Promise<Set<string>> {
  const { data } = await supabase
    .from('blocked_users')
    .select('blocked_id')
    .eq('blocker_id', myId);
  return new Set((data ?? []).map((row) => row.blocked_id as string));
}

export async function blockUser(myId: string, otherId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .upsert({ blocker_id: myId, blocked_id: otherId }, { onConflict: 'blocker_id,blocked_id' });
  if (error) throw error;
}

export async function unblockUser(myId: string, otherId: string): Promise<void> {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', myId)
    .eq('blocked_id', otherId);
  if (error) throw error;
}

export async function reportSubject(
  reporterId: string,
  subjectType: 'user' | 'conversation' | 'message',
  subjectId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.from('moderation_reports').insert({
    reporter_id: reporterId,
    subject_type: subjectType,
    subject_id: subjectId,
    reason,
  });
  if (error) throw error;
}
