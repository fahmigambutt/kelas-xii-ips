import { DEFAULT_ASSETS } from './config.js';
import { getData, GALLERY_CATEGORIES } from './data.js';
import { getAuthState, login, logout, requestPasswordReset, updatePassword, updateOwnName } from './auth.js';
import { imageFallback } from './storage.js';

const sections = ['home','tentang','struktur','anggota','galeri','penutup'];
let activeSection = 'home';
let lastFocusedElement = null;
let focusTrapCleanup = null;
let galleryFilter = 'Semua';
let currentLightboxIndex = 0;
let visibleGallery = [];
let touchStartX = 0;
let loadingTimer = null;
const loadingStartedAt = performance.now();
let particlesFrame = null;
let modalResolve = null;

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
}

export function formatDate(value, options = {}) {
  if (!value) return 'Belum diisi';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', { day:'numeric', month:'long', year:'numeric', ...options }).format(date);
}

export function toast(message, type = 'info', duration = 3400) {
  const region = document.querySelector('#toast-region');
  if (!region) return;
  const item = document.createElement('div');
  item.className = `toast${type === 'error' ? ' is-error' : ''}`;
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), duration);
}

function getFocusable(container) {
  return [...container.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
    .filter((element) => !element.hidden && element.offsetParent !== null);
}

function activateFocusTrap(shell, closeOnEscape = true) {
  const keyHandler = (event) => {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault();
      closeModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = getFocusable(shell);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', keyHandler);
  focusTrapCleanup = () => document.removeEventListener('keydown', keyHandler);
}

export function openModal({ title, content, footer = '', wide = false, onOpen, closeOnOverlay = true, closeOnEscape = true }) {
  closeModal(false);
  lastFocusedElement = document.activeElement;
  const root = document.querySelector('#modal-root');
  const shell = document.createElement('div');
  shell.className = 'modal-shell';
  shell.innerHTML = `
    <section class="modal-panel${wide ? ' is-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="active-modal-title">
      <header class="modal-header"><h2 id="active-modal-title"></h2><button class="modal-close" type="button" aria-label="Tutup modal">×</button></header>
      <div class="modal-body"></div>
      ${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}
    </section>`;
  shell.querySelector('#active-modal-title').textContent = title;
  const body = shell.querySelector('.modal-body');
  if (typeof content === 'string') body.innerHTML = content;
  else if (content instanceof Node) body.append(content);
  shell.querySelector('.modal-close').addEventListener('click', () => closeModal());
  if (closeOnOverlay) shell.addEventListener('pointerdown', (event) => { if (event.target === shell) closeModal(); });
  root.append(shell);
  document.body.classList.add('is-modal-open');
  activateFocusTrap(shell, closeOnEscape);
  requestAnimationFrame(() => (getFocusable(shell)[0] || shell.querySelector('.modal-panel')).focus?.());
  onOpen?.(shell);
  return shell;
}

export function closeModal(resolveValue = undefined) {
  const root = document.querySelector('#modal-root');
  if (!root?.firstChild) return;
  root.replaceChildren();
  document.body.classList.remove('is-modal-open');
  focusTrapCleanup?.();
  focusTrapCleanup = null;
  lastFocusedElement?.focus?.({ preventScroll:true });
  lastFocusedElement = null;
  if (modalResolve) {
    const resolver = modalResolve;
    modalResolve = null;
    resolver(resolveValue);
  }
}

export function confirmAction(message, title = 'Konfirmasi') {
  return new Promise((resolve) => {
    closeModal();
    modalResolve = resolve;
    const content = document.createElement('p');
    content.style.cssText = 'color:var(--muted);line-height:1.7;margin:0';
    content.textContent = message;
    openModal({
      title,
      content,
      footer:'<button class="button button-secondary" type="button" data-confirm="false">Batal</button><button class="button button-primary" type="button" data-confirm="true">Lanjutkan</button>',
      onOpen(shell) {
        shell.querySelectorAll('[data-confirm]').forEach((button) => button.addEventListener('click', () => closeModal(button.dataset.confirm === 'true')));
      }
    });
  });
}

function setImage(element, url, fallbackType = 'avatar') {
  if (!element) return;
  element.src = url || (fallbackType === 'gallery' ? DEFAULT_ASSETS.gallery : fallbackType === 'logo' ? DEFAULT_ASSETS.logo : DEFAULT_ASSETS.avatar);
  element.onerror = (event) => imageFallback(event, fallbackType);
}

function text(id, value) { const element = document.getElementById(id); if (element) element.textContent = value ?? ''; }

function hexToRgbString(hex) {
  const value = String(hex || '').replace('#','');
  if (!/^[0-9a-f]{6}$/i.test(value)) return '106, 169, 255';
  return `${parseInt(value.slice(0,2),16)}, ${parseInt(value.slice(2,4),16)}, ${parseInt(value.slice(4,6),16)}`;
}

export function applySiteSettings(data = getData()) {
  const site = data.site_settings;
  const about = data.about;
  const background = data.background_settings;
  const labels = data.labels;
  document.title = site.site_name || 'XII IPS — Official Class Website';
  text('welcome-text', site.welcome_text);
  text('home-title', site.class_name);
  text('motto', site.motto);
  text('generation', site.generation);
  text('home-description', site.description);
  text('closing-title', site.closing_text);
  text('closing-quote', site.closing_quote);
  text('closing-generation', site.generation);
  text('about-title', labels.about_title);
  text('structure-title', labels.structure_title);
  text('members-title', labels.members_title);
  text('gallery-title', labels.gallery_title);
  text('about-history', about.history);
  text('about-vision', about.vision);
  text('about-mission', about.mission);
  text('about-goals', about.goals);
  text('about-expectations', about.expectations);
  text('about-achievements', about.achievements);
  text('class-quote', about.quote);
  ['hero-logo','nav-logo','closing-logo','loading-logo'].forEach((id) => setImage(document.getElementById(id), site.logo_url, 'logo'));

  const root = document.documentElement;
  root.style.setProperty('--accent', site.accent_color || '#6aa9ff');
  root.style.setProperty('--accent-rgb', hexToRgbString(site.accent_color));
  root.style.setProperty('--bg', site.theme_color || '#08101d');
  root.style.setProperty('--animation-duration', `${Math.max(0, Number(site.animation_duration) || 700)}ms`);
  root.style.setProperty('--background-image', `url("${String(background.image_url || DEFAULT_ASSETS.background).replace(/"/g,'')}")`);
  root.style.setProperty('--background-blur', `${Math.max(0, Number(background.blur) || 0)}px`);
  root.style.setProperty('--background-brightness', `${Math.max(10, Number(background.brightness) || 65) / 100}`);
  root.style.setProperty('--background-overlay', `${Math.max(0, Math.min(100, Number(background.overlay) || 0)) / 100}`);
  root.style.setProperty('--background-position', background.position || 'center');
  root.style.setProperty('--background-scale', `${Math.max(100, Math.min(130, Number(background.scale) || 108)) / 100}`);

  const desktopEffects = matchMedia('(min-width: 769px)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  const particleCanvas = document.querySelector('#particle-canvas');
  const mouseLight = document.querySelector('#mouse-light');
  if (particleCanvas) particleCanvas.style.display = desktopEffects && site.particles_enabled !== false ? '' : 'none';
  if (mouseLight) { mouseLight.style.display = desktopEffects && site.mouse_light_enabled !== false ? '' : 'none'; if (site.mouse_light_enabled === false) mouseLight.style.opacity = '0'; }

  const audio = document.querySelector('#background-audio');
  const musicButton = document.querySelector('#music-toggle');
  if (site.music_enabled && site.audio_url) {
    audio.src = site.audio_url;
    audio.volume = Math.max(0, Math.min(1, Number(site.music_volume) || .35));
    musicButton.hidden = false;
  } else {
    audio.pause(); audio.removeAttribute('src'); musicButton.hidden = true;
  }
}

function createAdminActions(type, id) {
  const auth = getAuthState();
  if (!document.body.classList.contains('is-editing') || !auth.canEdit) return '';
  const labels = type === 'member'
    ? [['edit','Edit Profil'],['photo','Ganti Foto'],['delete','Hapus']]
    : type === 'structure'
      ? [['edit','Edit'],['photo','Ganti Foto'],['up','Naik'],['down','Turun'],['delete','Hapus']]
      : [['edit','Edit'],['up','Naik'],['down','Turun'],['delete','Hapus']];
  return `<div class="card-admin-actions">${labels.map(([action,label]) => `<button type="button" data-editor-action="${action}-${type}" data-id="${escapeHtml(id)}">${label}</button>`).join('')}</div>`;
}

export function renderStructure(items = getData().structure_members) {
  const grid = document.querySelector('#structure-grid');
  if (!grid) return;
  if (!items.length) { grid.innerHTML = '<div class="empty-state">Belum ada data struktur kelas.</div>'; return; }
  grid.innerHTML = items.map((item) => `
    <article class="profile-card reveal" data-entity="structure" data-id="${escapeHtml(item.id)}">
      ${createAdminActions('structure', item.id)}
      <div class="profile-media"><img src="${escapeHtml(item.photo_url || DEFAULT_ASSETS.avatar)}" width="600" height="680" loading="lazy" decoding="async" alt="Foto ${escapeHtml(item.name)}"></div>
      <div class="profile-copy"><h3>${escapeHtml(item.name)}</h3><p class="role">${escapeHtml(item.position)}</p>${item.description ? `<p class="description">${escapeHtml(item.description)}</p>` : ''}</div>
    </article>`).join('');
  grid.querySelectorAll('img').forEach((img) => img.addEventListener('error', (event) => imageFallback(event,'avatar'), { once:true }));
  observeReveals(grid);
}

function filteredMembers(items = getData().class_members) {
  const query = document.querySelector('#member-search')?.value.trim().toLowerCase() || '';
  const range = document.querySelector('#attendance-filter')?.value || 'all';
  return items.filter((member) => {
    const searchMatch = !query || [member.full_name, member.instagram, member.position].some((value) => String(value || '').toLowerCase().includes(query));
    const number = Number(member.attendance_number);
    const rangeMatch = range === 'all' || (range === '1-10' && number <= 10) || (range === '11-20' && number >= 11 && number <= 20) || (range === '21-30' && number >= 21);
    return searchMatch && rangeMatch;
  });
}

export function renderMembers(items = getData().class_members) {
  const grid = document.querySelector('#member-grid');
  if (!grid) return;
  text('member-count', items.length);
  const filtered = filteredMembers(items);
  if (!filtered.length) { grid.innerHTML = '<div class="empty-state">Anggota tidak ditemukan.</div>'; return; }
  grid.innerHTML = filtered.map((member) => `
    <article class="profile-card member-card reveal" tabindex="0" role="button" aria-label="Lihat profil ${escapeHtml(member.full_name)}" data-member-id="${escapeHtml(member.id)}">
      ${createAdminActions('member', member.id)}
      <span class="attendance-badge">${Number(member.attendance_number) || '-'}</span>
      <div class="profile-media"><img src="${escapeHtml(member.photo_url || DEFAULT_ASSETS.avatar)}" width="600" height="650" loading="lazy" decoding="async" alt="Foto ${escapeHtml(member.full_name)}"></div>
      <div class="profile-copy"><h3>${escapeHtml(member.full_name)}</h3><p class="instagram">${member.instagram ? `@${escapeHtml(String(member.instagram).replace(/^@/,''))}` : 'Instagram belum diisi'}</p></div>
    </article>`).join('');
  grid.querySelectorAll('img').forEach((img) => img.addEventListener('error', (event) => imageFallback(event,'avatar'), { once:true }));
  grid.querySelectorAll('.member-card').forEach((card) => {
    card.addEventListener('click', (event) => { if (!event.target.closest('.card-admin-actions')) openMemberModal(card.dataset.memberId); });
    card.addEventListener('keydown', (event) => { if ((event.key === 'Enter' || event.key === ' ') && !event.target.closest('.card-admin-actions')) { event.preventDefault(); openMemberModal(card.dataset.memberId); } });
  });
  observeReveals(grid);
}

export function openMemberModal(id) {
  const member = getData().class_members.find((item) => String(item.id) === String(id));
  if (!member) return;
  const instagram = member.instagram ? `@${String(member.instagram).replace(/^@/,'')}` : 'Belum diisi';
  const content = document.createElement('div');
  content.className = 'profile-detail';
  const image = document.createElement('img');
  image.src = member.photo_url || DEFAULT_ASSETS.avatar;
  image.alt = `Foto ${member.full_name}`;
  image.width = 700; image.height = 700;
  image.addEventListener('error', (event) => imageFallback(event,'avatar'), { once:true });
  const details = document.createElement('div');
  details.innerHTML = `<div class="detail-list">
    <div><small>Nama lengkap</small><p>${escapeHtml(member.full_name)}</p></div>
    <div><small>Nomor absen</small><p>${Number(member.attendance_number) || '-'}</p></div>
    <div><small>Tempat lahir</small><p>${escapeHtml(member.birth_place || 'Belum diisi')}</p></div>
    <div><small>Tanggal lahir</small><p>${escapeHtml(formatDate(member.birth_date))}</p></div>
    <div><small>Instagram</small><p>${escapeHtml(instagram)}</p></div>
    <div><small>Jabatan</small><p>${escapeHtml(member.position || 'Anggota')}</p></div>
    <div class="wide"><small>Bio</small><p>${escapeHtml(member.bio || 'Belum diisi')}</p></div>
    <div><small>Hobi</small><p>${escapeHtml(member.hobbies || 'Belum diisi')}</p></div>
    <div><small>Cita-cita</small><p>${escapeHtml(member.ambition || 'Belum diisi')}</p></div>
    <div class="wide"><small>Quote pribadi</small><p>${escapeHtml(member.quote || 'Belum diisi')}</p></div>
  </div>`;
  content.append(image, details);
  openModal({ title: member.full_name, content, wide:true });
}

function galleryCategories(items) {
  return ['Semua', ...new Set([...GALLERY_CATEGORIES, ...items.map((item) => item.category).filter(Boolean)])];
}

export function renderGallery(items = getData().gallery) {
  const filters = document.querySelector('#gallery-filters');
  const grid = document.querySelector('#gallery-grid');
  if (!filters || !grid) return;
  const categories = galleryCategories(items);
  if (!categories.includes(galleryFilter)) galleryFilter = 'Semua';
  filters.innerHTML = categories.map((category) => `<button type="button" class="filter-pill${category === galleryFilter ? ' is-active' : ''}" data-gallery-filter="${escapeHtml(category)}">${escapeHtml(category)}</button>`).join('');
  filters.querySelectorAll('button').forEach((button) => button.addEventListener('click', () => { galleryFilter = button.dataset.galleryFilter; renderGallery(items); }));
  visibleGallery = galleryFilter === 'Semua' ? items : items.filter((item) => item.category === galleryFilter);
  if (!visibleGallery.length) { grid.innerHTML = '<div class="empty-state">Belum ada foto pada kategori ini.</div>'; return; }
  grid.innerHTML = visibleGallery.map((item, index) => `
    <figure class="gallery-item reveal" tabindex="0" role="button" aria-label="Buka foto ${escapeHtml(item.title)}" data-gallery-index="${index}" data-id="${escapeHtml(item.id)}">
      ${createAdminActions('gallery', item.id)}
      <img src="${escapeHtml(item.image_url || DEFAULT_ASSETS.gallery)}" width="1200" height="900" loading="lazy" decoding="async" alt="${escapeHtml(item.title || item.category || 'Foto galeri XII IPS')}">
      <figcaption class="gallery-caption"><h3>${escapeHtml(item.title || 'Kenangan XII IPS')}</h3><p>${escapeHtml(item.category || 'Random Moment')}${item.event_date ? ` · ${escapeHtml(formatDate(item.event_date,{day:'numeric',month:'short',year:'numeric'}))}` : ''}</p></figcaption>
    </figure>`).join('');
  grid.querySelectorAll('img').forEach((img) => img.addEventListener('error', (event) => imageFallback(event,'gallery'), { once:true }));
  grid.querySelectorAll('.gallery-item').forEach((item) => {
    const open = (event) => { if (!event.target.closest('.card-admin-actions')) openLightbox(Number(item.dataset.galleryIndex)); };
    item.addEventListener('click', open);
    item.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(event); } });
  });
  observeReveals(grid);
}

