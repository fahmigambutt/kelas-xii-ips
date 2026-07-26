import { assertSupabase, runtimeConfig, supabaseClient } from './config.js';

const authState = {
  session: null,
  user: null,
  profile: null,
  ready: false
};

const listeners = new Set();
let unsubscribeAuth = null;

function emit(event = 'AUTH_UPDATED') {
  const snapshot = getAuthState();
  listeners.forEach((listener) => listener(snapshot, event));
  document.dispatchEvent(new CustomEvent('xii:auth', { detail: { state: snapshot, event } }));
}

export function getAuthState() {
  return {
    ...authState,
    canEdit: Boolean(authState.profile?.is_active && ['editor', 'super_admin'].includes(authState.profile?.role)),
    isSuperAdmin: Boolean(authState.profile?.is_active && authState.profile?.role === 'super_admin')
  };
}

export function subscribeAuth(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

async function fetchProfile(userId) {
  if (!supabaseClient || !userId) return null;
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, full_name, email, role, is_active, must_change_password, created_at, updated_at, last_login_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function touchLastLogin() {
  try {
    await supabaseClient?.rpc('record_client_activity', { p_action: 'login' });
  } catch (error) {
    console.warn('Audit login tidak dapat dicatat:', error?.message || error);
  }
}

async function resolveSession(session, event = 'SESSION_RESOLVED') {
  authState.session = session || null;
  authState.user = session?.user || null;
  authState.profile = null;

  if (session?.user) {
    try {
      const profile = await fetchProfile(session.user.id);
      authState.profile = profile;
      if (!profile?.is_active) {
        await supabaseClient.auth.signOut({ scope: 'local' });
        authState.session = null;
        authState.user = null;
        authState.profile = null;
        emit('ACCOUNT_DISABLED');
        return;
      }
    } catch (error) {
      console.error('Gagal memuat profil:', error);
      emit('PROFILE_ERROR');
      return;
    }
  }
  emit(event);
}

export async function initializeAuth() {
  if (!runtimeConfig.configured || !supabaseClient) {
    authState.ready = true;
    emit('DEMO_MODE');
    return getAuthState();
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error) console.warn('Gagal memulihkan sesi:', error.message);
  await resolveSession(data?.session || null, 'INITIAL_SESSION');

  const subscription = supabaseClient.auth.onAuthStateChange((event, session) => {
    queueMicrotask(async () => {
      await resolveSession(session, event);
      if (event === 'SIGNED_IN') await touchLastLogin();
    });
  });
  unsubscribeAuth = () => subscription.data.subscription.unsubscribe();
  authState.ready = true;
  emit('AUTH_READY');
  return getAuthState();
}

export async function login(email, password) {
  const client = assertSupabase();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !password) throw new Error('Email dan password wajib diisi.');
  const { data, error } = await client.auth.signInWithPassword({ email: normalizedEmail, password });
  if (error) throw new Error('Email atau password tidak benar, atau akun tidak dapat digunakan.');
  const profile = await fetchProfile(data.user.id);
  if (!profile) {
    await client.auth.signOut();
    throw new Error('Profil pengelola belum dibuat. Hubungi Super Admin.');
  }
  if (!profile.is_active) {
    await client.auth.signOut();
    throw new Error('Akun ini sedang dinonaktifkan.');
  }
  authState.session = data.session;
  authState.user = data.user;
  authState.profile = profile;
  emit('SIGNED_IN');
  return getAuthState();
}

export async function logout() {
  if (!supabaseClient) return;
  try { await supabaseClient.rpc('record_client_activity', { p_action: 'logout' }); } catch {}
  const { error } = await supabaseClient.auth.signOut();
  if (error) throw error;
  authState.session = null;
  authState.user = null;
  authState.profile = null;
  emit('SIGNED_OUT');
}

export async function requestPasswordReset(email) {
  const client = assertSupabase();
  const redirectTo = `${location.origin}${location.pathname}`;
  const { error } = await client.auth.resetPasswordForEmail(String(email || '').trim().toLowerCase(), { redirectTo });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const client = assertSupabase();
  if (String(newPassword).length < 10) throw new Error('Password minimal 10 karakter.');
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) throw error;
  const { error: rpcError } = await client.rpc('mark_password_changed');
  if (rpcError) throw rpcError;
  authState.profile = await fetchProfile(authState.user.id);
  emit('PASSWORD_CHANGED');
}

export async function updateOwnName(fullName) {
  const client = assertSupabase();
  const value = String(fullName || '').trim();
  if (value.length < 2 || value.length > 100) throw new Error('Nama harus 2–100 karakter.');
  const { error } = await client.rpc('update_own_profile_name', { p_full_name: value });
  if (error) throw error;
  authState.profile = await fetchProfile(authState.user.id);
  emit('PROFILE_UPDATED');
}

export async function getAccessToken() {
  if (!supabaseClient) return '';
  const { data } = await supabaseClient.auth.getSession();
  return data?.session?.access_token || '';
}

export function destroyAuth() {
  unsubscribeAuth?.();
  unsubscribeAuth = null;
}
