// shared/auth.js
// ============================================================
// نظام المصادقة وحماية الصفحات
// ============================================================

import { supabase } from './supabase.js'

// ─────────────────────────────────────────
// التحقق من الجلسة وجلب بيانات المستخدم
// ─────────────────────────────────────────
export async function requireAuth(allowedRoles = []) {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
      redirectToLogin()
      return null
    }

    // جلب الملف الشخصي مع بيانات المؤسسة والفرع
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select(`
        *,
        organizations ( id, name, logo_url, plan, is_active ),
        branches      ( id, name, is_main )
      `)
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      await supabase.auth.signOut()
      redirectToLogin('لم يتم العثور على ملفك الشخصي')
      return null
    }

    // تحقق من أن الحساب نشط
    if (!profile.is_active) {
      await supabase.auth.signOut()
      redirectToLogin('حسابك موقوف، تواصل مع المدير')
      return null
    }

    // تحقق من أن المؤسسة نشطة
    if (!profile.organizations?.is_active) {
      await supabase.auth.signOut()
      redirectToLogin('حساب العيادة موقوف')
      return null
    }

    // تحقق من الدور المطلوب
    if (allowedRoles.length > 0 && !allowedRoles.includes(profile.role)) {
      redirectByRole(profile.role)
      return null
    }

    // حفظ بيانات المستخدم في window للاستخدام في الصفحة
    window.currentUser = user
    window.currentProfile = profile
    window.orgId = profile.organization_id
    window.orgName = profile.organizations?.name

    return { user, profile }

  } catch (err) {
    console.error('Auth error:', err)
    redirectToLogin()
    return null
  }
}

// ─────────────────────────────────────────
// توجيه المستخدم حسب دوره
// ─────────────────────────────────────────
export function redirectByRole(role) {
  const routes = {
    admin:      'admin.html',
    doctor:     'doctor.html',
    reception:  'reception.html',
    accountant: 'admin.html'
  }
  window.location.href = routes[role] || 'login.html'
}

// ─────────────────────────────────────────
// تسجيل الخروج
// ─────────────────────────────────────────
export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = 'login.html'
}

// ─────────────────────────────────────────
// توجيه لصفحة الدخول
// ─────────────────────────────────────────
function redirectToLogin(msg = '') {
  if (msg) sessionStorage.setItem('login_error', msg)
  window.location.href = 'login.html'
}

// ─────────────────────────────────────────
// ملء بيانات المستخدم في الـ UI
// ─────────────────────────────────────────
export function fillUserUI(profile) {
  const roleNames = {
    admin:      'مدير النظام',
    doctor:     'طبيب',
    reception:  'موظف استقبال',
    accountant: 'محاسب'
  }

  // الاسم في الـ sidebar والـ topbar
  const nameEls = document.querySelectorAll('[data-user-name]')
  nameEls.forEach(el => el.textContent = profile.full_name)

  // الدور
  const roleEls = document.querySelectorAll('[data-user-role]')
  roleEls.forEach(el => el.textContent = roleNames[profile.role] || profile.role)

  // الأحرف الأولى (Avatar)
  const initials = profile.full_name
    .split(' ')
    .map(w => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  const avatarEls = document.querySelectorAll('[data-user-avatar]')
  avatarEls.forEach(el => el.textContent = initials)

  // اسم المؤسسة
  const orgEls = document.querySelectorAll('[data-org-name]')
  orgEls.forEach(el => el.textContent = profile.organizations?.name || '')
}