export function openLightbox(index = 0) {
  if (!visibleGallery.length) return;
  currentLightboxIndex = Math.max(0, Math.min(index, visibleGallery.length - 1));
  const render = (shell) => {
    const item = visibleGallery[currentLightboxIndex];
    const image = shell.querySelector('#lightbox-image');
    image.src = item.image_url || DEFAULT_ASSETS.gallery;
    image.alt = item.title || 'Foto galeri';
    image.style.setProperty('--zoom','1');
    shell.querySelector('#lightbox-title').textContent = item.title || 'Kenangan XII IPS';
    shell.querySelector('#lightbox-meta').textContent = `${item.category || 'Random Moment'}${item.event_date ? ` · ${formatDate(item.event_date)}` : ''}`;
    shell.querySelector('#lightbox-caption').textContent = item.caption || 'Tidak ada caption.';
    shell.querySelector('[data-lightbox-prev]').disabled = currentLightboxIndex === 0;
    shell.querySelector('[data-lightbox-next]').disabled = currentLightboxIndex === visibleGallery.length - 1;
  };
  const content = document.createElement('div');
  content.className = 'lightbox-panel';
  content.innerHTML = `
    <div class="lightbox-image-wrap"><img id="lightbox-image" width="1600" height="1100" alt=""></div>
    <aside class="lightbox-info"><h2 id="lightbox-title"></h2><p id="lightbox-meta"></p><p id="lightbox-caption"></p><p class="form-hint">Gunakan ← → pada keyboard atau geser horizontal di area foto.</p></aside>
    <div class="lightbox-controls"><button type="button" data-lightbox-prev aria-label="Foto sebelumnya">←</button><button type="button" data-lightbox-next aria-label="Foto berikutnya">→</button></div>
    <div class="lightbox-top"><button type="button" data-lightbox-zoom aria-label="Perbesar foto">＋</button><button type="button" data-lightbox-close aria-label="Tutup">×</button></div>`;
  const shell = openModal({ title:'Galeri XII IPS', content, wide:true, onOpen(shellElement) {
    shellElement.querySelector('.modal-header').hidden = true;
    render(shellElement);
    shellElement.querySelector('[data-lightbox-close]').addEventListener('click', () => closeModal());
    shellElement.querySelector('[data-lightbox-prev]').addEventListener('click', () => { if (currentLightboxIndex > 0) { currentLightboxIndex--; render(shellElement); } });
    shellElement.querySelector('[data-lightbox-next]').addEventListener('click', () => { if (currentLightboxIndex < visibleGallery.length - 1) { currentLightboxIndex++; render(shellElement); } });
    shellElement.querySelector('[data-lightbox-zoom]').addEventListener('click', () => {
      const image = shellElement.querySelector('#lightbox-image');
      const current = Number(image.style.getPropertyValue('--zoom')) || 1;
      image.style.setProperty('--zoom', current >= 2 ? '1' : String(current + .5));
    });
    const wrap = shellElement.querySelector('.lightbox-image-wrap');
    wrap.addEventListener('touchstart', (event) => { touchStartX = event.changedTouches[0].clientX; }, { passive:true });
    wrap.addEventListener('touchend', (event) => {
      const delta = event.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) < 50) return;
      if (delta < 0 && currentLightboxIndex < visibleGallery.length - 1) currentLightboxIndex++;
      if (delta > 0 && currentLightboxIndex > 0) currentLightboxIndex--;
      render(shellElement);
    }, { passive:true });
    const keyHandler = (event) => {
      if (event.key === 'ArrowLeft' && currentLightboxIndex > 0) { currentLightboxIndex--; render(shellElement); }
      if (event.key === 'ArrowRight' && currentLightboxIndex < visibleGallery.length - 1) { currentLightboxIndex++; render(shellElement); }
    };
    shellElement.addEventListener('keydown', keyHandler);
  }});
  return shell;
}

