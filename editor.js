import { getData, setData, saveChangeSet, GALLERY_CATEGORIES, fetchUsers, createUserAccount, updateUserAccount, disableUserAccount, enableUserAccount, deleteUserAccount, fetchAuditLogs } from './data.js';
import { getAuthState } from './auth.js';
import { uploadImage, uploadAudio, removeStoredFile, extractStoragePath } from './storage.js';
import { openModal, closeModal, confirmAction, toast, renderAll, escapeHtml, formatDate } from './ui.js';
import { DEFAULT_ASSETS } from './config.js';

const DRAFT_KEY = 'xii_ips_editor_draft_v1';
const MAX_HISTORY = 20;
const singletonTableMap = { labels:'content_labels' };

const editorState = {
  active: false,
  preview: false,
  baseData: null,
  changes: emptyChanges(),
  history: [],
  historyIndex: -1,
  pendingUploads: [],
  replacedFiles: [],
  restoreCheckedFor: null,
  userId: null
};

function emptyChanges() { return { upserts:{}, deletes:{} }; }
function clone(value) { return structuredClone(value); }
function currentUserId() { return getAuthState().user?.id || ''; }
function tableName(scope) { return singletonTableMap[scope] || scope; }

function setStatus(message, type = 'clean') {
  const label = document.querySelector('#save-status');
  const wrapper = label?.closest('.editor-status');
  if (label) label.textContent = message;
  wrapper?.classList.toggle('is-dirty', type === 'dirty');
  wrapper?.classList.toggle('is-error', type === 'error');
}

function hasChanges() {
  return Object.values(editorState.changes.upserts).some((rows) => rows.length) || Object.values(editorState.changes.deletes).some((ids) => ids.length);
}

function refreshToolbar() {
  const dirty = hasChanges();
  const save = document.querySelector('#save-all-button');
  const undo = document.querySelector('#undo-button');
  const redo = document.querySelector('#redo-button');
  if (save) save.disabled = !dirty;
  if (undo) undo.disabled = editorState.historyIndex <= 0;
  if (redo) redo.disabled = editorState.historyIndex >= editorState.history.length - 1;
  setStatus(dirty ? 'Ada perubahan belum disimpan' : 'Semua perubahan tersimpan', dirty ? 'dirty' : 'clean');
}

