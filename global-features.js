// ============================================================
// shared/global-features.js
// البحث العام + الوضع الليلي — مشترك بين كل الصفحات
// ============================================================

// ══════════════════════════════════════════════════════
// ★ الوضع الليلي (Dark Mode) ★
// ══════════════════════════════════════════════════════

const DARK_KEY = 'selim_dark_mode'

export function initDarkMode() {
  // استعادة الحالة من localStorage
  const saved = localStorage.getItem(DARK_KEY)
  if (saved === 'true') {
    document.body.classList.add('dark-mode')
    updateDarkIcon(true)
  }
}

export function toggleDarkMode() {
  const isDark = document.body.classList.toggle('dark-mode')
  document.body.classList.add('dark-mode-transition')
  setTimeout(() => document.body.classList.remove('dark-mode-transition'), 400)
  localStorage.setItem(DARK_KEY, isDark)
  updateDarkIcon(isDark)
}

function updateDarkIcon(isDark) {
  const icon = document.getElementById('dark-toggle-icon')
  if (icon) icon.className = isDark ? 'fa-solid fa-sun' : 'fa-regular fa-moon'
  const btn = document.getElementById('dark-toggle-btn')
  if (btn) btn.title = isDark ? 'الوضع النهاري' : 'الوضع الليلي'
}

// ══════════════════════════════════════════════════════
// ★ البحث العام (Global Search) ★
// ══════════════════════════════════════════════════════

let searchIndex = []      // بيانات البحث تُملأ ديناميكياً من Supabase
let searchFocusIdx = -1
let searchOverlayEl = null

export function initGlobalSearch(sb, orgId, navFn, openModalFn) {
  // إنشاء overlay الـ search إذا لم يكن موجوداً
  if (!document.getElementById('global-search-overlay')) {
    const overlay = document.createElement('div')
    overlay.id = 'global-search-overlay'
    overlay.className = 'search-overlay'
    overlay.innerHTML = `
      <div class="search-modal" onclick="event.stopPropagation()">
        <div class="search-input-wrap">
          <i class="fa-solid fa-magnifying-glass" style="color:var(--text-muted);font-size:18px;flex-shrink:0"></i>
          <input class="search-input" id="global-search-input"
            placeholder="ابحث عن مريض، طبيب، موعد..."
            oninput="window._gsSearch(this.value)"
            onkeydown="window._gsKey(event)"/>
          <span style="font-size:11px;color:var(--text-light);background:var(--bg);padding:2px 7px;border-radius:4px;border:1px solid var(--border);white-space:nowrap">ESC للإغلاق</span>
        </div>
        <div id="gs-results"></div>
        <div style="padding:10px 20px;border-top:1px solid var(--border);display:flex;gap:12px;font-size:11px;color:var(--text-light)">
          <span>↑↓ للتنقل</span>
          <span>Enter للفتح</span>
          <span>ESC للإغلاق</span>
        </div>
      </div>
    `
    overlay.addEventListener('click', closeGlobalSearch)
    document.body.appendChild(overlay)
    searchOverlayEl = overlay
  }

  // اختصار Ctrl+K
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      openGlobalSearch(sb, orgId)
    }
    if (e.key === 'Escape') closeGlobalSearch()
  })

  // ربط وظائف البحث بـ window
  window._gsSearch = (q) => runSearch(q, navFn, openModalFn)
  window._gsKey = (e) => handleKey(e, navFn, openModalFn)

  // استعداد: بناء الـ index الثابت (صفحات + إجراءات)
  buildStaticIndex(navFn, openModalFn)
}

export function openGlobalSearch(sb, orgId) {
  const overlay = document.getElementById('global-search-overlay')
  if (!overlay) return
  overlay.classList.add('open')
  const input = document.getElementById('global-search-input')
  if (input) { input.value = ''; input.focus() }
  searchFocusIdx = -1
  renderDefaultResults()
}

export function closeGlobalSearch() {
  const overlay = document.getElementById('global-search-overlay')
  if (overlay) overlay.classList.remove('open')
  searchFocusIdx = -1
}