export function renderAll(data = getData()) {
  applySiteSettings(data);
  renderStructure(data.structure_members);
  renderMembers(data.class_members);
  renderGallery(data.gallery);
  refreshAuthUI(getAuthState());
}

export function renderSkeletons() {
  const template = document.querySelector('#skeleton-template');
  const memberGrid = document.querySelector('#member-grid');
  const structureGrid = document.querySelector('#structure-grid');
  if (!template || !memberGrid || !structureGrid) return;
  memberGrid.replaceChildren(...Array.from({length:10}, () => template.content.cloneNode(true)));
  structureGrid.replaceChildren(...Array.from({length:8}, () => template.content.cloneNode(true)));
}

export function refreshAuthUI(state = getAuthState()) {
  const accountButton = document.querySelector('#account-button');
  const loginButton = document.querySelector('#login-manager-button');
  const editButton = document.querySelector('#edit-website-button');
  if (state.user && state.profile) {
    accountButton.hidden = false;
    loginButton.textContent = 'Akun Pengelola';
    editButton.hidden = !state.canEdit || state.profile.must_change_password;
    text('account-name', state.profile.full_name || state.profile.email);
    text('account-role', String(state.profile.role || '').replace('_',' '));
    text('account-initial', (state.profile.full_name || state.profile.email || 'A').trim().charAt(0).toUpperCase());
  } else {
    accountButton.hidden = true;
    loginButton.textContent = 'Login Pengelola';
    editButton.hidden = true;
  }
  document.querySelectorAll('.super-admin-only').forEach((element) => element.hidden = !state.isSuperAdmin);
}

