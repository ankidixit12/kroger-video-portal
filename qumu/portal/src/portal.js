const categorySelect = document.getElementById('categorySelect');
const searchInput    = document.getElementById('searchInput');
const cardGrid       = document.getElementById('cardGrid');
const emptyState     = document.getElementById('emptyState');
const errorState     = document.getElementById('errorState');
const noResults      = document.getElementById('noResults');
const sectionTitle   = document.getElementById('sectionTitle');
const countBadge     = document.getElementById('countBadge');
const btnAddVideo    = document.getElementById('btnAddVideo');
const btnCancel      = document.getElementById('btnCancel');
const pagination     = document.getElementById('pagination');
const pagePrev       = document.getElementById('pagePrev');
const pageNext       = document.getElementById('pageNext');
const pageNumbers    = document.getElementById('pageNumbers');

const ITEMS_PER_PAGE = 32;

let allVideos       = [];
let filteredCache   = [];
let selectedId      = null;
let currentPage     = 1;
let currentCategory = '';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const yyyy = d.getFullYear();
    return mm + '/' + dd + '/' + yyyy;
  } catch(e) { return iso; }
}

function getExpiryDate(video) {
  return video.withdrawOn || video.expiryDate || '';
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function highlight(text, q) {
  if (!q) return escHtml(text);
  const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escHtml(text).replace(new RegExp('(' + esc + ')', 'gi'), '<mark class="match-highlight">$1</mark>');
}

/* ── Pagination ── */
function renderPagination(total) {
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE) || 1;
  const disabled   = totalPages <= 1;

  pagination.style.display = 'flex';
  pagePrev.disabled = disabled || currentPage === 1;
  pageNext.disabled = disabled || currentPage === totalPages;

  pageNumbers.innerHTML = '';
  var numPages = disabled ? 1 : totalPages;
  for (var p = 1; p <= numPages; p++) {
    var btn = document.createElement('button');
    btn.className = 'page-btn' + (p === currentPage ? ' active' : '');
    btn.textContent = p;
    btn.disabled = disabled;
    btn.dataset.page = p;
    btn.addEventListener('click', function() {
      currentPage = Number(this.dataset.page);
      renderPage();
    });
    pageNumbers.appendChild(btn);
  }
}

function renderPage() {
  const start = (currentPage - 1) * ITEMS_PER_PAGE;
  const page  = filteredCache.slice(start, start + ITEMS_PER_PAGE);
  renderCards(page, searchInput.value.trim().toLowerCase());
  renderPagination(filteredCache.length);
}

pagePrev.addEventListener('click', function() {
  if (currentPage > 1) { currentPage--; renderPage(); }
});
pageNext.addEventListener('click', function() {
  const totalPages = Math.ceil(filteredCache.length / ITEMS_PER_PAGE);
  if (currentPage < totalPages) { currentPage++; renderPage(); }
});

/* ── Selection ── */
function selectCard(id) {
  selectedId = id;
  cardGrid.querySelectorAll('.video-card').forEach(function(c) {
    c.classList.toggle('selected', c.dataset.id === String(id));
  });
  btnAddVideo.disabled = false;
}

