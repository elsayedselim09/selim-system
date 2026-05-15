// PWA Registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/selim-system/sw.js', {
        scope: '/selim-system/'
      })
      console.log('SW registered:', reg.scope)

      // تحقق من وجود تحديث
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing
        newSW?.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner()
          }
        })
      })
    } catch (err) {
      console.log('SW registration failed:', err)
    }
  })
}

// شريط التحديث
function showUpdateBanner() {
  const banner = document.createElement('div')
  banner.style = 'position:fixed;bottom:0;left:0;right:0;background:#1B6CA8;color:#fff;padding:12px 20px;display:flex;align-items:center;justify-content:space-between;z-index:9999;font-family:IBM Plex Sans Arabic,sans-serif;font-size:13px'
  banner.innerHTML = `
    <span>🔄 يوجد تحديث جديد للنظام</span>
    <button onclick="location.reload()" style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:6px 14px;border-radius:6px;cursor:pointer;font-size:13px">تحديث الآن</button>
  `
  document.body.appendChild(banner)
}

// Install Prompt
let deferredPrompt = null
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault()
  deferredPrompt = e

  // أضف زر التثبيت لو موجود في الصفحة
  const installBtn = document.getElementById('install-btn')
  if (installBtn) {
    installBtn.style.display = 'flex'
    installBtn.onclick = async () => {
      if (!deferredPrompt) return
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      deferredPrompt = null
      installBtn.style.display = 'none'
    }
  }
})

window.addEventListener('appinstalled', () => {
  deferredPrompt = null
  console.log('PWA installed!')
})
