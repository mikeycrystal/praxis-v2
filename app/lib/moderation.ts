import { supabase } from '../services/supabase';

export const REPORT_REASONS = ['spam', 'harassment', 'hate', 'violence', 'impersonation', 'other'] as const;
export type ReportReason = typeof REPORT_REASONS[number];
export type ReportTarget = { targetUserId: string; targetType: 'message' | 'profile'; targetId?: string | number | null };

type BlockListener = (ids: Set<string>) => void;
const blockedCache = new Map<string, Set<string>>();
const listeners = new Map<string, Set<BlockListener>>();

function publish(userId: string, ids: Set<string>) {
  blockedCache.set(userId, ids);
  listeners.get(userId)?.forEach((listener) => listener(new Set(ids)));
}

/** Refreshes the current user's block list and keeps one in-memory copy for all screens.
 * Never throws: on a failed fetch it degrades to the cached set (or an empty one), so a
 * network blip filters nothing rather than wedging every caller's loading state. */
export async function fetchBlockedIds(userId: string, refresh = false): Promise<Set<string>> {
  if (!refresh && blockedCache.has(userId)) return new Set(blockedCache.get(userId));
  const { data, error } = await supabase.from('blocked_users').select('blocked_id').eq('blocker_id', userId);
  if (error) {
    console.warn('[moderation] Failed to fetch block list', error);
    return new Set(blockedCache.get(userId) ?? []);
  }
  const ids = new Set((data ?? []).map((row) => String(row.blocked_id)));
  publish(userId, ids);
  return new Set(ids);
}

export function subscribeBlockedIds(userId: string, listener: BlockListener) {
  const userListeners = listeners.get(userId) ?? new Set<BlockListener>();
  userListeners.add(listener);
  listeners.set(userId, userListeners);
  const cached = blockedCache.get(userId);
  if (cached) listener(new Set(cached));
  return () => {
    userListeners.delete(listener);
    if (userListeners.size === 0) listeners.delete(userId);
  };
}

export async function fetchIsBlocked(myId: string, otherId: string): Promise<boolean> {
  return (await fetchBlockedIds(myId)).has(otherId);
}

export async function blockUser(myId: string, otherId: string): Promise<void> {
  const { error } = await supabase.from('blocked_users').upsert(
    { blocker_id: myId, blocked_id: otherId }, { onConflict: 'blocker_id,blocked_id' },
  );
  if (error) throw error;
  // The database trigger protects this too; this removes both edges immediately.
  const { error: followsError } = await supabase.from('follows').delete().or(
    `and(follower_id.eq.${myId},following_id.eq.${otherId}),and(follower_id.eq.${otherId},following_id.eq.${myId})`,
  );
  if (followsError) throw followsError;
  await fetchBlockedIds(myId, true);
}

export async function unblockUser(myId: string, otherId: string): Promise<void> {
  const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', myId).eq('blocked_id', otherId);
  if (error) throw error;
  await fetchBlockedIds(myId, true);
}

export async function submitReport(reporterId: string, target: ReportTarget, reason: ReportReason, details?: string): Promise<void> {
  const { error } = await supabase.from('moderation_reports').insert({
    reporter_id: reporterId,
    target_user_id: target.targetUserId,
    target_type: target.targetType,
    target_id: target.targetType === 'message' && target.targetId != null ? String(target.targetId) : null,
    reason,
    details: details?.trim() || null,
  });
  if (error) throw error;
}