function persistDraft() {
  if (!editorState.active || !hasChanges()) {
    localStorage.removeItem(DRAFT_KEY);
    return;
  }
  const payload = {
    version: 1,
    userId: editorState.userId || currentUserId(),
    savedAt: new Date().toISOString(),
    data: getData(),
    changes: editorState.changes,
    pendingUploads: editorState.pendingUploads,
    replacedFiles: editorState.replacedFiles
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
}

function pushHistory() {
  const snapshot = { data: clone(getData()), changes: clone(editorState.changes) };
  if (editorState.historyIndex < editorState.history.length - 1) editorState.history.splice(editorState.historyIndex + 1);
  editorState.history.push(snapshot);
  if (editorState.history.length > MAX_HISTORY) editorState.history.shift();
  editorState.historyIndex = editorState.history.length - 1;
  persistDraft();
  refreshToolbar();
}

function restoreSnapshot(snapshot) {
  if (!snapshot) return;
  editorState.changes = clone(snapshot.changes);
  setData(clone(snapshot.data), 'EDITOR_HISTORY');
  renderAll();
  refreshToolbar();
  persistDraft();
}

function upsertChange(table, row) {
  const actual = tableName(table);
  editorState.changes.upserts[actual] ||= [];
  editorState.changes.deletes[actual] ||= [];
  editorState.changes.deletes[actual] = editorState.changes.deletes[actual].filter((id) => String(id) !== String(row.id));
  const index = editorState.changes.upserts[actual].findIndex((item) => String(item.id) === String(row.id));
  if (index >= 0) editorState.changes.upserts[actual][index] = clone(row);
  else editorState.changes.upserts[actual].push(clone(row));
}

function deleteChange(table, id) {
  const actual = tableName(table);
  editorState.changes.upserts[actual] ||= [];
  editorState.changes.deletes[actual] ||= [];
  editorState.changes.upserts[actual] = editorState.changes.upserts[actual].filter((row) => String(row.id) !== String(id));
  if (!String(id).startsWith('temp-') && !editorState.changes.deletes[actual].includes(id)) editorState.changes.deletes[actual].push(id);
}

function updateSingleton(scope, field, value) {
  const data = clone(getData());
  data[scope][field] = value;
  upsertChange(scope, data[scope]);
  setData(data, 'EDITOR_CHANGE');
  renderAll(data);
  pushHistory();
}

function updateCollection(scope, row) {
  const data = clone(getData());
  const index = data[scope].findIndex((item) => String(item.id) === String(row.id));
  if (index >= 0) data[scope][index] = row;
  else data[scope].push(row);
  if (scope === 'class_members') data[scope].sort((a,b) => Number(a.attendance_number)-Number(b.attendance_number));
  else data[scope].sort((a,b) => Number(a.sort_order)-Number(b.sort_order));
  upsertChange(scope, row);
  setData(data, 'EDITOR_CHANGE');
  renderAll(data);
  pushHistory();
}

function removeCollectionItem(scope, id) {
  const data = clone(getData());
  data[scope] = data[scope].filter((item) => String(item.id) !== String(id));
  deleteChange(scope, id);
  setData(data, 'EDITOR_CHANGE');
  renderAll(data);
  pushHistory();
}

function makeTempId() { return `temp-${crypto.randomUUID()}`; }
function serverId(id) { return String(id).startsWith('temp-') ? crypto.randomUUID() : id; }

export function enterEditMode() {
  const auth = getAuthState();
  if (!auth.canEdit) { toast('Akun tidak memiliki izin edit.', 'error'); return; }
  if (auth.profile.must_change_password) { toast('Ganti password terlebih dahulu.', 'error'); return; }
  if (editorState.active) return;
  editorState.active = true;
  editorState.preview = false;
  editorState.userId = auth.user?.id || null;
  editorState.baseData = clone(getData());
  editorState.changes = emptyChanges();
  editorState.history = [{ data:clone(getData()), changes:clone(editorState.changes) }];
  editorState.historyIndex = 0;
  editorState.pendingUploads = [];
  editorState.replacedFiles = [];
  document.body.classList.add('is-editing');
  document.body.classList.remove('is-preview');
  document.querySelector('#editor-toolbar').hidden = false;
  document.querySelectorAll('.editor-only').forEach((element) => element.hidden = false);
  renderAll();
  refreshToolbar();
  toast('Mode Edit aktif. Posisi halaman tetap dipertahankan.');
}

async function cleanupPendingUploads() {
  const jobs = editorState.pendingUploads.map(({bucket,path}) => removeStoredFile(bucket,path).catch(() => null));
  await Promise.allSettled(jobs);
  editorState.pendingUploads = [];
}

export async function cancelAllChanges() {
  if (!editorState.active) return;
  if (hasChanges() && !(await confirmAction('Batalkan seluruh perubahan yang belum disimpan?', 'Batalkan Perubahan'))) return;
  await cleanupPendingUploads();
  editorState.changes = emptyChanges();
  setData(clone(editorState.baseData), 'EDITOR_CANCEL');
  renderAll();
  editorState.history = [{ data:clone(editorState.baseData), changes:emptyChanges() }];
  editorState.historyIndex = 0;
  editorState.replacedFiles = [];
  localStorage.removeItem(DRAFT_KEY);
  refreshToolbar();
  toast('Perubahan dibatalkan.');
}

export async function exitEditMode(force = false, preserveDraft = false) {
  if (!editorState.active) return;
  if (!force && hasChanges()) {
    const leave = await confirmAction('Ada perubahan yang belum disimpan. Keluar dan buang perubahan?', 'Keluar Mode Edit');
    if (!leave) return;
  }
  const dirty = hasChanges();
  if (dirty && !preserveDraft) await cleanupPendingUploads();
  if (dirty && editorState.baseData) setData(clone(editorState.baseData), preserveDraft ? 'SESSION_EXPIRED_REVERT' : 'EDITOR_EXIT_REVERT');
  editorState.active = false;
  editorState.preview = false;
  editorState.changes = emptyChanges();
  editorState.history = [];
  editorState.historyIndex = -1;
  document.body.classList.remove('is-editing','is-preview');
  document.querySelector('#editor-toolbar').hidden = true;
  document.querySelectorAll('.editor-only').forEach((element) => element.hidden = true);
  if (!preserveDraft) { localStorage.removeItem(DRAFT_KEY); editorState.userId = null; }
  renderAll();
}

function collectReferencedStoragePaths(data) {
  const refs = new Map();
  const add = (bucket, url) => {
    const path = extractStoragePath(url, bucket);
    if (!path) return;
    if (!refs.has(bucket)) refs.set(bucket, new Set());
    refs.get(bucket).add(path);
  };
  add('logos', data.site_settings?.logo_url);
  add('backgrounds', data.background_settings?.image_url);
  add('audio', data.site_settings?.audio_url);
  data.structure_members?.forEach((item) => add('structure', item.photo_url));
  data.class_members?.forEach((item) => add('members', item.photo_url));
  data.gallery?.forEach((item) => add('gallery', item.image_url));
  return refs;
}

function isPathReferenced(refs, bucket, path) {
  return refs.get(bucket)?.has(path) || false;
}

export async function saveAllChanges() {
  if (!hasChanges()) return;
  setStatus('Menyimpan…', 'dirty');
  document.querySelector('#save-all-button').disabled = true;
  try {
    const refs = collectReferencedStoragePaths(getData());
    const unusedPending = editorState.pendingUploads.filter((file) => !isPathReferenced(refs, file.bucket, file.path));
    for (const file of unusedPending) await removeStoredFile(file.bucket, file.path).catch(() => null);
    editorState.pendingUploads = editorState.pendingUploads.filter((file) => isPathReferenced(refs, file.bucket, file.path));
    const prepared = clone(editorState.changes);
    for (const [table, rows] of Object.entries(prepared.upserts)) rows.forEach((row) => { row.id = serverId(row.id); });
    await saveChangeSet(prepared);
    for (const oldFile of editorState.replacedFiles) {
      if (!isPathReferenced(refs, oldFile.bucket, oldFile.path)) await removeStoredFile(oldFile.bucket, oldFile.path).catch(() => null);
    }
    editorState.pendingUploads = [];
    editorState.replacedFiles = [];
    editorState.baseData = clone(getData());
    editorState.changes = emptyChanges();
    editorState.history = [{ data:clone(getData()), changes:emptyChanges() }];
    editorState.historyIndex = 0;
    localStorage.removeItem(DRAFT_KEY);
    renderAll();
    setStatus('Berhasil disimpan', 'clean');
    toast('Semua perubahan berhasil disimpan.');
    setTimeout(refreshToolbar, 1200);
  } catch (error) {
    setStatus('Gagal menyimpan', 'error');
    toast(error.message, 'error', 6000);
    persistDraft();
    refreshToolbar();
  }
}

function undo() {
  if (editorState.historyIndex <= 0) return;
  editorState.historyIndex--;
  restoreSnapshot(editorState.history[editorState.historyIndex]);
}
function redo() {
  if (editorState.historyIndex >= editorState.history.length - 1) return;
  editorState.historyIndex++;
  restoreSnapshot(editorState.history[editorState.historyIndex]);
}
function togglePreview() {
  editorState.preview = !editorState.preview;
  document.body.classList.toggle('is-preview', editorState.preview);
  document.querySelector('#preview-button').textContent = editorState.preview ? 'Kembali Edit' : 'Preview';
  toast(editorState.preview ? 'Preview aktif.' : 'Kembali ke Mode Edit.');
}

function openTextEditor(key) {
  if (!editorState.active || editorState.preview) return;
  const [scope, field] = key.split('.');
  const current = getData()[scope]?.[field] ?? '';
  const longFields = new Set(['description','history','vision','mission','goals','expectations','achievements','quote','closing_text','closing_quote']);
  const form = document.createElement('form');
  form.className = 'form-grid';
  form.innerHTML = `<div class="form-group is-full"><label>Isi teks</label>${longFields.has(field) ? `<textarea class="form-control" name="value" maxlength="3000">${escapeHtml(current)}</textarea>` : `<input class="form-control" name="value" value="${escapeHtml(current)}" maxlength="180">`}</div><p class="form-hint is-full">Perubahan ditampilkan langsung setelah disimpan ke draft. Tekan Simpan pada toolbar untuk mengirim ke Supabase.</p>`;
  openModal({ title:'Edit Teks', content:form, footer:'<button class="button button-secondary" type="button" data-cancel>Batal</button><button class="button button-primary" type="button" data-apply>Terapkan</button>', onOpen(shell) {
    shell.querySelector('[data-cancel]').addEventListener('click', () => closeModal());
    shell.querySelector('[data-apply]').addEventListener('click', () => {
      const value = shell.querySelector('[name=value]').value.trim();
      if (!value) { toast('Teks tidak boleh kosong.', 'error'); return; }
      updateSingleton(scope, field, value);
      closeModal();
    });
  }});
}

function recordReplacedPublicFile(url, bucket) {
  const path = extractStoragePath(url, bucket);
  if (path) editorState.replacedFiles.push({bucket,path});
}

function previewSelectedFiles(files, title = 'Pratinjau upload') {
  const selected = [...files].filter(Boolean);
  if (!selected.length) return Promise.resolve(false);
  return new Promise((resolve) => {
    const urls = selected.map((file) => URL.createObjectURL(file));
    const shell = document.createElement('div');
    shell.className = 'upload-preview-shell';
    shell.setAttribute('role','dialog'); shell.setAttribute('aria-modal','true'); shell.setAttribute('aria-label',title);
    shell.innerHTML = `<section class="upload-preview-panel"><h3>${escapeHtml(title)}</h3><p>Periksa foto sebelum proses kompresi WebP dan upload dimulai.</p><div class="upload-preview-grid">${selected.map((file,index)=>`<div class="upload-preview-item"><img src="${urls[index]}" alt="Pratinjau ${escapeHtml(file.name)}"><span title="${escapeHtml(file.name)}">${escapeHtml(file.name)} · ${(file.size/1024/1024).toFixed(2)} MB</span></div>`).join('')}</div><div class="upload-preview-actions"><button class="button button-secondary" type="button" data-preview-cancel>Batal</button><button class="button button-primary" type="button" data-preview-confirm>Upload</button></div></section>`;
    const finish = (value) => { document.removeEventListener('keydown',onKey); urls.forEach((url)=>URL.revokeObjectURL(url)); shell.remove(); resolve(value); };
    shell.addEventListener('pointerdown',(event)=>{if(event.target===shell)finish(false);});
    shell.querySelector('[data-preview-cancel]').addEventListener('click',()=>finish(false));
    shell.querySelector('[data-preview-confirm]').addEventListener('click',()=>finish(true));
    const onKey=(event)=>{if(event.key==='Escape')finish(false);};
    document.addEventListener('keydown',onKey);
    document.body.append(shell); shell.querySelector('[data-preview-confirm]').focus();
  });
}

async function chooseAndUpload(bucket, currentUrl, context = {}) {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type='file'; input.accept='image/jpeg,image/png,image/webp';
    input.addEventListener('cancel', () => resolve(null), { once:true });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      if (!(await previewSelectedFiles([file], 'Pratinjau foto'))) return resolve(null);
      try {
        toast('Mengunggah dan mengoptimalkan foto…');
        const uploaded = await uploadImage(file,bucket,context);
        editorState.pendingUploads.push({bucket:uploaded.bucket,path:uploaded.path});
        recordReplacedPublicFile(currentUrl,bucket);
        resolve(uploaded);
      } catch (error) { toast(error.message,'error'); resolve(null); }
    }, { once:true });
    input.click();
  });
}

