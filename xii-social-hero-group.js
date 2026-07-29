const q = (s, r=document) => r.querySelector(s);
const qa = (s, r=document) => Array.from(r.querySelectorAll(s));

function applyBodyClass() {
  document.body.classList.add('xii-social-hero-group');
}

function findHomeSection() {
  return q('#home') || q('[data-section="home"]') || q('.home-section') || q('main section');
}

function ensureHeroCopy(home) {
  if (!home || q('.hero-copy', home)) return;
  const wrap = document.createElement('div');
  wrap.className = 'hero-copy';
  wrap.innerHTML = `
    <div class="hero-kicker">XII SOCIAL ORIGINAL</div>
    <h1 class="hero-title">XII SOCIAL</h1>
    <div class="hero-subtitle">Cerita bersama, satu angkatan, satu kenangan.</div>
    <p class="hero-desc">Tampilan awal dirancang untuk menonjolkan foto bersama sebagai cover utama. Login, edit, anggota, galeri, dan struktur tetap berjalan seperti biasa.</p>
    <div class="hero-meta">
      <span class="hero-chip">Angkatan 2026</span>
      <span class="hero-chip">Official</span>
      <span class="hero-chip">Mobile First</span>
    </div>
    <div class="hero-actions"></div>
    <div class="hero-strip">
      <div class="hero-card"><em>Highlight</em><span>Foto Bersama</span></div>
      <div class="hero-card"><em>Section</em><span>Struktur</span></div>
      <div class="hero-card"><em>Section</em><span>Galeri</span></div>
    </div>
  `;

  const possibleButtons = qa('button, a', home).filter(el => {
    const t = (el.textContent || '').toLowerCase();
    return t.includes('next') || t.includes('jelajah') || t.includes('selengkap') || t.includes('edit');
  }).slice(0,4);
  const actions = q('.hero-actions', wrap);
  possibleButtons.forEach(btn => actions.appendChild(btn.cloneNode(true)));
  if (!actions.children.length) {
    actions.innerHTML = `
      <button class="btn btn-primary cta-main" type="button">Jelajahi Website</button>
      <button class="btn btn-secondary cta-alt" type="button">Edit Website</button>
    `;
  }

  home.prepend(wrap);
}

function renameToXiiSocial() {
  const candidates = qa('body *').filter(el => el.childNodes.length === 1 && el.childNodes[0].nodeType === 3);
  candidates.forEach(el => {
    const txt = (el.textContent || '').trim();
    if (txt === 'XII IPS') el.textContent = 'XII SOCIAL';
    if (txt === 'WELCOME XII IPS') el.textContent = 'WELCOME XII SOCIAL';
  });
}

function addInstagramBadge() {
  const closing = q('#penutup') || q('[data-section="penutup"]') || q('.closing-section') || q('footer');
  if (!closing || q('.ig-badge', closing)) return;
  const a = document.createElement('a');
  a.className = 'ig-badge';
  a.href = 'https://instagram.com/XII.IPSBETHEONE';
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = 'IG : @XII.IPSBETHEONE';
  closing.appendChild(a);
}

function enhanceHeroCardsWithGallery() {
  const cards = qa('.hero-card');
  if (!cards.length) return;
  const galleryImages = qa('img').filter(img => {
    const src = img.getAttribute('src') || '';
    return src && !src.startsWith('data:') && img.naturalWidth > 50 && img.naturalHeight > 50;
  }).slice(0,3);
  cards.forEach((card, idx) => {
    const img = galleryImages[idx];
    if (!img) return;
    card.style.backgroundImage = `linear-gradient(180deg, rgba(0,0,0,.02), rgba(0,0,0,.62)), url('${img.src}')`;
    card.style.backgroundSize = 'cover';
    card.style.backgroundPosition = 'center';
  });
}

function optimizeStructureSection() {
  const struktur = q('#struktur') || q('[data-section="struktur"]') || q('.struktur');
  if (!struktur) return;
  const rows = qa('.org-row, .structure-row', struktur);
  rows.forEach(row => {
    const count = row.children.length;
    row.classList.remove('single','four');
    if (count === 1) row.classList.add('single');
    if (count >= 4) row.classList.add('four');
  });
}

function boot() {
  applyBodyClass();
  renameToXiiSocial();
  const home = findHomeSection();
  if (home) {
    home.classList.add('hero-streaming');
    ensureHeroCopy(home);
  }
  addInstagramBadge();
  optimizeStructureSection();
  setTimeout(enhanceHeroCardsWithGallery, 1200);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
