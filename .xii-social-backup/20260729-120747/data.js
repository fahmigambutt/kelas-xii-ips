import { DEFAULT_ASSETS, runtimeConfig, supabaseClient } from './config.js';
import { getAuthState } from './auth.js';

export const GALLERY_CATEGORIES = [
  'Study Tour', 'Class Meeting', '17 Agustus', 'Pentas Seni', 'Bukber', 'Perpisahan', 'Kegiatan Sekolah', 'Random Moment'
];

const fixedIds = {
  site: '00000000-0000-4000-8000-000000000001',
  about: '00000000-0000-4000-8000-000000000002',
  background: '00000000-0000-4000-8000-000000000003'
};

function demoStructure() {
  const positions = ['Wali Kelas','Ketua Kelas','Wakil Ketua','Sekretaris 1','Sekretaris 2','Bendahara 1','Bendahara 2','Koordinator Kebersihan','Koordinator Keamanan','Koordinator Dokumentasi','Koordinator Peralatan'];
  return positions.map((position, index) => ({
    id: `demo-structure-${index + 1}`,
    name: index === 0 ? 'Nama Wali Kelas' : `Pengurus ${String(index).padStart(2,'0')}`,
    position,
    description: 'Siap bekerja sama dan menjaga kekompakan kelas.',
    photo_url: DEFAULT_ASSETS.avatar,
    sort_order: index + 1
  }));
}

function demoMembers() {
  return Array.from({ length: 30 }, (_, index) => ({
    id: `demo-member-${index + 1}`,
    attendance_number: index + 1,
    full_name: `Anggota ${String(index + 1).padStart(2, '0')}`,
    birth_place: 'Kota Kelahiran',
    birth_date: null,
    instagram: `anggota${String(index + 1).padStart(2, '0')}`,
    bio: 'Salah satu bagian penting dari keluarga XII IPS.',
    hobbies: 'Belajar, musik, dan olahraga',
    ambition: 'Meraih masa depan terbaik',
    quote: 'Terus bertumbuh dan jangan takut mencoba.',
    position: '',
    photo_url: DEFAULT_ASSETS.avatar
  }));
}

function demoGallery() {
  return GALLERY_CATEGORIES.map((category, index) => ({
    id: `demo-gallery-${index + 1}`,
    title: category,
    caption: `Dokumentasi kegiatan ${category} XII IPS.`,
    category,
    event_date: null,
    image_url: index % 2 ? DEFAULT_ASSETS.gallery : DEFAULT_ASSETS.background,
    sort_order: index + 1
  }));
}

export const fallbackData = Object.freeze({
  site_settings: {
    id: fixedIds.site,
    site_name: 'XII IPS — Official Class Website',
    class_name: 'XII IPS',
    welcome_text: 'WELCOME XII IPS',
    motto: 'Bersama tumbuh, bersama mengukir cerita.',
    generation: 'Angkatan 2026',
    description: 'Ruang digital untuk menyimpan cerita, karya, persahabatan, dan kenangan terbaik keluarga XII IPS.',
    logo_url: DEFAULT_ASSETS.logo,
    closing_text: 'Terima kasih telah menjadi bagian dari XII IPS.',
    closing_quote: '“Yang selesai hanyalah masa sekolahnya, bukan persahabatannya.”',
    accent_color: '#6aa9ff',
    theme_color: '#08101d',
    animation_duration: 700,
    loading_enabled: true,
    loading_duration: 3400,
    music_enabled: false,
    audio_url: '',
    music_volume: 0.35,
    parallax_enabled: true,
    particles_enabled: true,
    mouse_light_enabled: true,
    reveal_enabled: true
  },
  about: {
    id: fixedIds.about,
    history: 'XII IPS adalah keluarga belajar yang tumbuh melalui kerja sama, keberanian, dan kepedulian.',
    vision: 'Menjadi kelas yang solid, berprestasi, berkarakter, dan saling mendukung.',
    mission: 'Belajar konsisten, menjaga kekompakan, menghargai perbedaan, dan menciptakan kenangan positif.',
    goals: 'Membentuk lingkungan kelas yang aman, produktif, kreatif, dan menyenangkan.',
    expectations: 'Semoga setiap anggota tumbuh menjadi pribadi yang bermanfaat dan tetap terhubung setelah lulus.',
    achievements: 'Prestasi akademik, organisasi, olahraga, seni, dan berbagai kontribusi positif di sekolah.',
    quote: '“Kelas bukan hanya tempat belajar, tetapi tempat kita bertumbuh bersama.”'
  },
  background_settings: {
    id: fixedIds.background,
    image_url: DEFAULT_ASSETS.background,
    blur: 16,
    brightness: 65,
    overlay: 35,
    position: 'center',
    scale: 108
  },
  labels: {
    about_title: 'Tentang XII IPS',
    structure_title: 'Struktur Organisasi XII IPS',
    members_title: 'Anggota XII IPS',
    gallery_title: 'Galeri Kenangan'
  },
  structure_members: demoStructure(),
  class_members: demoMembers(),
  gallery: demoGallery()
});

let appData = structuredClone(fallbackData);
const listeners = new Set();
let realtimeChannel = null;