// بناء index الصفحات الثابتة
function buildStaticIndex(navFn, openModalFn) {
  searchIndex = [
    { type: 'page', title: 'لوحة التحكم',      sub: 'نظرة عامة',          icon: 'fa-gauge-high',          bg: 'var(--primary-light)', color: 'var(--primary)',  action: () => navFn?.('dashboard') },
    { type: 'page', title: 'المواعيد',          sub: 'إدارة المواعيد',      icon: 'fa-calendar-check',      bg: '#EEF2FF',              color: '#6366F1',         action: () => navFn?.('appointments') },
    { type: 'page', title: 'العرض الأسبوعي',   sub: 'جدول الأسبوع',        icon: 'fa-calendar-week',       bg: 'var(--primary-light)', color: 'var(--primary)',  action: () => navFn?.('week-view') },
    { type: 'page', title: 'المرضى',            sub: 'قائمة المرضى',        icon: 'fa-users',               bg: '#D1FAE5',              color: '#065F46',         action: () => navFn?.('patients') },
    { type: 'page', title: 'فاتورة زيارة',      sub: 'نقطة البيع POS',      icon: 'fa-cash-register',       bg: 'var(--success-light)', color: 'var(--success)',  action: () => navFn?.('pos') },
    { type: 'page', title: 'الفواتير',          sub: 'سجل الفواتير',        icon: 'fa-file-invoice-dollar', bg: 'var(--warning-light)', color: 'var(--warning)',  action: () => navFn?.('invoices') },
    { type: 'page', title: 'تذكير المرضى',      sub: 'واتساب وSMS',         icon: 'fa-bell-ring',           bg: '#FEF3C7',              color: '#F59E0B',         action: () => navFn?.('reminders') },
    { type: 'page', title: 'التقرير المالي',    sub: 'إيرادات ومصروفات',    icon: 'fa-chart-pie',           bg: 'var(--primary-light)', color: 'var(--primary)',  action: () => navFn?.('financial') },
    { type: 'page', title: 'إدارة الخدمات',    sub: 'الأسعار والفئات',     icon: 'fa-briefcase-medical',   bg: '#D1FAE5',              color: '#065F46',         action: () => navFn?.('services') },
    { type: 'page', title: 'التعاقدات',         sub: 'عقود الشركات',        icon: 'fa-file-contract',       bg: '#EDE9FE',              color: '#5B21B6',         action: () => navFn?.('contracts') },
    { type: 'page', title: 'الأدوار والصلاحيات', sub: 'إدارة الأدوار',     icon: 'fa-shield-halved',       bg: '#DBEAFE',              color: '#1D4ED8',         action: () => navFn?.('roles') },
    { type: 'page', title: 'مركز التصدير',     sub: 'Excel وPDF',           icon: 'fa-file-export',         bg: '#FEE2E2',              color: '#DC2626',         action: () => navFn?.('export') },
    { type: 'page', title: 'الإعدادات',         sub: 'إعدادات العيادة',     icon: 'fa-gear',                bg: '#F1F5F9',              color: '#475569',         action: () => navFn?.('settings') },
    { type: 'action', title: 'موعد جديد',       sub: 'إضافة موعد للتقويم',  icon: 'fa-calendar-plus',       bg: 'var(--warning-light)', color: 'var(--warning)',  action: () => openModalFn?.('modal-appt') },
    { type: 'action', title: 'مريض جديد',       sub: 'تسجيل مريض جديد',    icon: 'fa-user-plus',           bg: '#D1FAE5',              color: '#065F46',         action: () => openModalFn?.('modal-patient') },
  ]
}

