import { readFile, access } from 'node:fs/promises';
import { constants } from 'node:fs';

const root = new URL('../', import.meta.url);
const required = [
  'index.html','style.css','script.js','config.js','auth.js','data.js','editor.js','storage.js','ui.js',
  'vercel.json','package.json','.gitignore','.env.example','README.md',
  'api/config.js','api/users/create.js','api/users/list.js','api/users/update.js','api/users/disable.js','api/users/enable.js','api/users/delete.js','api/audit/list.js',
  'supabase/schema.sql','supabase/policies.sql','supabase/storage-policies.sql','supabase/seed.sql',
  'assets/defaults/default-background.webp','assets/defaults/default-avatar.webp','assets/defaults/default-logo.webp'
];
const sourceFiles = [
  'index.html','style.css','script.js','config.js','auth.js','data.js','editor.js','storage.js','ui.js',
  'api/_shared.js','api/config.js','api/users/create.js','api/users/list.js','api/users/update.js','api/users/disable.js','api/users/enable.js','api/users/delete.js','api/audit/list.js',
  'vercel.json','package.json','.env.example'
];
const failures = [];
for (const file of required) {
  try { await access(new URL(file, root), constants.R_OK); } catch { failures.push(`File wajib hilang: ${file}`); }
}
const texts = Object.fromEntries(await Promise.all(sourceFiles.map(async (file) => [file, await readFile(new URL(file, root), 'utf8')])));
const html = texts['index.html'];
const css = texts['style.css'];
const editor = texts['editor.js'];
const runtimeSource = sourceFiles.filter((file) => !['.env.example'].includes(file)).map((file) => texts[file]).join('\n');
if (!html.includes('type="module"')) failures.push('index.html belum memakai ES Modules.');
if (/scroll-snap-type|scroll-snap-align|fullPage/i.test(css)) failures.push('Ditemukan pola scroll snap/fullPage terlarang.');
if (/addEventListener\(['"]wheel|window\.onwheel/i.test(runtimeSource)) failures.push('Ditemukan wheel listener global.');
if (!css.includes('overscroll-behavior-y: none')) failures.push('Proteksi overscroll belum ada.');
if (!css.includes('touch-action: pan-y')) failures.push('touch-action pan-y belum ada.');
if (!editor.includes('localStorage')) failures.push('Draft LocalStorage belum ada.');
if (/SUPABASE_SERVICE_ROLE_KEY\s*=\s*['"][A-Za-z0-9._-]{20,}/.test(runtimeSource)) failures.push('Kemungkinan Service Role Key hardcoded.');
if (/href=["']\/admin|location\.(?:href|assign)\s*\(?["']\/admin|path\s*:\s*["']\/admin/.test(runtimeSource)) failures.push('Ditemukan route /admin yang tidak diizinkan.');

const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
if (duplicateIds.length) failures.push(`ID HTML duplikat: ${duplicateIds.join(', ')}`);

const localReferences = [...html.matchAll(/(?:src|href)=["'](\.\/[^"'?#]+)(?:[?#][^"']*)?["']/g)].map((match) => match[1].replace(/^\.\//,''));
for (const reference of localReferences) {
  if (reference.startsWith('#')) continue;
  try { await access(new URL(reference, root), constants.R_OK); } catch { failures.push(`Referensi lokal rusak: ${reference}`); }
}

const schema = await readFile(new URL('supabase/schema.sql', root), 'utf8');
const policies = await readFile(new URL('supabase/policies.sql', root), 'utf8');
const storagePolicies = await readFile(new URL('supabase/storage-policies.sql', root), 'utf8');
for (const table of ['site_settings','about','background_settings','structure_members','class_members','gallery','profiles','audit_logs']) {
  if (!schema.includes(`public.${table}`)) failures.push(`Tabel schema tidak ditemukan: ${table}`);
  if (!policies.includes(`alter table public.${table} enable row level security`)) failures.push(`RLS belum diaktifkan: ${table}`);
}
if (!storagePolicies.includes('private.can_edit()')) failures.push('Storage policy belum memverifikasi role editor aktif.');
if (!texts['api/_shared.js'].includes('admin.auth.getUser')) failures.push('API belum memvalidasi access token melalui Supabase Auth.');
if (!texts['api/_shared.js'].includes("profile.role !== 'super_admin'")) failures.push('API belum memverifikasi role Super Admin.');

if (failures.length) {
  console.error('\nPROJECT CHECK FAILED\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Project check passed: struktur, aset, HTML ID, scroll, module, draft, RLS, API role, secret, dan route admin aman.');
