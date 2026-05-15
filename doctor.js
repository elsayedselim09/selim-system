import{createClient}from'https://esm.sh/@supabase/supabase-js@2'
const sb=createClient('https://kfbylfsqzbsqyqnjzjrw.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYnlsZnNxemJzcXlxbmp6anJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjE3MDQsImV4cCI6MjA5NDM5NzcwNH0.x_Tv06wcQAFRTX_nutecP13FzPM9mN8js6ITeVl9d4k')
let profile,orgId,drId,allDrPts=[]

const{data:{user}}=await sb.auth.getUser()
if(!user){location.href='login.html'}
const{data:p}=await sb.from('profiles').select('*').eq('id',user.id).single()
if(!p||!p.is_active){await sb.auth.signOut();location.href='login.html'}
if(p.role!=='doctor'){location.href=p.role==='admin'?'admin.html':'reception.html'}
profile=p;orgId=p.organization_id;drId=user.id
const{data:org}=await sb.from('organizations').select('name').eq('id',orgId).single()
p.organizations=org||{}
document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=p.full_name)
document.querySelectorAll('[data-user-role]').forEach(e=>e.textContent=p.specialty||'طبيب')
document.querySelectorAll('[data-user-avatar]').forEach(e=>e.textContent=p.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase())
document.querySelectorAll('[data-org-name]').forEach(e=>e.textContent=p.organizations?.name||'')
const now=new Date()
document.getElementById('topbar-date').textContent=now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
document.getElementById('sched-date').textContent=now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})

