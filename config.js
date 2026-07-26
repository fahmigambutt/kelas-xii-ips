import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.8?bundle';

export const APP_VERSION = '1.0.0';
export const DEFAULT_ASSETS = Object.freeze({
  background: './assets/defaults/default-background.webp',
  avatar: './assets/defaults/default-avatar.webp',
  logo: './assets/defaults/default-logo.webp',
  gallery: './assets/placeholders/gallery-placeholder.webp'
});

export let runtimeConfig = Object.freeze({ configured: false, supabaseUrl: '', supabaseAnonKey: '' });
export let supabaseClient = null;

export async function initializeConfig() {
  let responseConfig = null;
  try {
    const response = await fetch('/api/config', { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (response.ok) responseConfig = await response.json();
  } catch (error) {
    console.info('Endpoint konfigurasi belum tersedia. Website berjalan dalam mode demo lokal.', error?.message || error);
  }

  const injected = globalThis.XII_IPS_CONFIG || {};
  const supabaseUrl = responseConfig?.supabaseUrl || injected.supabaseUrl || '';
  const supabaseAnonKey = responseConfig?.supabaseAnonKey || injected.supabaseAnonKey || '';
  const configured = Boolean(supabaseUrl && supabaseAnonKey);

  runtimeConfig = Object.freeze({ configured, supabaseUrl, supabaseAnonKey });
  if (configured) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      },
      realtime: { params: { eventsPerSecond: 4 } }
    });
  }
  return runtimeConfig;
}

export function assertSupabase() {
  if (!supabaseClient) throw new Error('Supabase belum dikonfigurasi. Isi environment variables lalu jalankan melalui Vercel.');
  return supabaseClient;
}