// إضافة نتائج المرضى للـ index من Supabase
export async function loadPatientsIndex(sb, orgId, navFn) {
  const { data } = await sb.from('patients')
    .select('id,full_name,mrn,phone,status')
    .eq('organization_id', orgId)
    .order('full_name')
    .limit(100)
  if (!data) return
  const patientEntries = data.map(p => ({
    type: 'patient',
    title: p.full_name,
    sub: `${p.mrn} · ${p.phone || 'لا يوجد هاتف'} · ${p.status || ''}`,
    icon: 'fa-user',
    bg: '#DBEAFE',
    color: '#1D4ED8',
    action: () => navFn?.('patients')
  }))
  // أضف للـ index (بعد الـ static entries)
  searchIndex = searchIndex.filter(e => e.type !== 'patient')
  searchIndex.push(...patientEntries)
}

function runSearch(q, navFn, openModalFn) {
  const results = document.getElementById('gs-results')
  if (!results) return
  if (!q.trim()) { renderDefaultResults(); return }
  const query = q.toLowerCase()
  const matched = searchIndex.filter(e =>
    e.title.toLowerCase().includes(query) ||
    e.sub.toLowerCase().includes(query)
  )
  if (!matched.length) {
    results.innerHTML = `
      <div style="text-align:center;padding:32px;color:var(--text-muted)">
        <i class="fa-solid fa-magnifying-glass" style="font-size:28px;color:var(--border);display:block;margin-bottom:8px"></i>
        لا توجد نتائج لـ "<strong>${q}</strong>"
      </div>`
    return
  }
  // تجميع حسب النوع
  const groups = {}
  const typeLabels = { page: 'الصفحات', action: 'الإجراءات السريعة', patient: 'المرضى', doctor: 'الأطباء' }
  matched.forEach(r => {
    if (!groups[r.type]) groups[r.type] = []
    groups[r.type].push(r)
  })
  results.innerHTML = Object.entries(groups).map(([type, items]) =>
    `<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;padding:10px 20px 4px">${typeLabels[type] || type}</div>` +
    items.map((r, i) => `
      <div class="gs-item" onclick="(${r.action.toString()})();window._gsClose()" data-idx="${i}">
        <div style="width:34px;height:34px;border-radius:8px;background:${r.bg};color:${r.color};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
          <i class="fa-solid ${r.icon}"></i>
        </div>
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text)">${highlightMatch(r.title, query)}</div>
          <div style="font-size:11px;color:var(--text-muted)">${r.sub}</div>
        </div>
      </div>`).join('')
  ).join('')

  window._gsClose = closeGlobalSearch
}

function highlightMatch(text, query) {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query)
  if (idx < 0) return text
  return text.slice(0, idx) + `<mark style="background:var(--warning-light);color:var(--warning);border-radius:2px;padding:0 2px">${text.slice(idx, idx + query.length)}</mark>` + text.slice(idx + query.length)
}

function renderDefaultResults() {
  const results = document.getElementById('gs-results')
  if (!results) return
  const quick = searchIndex.filter(e => ['action', 'page'].includes(e.type)).slice(0, 6)
  results.innerHTML =
    `<div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.08em;padding:10px 20px 4px">الوصول السريع</div>` +
    quick.map(r => `
      <div class="gs-item" onclick="(${r.action.toString()})();window._gsClose()">
        <div style="width:34px;height:34px;border-radius:8px;background:${r.bg};color:${r.color};display:flex;align-items:center;justify-content:center;font-size:14px;flex-shrink:0">
          <i class="fa-solid ${r.icon}"></i>
        </div>
        <div>
          <div style="font-size:13px;font-weight:500;color:var(--text)">${r.title}</div>
          <div style="font-size:11px;color:var(--text-muted)">${r.sub}</div>
        </div>
      </div>`).join('')
  window._gsClose = closeGlobalSearch
}

function handleKey(e, navFn, openModalFn) {
  const items = document.querySelectorAll('.gs-item')
  if (e.key === 'ArrowDown') { e.preventDefault(); searchFocusIdx = Math.min(searchFocusIdx + 1, items.length - 1) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); searchFocusIdx = Math.max(searchFocusIdx - 1, 0) }
  else if (e.key === 'Enter' && searchFocusIdx >= 0) { items[searchFocusIdx]?.click(); return }
  items.forEach((el, i) => el.classList.toggle('focused', i === searchFocusIdx))
}
