import { supabase } from './supabase';
import type { Database } from '../types/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];

const STORAGE_KEY = 'techsync_user';

function pickDisplayName(meta: Record<string, unknown>): string | null {
  const full =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    '';
  return full || null;
}

function pickAvatarUrl(meta: Record<string, unknown>): string | null {
  const u =
    (typeof meta.avatar_url === 'string' && meta.avatar_url.trim()) ||
    (typeof meta.picture === 'string' && meta.picture.trim()) ||
    '';
  return u || null;
}

/**
 * Ensures `users` and `profiles` rows exist for the current Supabase session user,
 * and syncs Google OAuth `full_name` / `avatar_url` (from user_metadata) into `profiles`
 * (and `users.full_name` when provided).
 */
export async function ensureAppUserAndProfileFromSession(): Promise<UserRow | null> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();
  if (sessionError || !session?.user) {
    return null;
  }

  const authUser = session.user;
  const meta = (authUser.user_metadata ?? {}) as Record<string, unknown>;
  const displayName = pickDisplayName(meta);
  const avatarUrl = pickAvatarUrl(meta);
  const email = (authUser.email ?? '').trim();
  if (!email) {
    return null;
  }

  const { data: existingUser, error: fetchUserErr } = await supabase
    .from('users')
    .select('*')
    .eq('user_id', authUser.id)
    .maybeSingle();

  if (fetchUserErr) {
    console.error('ensureSession: users fetch', fetchUserErr);
    return null;
  }

  let userRow = existingUser as UserRow | null;

  if (!userRow) {
    const displayOrEmail =
      displayName ?? (email.includes('@') ? email.split('@')[0] : email) ?? 'User';
    const { data: inserted, error: insErr } = await supabase
      .from('users')
      .insert({
        user_id: authUser.id,
        full_name: displayOrEmail,
        email,
        role: 'Student',
        password_hash: '',
      } as never)
      .select()
      .single();
    if (insErr) {
      console.error('ensureSession: users insert', insErr);
      return null;
    }
    userRow = inserted as UserRow;
  } else if (displayName && (userRow.full_name ?? '').trim() !== displayName) {
    const { data: updated, error: upErr } = await supabase
      .from('users')
      .update({ full_name: displayName } as never)
      .eq('user_id', authUser.id)
      .select()
      .single();
    if (!upErr && updated) {
      userRow = updated as UserRow;
    }
  }

  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('profile_id')
    .eq('user_id', authUser.id)
    .maybeSingle();

  const profilePatch: Database['public']['Tables']['profiles']['Update'] = {};
  if (displayName) profilePatch.full_name = displayName;
  if (avatarUrl) profilePatch.avatar_url = avatarUrl;

  if (existingProfile && Object.keys(profilePatch).length > 0) {
    const { error: pErr } = await supabase
      .from('profiles')
      .update(profilePatch as never)
      .eq('user_id', authUser.id);
    if (pErr) {
      console.error('ensureSession: profiles update', pErr);
    }
  } else if (!existingProfile && (displayName || avatarUrl)) {
    const { error: pInsErr } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.id,
        full_name: displayName ?? null,
        avatar_url: avatarUrl ?? null,
      } as never);
    if (pInsErr) {
      console.error('ensureSession: profiles insert', pInsErr);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userRow));
  } catch {
    /* ignore */
  }

  return userRow;
}
