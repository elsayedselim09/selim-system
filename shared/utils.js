// shared/utils.js
// ============================================================
// دوال مساعدة مشتركة بين كل الصفحات
// ============================================================

import { supabase } from './supabase.js'

// ─────────────────────────────────────────
// Toast Notifications
// ─────────────────────────────────────────
export function showToast(title, msg = '', type = 'info') {
  const configs = {
    success: { icon: 'fa-check-circle',    bg: 'var(--success-light)', color: 'var(--success)' },
    error:   { icon: 'fa-circle-xmark',    bg: 'var(--danger-light)',  color: 'var(--danger)'  },
    warning: { icon: 'fa-triangle-exclamation', bg: 'var(--warning-light)', color: 'var(--warning)' },
    info:    { icon: 'fa-circle-info',     bg: 'var(--info-light)',    color: 'var(--info)'    }
  }
  const c = configs[type] || configs.info

  const wrap = document.getElementById('toast-wrap')
  if (!wrap) return

  const toast = document.createElement('div')
  toast.className = 'toast'
  toast.innerHTML = `
    <div class="toast-icon" style="background:${c.bg};color:${c.color}">
      <i class="fa-solid ${c.icon}"></i>
    </div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
    </div>
    <button onclick="this.parentElement.remove()"
      style="background:none;border:none;cursor:pointer;color:var(--text-light);font-size:14px;padding:0 4px">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `
  wrap.appendChild(toast)
  setTimeout(() => toast.remove(), 4000)
}

// ─────────────────────────────────────────
// تنسيق التاريخ والوقت
// ─────────────────────────────────────────
export function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('ar-EG', {
    year: 'numeric', month: 'long', day: 'numeric'
  })
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('ar-EG', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

export function formatTime(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleTimeString('ar-EG', {
    hour: '2-digit', minute: '2-digit'
  })
}

// ─────────────────────────────────────────
// تنسيق الأرقام والعملة
// ─────────────────────────────────────────
export function formatMoney(amount, currency = 'EGP') {
  if (amount === null || amount === undefined) return '—'
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency', currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(amount)
}

export function formatNumber(num) {
  return new Intl.NumberFormat('ar-EG').format(num || 0)
}

// ─────────────────────────────────────────
// Badges الحالة
// ─────────────────────────────────────────
export function statusBadge(status) {
  const map = {
    // مواعيد
    pending:    { label: 'في الانتظار', cls: 'badge-warning'  },
    confirmed:  { label: 'مؤكد',        cls: 'badge-success'  },
    completed:  { label: 'مكتمل',       cls: 'badge-success'  },
    cancelled:  { label: 'ملغي',        cls: 'badge-danger'   },
    no_show:    { label: 'لم يحضر',     cls: 'badge-danger'   },
    // فواتير
    draft:      { label: 'مسودة',       cls: 'badge-gray'     },
    sent:       { label: 'مرسلة',       cls: 'badge-info'     },
    paid:       { label: 'مدفوعة',      cls: 'badge-success'  },
    partial:    { label: 'جزئي',        cls: 'badge-warning'  },
    overdue:    { label: 'متأخرة',      cls: 'badge-danger'   },
    // مختبر
    processing: { label: 'قيد التحليل', cls: 'badge-info'     },
    // مرضى
    active:     { label: 'نشط',         cls: 'badge-success'  },
    inactive:   { label: 'غير نشط',     cls: 'badge-gray'     },
    new:        { label: 'جديد',        cls: 'badge-blue'     }
  }
  const s = map[status] || { label: status, cls: 'badge-gray' }
  return `<span class="badge ${s.cls}">${s.label}</span>`
}

// ─────────────────────────────────────────
// تأكيد الحذف
// ─────────────────────────────────────────
export function confirmAction(message = 'هل أنت متأكد؟') {
  return window.confirm(message)
}

// ─────────────────────────────────────────
// الأحرف الأولى من الاسم
// ─────────────────────────────────────────
export function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()
}

// ─────────────────────────────────────────
// ألوان Avatar
// ─────────────────────────────────────────
const avatarColors = ['avatar-blue','avatar-green','avatar-purple','avatar-amber','avatar-pink','avatar-red']
export function getAvatarColor(str = '') {
  let hash = 0
  for (const c of str) hash += c.charCodeAt(0)
  return avatarColors[hash % avatarColors.length]
}

// ─────────────────────────────────────────
// Realtime — الاشتراك في تغييرات جدول
// ─────────────────────────────────────────
export function subscribeToTable(table, orgId, callback) {
  return supabase
    .channel(`${table}_changes`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table,
      filter: `organization_id=eq.${orgId}`
    }, callback)
    .subscribe()
}

// ─────────────────────────────────────────
// تحويل تاريخ لـ input[type=datetime-local]
// ─────────────────────────────────────────
export function toInputDateTime(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toISOString().slice(0, 16)
}

export function toInputDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toISOString().slice(0, 10)
}

// ─────────────────────────────────────────
// Modal helpers
// ─────────────────────────────────────────
export function openModal(id) {
  document.getElementById(id)?.classList.add('open')
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open')
}