async function editLogo() {
  const current = getData().site_settings.logo_url;
  const uploaded = await chooseAndUpload('logos', current, { userId:currentUserId() });
  if (uploaded) updateSingleton('site_settings','logo_url',uploaded.url);
}

async function resetLogo() {
  const current = getData().site_settings.logo_url;
  if (current === DEFAULT_ASSETS.logo) return toast('Logo sudah menggunakan versi default.');
  if (!(await confirmAction('Kembalikan logo ke logo default? File lama baru dihapus setelah perubahan utama disimpan.','Reset Logo'))) return;
  recordReplacedPublicFile(current,'logos');
  updateSingleton('site_settings','logo_url',DEFAULT_ASSETS.logo);
}

function structureForm(item = {}) {
  const form = document.createElement('form'); form.className='form-grid';
  form.innerHTML = `
    <div class="form-group"><label>Nama</label><input class="form-control" name="name" value="${escapeHtml(item.name || '')}" maxlength="120" required></div>
    <div class="form-group"><label>Jabatan</label><input class="form-control" name="position" value="${escapeHtml(item.position || '')}" maxlength="100" required></div>
    <div class="form-group is-full"><label>Deskripsi</label><textarea class="form-control" name="description" maxlength="500">${escapeHtml(item.description || '')}</textarea></div>
    <div class="form-group"><label>Urutan</label><input class="form-control" name="sort_order" type="number" min="1" max="999" value="${Number(item.sort_order) || getData().structure_members.length + 1}" required></div>`;
  return form;
}