export function openLoginModal() {
  if (getAuthState().user) return openAccountModal();
  const content = document.createElement('form');
  content.id = 'login-form';
  content.className = 'form-grid';
  content.innerHTML = `
    <div class="form-group is-full"><label for="login-email">Email</label><input class="form-control" id="login-email" type="email" autocomplete="username" required placeholder="nama@email.com"></div>
    <div class="form-group is-full"><label for="login-password">Password</label><div class="password-field"><input class="form-control" id="login-password" type="password" autocomplete="current-password" required><button type="button" data-toggle-password aria-label="Tampilkan password">◉</button></div></div>
    <p id="login-error" class="form-error is-full" hidden></p>
    <div class="form-group is-full"><button id="login-submit" class="button button-primary" type="submit">Login</button><button class="text-button" type="button" data-forgot-password>Lupa password?</button></div>`;
  openModal({ title:'Login Pengelola', content, onOpen(shell) {
    const form = shell.querySelector('#login-form');
    const password = shell.querySelector('#login-password');
    shell.querySelector('[data-toggle-password]').addEventListener('click', () => { password.type = password.type === 'password' ? 'text' : 'password'; });
    shell.querySelector('[data-forgot-password]').addEventListener('click', async () => {
      const email = shell.querySelector('#login-email').value.trim();
      if (!email) { toast('Masukkan email terlebih dahulu.', 'error'); return; }
      try { await requestPasswordReset(email); toast('Tautan reset password telah dikirim.'); } catch (error) { toast(error.message, 'error'); }
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const submit = shell.querySelector('#login-submit');
      const errorBox = shell.querySelector('#login-error');
      submit.disabled = true; submit.textContent = 'Memeriksa…'; errorBox.hidden = true;
      try {
        const state = await login(shell.querySelector('#login-email').value, password.value);
        closeModal();
        toast(`Selamat datang, ${state.profile.full_name || state.profile.email}.`);
        if (state.profile.must_change_password) openChangePasswordModal(true);
      } catch (error) {
        errorBox.textContent = error.message; errorBox.hidden = false;
      } finally { submit.disabled = false; submit.textContent = 'Login'; }
    });
  }});
}