export function getData() { return appData; }
export function setData(nextData, reason = 'DATA_UPDATED') {
  appData = nextData;
  listeners.forEach((listener) => listener(appData, reason));
  document.dispatchEvent(new CustomEvent('xii:data', { detail: { data: appData, reason } }));
}
export function subscribeData(listener) { listeners.add(listener); return () => listeners.delete(listener); }

function safeSingle(result, fallback) {
  if (result.status === 'fulfilled' && !result.value.error && result.value.data) return result.value.data;
  return structuredClone(fallback);
}
function safeArray(result, fallback) {
  if (result.status === 'fulfilled' && !result.value.error && Array.isArray(result.value.data)) return result.value.data;
  return structuredClone(fallback);
}

export async function loadPublicData() {
  if (!runtimeConfig.configured || !supabaseClient) {
    setData(structuredClone(fallbackData), 'DEMO_DATA');
    return appData;
  }
  const queries = await Promise.allSettled([
    supabaseClient.from('site_settings').select('*').limit(1).maybeSingle(),
    supabaseClient.from('about').select('*').limit(1).maybeSingle(),
    supabaseClient.from('background_settings').select('*').limit(1).maybeSingle(),
    supabaseClient.from('content_labels').select('*').limit(1).maybeSingle(),
    supabaseClient.from('structure_members').select('*').order('sort_order', { ascending: true }),
    supabaseClient.from('class_members').select('*').order('attendance_number', { ascending: true }),
    supabaseClient.from('gallery').select('*').order('sort_order', { ascending: true })
  ]);
  const next = {
    site_settings: { ...fallbackData.site_settings, ...safeSingle(queries[0], fallbackData.site_settings) },
    about: { ...fallbackData.about, ...safeSingle(queries[1], fallbackData.about) },
    background_settings: { ...fallbackData.background_settings, ...safeSingle(queries[2], fallbackData.background_settings) },
    labels: { ...fallbackData.labels, ...safeSingle(queries[3], fallbackData.labels) },
    structure_members: safeArray(queries[4], fallbackData.structure_members),
    class_members: safeArray(queries[5], fallbackData.class_members),
    gallery: safeArray(queries[6], fallbackData.gallery)
  };
  setData(next, 'REMOTE_DATA');
  return next;
}

export function startRealtimeSync() {
  if (!supabaseClient || realtimeChannel) return;
  realtimeChannel = supabaseClient.channel('xii-ips-content')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'site_settings' }, () => loadPublicData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'about' }, () => loadPublicData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'background_settings' }, () => loadPublicData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'content_labels' }, () => loadPublicData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'structure_members' }, () => loadPublicData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'class_members' }, () => loadPublicData())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'gallery' }, () => loadPublicData())
    .subscribe();
}

export function stopRealtimeSync() {
  if (realtimeChannel && supabaseClient) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = null;
}

function sanitizePayload(table, payload) {
  const omit = new Set(['created_at', 'updated_at', 'updated_by']);
  const clean = Object.fromEntries(Object.entries(payload).filter(([key, value]) => !omit.has(key) && value !== undefined));
  if (table === 'class_members') clean.attendance_number = Number(clean.attendance_number);
  if (['structure_members','gallery'].includes(table)) clean.sort_order = Number(clean.sort_order);
  return clean;
}

export async function saveChangeSet(changeSet) {
  if (!supabaseClient) throw new Error('Supabase belum dikonfigurasi.');
  const auth = getAuthState();
  if (!auth.canEdit) throw new Error('Sesi tidak memiliki izin edit.');

  const order = ['site_settings','about','background_settings','content_labels','structure_members','class_members','gallery'];
  for (const table of order) {
    const upserts = changeSet.upserts?.[table] || [];
    const deletes = changeSet.deletes?.[table] || [];
    if (upserts.length) {
      const rows = upserts.map((row) => sanitizePayload(table, row));
      const { error } = await supabaseClient.from(table).upsert(rows).select();
      if (error) throw new Error(`${table}: ${error.message}`);
    }
    if (deletes.length) {
      const { error } = await supabaseClient.from(table).delete().in('id', deletes);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  }
  await loadPublicData();
}

export async function fetchUsers() {
  const response = await authorizedFetch('/api/users/list');
  return response.users || [];
}
export async function createUserAccount(payload) { return authorizedFetch('/api/users/create', { method:'POST', body:JSON.stringify(payload) }); }
export async function updateUserAccount(payload) { return authorizedFetch('/api/users/update', { method:'PATCH', body:JSON.stringify(payload) }); }
export async function disableUserAccount(id) { return authorizedFetch('/api/users/disable', { method:'POST', body:JSON.stringify({ id }) }); }
export async function enableUserAccount(id) { return authorizedFetch('/api/users/enable', { method:'POST', body:JSON.stringify({ id }) }); }
export async function deleteUserAccount(id) { return authorizedFetch('/api/users/delete', { method:'DELETE', body:JSON.stringify({ id }) }); }
export async function fetchAuditLogs() { const response = await authorizedFetch('/api/audit/list'); return response.logs || []; }

async function authorizedFetch(url, options = {}) {
  const token = getAuthState().session?.access_token;
  if (!token) throw new Error('Sesi berakhir. Silakan login kembali.');
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type':'application/json', Accept:'application/json', Authorization:`Bearer ${token}`, ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Permintaan gagal.');
  return data;
}