function openStructureEditor(id = null) {
  const existing = id ? getData().structure_members.find((item) => String(item.id) === String(id)) : null;
  const item = existing ? clone(existing) : { id:makeTempId(), name:'', position:'', description:'', photo_url:DEFAULT_ASSETS.avatar, sort_order:getData().structure_members.length+1 };
  const form = structureForm(item);
  openModal({ title:existing?'Edit Struktur':'Tambah Struktur', content:form, footer:'<button class="button button-secondary" type="button" data-cancel>Batal</button><button class="button button-primary" type="button" data-save>Simpan Draft</button>', onOpen(shell) {
    shell.querySelector('[data-cancel]').addEventListener('click', () => closeModal());
    shell.querySelector('[data-save]').addEventListener('click', () => {
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      item.name=String(values.get('name')).trim(); item.position=String(values.get('position')).trim(); item.description=String(values.get('description')).trim(); item.sort_order=Number(values.get('sort_order'));
      updateCollection('structure_members',item); closeModal();
    });
  }});
}

function memberForm(item = {}) {
  const form=document.createElement('form');form.className='form-grid';
  const fields=[
    ['full_name','Nama lengkap','text',true],['attendance_number','Nomor absen','number',true],['birth_place','Tempat lahir','text',false],['birth_date','Tanggal lahir','date',false],['instagram','Instagram','text',false],['position','Jabatan opsional','text',false]
  ];
  form.innerHTML=fields.map(([name,label,type,required])=>`<div class="form-group"><label>${label}</label><input class="form-control" name="${name}" type="${type}" value="${escapeHtml(item[name] ?? '')}" ${type==='number'?'min="1" max="999"':''} ${required?'required':''}></div>`).join('')+
    [['bio','Bio'],['hobbies','Hobi'],['ambition','Cita-cita'],['quote','Quote pribadi']].map(([name,label])=>`<div class="form-group is-full"><label>${label}</label><textarea class="form-control" name="${name}" maxlength="1000">${escapeHtml(item[name] || '')}</textarea></div>`).join('');
  return form;
}

function openMemberEditor(id=null) {
  const existing=id?getData().class_members.find((item)=>String(item.id)===String(id)):null;
  const item=existing?clone(existing):{id:makeTempId(),attendance_number:getData().class_members.length+1,full_name:'',birth_place:'',birth_date:null,instagram:'',bio:'',hobbies:'',ambition:'',quote:'',position:'',photo_url:DEFAULT_ASSETS.avatar};
  const form=memberForm(item);
  openModal({title:existing?'Edit Profil Anggota':'Tambah Anggota',content:form,wide:true,footer:'<button class="button button-secondary" type="button" data-cancel>Batal</button><button class="button button-primary" type="button" data-save>Simpan Draft</button>',onOpen(shell){
    shell.querySelector('[data-cancel]').addEventListener('click',()=>{renderAll(getData());closeModal();});
    shell.querySelector('[data-save]').addEventListener('click',()=>{
      if(!form.reportValidity())return;
      const values=Object.fromEntries(new FormData(form));
      Object.assign(item,values,{attendance_number:Number(values.attendance_number),birth_date:values.birth_date||null,instagram:String(values.instagram||'').replace(/^@/,'')});
      const duplicate=getData().class_members.find((member)=>Number(member.attendance_number)===item.attendance_number&&String(member.id)!==String(item.id));
      if(duplicate){toast('Nomor absen sudah digunakan.','error');return;}
      updateCollection('class_members',item);closeModal();
    });
  }});
}

function galleryForm(item={}) {
  const form=document.createElement('form');form.className='form-grid';
  form.innerHTML=`
    <div class="form-group"><label>Judul</label><input class="form-control" name="title" value="${escapeHtml(item.title||'')}" maxlength="160" required></div>
    <div class="form-group"><label>Kategori</label><select class="form-control" name="category">${GALLERY_CATEGORIES.map((cat)=>`<option ${cat===item.category?'selected':''}>${escapeHtml(cat)}</option>`).join('')}</select></div>
    <div class="form-group"><label>Tanggal kegiatan</label><input class="form-control" name="event_date" type="date" value="${escapeHtml(item.event_date||'')}"></div>
    <div class="form-group"><label>Urutan</label><input class="form-control" name="sort_order" type="number" min="1" max="9999" value="${Number(item.sort_order)||getData().gallery.length+1}"></div>
    <div class="form-group is-full"><label>Caption</label><textarea class="form-control" name="caption" maxlength="1200">${escapeHtml(item.caption||'')}</textarea></div>`;
  return form;
}

function openGalleryEditor(id) {
  const item=clone(getData().gallery.find((row)=>String(row.id)===String(id)));
  if(!item)return;
  const form=galleryForm(item);
  openModal({title:'Edit Foto Galeri',content:form,footer:'<button class="button button-secondary" type="button" data-cancel>Batal</button><button class="button button-primary" type="button" data-save>Simpan Draft</button>',onOpen(shell){
    shell.querySelector('[data-cancel]').addEventListener('click',()=>closeModal());
    shell.querySelector('[data-save]').addEventListener('click',()=>{
      if(!form.reportValidity())return;Object.assign(item,Object.fromEntries(new FormData(form)));item.sort_order=Number(item.sort_order);item.event_date=item.event_date||null;updateCollection('gallery',item);closeModal();
    });
  }});
}

