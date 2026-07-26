import { assertSupabase, DEFAULT_ASSETS } from './config.js';

const IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp']);
const AUDIO_TYPES = new Set(['audio/mpeg']);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

export function validateFile(file, kind = 'image') {
  if (!(file instanceof File)) throw new Error('File tidak valid.');
  if (kind === 'image') {
    if (!IMAGE_TYPES.has(file.type)) throw new Error('Gunakan JPG, PNG, atau WebP.');
    if (file.size > MAX_IMAGE_BYTES) throw new Error('Ukuran gambar maksimal 10 MB.');
  } else {
    if (!AUDIO_TYPES.has(file.type)) throw new Error('Audio harus berformat MP3.');
    if (file.size > MAX_AUDIO_BYTES) throw new Error('Ukuran audio maksimal 20 MB.');
  }
  if (/\.(exe|js|html?|svg|php|sh)$/i.test(file.name)) throw new Error('Jenis file tidak diizinkan.');
  return true;
}

export function previewFile(file) {
  validateFile(file, file.type.startsWith('audio/') ? 'audio' : 'image');
  return URL.createObjectURL(file);
}

export async function compressImage(file, options = {}) {
  validateFile(file, 'image');
  const maxWidth = options.maxWidth || 1920;
  const maxHeight = options.maxHeight || 1920;
  const quality = options.quality || 0.82;
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxWidth / bitmap.width, maxHeight / bitmap.height);
  const width = Math.max(1, Math.round(bitmap.width * ratio));
  const height = Math.max(1, Math.round(bitmap.height * ratio));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve, reject) => canvas.toBlob((result) => result ? resolve(result) : reject(new Error('Gagal mengompres gambar.')), 'image/webp', quality));
  return new File([blob], `${stripExtension(file.name)}.webp`, { type:'image/webp', lastModified:Date.now() });
}

function stripExtension(name) { return String(name || 'image').replace(/\.[^.]+$/, '').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0,50) || 'image'; }
function randomToken() { return crypto.getRandomValues(new Uint32Array(2)).join('-'); }
function safeSegment(value) { return String(value || 'general').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,50) || 'general'; }

export function buildStoragePath(bucket, context = {}) {
  const timestamp = Date.now();
  const random = randomToken();
  switch (bucket) {
    case 'members': return `${safeSegment(context.userId || 'content')}/${timestamp}-${random}.webp`;
    case 'structure': return `${safeSegment(context.userId || 'content')}/${timestamp}-${random}.webp`;
    case 'gallery': return `${safeSegment(context.year || new Date().getFullYear())}/${safeSegment(context.category)}/${timestamp}-${random}.webp`;
    case 'backgrounds': return `site/${timestamp}-${random}.webp`;
    case 'logos': return `site/${timestamp}-${random}.webp`;
    case 'audio': return `site/${timestamp}-${random}.mp3`;
    default: throw new Error('Bucket tidak dikenal.');
  }
}

export async function uploadImage(file, bucket, context = {}) {
  const client = assertSupabase();
  const compressed = await compressImage(file, {
    maxWidth: bucket === 'logos' ? 1000 : bucket === 'members' || bucket === 'structure' ? 1200 : 2200,
    maxHeight: bucket === 'backgrounds' ? 1600 : 2200,
    quality: bucket === 'logos' ? 0.9 : 0.82
  });
  const path = buildStoragePath(bucket, context);
  const { error } = await client.storage.from(bucket).upload(path, compressed, { cacheControl:'31536000', contentType:'image/webp', upsert:false });
  if (error) throw error;
  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return { url: data.publicUrl, path, bucket, size: compressed.size };
}

export async function uploadAudio(file) {
  validateFile(file, 'audio');
  const client = assertSupabase();
  const path = buildStoragePath('audio');
  const { error } = await client.storage.from('audio').upload(path, file, { cacheControl:'31536000', contentType:'audio/mpeg', upsert:false });
  if (error) throw error;
  const { data } = client.storage.from('audio').getPublicUrl(path);
  return { url:data.publicUrl, path, bucket:'audio', size:file.size };
}

export async function removeStoredFile(bucket, path) {
  if (!bucket || !path) return;
  const client = assertSupabase();
  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) throw error;
}

export function extractStoragePath(publicUrl, bucket) {
  if (!publicUrl || !bucket || publicUrl.startsWith('./')) return '';
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);
  return index >= 0 ? decodeURIComponent(publicUrl.slice(index + marker.length)) : '';
}

export function imageFallback(event, type = 'avatar') {
  const target = event.currentTarget;
  target.onerror = null;
  target.src = type === 'gallery' ? DEFAULT_ASSETS.gallery : type === 'logo' ? DEFAULT_ASSETS.logo : DEFAULT_ASSETS.avatar;
}