export function openChangePasswordModal(required = false) {
  const content = document.createElement('form');
  content.className = 'form-grid';
  content.innerHTML = `
    <p class="form-hint is-full">Gunakan minimal 10 karakter. Kombinasikan huruf besar, huruf kecil, angka, dan simbol.</p>
    <div class="form-group is-full"><label>Password baru</label><input class="form-control" name="password" type="password" minlength="10" autocomplete="new-password" required></div>
    <div class="form-group is-full"><label>Ulangi password</label><input class="form-control" name="confirm" type="password" minlength="10" autocomplete="new-password" required></div>
    <p class="form-error is-full" hidden></p>`;
  openModal({ title: required ? 'Ganti Password Wajib' : 'Ubah Password', content, closeOnOverlay:!required, closeOnEscape:!required, footer:'<button class="button button-primary" type="button" data-save-password>Simpan Password</button>', onOpen(shell) {
    if (required) shell.querySelector('.modal-close').hidden = true;
    shell.querySelector('[data-save-password]').addEventListener('click', async () => {
      const password = shell.querySelector('[name=password]').value;
      const confirm = shell.querySelector('[name=confirm]').value;
      const errorBox = shell.querySelector('.form-error');
      if (password !== confirm) { errorBox.textContent = 'Konfirmasi password tidak sama.'; errorBox.hidden = false; return; }
      try { await updatePassword(password); closeModal(); toast('Password berhasil diperbarui.'); } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; }
    });
  }});
}