function moveItem(scope,id,direction){
  const data=clone(getData());const list=data[scope];const index=list.findIndex((item)=>String(item.id)===String(id));if(index<0)return;
  const target=index+direction;if(target<0||target>=list.length)return;
  [list[index].sort_order,list[target].sort_order]=[list[target].sort_order,list[index].sort_order];
  [list[index],list[target]]=[list[target],list[index]];
  upsertChange(scope,list[index]);upsertChange(scope,list[target]);setData(data,'EDITOR_REORDER');renderAll(data);pushHistory();
}

async function replaceEntityPhoto(scope,id,bucket){
  const item=clone(getData()[scope].find((row)=>String(row.id)===String(id)));if(!item)return;
  const uploaded=await chooseAndUpload(bucket,item.photo_url,{userId:currentUserId()});if(!uploaded)return;item.photo_url=uploaded.url;updateCollection(scope,item);
}

async function handleDelete(scope,id,label){
  if(!(await confirmAction(`Hapus ${label}? Perubahan baru permanen setelah menekan Simpan pada toolbar.`,'Hapus Data')))return;
  const item=getData()[scope].find((row)=>String(row.id)===String(id));
  if(item?.photo_url||item?.image_url){const bucket=scope==='class_members'?'members':scope==='structure_members'?'structure':'gallery';recordReplacedPublicFile(item.photo_url||item.image_url,bucket);}
  removeCollectionItem(scope,id);
}

async function uploadGalleryFiles(files,{skipPreview=false}={}){
  if(!files?.length)return;
  if(!skipPreview && !(await previewSelectedFiles(files, `Pratinjau ${files.length} foto galeri`))) return;
  const progress=document.querySelector('#upload-progress');const bar=progress.querySelector('span');const label=progress.querySelector('p');progress.hidden=false;
  let success=0;const failed=[];
  for(let index=0;index<files.length;index++){
    label.textContent=`Mengunggah ${index+1} dari ${files.length}…`;
    try{
      const category='Random Moment';const uploaded=await uploadImage(files[index],'gallery',{year:new Date().getFullYear(),category});editorState.pendingUploads.push({bucket:'gallery',path:uploaded.path});
      const item={id:makeTempId(),title:files[index].name.replace(/\.[^.]+$/,''),caption:'',category,event_date:null,image_url:uploaded.url,sort_order:getData().gallery.length+1};
      const data=clone(getData());data.gallery.push(item);upsertChange('gallery',item);setData(data,'GALLERY_UPLOAD');success++;
    }catch(error){failed.push(files[index]);toast(`${files[index].name}: ${error.message}`,'error');}
    bar.style.width=`${Math.round(((index+1)/files.length)*100)}%`;
  }
  renderAll();pushHistory();label.textContent=`Upload selesai: ${success} berhasil, ${failed.length} gagal.`;
  progress.querySelector('.upload-retry')?.remove();
  if(failed.length){const retry=document.createElement('button');retry.type='button';retry.className='upload-retry';retry.textContent=`Ulangi ${failed.length} foto gagal`;retry.addEventListener('click',()=>uploadGalleryFiles(failed,{skipPreview:true}));progress.append(retry);}
  else setTimeout(()=>{progress.hidden=true;bar.style.width='0%';},2500);
}

