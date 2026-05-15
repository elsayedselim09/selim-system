import{createClient}from'https://esm.sh/@supabase/supabase-js@2'
const sb=createClient('https://kfbylfsqzbsqyqnjzjrw.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYnlsZnNxemJzcXlxbmp6anJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjE3MDQsImV4cCI6MjA5NDM5NzcwNH0.x_Tv06wcQAFRTX_nutecP13FzPM9mN8js6ITeVl9d4k')
let profile,orgId,allPts=[],allAppts=[],allInvs=[],services=[],posItems=[]

const{data:{user}}=await sb.auth.getUser()
if(!user){location.href='login.html'}
const{data:p}=await sb.from('profiles').select('*').eq('id',user.id).single()
if(!p||!p.is_active){await sb.auth.signOut();location.href='login.html'}
if(!['reception','admin','accountant'].includes(p.role)){location.href=p.role==='doctor'?'doctor.html':'admin.html'}
profile=p;orgId=p.organization_id
const{data:org}=await sb.from('organizations').select('name').eq('id',orgId).single()
p.organizations=org||{}
document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=p.full_name)
document.querySelectorAll('[data-user-role]').forEach(e=>e.textContent='موظف استقبال')
document.querySelectorAll('[data-user-avatar]').forEach(e=>e.textContent=p.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase())
document.querySelectorAll('[data-org-name]').forEach(e=>e.textContent=p.organizations?.name||'')
const now=new Date()
document.getElementById('topbar-date').textContent=now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})