export function openAccountModal() {
  const state = getAuthState();
  if (!state.profile) return openLoginModal();
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="detail-list">
      <div class="wide"><small>Nama</small><p>${escapeHtml(state.profile.full_name || '-')}</p></div>
      <div><small>Email</small><p>${escapeHtml(state.profile.email || state.user.email)}</p></div>
      <div><small>Role</small><p>${escapeHtml(String(state.profile.role).replace('_',' '))}</p></div>
      <div><small>Status</small><p>${state.profile.is_active ? 'Aktif' : 'Nonaktif'}</p></div>
      <div><small>Wajib ganti password</small><p>${state.profile.must_change_password ? 'Ya' : 'Tidak'}</p></div>
    </div>`;
  openModal({ title:'Akun Pengelola', content, footer:'<button class="button button-secondary" type="button" data-change-name>Ubah Nama</button><button class="button button-secondary" type="button" data-change-password>Ubah Password</button><button class="button button-primary" type="button" data-logout>Keluar</button>', onOpen(shell) {
    shell.querySelector('[data-change-password]').addEventListener('click', () => openChangePasswordModal(false));
    shell.querySelector('[data-change-name]').addEventListener('click', () => {
      const form = document.createElement('form'); form.className='form-grid';
      form.innerHTML = `<div class="form-group is-full"><label>Nama lengkap</label><input class="form-control" name="name" value="${escapeHtml(state.profile.full_name || '')}" minlength="2" maxlength="100" required></div>`;
      openModal({ title:'Ubah Nama', content:form, footer:'<button class="button button-primary" type="button" data-save-name>Simpan</button>', onOpen(nameShell) {
        nameShell.querySelector('[data-save-name]').addEventListener('click', async () => { try { await updateOwnName(nameShell.querySelector('[name=name]').value); closeModal(); toast('Nama berhasil diperbarui.'); } catch (error) { toast(error.message,'error'); } });
      }});
    });
    shell.querySelector('[data-logout]').addEventListener('click', async () => {
      document.dispatchEvent(new CustomEvent('xii:before-logout'));
      try { await logout(); closeModal(); toast('Anda telah keluar.'); } catch (error) { toast(error.message,'error'); }
    });
  }});
}

function scrollToSection(id) {
  const target = document.getElementById(id);
  if (target) target.scrollIntoView({ behavior:'smooth', block:'start' });
}

function updateActiveNavigation(id) {
  activeSection = id;
  document.querySelectorAll('[data-target]').forEach((button) => {
    if (button.matches('.nav-link, .mobile-nav button')) button.classList.toggle('is-active', button.dataset.target === id);
  });
}

function initializeNavigation() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-target]');
    if (!trigger) return;
    event.preventDefault();
    scrollToSection(trigger.dataset.target);
  });
  document.querySelector('#previous-section')?.addEventListener('click', () => scrollToSection(sections[Math.max(0, sections.indexOf(activeSection)-1)]));
  document.querySelector('#next-section')?.addEventListener('click', () => scrollToSection(sections[Math.min(sections.length-1, sections.indexOf(activeSection)+1)]));
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a,b) => b.intersectionRatio-a.intersectionRatio)[0];
    if (visible) updateActiveNavigation(visible.target.id);
  }, { rootMargin:'-28% 0px -55% 0px', threshold:[0,.15,.35,.6] });
  sections.forEach((id) => { const section = document.getElementById(id); if (section) observer.observe(section); });
}

let revealObserver;
export function observeReveals(root = document) {
  const enabled = getData().site_settings.reveal_enabled !== false;
  if (!enabled || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    root.querySelectorAll?.('.reveal').forEach((element) => element.classList.add('is-visible'));
    return;
  }
  revealObserver ||= new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add('is-visible'); revealObserver.unobserve(entry.target); }
  }), { threshold:.08, rootMargin:'0px 0px -8% 0px' });
  root.querySelectorAll?.('.reveal:not(.is-visible)').forEach((element) => revealObserver.observe(element));
}

function initializeLoading() {
  const screen = document.querySelector('#loading-screen');
  const finish = () => { clearTimeout(loadingTimer); screen.classList.add('is-hidden'); setTimeout(() => screen.remove(), 700); };
  document.querySelector('#skip-loading')?.addEventListener('click', finish);
  const settings = getData().site_settings;
  if (settings.loading_enabled === false) return finish();
  const duration = Math.max(800, Math.min(7000, Number(settings.loading_duration) || 3400));
  const remaining = Math.max(0, duration - (performance.now() - loadingStartedAt));
  loadingTimer = setTimeout(finish, remaining);
}

function initializeEffects() {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = matchMedia('(min-width: 769px)').matches;
  if (!desktop || reduced) return;
  const light = document.querySelector('#mouse-light');
  let pointerFrame = 0;
  window.addEventListener('pointermove', (event) => {
    if (getData().site_settings.mouse_light_enabled === false) return;
    cancelAnimationFrame(pointerFrame);
    pointerFrame = requestAnimationFrame(() => { light.style.left=`${event.clientX}px`; light.style.top=`${event.clientY}px`; light.style.opacity='1'; });
  }, { passive:true });
  document.documentElement.addEventListener('mouseleave', () => light.style.opacity='0');
  startParticles();
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return; ticking = true;
    requestAnimationFrame(() => {
      const hero = document.querySelector('.hero-backdrop');
      const scale = Math.max(100, Math.min(130, Number(getData().background_settings.scale) || 108)) / 100;
      const enabled = getData().site_settings.parallax_enabled !== false;
      const offset = enabled ? Math.min(80, scrollY * .05) : 0;
      if (hero) hero.style.transform = `scale(${scale}) translate3d(0, ${offset}px, 0)`;
      ticking = false;
    });
  }, { passive:true });
}

function startParticles() {
  const canvas = document.querySelector('#particle-canvas');
  const context = canvas.getContext('2d');
  const particles = Array.from({length:30}, () => ({ x:Math.random(), y:Math.random(), r:Math.random()*1.4+.4, speed:Math.random()*.00012+.00004 }));
  const resize = () => { const dpr=Math.min(devicePixelRatio,1.5); canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;context.setTransform(dpr,0,0,dpr,0,0); };
  resize(); window.addEventListener('resize', resize, { passive:true });
  const draw = () => {
    context.clearRect(0,0,innerWidth,innerHeight);
    if (getData().site_settings.particles_enabled === false) { particlesFrame=requestAnimationFrame(draw); return; }
    context.fillStyle='rgba(255,255,255,.7)';
    particles.forEach((p) => { p.y -= p.speed*16; if(p.y<-.02){p.y=1.02;p.x=Math.random();} context.beginPath(); context.arc(p.x*innerWidth,p.y*innerHeight,p.r,0,Math.PI*2); context.fill(); });
    particlesFrame=requestAnimationFrame(draw);
  };
  draw();
}

function initializeMusic() {
  const audio = document.querySelector('#background-audio');
  const button = document.querySelector('#music-toggle');
  button?.addEventListener('click', async () => {
    try {
      if (audio.paused) { await audio.play(); button.textContent='❚❚'; button.setAttribute('aria-label','Jeda musik'); }
      else { audio.pause(); button.textContent='♫'; button.setAttribute('aria-label','Putar musik'); }
    } catch { toast('Browser menolak pemutaran audio. Sentuh tombol lagi.', 'error'); }
  });
}

export function initializeUI() {
  text('current-year', new Date().getFullYear());
  initializeNavigation();
  document.querySelector('#login-manager-button')?.addEventListener('click', openLoginModal);
  document.querySelector('#account-button')?.addEventListener('click', openAccountModal);
  document.querySelector('#member-search')?.addEventListener('input', () => renderMembers());
  document.querySelector('#attendance-filter')?.addEventListener('change', () => renderMembers());
  window.addEventListener('offline', () => { document.querySelector('#connection-banner').hidden=false; });
  window.addEventListener('online', () => { document.querySelector('#connection-banner').hidden=true; toast('Koneksi kembali tersedia.'); });
  initializeMusic();
  observeReveals();
}

export function startPostDataUI() {
  initializeLoading();
  initializeEffects();
}