function openSettings() {
  const data=clone(getData());const site=data.site_settings;const bg=data.background_settings;
  const pendingStart=editorState.pendingUploads.length;const replacedStart=editorState.replacedFiles.length;
  const rollbackSettings=async()=>{
    const abandoned=editorState.pendingUploads.slice(pendingStart);
    await Promise.allSettled(abandoned.map((file)=>removeStoredFile(file.bucket,file.path)));
    editorState.pendingUploads.splice(pendingStart);editorState.replacedFiles.splice(replacedStart);
    renderAll(getData());
  };
  const form=document.createElement('form');form.className='form-grid';
  form.innerHTML=`
    <div class="settings-preview is-full"></div>
    <div class="form-group"><label>Nama website</label><input class="form-control" name="site_name" value="${escapeHtml(site.site_name)}"></div>
    <div class="form-group"><label>Nama kelas</label><input class="form-control" name="class_name" value="${escapeHtml(site.class_name)}"></div>
    <div class="form-group"><label>Warna aksen</label><input class="form-control" name="accent_color" type="color" value="${escapeHtml(site.accent_color||'#6aa9ff')}"></div>
    <div class="form-group"><label>Warna tema</label><input class="form-control" name="theme_color" type="color" value="${escapeHtml(site.theme_color||'#08101d')}"></div>
    <div class="form-group is-full"><label>Blur background</label><div class="range-row"><input name="blur" type="range" min="0" max="32" value="${Number(bg.blur)||0}"><output>${Number(bg.blur)||0}px</output></div></div>
    <div class="form-group is-full"><label>Brightness</label><div class="range-row"><input name="brightness" type="range" min="20" max="100" value="${Number(bg.brightness)||65}"><output>${Number(bg.brightness)||65}%</output></div></div>
    <div class="form-group is-full"><label>Overlay</label><div class="range-row"><input name="overlay" type="range" min="0" max="90" value="${Number(bg.overlay)||35}"><output>${Number(bg.overlay)||35}%</output></div></div>
    <div class="form-group is-full"><label>Skala background</label><div class="range-row"><input name="scale" type="range" min="100" max="130" value="${Number(bg.scale)||108}"><output>${Number(bg.scale)||108}%</output></div></div>
    <div class="form-group"><label>Posisi background</label><select class="form-control" name="position">${['center','top','bottom','left','right'].map((v)=>`<option ${v===bg.position?'selected':''}>${v}</option>`).join('')}</select></div>
    <div class="form-group"><label>Durasi animasi (ms)</label><input class="form-control" name="animation_duration" type="number" min="0" max="2000" value="${Number(site.animation_duration)||700}"></div>
    <div class="form-group"><label><input name="loading_enabled" type="checkbox" ${site.loading_enabled?'checked':''}> Loading screen aktif</label><input class="form-control" name="loading_duration" type="number" min="800" max="7000" value="${Number(site.loading_duration)||3400}"></div>
    <div class="form-group"><label><input name="music_enabled" type="checkbox" ${site.music_enabled?'checked':''}> Musik aktif</label><input class="form-control" name="music_volume" type="number" min="0" max="1" step="0.05" value="${Number(site.music_volume)||.35}"></div>
    <div class="form-group"><label><input name="parallax_enabled" type="checkbox" ${site.parallax_enabled?'checked':''}> Parallax desktop</label><label><input name="particles_enabled" type="checkbox" ${site.particles_enabled?'checked':''}> Particle desktop</label></div>
    <div class="form-group"><label><input name="mouse_light_enabled" type="checkbox" ${site.mouse_light_enabled?'checked':''}> Mouse light desktop</label><label><input name="reveal_enabled" type="checkbox" ${site.reveal_enabled?'checked':''}> Reveal effect</label></div>
    <div class="form-group is-full"><button class="button button-secondary" type="button" data-background>Ganti Background</button><button class="button button-secondary" type="button" data-audio>Upload Musik MP3</button><button class="text-button" type="button" data-reset-background>Reset Background</button></div>`;
  const updateOutputs=()=>form.querySelectorAll('input[type=range]').forEach((input)=>{input.closest('.range-row').querySelector('output').value=`${input.value}${input.name==='blur'?'px':'%'}`;});
  const syncFormToPreview=()=>{
    const values=new FormData(form);
    Object.assign(site,{site_name:String(values.get('site_name')).trim(),class_name:String(values.get('class_name')).trim(),accent_color:String(values.get('accent_color')),theme_color:String(values.get('theme_color')),animation_duration:Number(values.get('animation_duration')),loading_enabled:form.elements.loading_enabled.checked,loading_duration:Number(values.get('loading_duration')),music_enabled:form.elements.music_enabled.checked,music_volume:Number(values.get('music_volume')),parallax_enabled:form.elements.parallax_enabled.checked,particles_enabled:form.elements.particles_enabled.checked,mouse_light_enabled:form.elements.mouse_light_enabled.checked,reveal_enabled:form.elements.reveal_enabled.checked});
    Object.assign(bg,{blur:Number(values.get('blur')),brightness:Number(values.get('brightness')),overlay:Number(values.get('overlay')),scale:Number(values.get('scale')),position:String(values.get('position'))});
    renderAll(data);
  };
  openModal({title:'Pengaturan Tampilan',content:form,wide:true,closeOnOverlay:false,closeOnEscape:false,footer:'<button class="button button-secondary" type="button" data-cancel>Batal</button><button class="button button-primary" type="button" data-save>Simpan ke Draft</button>',onOpen(shell){
    form.querySelectorAll('input,select').forEach((input)=>input.addEventListener('input',()=>{updateOutputs();syncFormToPreview();}));
    updateOutputs();
    shell.querySelector('[data-background]').addEventListener('click',async()=>{const uploaded=await chooseAndUpload('backgrounds',bg.image_url,{userId:currentUserId()});if(uploaded){bg.image_url=uploaded.url;renderAll(data);toast('Background siap diterapkan.');}});
    shell.querySelector('[data-reset-background]').addEventListener('click',()=>{recordReplacedPublicFile(bg.image_url,'backgrounds');bg.image_url=DEFAULT_ASSETS.background;bg.blur=16;bg.brightness=65;bg.overlay=35;bg.position='center';bg.scale=108;form.elements.blur.value=16;form.elements.brightness.value=65;form.elements.overlay.value=35;form.elements.scale.value=108;form.elements.position.value='center';updateOutputs();renderAll(data);toast('Background direset ke default.');});
    shell.querySelector('[data-audio]').addEventListener('click',()=>{const input=document.createElement('input');input.type='file';input.accept='audio/mpeg';input.addEventListener('change',async()=>{if(!input.files?.[0])return;try{const uploaded=await uploadAudio(input.files[0]);editorState.pendingUploads.push({bucket:'audio',path:uploaded.path});recordReplacedPublicFile(site.audio_url,'audio');site.audio_url=uploaded.url;site.music_enabled=true;toast('Audio berhasil diunggah.');}catch(error){toast(error.message,'error');}},{once:true});input.click();});
    shell.querySelector('.modal-close').addEventListener('click',()=>rollbackSettings());
    shell.querySelector('[data-cancel]').addEventListener('click',async()=>{await rollbackSettings();closeModal();});
    shell.querySelector('[data-save]').addEventListener('click',()=>{
      const values=new FormData(form);
      Object.assign(site,{site_name:String(values.get('site_name')).trim(),class_name:String(values.get('class_name')).trim(),accent_color:String(values.get('accent_color')),theme_color:String(values.get('theme_color')),animation_duration:Number(values.get('animation_duration')),loading_enabled:form.elements.loading_enabled.checked,loading_duration:Number(values.get('loading_duration')),music_enabled:form.elements.music_enabled.checked,music_volume:Number(values.get('music_volume')),parallax_enabled:form.elements.parallax_enabled.checked,particles_enabled:form.elements.particles_enabled.checked,mouse_light_enabled:form.elements.mouse_light_enabled.checked,reveal_enabled:form.elements.reveal_enabled.checked});
      Object.assign(bg,{blur:Number(values.get('blur')),brightness:Number(values.get('brightness')),overlay:Number(values.get('overlay')),scale:Number(values.get('scale')),position:String(values.get('position'))});
      data.site_settings=site;data.background_settings=bg;upsertChange('site_settings',site);upsertChange('background_settings',bg);setData(data,'SETTINGS_CHANGE');renderAll(data);pushHistory();closeModal();
    });
  }});
}