const titles={schedule:'جدولي اليوم',patients:'مرضاي','patient-profile':'ملف المريض',prescriptions:'الوصفات الطبية',lab:'طلبات المختبر',week:'الجدول الأسبوعي'}
window.nav=id=>{
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'))
  document.getElementById('page-'+id)?.classList.add('active')
  document.getElementById('nav-'+id)?.classList.add('active')
  document.getElementById('topbar-title').textContent=titles[id]||''
  const loaders={patients:loadDrPatients,prescriptions:loadRx,lab:loadLab,week:loadWeek}
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
function age(dob){if(!dob)return'—';return Math.floor((Date.now()-new Date(dob))/(365.25*864e5))+' سنة'}
function badge(s){const m={pending:'badge-warning',confirmed:'badge-info',completed:'badge-success',cancelled:'badge-danger',normal:'badge-success',urgent:'badge-warning',stat:'badge-danger'};const l={pending:'انتظار',confirmed:'مؤكد',completed:'مكتمل',cancelled:'ملغي',normal:'عادي',urgent:'عاجل',stat:'فوري'};return`<span class="badge ${m[s]||'badge-gray'}">${l[s]||s}</span>`}

// ── Schedule ──
async function loadSchedule(){
  const today=new Date().toISOString().slice(0,10)
  const{data}=await sb.from('appointments').select('*,patients(full_name,phone,date_of_birth)').eq('organization_id',orgId).eq('doctor_id',drId).gte('scheduled_at',today+'T00:00:00').lte('scheduled_at',today+'T23:59:59').order('scheduled_at')
  const done=(data||[]).filter(a=>a.status==='completed').length
  const pend=(data||[]).filter(a=>a.status==='pending').length
  document.getElementById('d-stat-today').textContent=data?.length||0
  document.getElementById('d-stat-done').textContent=done
  document.getElementById('d-stat-pending').textContent=pend
  const{count}=await sb.from('patients').select('*',{count:'exact',head:true}).eq('organization_id',orgId).eq('assigned_doctor_id',drId)
  document.getElementById('d-stat-pts').textContent=count||0
  const tb=document.getElementById('sched-table')
  if(!data?.length){tb.innerHTML='<tr><td colspan="5" class="table-empty">لا توجد مواعيد اليوم</td></tr>';return}
  tb.innerHTML=data.map(a=>`<tr><td><div style="font-weight:600">${a.patients?.full_name}</div><div style="font-size:11px;color:var(--text-muted)">${a.patients?.phone||''}</div></td><td>${fdt(a.scheduled_at)}</td><td>${{consultation:'كشف',follow_up:'متابعة',procedure:'إجراء',checkup:'فحص'}[a.type]||a.type}</td><td>${badge(a.status)}</td><td><button class="btn btn-primary btn-sm" onclick="viewPatient('${a.patients?.id||''}','${a.patient_id}')"><i class="fa-solid fa-folder-open"></i> ملف المريض</button> <button class="btn btn-ghost btn-sm" onclick="completeAppt('${a.id}')"><i class="fa-solid fa-check"></i></button></td></tr>`).join('')
}

window.completeAppt=async id=>{
  await sb.from('appointments').update({status:'completed'}).eq('id',id)
  toast('تم','تم تحديث حالة الموعد','success');loadSchedule()
}

// ── Patients ──
async function loadDrPatients(){
  const{data}=await sb.from('patients').select('*').eq('organization_id',orgId).eq('assigned_doctor_id',drId).order('full_name')
  allDrPts=data||[]
  renderDrPts(allDrPts)
  const sel=document.getElementById('rx-patient')
  sel.innerHTML='<option value="">— اختر مريض —</option>'+(allDrPts).map(p=>`<option value="${p.id}">${p.full_name}</option>`).join('')
  const lsel=document.getElementById('lab-patient')
  lsel.innerHTML=sel.innerHTML
}
function renderDrPts(data){
  const tb=document.getElementById('dr-patients-table')
  tb.innerHTML=data.map(p=>`<tr><td><code>${p.mrn}</code></td><td>${p.full_name}</td><td>${age(p.date_of_birth)}</td><td>${p.phone||'—'}</td><td>—</td><td><button class="btn btn-primary btn-sm" onclick="viewPatient('${p.id}','${p.id}')"><i class="fa-solid fa-folder-open"></i> ملف</button></td></tr>`).join('')||'<tr><td colspan="6" class="table-empty">لا يوجد مرضى مسجلون</td></tr>'
}
window.filterDrPatients=()=>{
  const s=document.getElementById('dp-search').value.toLowerCase()
  renderDrPts(allDrPts.filter(p=>(p.full_name||'').toLowerCase().includes(s)||(p.mrn||'').includes(s)))
}

window.viewPatient=async(pid)=>{
  if(!pid||pid==='undefined'){toast('خطأ','لم يتم تحديد المريض','error');return}
  const[{data:pt},{data:apts}]=await Promise.all([
    sb.from('patients').select('*').eq('id',pid).single(),
    sb.from('appointments').select('*').eq('patient_id',pid).order('scheduled_at',{ascending:false}).limit(10)
  ])
  if(!pt)return
  document.getElementById('prof-name').textContent=pt.full_name
  document.getElementById('prof-mrn').textContent=pt.mrn
  document.getElementById('diag-patient-id').value=pt.id
  document.getElementById('prof-info').innerHTML=`<div style="font-size:13px;line-height:2.2">
    <div><b>تاريخ الميلاد:</b> ${pt.date_of_birth||'—'} (${age(pt.date_of_birth)})</div>
    <div><b>الجنس:</b> ${pt.gender==='male'?'ذكر':'أنثى'}</div>
    <div><b>الهاتف:</b> ${pt.phone||'—'}</div>
    <div><b>فصيلة الدم:</b> ${pt.blood_type||'—'}</div>
    <div><b>التأمين:</b> ${pt.insurance_company||'—'}</div>
    <div><b>العنوان:</b> ${pt.address||'—'}</div>
    ${pt.notes?`<div><b>ملاحظات:</b> ${pt.notes}</div>`:''}
  </div>`
  document.getElementById('prof-allergies').innerHTML=pt.allergies?.length?pt.allergies.map(a=>`<span class="badge badge-danger" style="margin:2px">${a}</span>`).join(''):'<span style="color:var(--text-muted);font-size:13px">لا توجد حساسيات مسجلة</span>'
  const tb=document.getElementById('prof-appts')
  tb.innerHTML=(apts||[]).map(a=>`<tr><td>${fdt(a.scheduled_at)}</td><td>${{consultation:'كشف',follow_up:'متابعة',procedure:'إجراء',checkup:'فحص'}[a.type]||a.type}</td><td>${badge(a.status)}</td></tr>`).join('')||'<tr><td colspan="3" class="table-empty">لا توجد مواعيد</td></tr>'
  nav('patient-profile')
}

window.saveDiagnosis=async()=>{
  const pid=document.getElementById('diag-patient-id').value
  const notes=document.getElementById('diag-notes').value.trim()
  if(!notes)return
  const curr=document.getElementById('prof-info').querySelector('[data-notes]')?.textContent||''
  await sb.from('patients').update({notes:(curr?curr+'\n':'')+new Date().toLocaleDateString('ar-EG')+': '+notes}).eq('id',pid)
  document.getElementById('diag-notes').value=''
  toast('تم حفظ الملاحظة','','success')
}

// ── Prescriptions ──
async function loadRx(){
  const{data}=await sb.from('prescriptions').select('*,patients(full_name)').eq('organization_id',orgId).eq('doctor_id',drId).order('created_at',{ascending:false})
  const tb=document.getElementById('rx-table')
  const fdate=d=>d?new Date(d).toLocaleDateString('ar-EG'):'—'
  tb.innerHTML=(data||[]).map(r=>`<tr><td>${r.patients?.full_name||'—'}</td><td>${r.diagnosis||'—'}</td><td>${fdate(r.created_at)}</td><td>${fdate(r.valid_until)}</td><td></td></tr>`).join('')||'<tr><td colspan="5" class="table-empty">لا توجد وصفات</td></tr>'
}

let drugCount=0
window.addDrugRow=()=>{
  drugCount++
  const div=document.createElement('div')
  div.style='display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;margin-bottom:8px;align-items:center'
  div.innerHTML=`<input class="form-control drug-name" placeholder="اسم الدواء"/><input class="form-control drug-dose" placeholder="الجرعة"/><input class="form-control drug-freq" placeholder="التكرار"/><input class="form-control drug-dur" placeholder="المدة"/><button class="btn btn-danger btn-icon" onclick="this.parentElement.remove()"><i class="fa-solid fa-times"></i></button>`
  document.getElementById('drugs-list').appendChild(div)
}
window.saveRx=async()=>{
  const pid=document.getElementById('rx-patient').value
  if(!pid){toast('اختر المريض','','warning');return}
  const{data:rx,error}=await sb.from('prescriptions').insert({organization_id:orgId,patient_id:pid,doctor_id:drId,diagnosis:document.getElementById('rx-diag').value,notes:document.getElementById('rx-notes').value,valid_until:document.getElementById('rx-valid').value||null}).select().single()
  if(error){toast('خطأ',error.message,'error');return}
  const rows=[...document.querySelectorAll('#drugs-list>div')].map(d=>({prescription_id:rx.id,drug_name:d.querySelector('.drug-name').value,dose:d.querySelector('.drug-dose').value,frequency:d.querySelector('.drug-freq').value,duration:d.querySelector('.drug-dur').value})).filter(r=>r.drug_name)
  if(rows.length)await sb.from('prescription_items').insert(rows)
  toast('تم حفظ الوصفة','','success');closeModal('modal-rx');document.getElementById('drugs-list').innerHTML='';loadRx()
}

// ── Lab ──
async function loadLab(){
  const{data}=await sb.from('lab_orders').select('*,patients(full_name)').eq('organization_id',orgId).eq('doctor_id',drId).order('created_at',{ascending:false})
  const fdate=d=>d?new Date(d).toLocaleDateString('ar-EG'):'—'
  const tb=document.getElementById('lab-table')
  tb.innerHTML=(data||[]).map(l=>`<tr><td>${l.patients?.full_name||'—'}</td><td>${badge(l.priority)}</td><td>${badge(l.status)}</td><td>${fdate(l.created_at)}</td><td>${l.notes||'—'}</td></tr>`).join('')||'<tr><td colspan="5" class="table-empty">لا توجد طلبات</td></tr>'
}
window.saveLabOrder=async()=>{
  const pid=document.getElementById('lab-patient').value
  if(!pid){toast('اختر المريض','','warning');return}
  const tests=document.getElementById('lab-tests').value.trim()
  const{data:lo,error}=await sb.from('lab_orders').insert({organization_id:orgId,patient_id:pid,doctor_id:drId,priority:document.getElementById('lab-priority').value,notes:document.getElementById('lab-notes').value,status:'pending'}).select().single()
  if(error){toast('خطأ',error.message,'error');return}
  if(tests){const rows=tests.split('\n').filter(t=>t.trim()).map(t=>({lab_order_id:lo.id,test_name:t.trim()}));await sb.from('lab_order_tests').insert(rows)}
  toast('تم إرسال الطلب','','success');closeModal('modal-lab');loadLab()
}

// ── Week ──
async function loadWeek(){
  const start=new Date();start.setDate(start.getDate()-start.getDay())
  const end=new Date(start);end.setDate(end.getDate()+6)
  const{data}=await sb.from('appointments').select('*,patients(full_name)').eq('organization_id',orgId).eq('doctor_id',drId).gte('scheduled_at',start.toISOString()).lte('scheduled_at',end.toISOString()).order('scheduled_at')
  const days=['السبت','الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة']
  const byDay={}
  ;(data||[]).forEach(a=>{const d=new Date(a.scheduled_at).getDay();(byDay[d]||(byDay[d]=[])).push(a)})
  document.getElementById('week-grid').innerHTML=`<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:8px;min-width:700px">${days.map((d,i)=>`<div><div style="font-weight:700;font-size:12px;padding:8px;background:var(--primary-light);border-radius:6px;text-align:center;margin-bottom:6px">${d}</div>${(byDay[i]||[]).map(a=>`<div style="background:var(--card);border:1px solid var(--border);border-radius:6px;padding:8px;margin-bottom:4px;font-size:12px"><div style="font-weight:600">${a.patients?.full_name}</div><div style="color:var(--text-muted)">${new Date(a.scheduled_at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})}</div></div>`).join('')||'<div style="text-align:center;font-size:11px;color:var(--text-light);padding:8px">—</div>'}</div>`).join('')}</div>`
}

// ── Init ──
document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open')}))
await loadDrPatients()
await loadSchedule()

// ── Print Prescription ──
window.printRx=async(rxId)=>{
  const{data:rx}=await sb.from('prescriptions').select('*,patients(full_name,mrn,date_of_birth,phone),prescription_items(*)').eq('id',rxId).single()
  if(!rx){toast('لم يتم العثور على الوصفة','','error');return}
  const drName=profile.full_name
  const orgName=p.organizations?.name||'سليم'
  const win=window.open('','_blank','width=700,height=900')
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>وصفة طبية</title><style>body{font-family:Arial;padding:32px;direction:rtl}.cn{font-size:22px;font-weight:800;color:#1B6CA8}.rx-box{border:2px solid #1B6CA8;border-radius:8px;padding:16px;margin-bottom:16px}.drug{border-bottom:1px dashed #ddd;padding:10px 0;display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:8px}.drug-label{font-size:11px;color:#888}@media print{button{display:none}}</style></head><body>
  <div style="text-align:center;border-bottom:3px solid #1B6CA8;padding-bottom:12px;margin-bottom:16px">
    <div class="cn">${orgName}</div>
    <div style="font-size:13px;color:#555">وصفة طبية</div>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px;font-size:13px">
    <div><b>المريض:</b> ${rx.patients?.full_name}</div>
    <div><b>الرقم الطبي:</b> ${rx.patients?.mrn}</div>
    <div><b>الطبيب:</b> د. ${drName}</div>
    <div><b>التاريخ:</b> ${new Date(rx.created_at).toLocaleDateString('ar-EG')}</div>
    ${rx.valid_until?`<div><b>صالحة حتى:</b> ${new Date(rx.valid_until).toLocaleDateString('ar-EG')}</div>`:''}
    ${rx.diagnosis?`<div><b>التشخيص:</b> ${rx.diagnosis}</div>`:''}
  </div>
  <div class="rx-box">
    <div style="font-weight:700;margin-bottom:8px;color:#1B6CA8">☤ الأدوية الموصوفة</div>
    ${(rx.prescription_items||[]).map((d,i)=>`<div class="drug"><div><div class="drug-label">الدواء</div><b>${i+1}. ${d.drug_name}</b></div><div><div class="drug-label">الجرعة</div>${d.dose||'—'}</div><div><div class="drug-label">التكرار</div>${d.frequency||'—'}</div><div><div class="drug-label">المدة</div>${d.duration||'—'}</div></div>`).join('')}
  </div>
  ${rx.notes?`<div style="margin-bottom:12px;font-size:13px"><b>تعليمات:</b> ${rx.notes}</div>`:''}
  <div style="margin-top:40px;text-align:left;font-size:13px">
    <div style="border-top:1px solid #222;width:200px;padding-top:4px">توقيع وختم الطبيب</div>
  </div>
  <div style="text-align:center;margin-top:20px"><button onclick="window.print()" style="background:#1B6CA8;color:#fff;border:none;padding:10px 24px;border-radius:8px;cursor:pointer">🖨️ طباعة</button></div>
  </body></html>`)
  win.document.close()
  setTimeout(()=>win.print(),400)
}