const titles={today:'مواعيد اليوم',appointments:'كل المواعيد',patients:'المرضى',pos:'فاتورة زيارة',invoices:'الفواتير'}
window.nav=id=>{
  document.querySelectorAll('.page').forEach(pg=>pg.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'))
  document.getElementById('page-'+id)?.classList.add('active')
  document.getElementById('nav-'+id)?.classList.add('active')
  document.getElementById('topbar-title').textContent=titles[id]||''
  const loaders={appointments:loadAllAppts,patients:loadPatients,pos:loadPos,invoices:loadInvoices}
  loaders[id]?.()
}
window.openModal=id=>document.getElementById(id)?.classList.add('open')
window.closeModal=id=>document.getElementById(id)?.classList.remove('open')
window.doSignOut=async()=>{await sb.auth.signOut();location.href='login.html'}

function toast(title,msg='',type='info'){
  const c={success:{i:'fa-check-circle',bg:'#D1FAE5',cl:'#10B981'},error:{i:'fa-circle-xmark',bg:'#FEE2E2',cl:'#EF4444'},warning:{i:'fa-triangle-exclamation',bg:'#FEF3C7',cl:'#F59E0B'},info:{i:'fa-circle-info',bg:'#EEF2FF',cl:'#6366F1'}}[type]
  const w=document.getElementById('toast-wrap'),t=document.createElement('div')
  t.className='toast'
  t.innerHTML=`<div class="toast-icon" style="background:${c.bg};color:${c.cl}"><i class="fa-solid ${c.i}"></i></div><div class="toast-body"><div class="toast-title">${title}</div>${msg?`<div class="toast-msg">${msg}</div>`:''}</div>`
  w.appendChild(t);setTimeout(()=>t.remove(),4000)
}
function fdt(d){return d?new Date(d).toLocaleString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}
function fmoney(n){return(n||0).toLocaleString('ar-EG')+'  ج.م'}
function badge(s){const m={pending:'badge-warning',confirmed:'badge-info',completed:'badge-success',cancelled:'badge-danger',no_show:'badge-danger',paid:'badge-success',partial:'badge-warning',draft:'badge-gray',overdue:'badge-danger',active:'badge-success',inactive:'badge-gray'};const l={pending:'انتظار',confirmed:'مؤكد',completed:'مكتمل',cancelled:'ملغي',no_show:'لم يحضر',paid:'مدفوع',partial:'جزئي',draft:'مسودة',overdue:'متأخر',active:'نشط',inactive:'غير نشط'};return`<span class="badge ${m[s]||'badge-gray'}">${l[s]||s}</span>`}

// ── Today ──
async function loadToday(){
  const today=new Date().toISOString().slice(0,10)
  const{data}=await sb.from('appointments').select('*,patients(full_name,phone),profiles!appointments_doctor_id_fkey(full_name)').eq('organization_id',orgId).gte('scheduled_at',today+'T00:00:00').lte('scheduled_at',today+'T23:59:59').order('scheduled_at')
  const list=data||[]
  document.getElementById('r-stat-total').textContent=list.length
  document.getElementById('r-stat-wait').textContent=list.filter(a=>a.status==='pending').length
  document.getElementById('r-stat-done').textContent=list.filter(a=>a.status==='completed').length
  document.getElementById('r-stat-cancel').textContent=list.filter(a=>a.status==='cancelled').length
  const tb=document.getElementById('today-table')
  if(!list.length){tb.innerHTML='<tr><td colspan="7" class="table-empty">لا توجد مواعيد اليوم</td></tr>';return}
  tb.innerHTML=list.map((a,i)=>`<tr><td>${i+1}</td><td><div style="font-weight:600">${a.patients?.full_name||'—'}</div><div style="font-size:11px;color:var(--text-muted)">${a.patients?.phone||''}</div></td><td>${a.profiles?.full_name||'—'}</td><td>${fdt(a.scheduled_at)}</td><td>${{consultation:'كشف',follow_up:'متابعة',procedure:'إجراء',checkup:'فحص'}[a.type]||a.type}</td><td>${badge(a.status)}</td><td style="display:flex;gap:4px;flex-wrap:wrap">
    <button class="btn btn-ghost btn-sm" onclick="updateStatus('${a.id}','confirmed')"><i class="fa-solid fa-check"></i></button>
    <button class="btn btn-success btn-sm" onclick="goToPOS('${a.patient_id}','${a.id}')"><i class="fa-solid fa-file-invoice-dollar"></i> فاتورة</button>
    <button class="btn btn-danger btn-sm" onclick="updateStatus('${a.id}','cancelled')"><i class="fa-solid fa-times"></i></button>
  </td></tr>`).join('')
}

window.updateStatus=async(id,status)=>{
  await sb.from('appointments').update({status}).eq('id',id)
  toast('تم التحديث','','success');loadToday()
}

// ── All Appointments ──
async function loadAllAppts(){
  const{data}=await sb.from('appointments').select('*,patients(full_name),profiles!appointments_doctor_id_fkey(full_name)').eq('organization_id',orgId).order('scheduled_at',{ascending:false})
  allAppts=data||[]
  renderAllAppts(allAppts)
}
function renderAllAppts(data){
  const tb=document.getElementById('all-appts-table')
  tb.innerHTML=data.map(a=>`<tr><td>${a.patients?.full_name||'—'}</td><td>${a.profiles?.full_name||'—'}</td><td>${fdt(a.scheduled_at)}</td><td>${badge(a.status)}</td><td><button class="btn btn-ghost btn-sm btn-icon" onclick="updateStatus('${a.id}','completed')"><i class="fa-solid fa-check"></i></button></td></tr>`).join('')||'<tr><td colspan="5" class="table-empty">لا توجد مواعيد</td></tr>'
}
window.filterAllAppts=()=>{
  const s=document.getElementById('all-appt-search').value.toLowerCase()
  const st=document.getElementById('all-appt-status').value
  const dt=document.getElementById('all-appt-date').value
  renderAllAppts(allAppts.filter(a=>(!s||(a.patients?.full_name||'').toLowerCase().includes(s))&&(!st||a.status===st)&&(!dt||a.scheduled_at?.startsWith(dt))))
}

// ── Patients ──
async function loadPatients(){
  const{data}=await sb.from('patients').select('*').eq('organization_id',orgId).order('created_at',{ascending:false})
  allPts=data||[]
  document.getElementById('r-pts-count').textContent=`${allPts.length} مريض`
  renderPts(allPts)
  const sels=['na-patient','pos-patient','np-doctor']
  const{data:docs}=await sb.from('profiles').select('id,full_name').eq('organization_id',orgId).eq('role','doctor')
  document.getElementById('np-doctor').innerHTML='<option value="">— بلا طبيب —</option>'+(docs||[]).map(d=>`<option value="${d.id}">${d.full_name}</option>`).join('')
}
function renderPts(data){
  const tb=document.getElementById('r-pts-table')
  tb.innerHTML=data.map(p=>`<tr><td><code>${p.mrn}</code></td><td>${p.full_name}</td><td>${p.phone||'—'}</td><td>${p.gender==='male'?'ذكر':'أنثى'}</td><td>${badge(p.status)}</td><td><button class="btn btn-ghost btn-sm" onclick="goToPOS('${p.id}','')"><i class="fa-solid fa-file-invoice-dollar"></i> فاتورة</button></td></tr>`).join('')||'<tr><td colspan="6" class="table-empty">لا يوجد مرضى</td></tr>'
}
window.filterRPts=()=>{
  const s=document.getElementById('r-pts-search').value.toLowerCase()
  renderPts(allPts.filter(p=>(p.full_name||'').toLowerCase().includes(s)||(p.mrn||'').includes(s)))
}
window.saveNewPatient=async()=>{
  const name=document.getElementById('np-name').value.trim()
  if(!name){toast('الاسم مطلوب','','warning');return}
  const{data:last}=await sb.from('patients').select('mrn').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(1)
  const n=(last?.[0]?.mrn?.split('-').pop()||999)
  const mrn=`MRN-${new Date().getFullYear()}-${String(+n+1).padStart(4,'0')}`
  const{error}=await sb.from('patients').insert({full_name:name,gender:document.getElementById('np-gender').value,phone:document.getElementById('np-phone').value,date_of_birth:document.getElementById('np-dob').value||null,assigned_doctor_id:document.getElementById('np-doctor').value||null,insurance_company:document.getElementById('np-insurance').value,organization_id:orgId,mrn,status:'new'})
  if(error){toast('خطأ',error.message,'error');return}
  toast('تمت إضافة المريض','','success');closeModal('modal-patient');loadPatients()
}

// ── New Appointment ──
async function loadApptSelects(){
  const[{data:pts},{data:docs}]=await Promise.all([
    sb.from('patients').select('id,full_name').eq('organization_id',orgId).order('full_name'),
    sb.from('profiles').select('id,full_name').eq('organization_id',orgId).eq('role','doctor')
  ])
  document.getElementById('na-patient').innerHTML='<option value="">— اختر مريض —</option>'+(pts||[]).map(p=>`<option value="${p.id}">${p.full_name}</option>`).join('')
  document.getElementById('na-doctor').innerHTML='<option value="">— اختر طبيب —</option>'+(docs||[]).map(d=>`<option value="${d.id}">${d.full_name}</option>`).join('')
}
window.saveNewAppt=async()=>{
  const pid=document.getElementById('na-patient').value,did=document.getElementById('na-doctor').value,dt=document.getElementById('na-datetime').value
  if(!pid||!did||!dt){toast('تحقق من البيانات','','warning');return}
  const{error}=await sb.from('appointments').insert({patient_id:pid,doctor_id:did,scheduled_at:dt,type:document.getElementById('na-type').value,notes:document.getElementById('na-notes').value,status:'pending',organization_id:orgId})
  if(error){toast('خطأ',error.message,'error');return}
  toast('تمت إضافة الموعد','','success');closeModal('modal-appt');loadToday()
}

// ── POS ──
async function loadPos(){
  const[{data:pts},{data:svcs}]=await Promise.all([
    sb.from('patients').select('id,full_name').eq('organization_id',orgId).order('full_name'),
    sb.from('services').select('*').eq('organization_id',orgId).eq('is_active',true)
  ])
  services=svcs||[]
  document.getElementById('pos-patient').innerHTML='<option value="">— اختر مريض —</option>'+(pts||[]).map(p=>`<option value="${p.id}">${p.full_name}</option>`).join('')
  posItems=[]
  document.getElementById('pos-services').innerHTML=''
  posCalc()
}
window.goToPOS=async(patientId,apptId)=>{
  nav('pos')
  await loadPos()
  if(patientId)document.getElementById('pos-patient').value=patientId
}
window.addPosService=()=>{
  const wrap=document.getElementById('pos-services')
  const idx=posItems.length
  posItems.push({svc:'',qty:1,price:0})
  const div=document.createElement('div')
  div.id='pos-item-'+idx
  div.style='display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center'
  div.innerHTML=`<select class="form-control pos-svc" onchange="onSvcChange(${idx},this)"><option value="">— اختر خدمة —</option>${services.map(s=>`<option value="${s.id}" data-price="${s.price}">${s.name} — ${s.price} ج.م</option>`).join('')}</select><input type="number" class="form-control pos-qty" value="1" min="1" oninput="onItemChange(${idx},this)" style="width:80px"/><input type="number" class="form-control pos-price" value="0" oninput="onItemChange(${idx},this)"/><button class="btn btn-danger btn-icon" onclick="removePosItem(${idx})"><i class="fa-solid fa-times"></i></button>`
  wrap.appendChild(div)
}
window.onSvcChange=(idx,sel)=>{
  const opt=sel.options[sel.selectedIndex]
  const price=+opt.dataset.price||0
  const row=document.getElementById('pos-item-'+idx)
  row.querySelector('.pos-price').value=price
  posItems[idx]={svc:sel.value,qty:+row.querySelector('.pos-qty').value,price}
  posCalc()
}
window.onItemChange=(idx,el)=>{
  const row=document.getElementById('pos-item-'+idx)
  posItems[idx]={...posItems[idx],qty:+row.querySelector('.pos-qty').value,price:+row.querySelector('.pos-price').value}
  posCalc()
}
window.removePosItem=idx=>{document.getElementById('pos-item-'+idx)?.remove();posItems[idx]={removed:true};posCalc()}
window.posCalc=()=>{
  const sub=posItems.filter(i=>!i?.removed).reduce((s,i)=>s+(i.qty||0)*(i.price||0),0)
  const disc=+document.getElementById('pos-discount')?.value||0
  const dtype=document.getElementById('pos-disc-type')?.value
  const discAmt=dtype==='percentage'?sub*disc/100:disc
  const total=Math.max(0,sub-discAmt)
  document.getElementById('pos-subtotal').textContent=fmoney(sub)
  document.getElementById('pos-total').textContent=fmoney(total)
}
window.createInvoice=async()=>{
  const pid=document.getElementById('pos-patient').value
  if(!pid){toast('اختر المريض','','warning');return}
  const items=posItems.filter(i=>!i?.removed&&i.svc)
  if(!items.length){toast('أضف خدمة واحدة على الأقل','','warning');return}
  const sub=items.reduce((s,i)=>s+i.qty*i.price,0)
  const disc=+document.getElementById('pos-discount').value||0
  const dtype=document.getElementById('pos-disc-type').value
  const discAmt=dtype==='percentage'?sub*disc/100:disc
  const total=Math.max(0,sub-discAmt)
  const method=document.getElementById('pos-method').value
  const{data:last}=await sb.from('invoices').select('invoice_number').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(1)
  const n=(last?.[0]?.invoice_number?.split('-').pop()||999)
  const inv_num=`INV-${new Date().getFullYear()}-${String(+n+1).padStart(4,'0')}`
  const{data:inv,error}=await sb.from('invoices').insert({organization_id:orgId,patient_id:pid,invoice_number:inv_num,subtotal:sub,discount:disc,discount_type:dtype,total,paid_amount:total,status:'paid',payment_method:method,notes:document.getElementById('pos-notes').value,created_by:user.id}).select().single()
  if(error){toast('خطأ',error.message,'error');return}
  const rows=items.map(i=>({invoice_id:inv.id,service_id:i.svc,description:services.find(s=>s.id===i.svc)?.name||'خدمة',quantity:i.qty,unit_price:i.price}))
  await sb.from('invoice_items').insert(rows)
  await sb.from('payments').insert({organization_id:orgId,invoice_id:inv.id,amount:total,method,created_by:user.id})
  toast('تمت إنشاء الفاتورة',`رقم: ${inv_num}`,'success')
  posItems=[];document.getElementById('pos-services').innerHTML='';posCalc()
}

// ── Invoices ──
async function loadInvoices(){
  const{data}=await sb.from('invoices').select('*,patients(full_name)').eq('organization_id',orgId).order('created_at',{ascending:false})
  allInvs=data||[]
  renderInvs(allInvs)
}
function renderInvs(data){
  const tb=document.getElementById('r-inv-table')
  tb.innerHTML=data.map(i=>`<tr><td><code>${i.invoice_number}</code></td><td>${i.patients?.full_name||'—'}</td><td>${fmoney(i.total)}</td><td>${fmoney(i.paid_amount)}</td><td style="color:${i.remaining>0?'var(--danger)':'var(--success)'}">${fmoney(i.remaining)}</td><td>${badge(i.status)}</td><td>${i.remaining>0?`<button class="btn btn-success btn-sm" onclick="openPayModal('${i.id}',${i.remaining})"><i class="fa-solid fa-money-bill"></i> دفع</button>`:''}</td></tr>`).join('')||'<tr><td colspan="7" class="table-empty">لا توجد فواتير</td></tr>'
}
window.filterRInv=()=>{
  const s=document.getElementById('r-inv-search').value.toLowerCase()
  const st=document.getElementById('r-inv-status').value
  renderInvs(allInvs.filter(i=>(!s||(i.invoice_number||'').toLowerCase().includes(s))&&(!st||i.status===st)))
}
window.openPayModal=(id,remaining)=>{
  document.getElementById('pay-inv-id').value=id
  document.getElementById('pay-amount').value=remaining
  openModal('modal-payment')
}
window.savePayment=async()=>{
  const id=document.getElementById('pay-inv-id').value
  const amt=+document.getElementById('pay-amount').value
  const method=document.getElementById('pay-method').value
  const{error}=await sb.from('payments').insert({organization_id:orgId,invoice_id:id,amount:amt,method,reference:document.getElementById('pay-ref').value,created_by:user.id})
  if(error){toast('خطأ',error.message,'error');return}
  const inv=allInvs.find(i=>i.id===id)
  const newPaid=(inv.paid_amount||0)+amt
  const newStatus=newPaid>=inv.total?'paid':'partial'
  await sb.from('invoices').update({paid_amount:newPaid,status:newStatus}).eq('id',id)
  toast('تم تسجيل الدفعة','','success');closeModal('modal-payment');loadInvoices()
}

// ── Init ──
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open')}))
await loadApptSelects()
await loadToday()

// ── Print Invoice ──
window.printInvoice=async(invId)=>{
  const{data:inv}=await sb.from('invoices').select('*,patients(full_name,mrn,phone),invoice_items(*)').eq('id',invId).single()
  if(!inv){toast('لم يتم العثور على الفاتورة','','error');return}
  const orgName=p.organizations?.name||'سليم'
  const win=window.open('','_blank','width=700,height=900')
  const sAr={paid:'مدفوعة',partial:'جزئي',draft:'مسودة',overdue:'متأخرة'}
  const mAr={cash:'نقداً',card:'بطاقة',insurance:'تأمين',bank_transfer:'تحويل'}
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>فاتورة ${inv.invoice_number}</title><style>body{font-family:Arial;padding:32px;direction:rtl}.cn{font-size:22px;font-weight:800;color:#1B6CA8}table{width:100%;border-collapse:collapse}th{background:#1B6CA8;color:#fff;padding:8px;text-align:right}td{padding:8px;border-bottom:1px solid #eee}.tot{font-weight:700;border-top:2px solid #1B6CA8}@media print{button{display:none}}</style></head><body><div style="text-align:center;border-bottom:3px solid #1B6CA8;padding-bottom:12px;margin-bottom:16px"><div class="cn">${orgName}</div></div><div style="display:flex;justify-content:space-between;margin-bottom:12px"><div><b>فاتورة: ${inv.invoice_number}</b><div style="font-size:12px">${new Date(inv.created_at).toLocaleDateString('ar-EG')}</div></div><span style="background:#D1FAE5;color:#065F46;padding:4px 12px;border-radius:20px;font-size:12px">${sAr[inv.status]||inv.status}</span></div><p><b>المريض:</b> ${inv.patients?.full_name} | <b>الرقم:</b> ${inv.patients?.mrn} | <b>الهاتف:</b> ${inv.patients?.phone||'—'} | <b>الدفع:</b> ${mAr[inv.payment_method]||inv.payment_method||'—'}</p><table><thead><tr><th>الخدمة</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${(inv.invoice_items||[]).map(i=>`<tr><td>${i.description||'خدمة'}</td><td>${i.quantity}</td><td>${(i.unit_price||0).toLocaleString()}</td><td>${((i.quantity||1)*(i.unit_price||0)).toLocaleString()}</td></tr>`).join('')}</tbody><tfoot><tr class="tot"><td colspan="3">الإجمالي</td><td>${(inv.total||0).toLocaleString()} ج.م</td></tr><tr><td colspan="3">المدفوع</td><td style="color:#10B981">${(inv.paid_amount||0).toLocaleString()} ج.م</td></tr></tfoot></table>${inv.notes?`<p><b>ملاحظات:</b> ${inv.notes}</p>`:''}<div style="text-align:center;margin-top:20px"><button onclick="window.print()" style="background:#1B6CA8;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer">طباعة</button></div></body></html>`)
  win.document.close()
  setTimeout(()=>win.print(),400)
}

// ── WhatsApp Reminder ──
window.sendWhatsApp=(phone,name,time)=>{
  const msg=encodeURIComponent(`مرحباً ${name}،\nموعدكم: ${new Date(time).toLocaleString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}\nسليم لإدارة العيادات 🏥`)
  const num=(phone||'').replace(/[^0-9]/g,'')
  if(!num){toast('لا يوجد رقم هاتف','','warning');return}
  window.open(`https://wa.me/2${num}?text=${msg}`,'_blank')
}