function userRows(users){return users.map((user)=>`<tr><td>${escapeHtml(user.full_name||'-')}<br><small>${escapeHtml(user.email||'')}</small></td><td><span class="badge">${escapeHtml(String(user.role||'').replace('_',' '))}</span></td><td><span class="badge${user.is_active?'':' is-disabled'}">${user.is_active?'Aktif':'Nonaktif'}</span></td><td>${user.created_at?formatDate(user.created_at.slice(0,10)):'-'}</td><td>${user.last_login_at?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(user.last_login_at)):'-'}</td><td><div class="table-actions"><button data-user-edit="${user.id}">Edit</button>${user.is_active?`<button data-user-disable="${user.id}">Nonaktifkan</button>`:`<button data-user-enable="${user.id}">Aktifkan</button>`}<button data-user-delete="${user.id}">Hapus</button></div></td></tr>`).join('');}

async function openUsersManager(){
  try{
    const users=await fetchUsers();const content=document.createElement('div');content.innerHTML=`<div style="display:flex;justify-content:flex-end;margin-bottom:12px"><button class="button button-primary" type="button" data-create-user>+ Buat Akun Baru</button></div><div class="data-table-wrap"><table class="data-table"><thead><tr><th>Akun</th><th>Role</th><th>Status</th><th>Dibuat</th><th>Terakhir aktif</th><th>Aksi</th></tr></thead><tbody>${userRows(users)}</tbody></table></div>`;
    openModal({title:'Kelola Pengguna',content,wide:true,onOpen(shell){
      shell.querySelector('[data-create-user]').addEventListener('click',openCreateUser);
      shell.querySelectorAll('[data-user-edit]').forEach((b)=>b.addEventListener('click',()=>openEditUser(users.find((u)=>u.id===b.dataset.userEdit))));
      shell.querySelectorAll('[data-user-disable]').forEach((b)=>b.addEventListener('click',async()=>{if(await confirmAction('Nonaktifkan akun ini?')){try{await disableUserAccount(b.dataset.userDisable);closeModal();toast('Akun dinonaktifkan.');openUsersManager();}catch(e){toast(e.message,'error');}}}));
      shell.querySelectorAll('[data-user-enable]').forEach((b)=>b.addEventListener('click',async()=>{try{await enableUserAccount(b.dataset.userEnable);closeModal();toast('Akun diaktifkan.');openUsersManager();}catch(e){toast(e.message,'error');}}));
      shell.querySelectorAll('[data-user-delete]').forEach((b)=>b.addEventListener('click',async()=>{if(await confirmAction('Hapus akun secara permanen? Tindakan ini tidak dapat dibatalkan.','Hapus Akun')){try{await deleteUserAccount(b.dataset.userDelete);closeModal();toast('Akun dihapus.');openUsersManager();}catch(e){toast(e.message,'error');}}}));
    }});
  }catch(error){toast(error.message,'error');}
}

function userForm(user=null){const form=document.createElement('form');form.className='form-grid';form.innerHTML=`
  <div class="form-group"><label>Nama lengkap</label><input class="form-control" name="full_name" value="${escapeHtml(user?.full_name||'')}" required></div>
  <div class="form-group"><label>Email</label><input class="form-control" name="email" type="email" value="${escapeHtml(user?.email||'')}" required></div>
  <div class="form-group"><label>Role</label><select class="form-control" name="role"><option value="editor" ${user?.role==='editor'?'selected':''}>Editor</option><option value="super_admin" ${user?.role==='super_admin'?'selected':''}>Super Admin</option></select></div>
  ${user?'':`<div class="form-group"><label>Metode</label><select class="form-control" name="method"><option value="invite">Undangan email</option><option value="temporary_password">Password sementara</option></select></div><div class="form-group is-full"><label>Password sementara (opsional untuk metode password)</label><input class="form-control" name="temporary_password" type="password" minlength="10" autocomplete="new-password"></div>`}`;return form;}

function openCreateUser(){const form=userForm();openModal({title:'Buat Akun Baru',content:form,footer:'<button class="button button-secondary" type="button" data-cancel>Batal</button><button class="button button-primary" type="button" data-save>Buat Akun</button>',onOpen(shell){shell.querySelector('[data-cancel]').addEventListener('click',()=>closeModal());shell.querySelector('[data-save]').addEventListener('click',async()=>{if(!form.reportValidity())return;const payload=Object.fromEntries(new FormData(form));try{await createUserAccount(payload);closeModal();toast('Akun berhasil dibuat atau undangan dikirim.');openUsersManager();}catch(e){toast(e.message,'error');}});}});}
function openEditUser(user){const form=userForm(user);openModal({title:'Edit Akun',content:form,footer:'<button class="button button-secondary" type="button" data-cancel>Batal</button><button class="button button-primary" type="button" data-save>Simpan</button>',onOpen(shell){shell.querySelector('[data-cancel]').addEventListener('click',()=>closeModal());shell.querySelector('[data-save]').addEventListener('click',async()=>{if(!form.reportValidity())return;try{await updateUserAccount({id:user.id,...Object.fromEntries(new FormData(form))});closeModal();toast('Akun diperbarui.');openUsersManager();}catch(e){toast(e.message,'error');}});}});}