/* ── Play ── */
function playVideo(event, videoUrl) {
  event.stopPropagation();
  if (!videoUrl) return;
  const thumb = event.currentTarget.closest('.card-thumb');
  const separator = videoUrl.indexOf('?') === -1 ? '?' : '&';
  const embedSrc = String(videoUrl).replace(/"/g, '&quot;') + separator + 'autoplay=1';
  thumb.innerHTML =
    '<iframe src="' + embedSrc + '"' +
    ' allow="autoplay;encrypted-media;picture-in-picture" allowfullscreen></iframe>';
}

/* ── Render cards ── */
function renderCards(videos, query) {
  cardGrid.innerHTML = '';

  if (videos.length === 0) {
    cardGrid.style.display   = 'none';
    countBadge.style.display = 'none';
    noResults.style.display  = query ? 'block' : 'none';
    emptyState.style.display = query ? 'none'  : 'block';
    if (!query) {
      emptyState.querySelector('p').textContent    = 'No video selected';
      emptyState.querySelector('span').textContent = 'The video library is currently unavailable.';
    }
    renderPagination(0);
    return;
  }

  noResults.style.display  = 'none';
  emptyState.style.display = 'none';
  cardGrid.style.display   = 'grid';
  countBadge.style.display = 'inline-flex';
  countBadge.textContent   = filteredCache.length + ' video' + (filteredCache.length !== 1 ? 's' : '');

  videos.forEach(function(v) {
    const thumbUrl = v.thumbnailUrl || ('https://picsum.photos/seed/kroger' + v.id + '/640/360');
    const isSelected = selectedId === v.id;

    const card = document.createElement('div');
    card.className  = 'video-card' + (isSelected ? ' selected' : '');
    card.dataset.id = v.id;

    card.innerHTML =
      '<div class="card-thumb" style="background-image:url(' + thumbUrl + ')">' +
        '<div class="radio-circle"><span class="radio-dot"></span></div>' +
        '<button class="play-btn" aria-label="Play ' + escHtml(v.title) + '">' +
          '<span class="play-circle">' +
            '<svg width="18" height="18" viewBox="0 0 24 24" fill="#003087"><path d="M8 5v14l11-7z"/></svg>' +
          '</span>' +
        '</button>' +
        '<span class="duration-badge">' + escHtml(v.duration || '') + '</span>' +
      '</div>' +
      '<div class="card-info">' +
        '<p class="card-title">' + highlight(v.title, query) + '</p>' +
        '<p class="card-series">' + escHtml(v.series || v.category || '') + '</p>' +
        '<div class="meta-table">' +
          '<div class="meta-row"><span class="meta-label">Author</span><span class="meta-value">' + escHtml(v.author || '—') + '</span></div>' +
          '<div class="meta-row"><span class="meta-label">Published</span><span class="meta-value">' + formatDate(v.publishedAt) + '</span></div>' +
          '<div class="meta-row"><span class="meta-label">Expires</span><span class="meta-value">' + formatDate(getExpiryDate(v)) + '</span></div>' +
        '</div>' +
      '</div>';

    card.addEventListener('click', function(e) {
      if (e.target.closest('.play-btn')) return;
      selectCard(v.id);
    });

    card.querySelector('.play-btn').addEventListener('click', function(e) {
      playVideo(e, v.videoUrl);
    });

    cardGrid.appendChild(card);
  });
}

/* ── Filter ── */
function filterAndRender() {
  const q = searchInput.value.trim().toLowerCase();
  filteredCache = q
    ? allVideos.filter(function(v) {
        return (v.title    || '').toLowerCase().includes(q) ||
               (v.series   || '').toLowerCase().includes(q) ||
               (v.author   || '').toLowerCase().includes(q) ||
               (v.category || '').toLowerCase().includes(q);
      })
    : allVideos.slice();
  currentPage = 1;
  renderPage();
}

/* ── Qumu API helpers ── */
var QUMU_API = 'https://staffbase-qumu-service-gfh7bccrescea0fe.eastus-01.azurewebsites.net/staffbase-qumu/kulus';


function msToDuration(ms) {
  var totalSec = Math.floor(ms / 1000);
  var min = Math.floor(totalSec / 60);
  var sec = totalSec % 60;
  return min + ':' + (sec < 10 ? '0' + sec : sec);
}

function getMeta(metadata, title) {
  var field = (metadata || []).find(function(m) { return m.title === title; });
  if (!field || field.value == null) return null;
  if (Array.isArray(field.value)) return field.value.length ? field.value[0] : null;
  if (typeof field.value === 'object') return null;
  return String(field.value);
}

function mapKuluToVideoItem(k) {
  var division = getMeta(k.metadata, 'Division') || '';
  var category = getMeta(k.metadata, 'Category') || 'Corporate';
  var description = getMeta(k.metadata, 'Description') || '';
  var metaAuthor = getMeta(k.metadata, 'Author');
  var author = metaAuthor || (k.publisher && k.publisher.name) || '';
  return {
    id: k.guid,
    title: k.title || '',
    description: description,
    author: author,
    duration: k.duration ? msToDuration(k.duration) : '0:00',
    category: category,
    division: division || undefined,
    publishedAt: k.published || k.created || '',
    expiryDate: k.withdrawOn || k.expiryDate || '',
    thumbnailColor: DIVISION_COLORS[division] || '#004990',
    thumbnailUrl: k.thumbnail && k.thumbnail.url ? k.thumbnail.url : undefined,
    videoUrl: k.player || '',
  };
}

/* ── Load ── */
async function loadVideos(category) {
  currentCategory = category;
  searchInput.value = '';
  emptyState.style.display  = 'block';
  errorState.style.display  = 'none';
  cardGrid.style.display    = 'none';
  noResults.style.display   = 'none';
  countBadge.style.display  = 'none';
  pagination.style.display  = 'none';
  emptyState.querySelector('p').textContent    = 'Loading videos…';
  emptyState.querySelector('span').textContent = 'Fetching from the video library.';

  var query = new URLSearchParams({ page: '1', perPage: '100', sort: '-updatedAt' });
  var authHeader = { Authorization: 'Basic ' + btoa(process.env.QUMU_USERNAME + ':' + process.env.QUMU_PASSWORD) };
  try {
    var res = await fetch(QUMU_API + '?' + query.toString(), { headers: authHeader });
    if (!res.ok) throw new Error('API error ' + res.status);
    var data = await res.json();
    allVideos = (data.kulus || []).map(mapKuluToVideoItem);
    if (category) {
      allVideos = allVideos.filter(function(v) { return v.category === category; });
    }
  } catch(e) {
    console.warn('[VideoPortal] API unavailable', e);
    allVideos = [];
  }

  filteredCache = allVideos.slice();
  currentPage   = 1;
  sectionTitle.textContent = category ? category + ' — Videos' : 'All Videos';

  if (allVideos.length === 0) {
    emptyState.querySelector('p').textContent    = 'No videos available';
    emptyState.querySelector('span').textContent = 'There are no videos in this category.';
    emptyState.style.display = 'block';
    return;
  }

  renderPage();
}

document.getElementById('btnTryAgain').addEventListener('click', function() {
  loadVideos(currentCategory);
});

/* ── Event listeners ── */
categorySelect.addEventListener('change', function() { loadVideos(categorySelect.value); });
searchInput.addEventListener('input', filterAndRender);

btnCancel.addEventListener('click', function() {
  selectedId = null;
  cardGrid.querySelectorAll('.video-card').forEach(function(c) { c.classList.remove('selected'); });
  btnAddVideo.disabled = true;
});

btnAddVideo.addEventListener('click', function() {});

btnAddVideo.disabled = true;
loadVideos('');
