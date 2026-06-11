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

function extractYtId(url) {
  const m = (url || '').match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
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
function playVideo(event, ytId, videoUrl) {
  event.stopPropagation();
  if (!ytId) { window.open(videoUrl, '_blank', 'noopener,noreferrer'); return; }
  const thumb = event.currentTarget.closest('.card-thumb');
  thumb.innerHTML =
    '<iframe src="https://www.youtube-nocookie.com/embed/' + ytId + '?autoplay=1"' +
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
    const ytId     = extractYtId(v.videoUrl);
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
          '<div class="meta-row"><span class="meta-label">Duration</span><span class="meta-value">' + escHtml(v.duration || '—') + '</span></div>' +
          '<div class="meta-row"><span class="meta-label">Author</span><span class="meta-value">' + escHtml(v.author || '—') + '</span></div>' +
          '<div class="meta-row"><span class="meta-label">Published</span><span class="meta-value">' + formatDate(v.publishedAt) + '</span></div>' +
          '<div class="meta-row"><span class="meta-label">Expires</span><span class="meta-value">' + formatDate(v.expiryDate) + '</span></div>' +
        '</div>' +
      '</div>';

    card.addEventListener('click', function(e) {
      if (e.target.closest('.play-btn')) return;
      selectCard(v.id);
    });

    card.querySelector('.play-btn').addEventListener('click', function(e) {
      playVideo(e, ytId, v.videoUrl);
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

/* ── Fallback demo data (used when API is unavailable) ── */
var FALLBACK_VIDEOS = (function() {
  var divColors = { dallas:'#004990', fredmeyer:'#1a6b3a', atlanta:'#EF3E42', roundys:'#5B2C8D', ruler:'#d46b00', smiths:'#0057a8', michigan:'#2e7d32', columbus:'#37474f' };
  var seriesCat  = {
    'Operations Training Series':'Training',   'Customer Experience Series':'Training',
    'Compliance & Safety Series':'Training',   'Fresh Department Series':'Training',
    'Technology Training Series':'Training',   'A Fresh Welcome Orientation':'Training',
    'Leadership Development Series':'HR & Benefits',
    'Brand & Culture Series':'Corporate',      'Regional Leadership Series':'Corporate',
    'Community Impact Series':'Corporate',
  };
  var raw = {
    dallas:[
      {id:1,title:'Store Operations Overview',series:'Operations Training Series',author:'Operations Team',duration:'12:34',publishDate:'2024-01-15',expiryDate:'2027-01-15',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:2,title:'Customer Service Excellence',series:'Customer Experience Series',author:'Training Team',duration:'08:22',publishDate:'2024-02-01',expiryDate:'2027-02-01',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:3,title:'Inventory Management Basics',series:'Operations Training Series',author:'Operations Team',duration:'15:10',publishDate:'2024-02-20',expiryDate:'2027-02-20',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:4,title:'Food Safety Compliance',series:'Compliance & Safety Series',author:'Safety Team',duration:'20:05',publishDate:'2024-03-05',expiryDate:'2027-03-05',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:5,title:'POS System Training',series:'Technology Training Series',author:'IT Department',duration:'10:48',publishDate:'2024-03-18',expiryDate:'2027-03-18',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:6,title:'Loss Prevention Strategies',series:'Compliance & Safety Series',author:'LP Team',duration:'18:30',publishDate:'2024-04-02',expiryDate:'2027-04-02',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:7,title:'Team Communication Skills',series:'Leadership Development Series',author:'HR Department',duration:'09:15',publishDate:'2024-04-20',expiryDate:'2027-04-20',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:8,title:'Health & Safety Orientation',series:'Compliance & Safety Series',author:'Safety Team',duration:'14:22',publishDate:'2024-05-01',expiryDate:'2027-05-01',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:9,title:'Produce Department Standards',series:'Fresh Department Series',author:'Merchandising Team',duration:'11:40',publishDate:'2024-05-15',expiryDate:'2027-05-15',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:10,title:'New Employee Onboarding',series:'A Fresh Welcome Orientation',author:'HR Department',duration:'25:00',publishDate:'2024-06-01',expiryDate:'2027-06-01',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
    ],
    fredmeyer:[
      {id:1,title:'Fred Meyer Brand Standards',series:'Brand & Culture Series',author:'Brand Team',duration:'13:20',publishDate:'2024-01-10',expiryDate:'2027-01-10',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:2,title:'Multi-Department Operations',series:'Operations Training Series',author:'Operations Team',duration:'22:15',publishDate:'2024-02-05',expiryDate:'2027-02-05',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:3,title:'Pharmacy Compliance Training',series:'Compliance & Safety Series',author:'Pharmacy Team',duration:'30:00',publishDate:'2024-02-18',expiryDate:'2027-02-18',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:4,title:'Fuel Center Procedures',series:'Operations Training Series',author:'Safety Team',duration:'16:45',publishDate:'2024-03-01',expiryDate:'2027-03-01',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:5,title:'Electronics Department Sales',series:'Customer Experience Series',author:'Training Team',duration:'14:55',publishDate:'2024-03-22',expiryDate:'2027-03-22',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:6,title:'Deli & Bakery Operations',series:'Fresh Department Series',author:'Merchandising Team',duration:'19:30',publishDate:'2024-04-08',expiryDate:'2027-04-08',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:7,title:'Click-List Fulfillment',series:'Technology Training Series',author:'E-Commerce Team',duration:'12:00',publishDate:'2024-04-25',expiryDate:'2027-04-25',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:8,title:'Seasonal Merchandise Setup',series:'Operations Training Series',author:'Merchandising Team',duration:'08:45',publishDate:'2024-05-10',expiryDate:'2027-05-10',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:9,title:'Meat Department Training',series:'Fresh Department Series',author:'Merchandising Team',duration:'17:20',publishDate:'2024-05-28',expiryDate:'2027-05-28',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:10,title:'Asset Protection Overview',series:'Compliance & Safety Series',author:'LP Team',duration:'21:10',publishDate:'2024-06-10',expiryDate:'2027-06-10',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
    ],
    atlanta:[
      {id:1,title:'Atlanta Market Introduction',series:'Regional Leadership Series',author:'Regional Director',duration:'10:00',publishDate:'2024-01-08',expiryDate:'2027-01-08',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:2,title:'Southern Customer Experience',series:'Customer Experience Series',author:'Training Team',duration:'09:30',publishDate:'2024-01-25',expiryDate:'2027-01-25',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:3,title:'Distribution Center Liaison',series:'Operations Training Series',author:'Operations Team',duration:'16:00',publishDate:'2024-02-12',expiryDate:'2027-02-12',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:4,title:'Fresh Food Initiatives',series:'Fresh Department Series',author:'Merchandising Team',duration:'14:20',publishDate:'2024-03-01',expiryDate:'2027-03-01',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:5,title:'Community Engagement Programs',series:'Community Impact Series',author:'Community Team',duration:'11:55',publishDate:'2024-03-18',expiryDate:'2027-03-18',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:6,title:'Shrink Reduction Action Plan',series:'Compliance & Safety Series',author:'LP Team',duration:'18:00',publishDate:'2024-04-05',expiryDate:'2027-04-05',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:7,title:'HR Policies & Procedures',series:'Leadership Development Series',author:'HR Department',duration:'22:40',publishDate:'2024-04-22',expiryDate:'2027-04-22',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:8,title:'Store Reset & Remodel Process',series:'Operations Training Series',author:'Operations Team',duration:'20:15',publishDate:'2024-05-06',expiryDate:'2027-05-06',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:9,title:'Digital Coupon Program',series:'Technology Training Series',author:'Marketing Team',duration:'07:30',publishDate:'2024-05-20',expiryDate:'2027-05-20',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:10,title:'Floral Department Basics',series:'Fresh Department Series',author:'Merchandising Team',duration:'13:10',publishDate:'2024-06-03',expiryDate:'2027-06-03',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
    ],
    roundys:[
      {id:1,title:"Roundy's Heritage & Values",series:'Brand & Culture Series',author:'Brand Team',duration:'11:30',publishDate:'2024-01-12',expiryDate:'2027-01-12',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:2,title:'Pick N Save Store Standards',series:'Operations Training Series',author:'Operations Team',duration:'15:45',publishDate:'2024-02-03',expiryDate:'2027-02-03',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:3,title:'Metro Market Excellence',series:'Customer Experience Series',author:'Training Team',duration:'13:00',publishDate:'2024-02-22',expiryDate:'2027-02-22',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:4,title:'Wisconsin Compliance Training',series:'Compliance & Safety Series',author:'Safety Team',duration:'19:20',publishDate:'2024-03-10',expiryDate:'2027-03-10',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:5,title:'Warehouse Efficiency',series:'Operations Training Series',author:'Operations Team',duration:'16:50',publishDate:'2024-03-28',expiryDate:'2027-03-28',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:6,title:'Private Label Promotion',series:'Customer Experience Series',author:'Marketing Team',duration:'10:20',publishDate:'2024-04-15',expiryDate:'2027-04-15',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:7,title:'Loyalty Program Training',series:'Technology Training Series',author:'Marketing Team',duration:'08:35',publishDate:'2024-05-01',expiryDate:'2027-05-01',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:8,title:'Seasonal Holiday Planning',series:'Operations Training Series',author:'Merchandising Team',duration:'24:00',publishDate:'2024-05-18',expiryDate:'2027-05-18',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:9,title:'Cheese & Specialty Foods',series:'Fresh Department Series',author:'Merchandising Team',duration:'17:40',publishDate:'2024-06-02',expiryDate:'2027-06-02',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:10,title:'Energy Management',series:'Operations Training Series',author:'Facilities Team',duration:'12:25',publishDate:'2024-06-18',expiryDate:'2027-06-18',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
    ],
    ruler:[
      {id:1,title:'Ruler Foods Business Model',series:'Brand & Culture Series',author:'Brand Team',duration:'09:00',publishDate:'2024-01-20',expiryDate:'2027-01-20',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:2,title:'Cost Control Fundamentals',series:'Operations Training Series',author:'Operations Team',duration:'14:30',publishDate:'2024-02-08',expiryDate:'2027-02-08',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:3,title:'Efficient Stocking Techniques',series:'Operations Training Series',author:'Operations Team',duration:'11:10',publishDate:'2024-02-26',expiryDate:'2027-02-26',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:4,title:'Cash Handling Procedures',series:'Compliance & Safety Series',author:'Finance Team',duration:'10:45',publishDate:'2024-03-14',expiryDate:'2027-03-14',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:5,title:'Limited SKU Strategy',series:'Brand & Culture Series',author:'Brand Team',duration:'08:00',publishDate:'2024-04-01',expiryDate:'2027-04-01',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:6,title:'Customer Value Communication',series:'Customer Experience Series',author:'Training Team',duration:'06:50',publishDate:'2024-04-18',expiryDate:'2027-04-18',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:7,title:'Small Store Operations',series:'Operations Training Series',author:'Operations Team',duration:'13:20',publishDate:'2024-05-05',expiryDate:'2027-05-05',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:8,title:'Receiving & Date Checks',series:'Compliance & Safety Series',author:'Safety Team',duration:'09:55',publishDate:'2024-05-22',expiryDate:'2027-05-22',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:9,title:'Team Cross-Training',series:'Leadership Development Series',author:'HR Department',duration:'15:00',publishDate:'2024-06-08',expiryDate:'2027-06-08',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:10,title:'Markdowns & Clearance',series:'Operations Training Series',author:'Operations Team',duration:'07:40',publishDate:'2024-06-25',expiryDate:'2027-06-25',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
    ],
    smiths:[
      {id:1,title:"Smith's Food & Drug Overview",series:'Brand & Culture Series',author:'Brand Team',duration:'12:00',publishDate:'2024-01-16',expiryDate:'2027-01-16',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:2,title:'Fuel Rewards Program',series:'Customer Experience Series',author:'Marketing Team',duration:'08:10',publishDate:'2024-02-04',expiryDate:'2027-02-04',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:3,title:'Natural & Organic Sections',series:'Fresh Department Series',author:'Merchandising Team',duration:'16:30',publishDate:'2024-02-22',expiryDate:'2027-02-22',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:4,title:'Nevada Regulatory Compliance',series:'Compliance & Safety Series',author:'Legal Team',duration:'21:00',publishDate:'2024-03-11',expiryDate:'2027-03-11',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:5,title:'Wine & Beer Department',series:'Fresh Department Series',author:'Merchandising Team',duration:'18:45',publishDate:'2024-03-29',expiryDate:'2027-03-29',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:6,title:'Desert Climate Food Safety',series:'Compliance & Safety Series',author:'Safety Team',duration:'14:00',publishDate:'2024-04-16',expiryDate:'2027-04-16',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:7,title:'E-Commerce Fulfillment',series:'Technology Training Series',author:'E-Commerce Team',duration:'11:25',publishDate:'2024-05-03',expiryDate:'2027-05-03',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:8,title:'Grand Opening Procedures',series:'Operations Training Series',author:'Operations Team',duration:'23:50',publishDate:'2024-05-20',expiryDate:'2027-05-20',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:9,title:'Mountain States Market Insights',series:'Regional Leadership Series',author:'Regional Director',duration:'10:30',publishDate:'2024-06-06',expiryDate:'2027-06-06',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:10,title:'Holiday Catering Services',series:'Customer Experience Series',author:'Training Team',duration:'15:55',publishDate:'2024-06-23',expiryDate:'2027-06-23',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
    ],
    michigan:[
      {id:1,title:'Michigan Market Overview',series:'Regional Leadership Series',author:'Regional Director',duration:'11:00',publishDate:'2024-01-22',expiryDate:'2027-01-22',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:2,title:'Great Lakes Regional Training',series:'Operations Training Series',author:'Operations Team',duration:'14:15',publishDate:'2024-02-10',expiryDate:'2027-02-10',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:3,title:'Labor Law Compliance - MI',series:'Compliance & Safety Series',author:'Legal Team',duration:'19:45',publishDate:'2024-03-01',expiryDate:'2027-03-01',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:4,title:'Seafood Department Training',series:'Fresh Department Series',author:'Merchandising Team',duration:'17:00',publishDate:'2024-03-19',expiryDate:'2027-03-19',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:5,title:'Union Relations Basics',series:'Leadership Development Series',author:'HR Department',duration:'22:30',publishDate:'2024-04-05',expiryDate:'2027-04-05',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:6,title:'Store Remodel Standards',series:'Operations Training Series',author:'Operations Team',duration:'20:00',publishDate:'2024-04-23',expiryDate:'2027-04-23',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:7,title:'Prepared Foods Expansion',series:'Fresh Department Series',author:'Merchandising Team',duration:'13:30',publishDate:'2024-05-10',expiryDate:'2027-05-10',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:8,title:'Diversity & Inclusion Training',series:'Leadership Development Series',author:'HR Department',duration:'18:20',publishDate:'2024-05-28',expiryDate:'2027-05-28',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:9,title:'Fleet & Delivery Coordination',series:'Technology Training Series',author:'E-Commerce Team',duration:'12:40',publishDate:'2024-06-14',expiryDate:'2027-06-14',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:10,title:'Cold Weather Readiness',series:'Operations Training Series',author:'Facilities Team',duration:'09:20',publishDate:'2024-06-30',expiryDate:'2027-06-30',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
    ],
    columbus:[
      {id:1,title:'Columbus Division Kickoff',series:'Regional Leadership Series',author:'Regional Director',duration:'10:30',publishDate:'2024-01-18',expiryDate:'2027-01-18',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:2,title:'Ohio Regulatory Updates',series:'Compliance & Safety Series',author:'Legal Team',duration:'16:00',publishDate:'2024-02-06',expiryDate:'2027-02-06',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:3,title:'Analytics & Reporting Tools',series:'Technology Training Series',author:'IT Department',duration:'20:45',publishDate:'2024-02-24',expiryDate:'2027-02-24',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:4,title:'Meat Case Optimization',series:'Fresh Department Series',author:'Merchandising Team',duration:'15:10',publishDate:'2024-03-13',expiryDate:'2027-03-13',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:5,title:'Store Director Leadership',series:'Leadership Development Series',author:'HR Department',duration:'28:00',publishDate:'2024-04-01',expiryDate:'2027-04-01',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:6,title:'Pharmacy Integration',series:'Operations Training Series',author:'Pharmacy Team',duration:'17:35',publishDate:'2024-04-18',expiryDate:'2027-04-18',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:7,title:'Bakery Artisan Program',series:'Fresh Department Series',author:'Merchandising Team',duration:'14:50',publishDate:'2024-05-06',expiryDate:'2027-05-06',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:8,title:'Vendor Relations & Resets',series:'Operations Training Series',author:'Merchandising Team',duration:'11:20',publishDate:'2024-05-23',expiryDate:'2027-05-23',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:9,title:'Kroger History',series:'A Fresh Welcome Orientation',author:'HR Department',duration:'19:00',publishDate:'2024-06-10',expiryDate:'2027-06-10',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
      {id:10,title:'Shrink Action Planning',series:'Compliance & Safety Series',author:'LP Team',duration:'13:45',publishDate:'2024-06-27',expiryDate:'2027-06-27',videoUrl:'https://kroger.qumucloud.com/view/iUpLSGWMuTfRsd1QjXYFoK'},
    ],
  };
  var out = [], uid = 1;
  Object.keys(raw).forEach(function(div) {
    raw[div].forEach(function(v) {
      out.push({
        id: String(uid++),
        title: v.title,
        description: v.series + ' — ' + v.author,
        series: v.series,
        author: v.author,
        duration: v.duration,
        category: seriesCat[v.series] || 'Corporate',
        publishedAt: v.publishDate,
        expiryDate: v.expiryDate,
        thumbnailColor: divColors[div] || '#004990',
        videoUrl: v.videoUrl,
      });
    });
  });
  return out;
}());

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

  const url = 'http://localhost:3000/api/qumu_cloud' + (category ? '?category=' + encodeURIComponent(category) : '');
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('API error ' + res.status);
    allVideos = await res.json();
  } catch(e) {
    console.warn('[Demo] API unavailable — showing fallback data');
    allVideos = category
      ? FALLBACK_VIDEOS.filter(function(v) { return v.category === category; })
      : FALLBACK_VIDEOS.slice();
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