async function openAudit(){try{const logs=await fetchAuditLogs();const content=document.createElement('div');content.innerHTML=`<div class="data-table-wrap"><table class="data-table"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Entitas</th><th>ID</th></tr></thead><tbody>${logs.map((log)=>`<tr><td>${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'medium'}).format(new Date(log.created_at))}</td><td>${escapeHtml(log.user_name||'-')}</td><td>${escapeHtml(log.action)}</td><td>${escapeHtml(log.entity_type||'-')}</td><td>${escapeHtml(log.entity_id||'-')}</td></tr>`).join('')||'<tr><td colspan="5">Belum ada audit log.</td></tr>'}</tbody></table></div>`;openModal({title:'Audit Aktivitas',content,wide:true});}catch(e){toast(e.message,'error');}}

async function restoreDraftIfAvailable(){
  const auth=getAuthState();if(!auth.canEdit||editorState.restoreCheckedFor===auth.user?.id)return;editorState.restoreCheckedFor=auth.user.id;
  const raw=localStorage.getItem(DRAFT_KEY);if(!raw)return;
  try{const draft=JSON.parse(raw);if(draft.userId!==auth.user.id){localStorage.removeItem(DRAFT_KEY);return;}const restore=await confirmAction(`Ditemukan draft dari ${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short'}).format(new Date(draft.savedAt))}. Pulihkan draft?`,'Pulihkan Draft');if(restore){editorState.active=true;editorState.userId=auth.user.id;editorState.baseData=clone(getData());editorState.changes=draft.changes;editorState.pendingUploads=draft.pendingUploads||[];editorState.replacedFiles=draft.replacedFiles||[];editorState.history=[{data:clone(editorState.baseData),changes:emptyChanges()},{data:clone(draft.data),changes:clone(draft.changes)}];editorState.historyIndex=1;setData(draft.data,'DRAFT_RESTORED');document.body.classList.add('is-editing');document.querySelector('#editor-toolbar').hidden=false;document.querySelectorAll('.editor-only').forEach((el)=>el.hidden=false);renderAll();refreshToolbar();toast('Draft dipulihkan.');}else localStorage.removeItem(DRAFT_KEY);}catch{localStorage.removeItem(DRAFT_KEY);}
}

async function handleEditorAction(action,id){
  if(!editorState.active||editorState.preview)return;
  if(action==='edit-logo')return editLogo();
  if(action==='reset-logo')return resetLogo();
  if(action==='add-structure')return openStructureEditor();
  if(action==='add-member')return openMemberEditor();
  if(action==='edit-structure')return openStructureEditor(id);
  if(action==='photo-structure')return replaceEntityPhoto('structure_members',id,'structure');
  if(action==='up-structure')return moveItem('structure_members',id,-1);
  if(action==='down-structure')return moveItem('structure_members',id,1);
  if(action==='delete-structure')return handleDelete('structure_members',id,'struktur ini');
  if(action==='edit-member')return openMemberEditor(id);
  if(action==='photo-member')return replaceEntityPhoto('class_members',id,'members');
  if(action==='delete-member')return handleDelete('class_members',id,'anggota ini');
  if(action==='edit-gallery')return openGalleryEditor(id);
  if(action==='up-gallery')return moveItem('gallery',id,-1);
  if(action==='down-gallery')return moveItem('gallery',id,1);
  if(action==='delete-gallery')return handleDelete('gallery',id,'foto galeri ini');
}

export function initializeEditor(){
  document.querySelector('#edit-website-button')?.addEventListener('click',enterEditMode);
  document.querySelector('#save-all-button')?.addEventListener('click',saveAllChanges);
  document.querySelector('#cancel-all-button')?.addEventListener('click',cancelAllChanges);
  document.querySelector('#undo-button')?.addEventListener('click',undo);
  document.querySelector('#redo-button')?.addEventListener('click',redo);
  document.querySelector('#preview-button')?.addEventListener('click',togglePreview);
  document.querySelector('#settings-button')?.addEventListener('click',openSettings);
  document.querySelector('#users-button')?.addEventListener('click',openUsersManager);
  document.querySelector('#audit-button')?.addEventListener('click',openAudit);
  document.querySelector('#exit-edit-button')?.addEventListener('click',()=>exitEditMode());
  document.querySelector('#gallery-upload-input')?.addEventListener('change',(event)=>{const files=[...event.target.files];event.target.value='';uploadGalleryFiles(files);});
  document.addEventListener('click',(event)=>{
    const actionButton=event.target.closest('[data-editor-action]');if(actionButton){event.stopPropagation();handleEditorAction(actionButton.dataset.editorAction,actionButton.dataset.id);return;}
    const editable=event.target.closest('[data-edit-key]');if(editable&&editorState.active&&!editorState.preview){event.preventDefault();event.stopPropagation();openTextEditor(editable.dataset.editKey);}
  });
  document.addEventListener('xii:auth',(event)=>{const state=event.detail.state;if(!state.user)editorState.restoreCheckedFor=null;if(!state.canEdit&&editorState.active){persistDraft();exitEditMode(true,true);}if(state.canEdit)queueMicrotask(restoreDraftIfAvailable);});
  document.addEventListener('xii:before-logout',()=>{localStorage.removeItem(DRAFT_KEY);if(editorState.active)exitEditMode(true);});
  window.addEventListener('beforeunload',(event)=>{if(hasChanges()){persistDraft();event.preventDefault();event.returnValue='';}});
}
