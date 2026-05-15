import{createClient}from'https://esm.sh/@supabase/supabase-js@2'
const sb=createClient('https://kfbylfsqzbsqyqnjzjrw.supabase.co','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmYnlsZnNxemJzcXlxbmp6anJ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4MjE3MDQsImV4cCI6MjA5NDM5NzcwNH0.x_Tv06wcQAFRTX_nutecP13FzPM9mN8js6ITeVl9d4k')
let profile,orgId,allAppts=[],allPatients=[]

// ── Auth ──
const{data:{user}}=await sb.auth.getUser()
if(!user){location.href='login.html'}
const{data:p}=await sb.from('profiles').select('*').eq('id',user.id).single()
if(!p||!p.is_active){await sb.auth.signOut();location.href='login.html'}
if(!['admin','accountant'].includes(p.role)){location.href=p.role==='doctor'?'doctor.html':'reception.html'}
profile=p;orgId=p.organization_id
const{data:org}=await sb.from('organizations').select('*').eq('id',orgId).single()
p.organizations=org||{}
document.querySelectorAll('[data-user-name]').forEach(e=>e.textContent=p.full_name)
document.querySelectorAll('[data-user-role]').forEach(e=>e.textContent=({admin:'مدير النظام',doctor:'طبيب',reception:'استقبال',accountant:'محاسب'})[p.role]||p.role)
document.querySelectorAll('[data-user-avatar]').forEach(e=>e.textContent=p.full_name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase())
document.querySelectorAll('[data-org-name]').forEach(e=>e.textContent=p.organizations?.name||'')
const now=new Date()
document.getElementById('topbar-date').textContent=now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})
document.getElementById('dash-date').textContent=now.toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})

// ── Navigation ──
const titles={dashboard:'لوحة التحكم',appointments:'المواعيد',patients:'المرضى',doctors:'الأطباء',employees:'الموظفون',invoices:'الفواتير',inventory:'المخزون',branches:'الفروع',reports:'التقارير',settings:'الإعدادات'}
window.nav=function(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'))
  document.getElementById('page-'+id)?.classList.add('active')
  document.getElementById('nav-'+id)?.classList.add('active')
  document.getElementById('topbar-title').textContent=titles[id]||''
  const loaders={appointments:loadAppts,patients:loadPatients,doctors:loadDoctors,employees:loadEmployees,invoices:loadInvoices,inventory:loadInventory,branches:loadBranches,reports:loadReports}
  loaders[id]?.()
}

// ── Helpers ──
window.openModal=id=>{document.getElementById(id)?.classList.add('open')}
window.closeModal=id=>{document.getElementById(id)?.classList.remove('open')}
window.doSignOut=async()=>{await sb.auth.signOut();location.href='login.html'}
function toast(title,msg='',type='info'){
  const c={success:{i:'fa-check-circle',bg:'#D1FAE5',cl:'#10B981'},error:{i:'fa-circle-xmark',bg:'#FEE2E2',cl:'#EF4444'},warning:{i:'fa-triangle-exclamation',bg:'#FEF3C7',cl:'#F59E0B'},info:{i:'fa-circle-info',bg:'#EEF2FF',cl:'#6366F1'}}[type]
  const w=document.getElementById('toast-wrap'),t=document.createElement('div')
  t.className='toast'
  t.innerHTML=`<div class="toast-icon" style="background:${c.bg};color:${c.cl}"><i class="fa-solid ${c.i}"></i></div><div class="toast-body"><div class="toast-title">${title}</div>${msg?`<div class="toast-msg">${msg}</div>`:''}</div>`
  w.appendChild(t);setTimeout(()=>t.remove(),4000)
}
function fmoney(n){return new Intl.NumberFormat('ar-EG',{style:'currency',currency:'EGP',minimumFractionDigits:0}).format(n||0)}
function fdt(d){return d?new Date(d).toLocaleString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}
function badge(s){const m={pending:'badge-warning',confirmed:'badge-info',completed:'badge-success',cancelled:'badge-danger',no_show:'badge-danger',paid:'badge-success',partial:'badge-warning',draft:'badge-gray',overdue:'badge-danger',active:'badge-success',inactive:'badge-gray',new:'badge-blue'};const l={pending:'انتظار',confirmed:'مؤكد',completed:'مكتمل',cancelled:'ملغي',no_show:'لم يحضر',paid:'مدفوع',partial:'جزئي',draft:'مسودة',overdue:'متأخر',active:'نشط',inactive:'غير نشط',new:'جديد'};return`<span class="badge ${m[s]||'badge-gray'}">${l[s]||s}</span>`}

// ── Dashboard ──
async function loadDashboard(){
  const today=new Date().toISOString().slice(0,10)
  const[{count:tc},{count:pc},{data:rev},{count:wc}]=await Promise.all([
    sb.from('appointments').select('*',{count:'exact',head:true}).eq('organization_id',orgId).gte('scheduled_at',today+'T00:00:00').lte('scheduled_at',today+'T23:59:59'),
    sb.from('patients').select('*',{count:'exact',head:true}).eq('organization_id',orgId),
    sb.from('invoices').select('total').eq('organization_id',orgId).eq('status','paid').gte('created_at',new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString()),
    sb.from('appointments').select('*',{count:'exact',head:true}).eq('organization_id',orgId).eq('status','pending')
  ])
  document.getElementById('stat-today').textContent=tc||0
  document.getElementById('stat-patients').textContent=pc||0
  document.getElementById('stat-revenue').textContent=fmoney((rev||[]).reduce((s,r)=>s+(r.total||0),0))
  document.getElementById('stat-pending').textContent=wc||0
  const{data:appts}=await sb.from('appointments').select('*,patients(full_name),profiles!appointments_doctor_id_fkey(full_name)').eq('organization_id',orgId).gte('scheduled_at',today+'T00:00:00').lte('scheduled_at',today+'T23:59:59').order('scheduled_at')
  const tb=document.getElementById('today-appts')
  if(!appts?.length){tb.innerHTML='<tr><td colspan="6" class="table-empty">لا توجد مواعيد اليوم</td></tr>';return}
  tb.innerHTML=appts.map(a=>`<tr><td>${a.patients?.full_name||'—'}</td><td>${a.profiles?.full_name||'—'}</td><td>${fdt(a.scheduled_at)}</td><td>${{consultation:'كشف',follow_up:'متابعة',procedure:'إجراء',checkup:'فحص'}[a.type]||a.type}</td><td>${badge(a.status)}</td><td><button class="btn btn-ghost btn-sm btn-icon" onclick="editAppt('${a.id}')"><i class="fa-solid fa-pen"></i></button></td></tr>`).join('')
}

// ── Appointments ──
async function loadAppts(){
  const{data}=await sb.from('appointments').select('*,patients(full_name),profiles!appointments_doctor_id_fkey(full_name)').eq('organization_id',orgId).order('scheduled_at',{ascending:false})
  allAppts=data||[]
  document.getElementById('appts-count').textContent=`${allAppts.length} موعد`
  renderAppts(allAppts)
}
function renderAppts(data){
  const tb=document.getElementById('appts-table')
  if(!data.length){tb.innerHTML='<tr><td colspan="6" class="table-empty">لا توجد مواعيد</td></tr>';return}
  tb.innerHTML=data.map(a=>`<tr><td>${a.patients?.full_name||'—'}</td><td>${a.profiles?.full_name||'—'}</td><td>${fdt(a.scheduled_at)}</td><td>${{consultation:'كشف',follow_up:'متابعة',procedure:'إجراء',checkup:'فحص'}[a.type]||a.type}</td><td>${badge(a.status)}</td><td><button class="btn btn-ghost btn-sm btn-icon" onclick="editAppt('${a.id}')"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-danger btn-sm btn-icon" onclick="deleteAppt('${a.id}')"><i class="fa-solid fa-trash"></i></button></td></tr>`).join('')
}
window.filterAppts=()=>{
  const s=document.getElementById('appt-search').value.toLowerCase()
  const st=document.getElementById('appt-status-filter').value
  const dt=document.getElementById('appt-date-filter').value
  renderAppts(allAppts.filter(a=>{
    const nm=(a.patients?.full_name||'').toLowerCase()
    return(!s||nm.includes(s))&&(!st||a.status===st)&&(!dt||a.scheduled_at?.startsWith(dt))
  }))
}
window.saveAppt=async()=>{
  const id=document.getElementById('appt-id').value
  const row={patient_id:document.getElementById('appt-patient').value,doctor_id:document.getElementById('appt-doctor').value,scheduled_at:document.getElementById('appt-datetime').value,type:document.getElementById('appt-type').value,status:document.getElementById('appt-status').value,duration_minutes:+document.getElementById('appt-duration').value,notes:document.getElementById('appt-notes').value,organization_id:orgId}
  if(!row.patient_id||!row.doctor_id||!row.scheduled_at){toast('تحقق من البيانات','المريض والطبيب والوقت مطلوبون','warning');return}
  const{error}=id?await sb.from('appointments').update(row).eq('id',id):await sb.from('appointments').insert(row)
  if(error){toast('خطأ',error.message,'error');return}
  toast(id?'تم التحديث':'تمت الإضافة','','success');closeModal('modal-appt');loadAppts();loadDashboard()
}
window.editAppt=async(id)=>{
  const{data:a}=await sb.from('appointments').select('*').eq('id',id).single()
  document.getElementById('appt-id').value=a.id
  document.getElementById('appt-patient').value=a.patient_id
  document.getElementById('appt-doctor').value=a.doctor_id
  document.getElementById('appt-datetime').value=new Date(a.scheduled_at).toISOString().slice(0,16)
  document.getElementById('appt-type').value=a.type
  document.getElementById('appt-status').value=a.status
  document.getElementById('appt-duration').value=a.duration_minutes
  document.getElementById('appt-notes').value=a.notes||''
  document.getElementById('appt-modal-title').textContent='تعديل الموعد'
  openModal('modal-appt')
}
window.deleteAppt=async(id)=>{
  if(!confirm('حذف هذا الموعد؟'))return
  await sb.from('appointments').delete().eq('id',id)
  toast('تم الحذف','','success');loadAppts()
}

// ── Patients ──
async function loadPatients(){
  const{data}=await sb.from('patients').select('*,profiles!patients_assigned_doctor_id_fkey(full_name)').eq('organization_id',orgId).order('created_at',{ascending:false})
  allPatients=data||[]
  document.getElementById('patients-count').textContent=`${allPatients.length} مريض`
  renderPatients(allPatients)
  const sel=document.getElementById('patient-doctor')
  sel.innerHTML='<option value="">— بلا طبيب —</option>'
  const{data:docs}=await sb.from('profiles').select('id,full_name').eq('organization_id',orgId).eq('role','doctor')
  ;(docs||[]).forEach(d=>{sel.innerHTML+=`<option value="${d.id}">${d.full_name}</option>`})
}
function renderPatients(data){
  const tb=document.getElementById('patients-table')
  if(!data.length){tb.innerHTML='<tr><td colspan="7" class="table-empty">لا يوجد مرضى</td></tr>';return}
  tb.innerHTML=data.map(p=>`<tr><td><code>${p.mrn}</code></td><td>${p.full_name}</td><td>${p.gender==='male'?'ذكر':'أنثى'}</td><td>${p.phone||'—'}</td><td>${p.profiles?.full_name||'—'}</td><td>${badge(p.status)}</td><td><button class="btn btn-ghost btn-sm btn-icon" onclick="editPatient('${p.id}')"><i class="fa-solid fa-pen"></i></button></td></tr>`).join('')
}
window.filterPatients=()=>{
  const s=document.getElementById('patient-search').value.toLowerCase()
  renderPatients(allPatients.filter(p=>(p.full_name||'').toLowerCase().includes(s)||(p.mrn||'').toLowerCase().includes(s)))
}
window.savePatient=async()=>{
  const id=document.getElementById('patient-id').value
  const name=document.getElementById('patient-name').value.trim()
  if(!name){toast('الاسم مطلوب','','warning');return}
  const row={full_name:name,gender:document.getElementById('patient-gender').value,date_of_birth:document.getElementById('patient-dob').value||null,phone:document.getElementById('patient-phone').value,email:document.getElementById('patient-email').value,blood_type:document.getElementById('patient-blood').value||null,assigned_doctor_id:document.getElementById('patient-doctor').value||null,insurance_company:document.getElementById('patient-insurance').value,address:document.getElementById('patient-address').value,notes:document.getElementById('patient-notes').value,organization_id:orgId,status:'active'}
  if(!id){
    const{data:last}=await sb.from('patients').select('mrn').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(1)
    const n=(last?.[0]?.mrn?.split('-').pop()||999)
    row.mrn=`MRN-${new Date().getFullYear()}-${String(+n+1).padStart(4,'0')}`
  }
  const{error}=id?await sb.from('patients').update(row).eq('id',id):await sb.from('patients').insert(row)
  if(error){toast('خطأ',error.message,'error');return}
  toast(id?'تم التحديث':'تمت الإضافة','','success');closeModal('modal-patient');loadPatients()
}
window.editPatient=async(id)=>{
  const{data:p}=await sb.from('patients').select('*').eq('id',id).single()
  document.getElementById('patient-id').value=p.id
  document.getElementById('patient-name').value=p.full_name
  document.getElementById('patient-gender').value=p.gender||'male'
  document.getElementById('patient-dob').value=p.date_of_birth||''
  document.getElementById('patient-phone').value=p.phone||''
  document.getElementById('patient-email').value=p.email||''
  document.getElementById('patient-blood').value=p.blood_type||''
  document.getElementById('patient-doctor').value=p.assigned_doctor_id||''
  document.getElementById('patient-insurance').value=p.insurance_company||''
  document.getElementById('patient-address').value=p.address||''
  document.getElementById('patient-notes').value=p.notes||''
  document.getElementById('patient-modal-title').textContent='تعديل بيانات المريض'
  openModal('modal-patient')
}

// ── Doctors ──
async function loadDoctors(){
  const{data}=await sb.from('profiles').select('*').eq('organization_id',orgId).eq('role','doctor')
  const g=document.getElementById('doctors-grid')
  const colors=['avatar-blue','avatar-green','avatar-purple','avatar-amber']
  g.innerHTML=(data||[]).map((d,i)=>`<div class="card" style="padding:20px"><div style="display:flex;align-items:center;gap:12px;margin-bottom:12px"><div class="avatar avatar-md ${colors[i%4]}">${d.full_name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div><div><div style="font-weight:700">${d.full_name}</div><div style="font-size:12px;color:var(--text-muted)">${d.specialty||'طبيب عام'}</div></div></div><div style="font-size:12px;color:var(--text-muted)">${d.phone||''}</div></div>`).join('')||'<div style="color:var(--text-muted)">لا يوجد أطباء</div>'
}

// ── Employees ──
async function loadEmployees(){
  const{data}=await sb.from('profiles').select('*,branches(name)').eq('organization_id',orgId).order('role')
  const roles={admin:'مدير',doctor:'طبيب',reception:'استقبال',accountant:'محاسب'}
  const tb=document.getElementById('employees-table')
  tb.innerHTML=(data||[]).map(e=>`<tr><td>${e.full_name}</td><td>${roles[e.role]||e.role}</td><td>${e.phone||'—'}</td><td>${e.branches?.name||'—'}</td><td>${badge(e.is_active?'active':'inactive')}</td><td></td></tr>`).join('')||'<tr><td colspan="6" class="table-empty">لا يوجد موظفون</td></tr>'
}

// ── Invoices ──
let allInvoices=[]
async function loadInvoices(){
  const{data}=await sb.from('invoices').select('*,patients(full_name)').eq('organization_id',orgId).order('created_at',{ascending:false})
  allInvoices=data||[]
  renderInvoices(allInvoices)
}
function renderInvoices(data){
  const tb=document.getElementById('invoices-table')
  tb.innerHTML=data.map(i=>`<tr><td><code>${i.invoice_number}</code></td><td>${i.patients?.full_name||'—'}</td><td>${fmoney(i.total)}</td><td>${fmoney(i.paid_amount)}</td><td>${fmoney(i.remaining)}</td><td>${badge(i.status)}</td><td></td></tr>`).join('')||'<tr><td colspan="7" class="table-empty">لا توجد فواتير</td></tr>'
}
window.filterInvoices=()=>{
  const s=document.getElementById('inv-search').value.toLowerCase()
  const st=document.getElementById('inv-status-filter').value
  renderInvoices(allInvoices.filter(i=>(!s||(i.invoice_number||'').toLowerCase().includes(s))&&(!st||i.status===st)))
}

// ── Inventory ──
async function loadInventory(){
  const{data}=await sb.from('inventory').select('*').eq('organization_id',orgId).order('name')
  const tb=document.getElementById('inventory-table')
  tb.innerHTML=(data||[]).map(i=>`<tr><td>${i.name}</td><td>${i.category||'—'}</td><td style="color:${i.quantity<=i.min_quantity?'var(--danger)':'inherit'};font-weight:${i.quantity<=i.min_quantity?700:400}">${i.quantity}</td><td>${i.min_quantity}</td><td>${i.unit||'—'}</td><td>${badge(i.is_active?'active':'inactive')}</td><td></td></tr>`).join('')||'<tr><td colspan="7" class="table-empty">لا يوجد مخزون</td></tr>'
}

// ── Branches ──
async function loadBranches(){
  const{data}=await sb.from('branches').select('*').eq('organization_id',orgId)
  const g=document.getElementById('branches-grid')
  g.innerHTML=(data||[]).map(b=>`<div class="card" style="padding:20px"><div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><i class="fa-solid fa-code-branch" style="color:var(--primary)"></i><strong>${b.name}</strong>${b.is_main?'<span class="badge badge-blue">رئيسي</span>':''}</div><div style="font-size:13px;color:var(--text-muted)">${b.phone||''}</div><div style="font-size:13px;color:var(--text-muted)">${b.address||''}</div></div>`).join('')||'<div style="color:var(--text-muted)">لا توجد فروع</div>'
}

// ── Reports + Charts ──
async function loadReports(){
  const m=new Date();const ms=new Date(m.getFullYear(),m.getMonth(),1).toISOString()
  const[{data:rev},{count:pts},{count:apts}]=await Promise.all([
    sb.from('invoices').select('total,paid_amount').eq('organization_id',orgId).gte('created_at',ms),
    sb.from('patients').select('*',{count:'exact',head:true}).eq('organization_id',orgId),
    sb.from('appointments').select('*',{count:'exact',head:true}).eq('organization_id',orgId).gte('created_at',ms)
  ])
  const total=(rev||[]).reduce((s,r)=>s+(r.total||0),0)
  const paid=(rev||[]).reduce((s,r)=>s+(r.paid_amount||0),0)
  document.getElementById('report-stats').innerHTML=`
    <div class="stat-card"><div class="stat-header"><span class="stat-label">إيرادات الشهر</span><div class="stat-icon" style="background:#FEF3C7;color:#F59E0B"><i class="fa-solid fa-coins"></i></div></div><div class="stat-value">${fmoney(total)}</div></div>
    <div class="stat-card"><div class="stat-header"><span class="stat-label">المحصّل</span><div class="stat-icon" style="background:#D1FAE5;color:#10B981"><i class="fa-solid fa-check-circle"></i></div></div><div class="stat-value">${fmoney(paid)}</div></div>
    <div class="stat-card"><div class="stat-header"><span class="stat-label">إجمالي المرضى</span><div class="stat-icon" style="background:#EEF2FF;color:#6366F1"><i class="fa-solid fa-users"></i></div></div><div class="stat-value">${pts||0}</div></div>
    <div class="stat-card"><div class="stat-header"><span class="stat-label">مواعيد الشهر</span><div class="stat-icon" style="background:#DBEAFE;color:#1D4ED8"><i class="fa-solid fa-calendar"></i></div></div><div class="stat-value">${apts||0}</div></div>`
  await buildCharts()
}

// ── Load selects for modals ──
async function loadSelects(){
  const[{data:pts},{data:docs}]=await Promise.all([
    sb.from('patients').select('id,full_name').eq('organization_id',orgId).order('full_name'),
    sb.from('profiles').select('id,full_name').eq('organization_id',orgId).eq('role','doctor')
  ])
  const ps=document.getElementById('appt-patient'),ds=document.getElementById('appt-doctor')
  ps.innerHTML='<option value="">— اختر مريض —</option>'+(pts||[]).map(p=>`<option value="${p.id}">${p.full_name}</option>`).join('')
  ds.innerHTML='<option value="">— اختر طبيب —</option>'+(docs||[]).map(d=>`<option value="${d.id}">${d.full_name}</option>`).join('')
}

// ── Charts ──
async function buildCharts(){
  const months=[];const labels=[]
  for(let i=5;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);months.push(d);labels.push(d.toLocaleDateString('ar-EG',{month:'short'}))}
  const[aD,rD,sD,pD]=await Promise.all([
    Promise.all(months.map(m=>sb.from('appointments').select('*',{count:'exact',head:true}).eq('organization_id',orgId).gte('scheduled_at',new Date(m.getFullYear(),m.getMonth(),1).toISOString()).lte('scheduled_at',new Date(m.getFullYear(),m.getMonth()+1,0).toISOString()))),
    Promise.all(months.map(m=>sb.from('invoices').select('total').eq('organization_id',orgId).eq('status','paid').gte('created_at',new Date(m.getFullYear(),m.getMonth(),1).toISOString()).lte('created_at',new Date(m.getFullYear(),m.getMonth()+1,0).toISOString()))),
    sb.from('appointments').select('status').eq('organization_id',orgId),
    Promise.all(months.map(m=>sb.from('patients').select('*',{count:'exact',head:true}).eq('organization_id',orgId).gte('created_at',new Date(m.getFullYear(),m.getMonth(),1).toISOString()).lte('created_at',new Date(m.getFullYear(),m.getMonth()+1,0).toISOString())))
  ])
  const opt={responsive:true,plugins:{legend:{display:false}},scales:{y:{beginAtZero:true,ticks:{font:{family:'IBM Plex Sans Arabic'}}},x:{ticks:{font:{family:'IBM Plex Sans Arabic'}}}}}
  const mk=(id,type,data,label,color,opts)=>{const c=document.getElementById(id);if(!c)return;const ex=Chart.getChart(c);if(ex)ex.destroy();new Chart(c,{type,data:{labels,datasets:[{label,data,borderColor:color,backgroundColor:color+(type==='line'?'20':'99'),tension:.4,fill:type==='line'}]},options:opts||opt})}
  mk('chart-appts','line',aD.map(r=>r.count||0),'المواعيد','#6366F1')
  mk('chart-revenue','line',rD.map(r=>(r.data||[]).reduce((s,i)=>s+(i.total||0),0)),'الإيرادات','#10B981')
  mk('chart-patients','bar',pD.map(r=>r.count||0),'مرضى جدد','#1D4ED8')
  const st={pending:0,confirmed:0,completed:0,cancelled:0};(sD.data||[]).forEach(a=>{if(st[a.status]!==undefined)st[a.status]++})
  const cs=document.getElementById('chart-status');if(cs){const ex=Chart.getChart(cs);if(ex)ex.destroy();new Chart(cs,{type:'doughnut',data:{labels:['انتظار','مؤكد','مكتمل','ملغي'],datasets:[{data:Object.values(st),backgroundColor:['#F59E0B','#6366F1','#10B981','#EF4444']}]},options:{responsive:true,plugins:{legend:{position:'bottom',labels:{font:{family:'IBM Plex Sans Arabic'}}}}}})}  
}

// ── Excel Export ──
window.exportExcel=async(type)=>{
  let data,fname
  if(type==='patients'){
    const{data:d}=await sb.from('patients').select('mrn,full_name,gender,phone,email,blood_type,status,created_at').eq('organization_id',orgId)
    data=(d||[]).map(r=>({الرقم:r.mrn,الاسم:r.full_name,الجنس:r.gender==='male'?'ذكر':'أنثى',الهاتف:r.phone||'',البريد:r.email||'',فصيلة_الدم:r.blood_type||'',الحالة:r.status,التاريخ:new Date(r.created_at).toLocaleDateString('ar-EG')}));fname='المرضى'
  } else {
    const{data:d}=await sb.from('invoices').select('invoice_number,total,paid_amount,status,payment_method,created_at,patients(full_name)').eq('organization_id',orgId)
    data=(d||[]).map(r=>({رقم_الفاتورة:r.invoice_number,المريض:r.patients?.full_name||'',الإجمالي:r.total,المدفوع:r.paid_amount,الحالة:r.status,طريقة_الدفع:r.payment_method||'',التاريخ:new Date(r.created_at).toLocaleDateString('ar-EG')}));fname='الفواتير'
  }
  const wb=XLSX.utils.book_new();const ws=XLSX.utils.json_to_sheet(data)
  XLSX.utils.book_append_sheet(wb,ws,fname);XLSX.writeFile(wb,`سليم_${fname}_${new Date().toISOString().slice(0,10)}.xlsx`)
  toast(`تم تصدير ${fname}`,'','success')
}

// ── Settings ──
async function loadSettings(){
  const{data:o}=await sb.from('organizations').select('*').eq('id',orgId).single()
  if(!o)return
  const fields={name:'set-name',phone:'set-phone',email:'set-email',address:'set-address',tax_number:'set-tax'}
  Object.entries(fields).forEach(([k,id])=>{const el=document.getElementById(id);if(el)el.value=o[k]||''})
}
window.saveSettings=async()=>{
  const row={name:document.getElementById('set-name').value,phone:document.getElementById('set-phone').value,email:document.getElementById('set-email').value,address:document.getElementById('set-address').value,tax_number:document.getElementById('set-tax').value}
  const{error}=await sb.from('organizations').update(row).eq('id',orgId)
  if(error){toast('خطأ',error.message,'error');return}
  document.querySelectorAll('[data-org-name]').forEach(e=>e.textContent=row.name)
  toast('تم حفظ بيانات العيادة','','success')
}
window.changePassword=async()=>{
  const np=document.getElementById('set-new-pass').value
  const cp=document.getElementById('set-confirm-pass').value
  if(!np||np.length<6){toast('6 أحرف على الأقل','','warning');return}
  if(np!==cp){toast('كلمتا المرور غير متطابقتين','','warning');return}
  const{error}=await sb.auth.updateUser({password:np})
  if(error){toast('خطأ',error.message,'error');return}
  toast('تم تغيير كلمة المرور','','success')
  ;['set-old-pass','set-new-pass','set-confirm-pass'].forEach(id=>{const el=document.getElementById(id);if(el)el.value=''})
}

// ── User Management ──
async function loadEmployeesWithEdit(){
  const[{data},{data:branches}]=await Promise.all([
    sb.from('profiles').select('*,branches(name)').eq('organization_id',orgId).order('role'),
    sb.from('branches').select('id,name').eq('organization_id',orgId)
  ])
  const roles={admin:'مدير',doctor:'طبيب',reception:'استقبال',accountant:'محاسب'}
  const tb=document.getElementById('employees-table')
  tb.innerHTML=(data||[]).map(e=>`<tr><td>${e.full_name}</td><td>${roles[e.role]||e.role}</td><td>${e.phone||'—'}</td><td>${e.branches?.name||'—'}</td><td>${badge(e.is_active?'active':'inactive')}</td><td><button class="btn btn-ghost btn-sm btn-icon" onclick="editEmployee('${e.id}')"><i class="fa-solid fa-pen"></i></button> <button class="btn btn-${e.is_active?'warning':'success'} btn-sm" onclick="toggleEmployee('${e.id}',${!e.is_active})">${e.is_active?'تعليق':'تفعيل'}</button></td></tr>`).join('')||'<tr><td colspan="6" class="table-empty">لا يوجد موظفون</td></tr>'
  const bsel=document.getElementById('emp-branch')
  if(bsel)bsel.innerHTML='<option value="">— بلا فرع —</option>'+(branches||[]).map(b=>`<option value="${b.id}">${b.name}</option>`).join('')
}
window.editEmployee=async(id)=>{
  const{data:e}=await sb.from('profiles').select('*').eq('id',id).single()
  ;['emp-id','emp-name','emp-role','emp-phone','emp-specialty','emp-branch','emp-active'].forEach(k=>{
    const el=document.getElementById(k);if(!el)return
    const map={id:e.id,name:e.full_name,role:e.role,phone:e.phone||'',specialty:e.specialty||'',branch:e.branch_id||'',active:String(e.is_active)}
    el.value=map[k.replace('emp-','')]||''
  })
  ;['emp-email','emp-pass'].forEach(i=>{const el=document.getElementById(i);if(el)el.value=''})
  document.getElementById('emp-modal-title').textContent='تعديل بيانات الموظف'
  openModal('modal-employee')
}
window.saveEmployee=async()=>{
  const id=document.getElementById('emp-id').value
  const name=document.getElementById('emp-name').value.trim()
  if(!name){toast('الاسم مطلوب','','warning');return}
  const row={full_name:name,role:document.getElementById('emp-role').value,phone:document.getElementById('emp-phone').value,specialty:document.getElementById('emp-specialty').value,branch_id:document.getElementById('emp-branch').value||null,is_active:document.getElementById('emp-active').value==='true'}
  if(id){
    const{error}=await sb.from('profiles').update(row).eq('id',id)
    if(error){toast('خطأ',error.message,'error');return}
  } else {
    row.organization_id=orgId
    const{error}=await sb.from('profiles').insert(row)
    if(error){toast('خطأ',error.message,'error');return}
  }
  toast(id?'تم التحديث':'تمت الإضافة','','success');closeModal('modal-employee');loadEmployeesWithEdit()
}
window.toggleEmployee=async(id,active)=>{
  await sb.from('profiles').update({is_active:active}).eq('id',id)
  toast(active?'تم التفعيل':'تم التعليق','','success');loadEmployeesWithEdit()
}

// ── Realtime ──
let notifList=[]
function setupRealtime(){
  sb.channel('clinic').on('postgres_changes',{event:'INSERT',schema:'public',table:'appointments',filter:`organization_id=eq.${orgId}`},()=>{
    addNotif('موعد جديد','تمت إضافة موعد جديد');toast('موعد جديد','تمت الإضافة','info');loadDashboard()
  }).on('postgres_changes',{event:'INSERT',schema:'public',table:'patients',filter:`organization_id=eq.${orgId}`},()=>{
    addNotif('مريض جديد','تم تسجيل مريض جديد')
  }).subscribe()
}
function addNotif(title,msg){
  notifList.unshift({title,msg,time:new Date()})
  const cnt=document.getElementById('notif-count');if(cnt){cnt.style.display='flex';cnt.textContent=notifList.length}
}
document.getElementById('notif-btn')?.addEventListener('click',()=>{
  const el=document.getElementById('notif-list')
  if(el)el.innerHTML=notifList.length?notifList.map(n=>`<div style="padding:12px 16px;border-bottom:1px solid var(--border)"><div style="font-weight:600;font-size:13px">${n.title}</div><div style="font-size:12px;color:var(--text-muted)">${n.msg}</div><div style="font-size:11px;color:var(--text-light);margin-top:4px">${new Date(n.time).toLocaleTimeString('ar-EG')}</div></div>`).join(''):'<div style="text-align:center;padding:24px;color:var(--text-muted)">لا توجد إشعارات</div>'
  openModal('modal-notif');const cnt=document.getElementById('notif-count');if(cnt)cnt.style.display='none'
})
window.toggleNotif=async()=>{
  const tog=document.getElementById('notif-toggle'),sl=document.getElementById('notif-slider'),st=document.getElementById('notif-status')
  if(tog?.checked){
    const p=await Notification.requestPermission()
    if(p==='granted'){if(sl)sl.style.background='var(--success)';if(st)st.textContent='مفعّلة ✅'}
    else{if(tog)tog.checked=false;if(st)st.textContent='تم رفض الإذن'}
  } else {if(sl)sl.style.background='#ddd';if(st)st.textContent='متوقفة'}
}

// ── Nav (override with new loaders) ──
window.nav=id=>{
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'))
  document.getElementById('page-'+id)?.classList.add('active')
  document.getElementById('nav-'+id)?.classList.add('active')
  document.getElementById('topbar-title').textContent=({dashboard:'لوحة التحكم',appointments:'المواعيد',patients:'المرضى',doctors:'الأطباء',employees:'الموظفون',invoices:'الفواتير',inventory:'المخزون',branches:'الفروع',reports:'التقارير',settings:'الإعدادات'})[id]||''
  ;({appointments:loadAppts,patients:loadPatients,doctors:loadDoctors,employees:loadEmployeesWithEdit,invoices:loadInvoices,inventory:loadInventory,branches:loadBranches,reports:loadReports,settings:loadSettings})[id]?.()
}

// ── Load selects ──
async function loadSelects(){
  const[{data:pts},{data:docs}]=await Promise.all([
    sb.from('patients').select('id,full_name').eq('organization_id',orgId).order('full_name'),
    sb.from('profiles').select('id,full_name').eq('organization_id',orgId).eq('role','doctor')
  ])
  const ps=document.getElementById('appt-patient'),ds=document.getElementById('appt-doctor')
  ps.innerHTML='<option value="">— اختر مريض —</option>'+(pts||[]).map(p=>`<option value="${p.id}">${p.full_name}</option>`).join('')
  ds.innerHTML='<option value="">— اختر طبيب —</option>'+(docs||[]).map(d=>`<option value="${d.id}">${d.full_name}</option>`).join('')
}

// ── Init ──
await loadSelects()
await loadDashboard()
setupRealtime()

document.querySelectorAll('.modal-overlay').forEach(o=>o.addEventListener('click',e=>{if(e.target===o)o.classList.remove('open')}))
const origOpenModal=window.openModal
window.openModal=id=>{
  if(id==='modal-appt'){document.getElementById('appt-id').value='';document.getElementById('appt-modal-title').textContent='موعد جديد';document.getElementById('appt-notes').value=''}
  if(id==='modal-patient'){document.getElementById('patient-id').value='';document.getElementById('patient-modal-title').textContent='مريض جديد';['patient-name','patient-dob','patient-phone','patient-email','patient-insurance','patient-address','patient-notes'].forEach(i=>document.getElementById(i).value='')}
  if(id==='modal-employee'){document.getElementById('emp-id').value='';document.getElementById('emp-modal-title').textContent='موظف جديد';['emp-name','emp-phone','emp-specialty','emp-email','emp-pass'].forEach(i=>document.getElementById(i).value='')}
  origOpenModal(id)
}



// ── Dark Mode ──
window.toggleDark=()=>{
  document.body.classList.toggle('dark')
  const isDark=document.body.classList.contains('dark')
  document.getElementById('dark-icon').className=isDark?'fa-solid fa-sun':'fa-regular fa-moon'
  localStorage.setItem('theme',isDark?'dark':'light')
}
if(localStorage.getItem('theme')==='dark'){
  document.body.classList.add('dark')
  const di=document.getElementById('dark-icon')
  if(di)di.className='fa-solid fa-sun'
}

// ── Mobile Menu ──
window.toggleMobileMenu=()=>{
  document.getElementById('sidebar')?.classList.toggle('open')
  document.getElementById('mobile-overlay')?.classList.toggle('show')
}

// ── Global Search ──
window.openSearch=()=>{
  document.getElementById('search-overlay')?.classList.add('open')
  setTimeout(()=>document.getElementById('search-input')?.focus(),100)
}
window.closeSearch=()=>{
  document.getElementById('search-overlay')?.classList.remove('open')
  if(document.getElementById('search-input'))document.getElementById('search-input').value=''
}
window.doSearch=async(q)=>{
  const res=document.getElementById('search-results')
  if(!q||q.length<2){res.innerHTML=`<div class="search-section-label">الاختصارات السريعة</div>
    <div class="search-result-row" onclick="nav('appointments');closeSearch()"><div class="search-result-icon" style="background:#EEF2FF;color:#6366F1"><i class="fa-solid fa-calendar"></i></div><div><div class="search-result-title">المواعيد</div></div></div>
    <div class="search-result-row" onclick="nav('patients');closeSearch()"><div class="search-result-icon" style="background:#D1FAE5;color:#10B981"><i class="fa-solid fa-users"></i></div><div><div class="search-result-title">المرضى</div></div></div>
    <div class="search-result-row" onclick="nav('reports');closeSearch()"><div class="search-result-icon" style="background:#DBEAFE;color:#1D4ED8"><i class="fa-solid fa-chart-bar"></i></div><div><div class="search-result-title">التقارير</div></div></div>`;return}
  const[{data:pts},{data:apts}]=await Promise.all([
    sb.from('patients').select('id,full_name,mrn,phone').eq('organization_id',orgId).ilike('full_name',`%${q}%`).limit(5),
    sb.from('appointments').select('id,scheduled_at,patients(full_name)').eq('organization_id',orgId).gte('scheduled_at',new Date().toISOString().slice(0,10)).limit(3)
  ])
  let html=''
  if(pts?.length){html+=`<div class="search-section-label">المرضى</div>${pts.map(p=>`<div class="search-result-row" onclick="closeSearch()"><div class="search-result-icon" style="background:#D1FAE5;color:#10B981"><i class="fa-solid fa-user"></i></div><div><div class="search-result-title">${p.full_name}</div><div class="search-result-sub">${p.mrn||''} · ${p.phone||''}</div></div></div>`).join('')}`}
  if(!html)html=`<div class="search-no-results"><i class="fa-solid fa-search" style="font-size:28px;color:var(--border)"></i><div style="margin-top:8px">لا نتائج لـ "${q}"</div></div>`
  res.innerHTML=html
}
document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key==='k'){e.preventDefault();openSearch()}if(e.key==='Escape')closeSearch()})

// ── Welcome Banner ──
const _wn=profile?.full_name?.split(' ')[0]||'مدير'
const _hr=new Date().getHours()
const _gr=_hr<12?'صباح الخير':'_hr<17?'مساء الخير':'مساء النور'
const _welEl=document.getElementById('welcome-msg')
if(_welEl)_welEl.textContent=`${_gr}، ${_wn} 👋`
const _wdEl=document.getElementById('welcome-date')
if(_wdEl)_wdEl.textContent=new Date().toLocaleDateString('ar-EG',{weekday:'long',year:'numeric',month:'long',day:'numeric'})

// Update welcome stats from existing stat elements
setTimeout(()=>{
  const wt=document.getElementById('w-today'),ws=document.getElementById('stat-today')
  if(wt&&ws)wt.textContent=ws.textContent
  const wr=document.getElementById('w-rev'),wsr=document.getElementById('stat-revenue')
  if(wr&&wsr)wr.textContent=wsr.textContent
},2000)

// ── Calendar ──
let calYear=new Date().getFullYear(),calMonth=new Date().getMonth(),calAppts=[]
window.changeMonth=(d)=>{calMonth+=d;if(calMonth>11){calMonth=0;calYear++}if(calMonth<0){calMonth=11;calYear--};renderCal()}
async function loadCalendar(){
  const start=new Date(calYear,calMonth,1).toISOString()
  const end=new Date(calYear,calMonth+1,0,23,59).toISOString()
  const{data}=await sb.from('appointments').select('scheduled_at,status,patients(full_name)').eq('organization_id',orgId).gte('scheduled_at',start).lte('scheduled_at',end)
  calAppts=data||[]
  renderCal()
}
function renderCal(){
  const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']
  const lbl=document.getElementById('cal-label')
  if(lbl)lbl.textContent=`${months[calMonth]} ${calYear}`
  const body=document.getElementById('cal-body')
  if(!body)return
  const first=new Date(calYear,calMonth,1).getDay()
  const days=new Date(calYear,calMonth+1,0).getDate()
  const today=new Date()
  let html=''
  for(let i=0;i<first;i++)html+=`<div class="cal-day other-month"><div class="cal-day-num" style="color:var(--text-light)">${new Date(calYear,calMonth,-(first-i-1)).getDate()}</div></div>`
  for(let d=1;d<=days;d++){
    const isToday=d===today.getDate()&&calMonth===today.getMonth()&&calYear===today.getFullYear()
    const dateStr=`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
    const dayAppts=calAppts.filter(a=>a.scheduled_at?.startsWith(dateStr))
    const colors={pending:'background:#FEF3C7;color:#92400E',confirmed:'background:#DBEAFE;color:#1D4ED8',completed:'background:#D1FAE5;color:#065F46',cancelled:'background:#FEE2E2;color:#991B1B'}
    html+=`<div class="cal-day${isToday?' today':''}"><div class="cal-day-num">${d}</div>${dayAppts.slice(0,3).map(a=>`<div class="cal-event" style="${colors[a.status]||'background:#F1F5F9;color:#475569'}">${a.patients?.full_name||'موعد'}</div>`).join('')}${dayAppts.length>3?`<div style="font-size:9px;color:var(--text-muted)">+${dayAppts.length-3} أكثر</div>`:''}</div>`
  }
  body.innerHTML=html
}

// ── Financial Report ──
async function loadFinancial(period='month'){
  const now=new Date()
  let start
  if(period==='month')start=new Date(now.getFullYear(),now.getMonth(),1).toISOString()
  else if(period==='quarter')start=new Date(now.getFullYear(),Math.floor(now.getMonth()/3)*3,1).toISOString()
  else start=new Date(now.getFullYear(),0,1).toISOString()
  const{data:invs}=await sb.from('invoices').select('total,paid_amount,status,payment_method').eq('organization_id',orgId).gte('created_at',start)
  const list=invs||[]
  const rev=list.reduce((s,i)=>s+(i.total||0),0)
  const paid=list.reduce((s,i)=>s+(i.paid_amount||0),0)
  const pend=rev-paid
  document.getElementById('fin-revenue').textContent=fmoney(rev)
  document.getElementById('fin-paid').textContent=fmoney(paid)
  document.getElementById('fin-pending').textContent=fmoney(pend)
  document.getElementById('fin-invoices').textContent=list.length
  // Payment methods bar
  const methods={cash:0,card:0,insurance:0,bank_transfer:0}
  list.forEach(i=>{if(methods[i.payment_method]!==undefined)methods[i.payment_method]+=(i.paid_amount||0)})
  const total=Object.values(methods).reduce((a,b)=>a+b,0)||1
  const mColors={cash:'#10B981',card:'#6366F1',insurance:'#F59E0B',bank_transfer:'#3B82F6'}
  const mLabels={cash:'نقداً',card:'بطاقة',insurance:'تأمين',bank_transfer:'تحويل'}
  const barEl=document.getElementById('fin-pay-bar-wrap')
  if(barEl)barEl.innerHTML=`<div class="fin-pay-bar">${Object.entries(methods).filter(([,v])=>v>0).map(([k,v])=>`<div class="fin-pay-segment" style="width:${(v/total*100).toFixed(1)}%;background:${mColors[k]}" title="${mLabels[k]}: ${fmoney(v)}">${(v/total*100).toFixed(0)}%</div>`).join('')}</div><div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:8px">${Object.entries(methods).filter(([,v])=>v>0).map(([k,v])=>`<div style="display:flex;align-items:center;gap:5px;font-size:12px"><div style="width:10px;height:10px;border-radius:50%;background:${mColors[k]}"></div>${mLabels[k]}: ${fmoney(v)}</div>`).join('')}</div>`
}

// ── Notifications Page ──
let allNotifs=[]
async function loadNotificationsPage(){
  const{data}=await sb.from('appointments').select('id,scheduled_at,status,created_at,patients(full_name)').eq('organization_id',orgId).order('created_at',{ascending:false}).limit(30)
  allNotifs=(data||[]).map(a=>({id:a.id,type:'appt',title:`موعد: ${a.patients?.full_name||'—'}`,body:`${new Date(a.scheduled_at).toLocaleString('ar-EG',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})} · ${{pending:'في الانتظار',confirmed:'مؤكد',completed:'مكتمل',cancelled:'ملغي'}[a.status]||a.status}`,time:a.created_at,unread:a.status==='pending'}))
  renderNotifPage(allNotifs)
}
function renderNotifPage(list){
  const el=document.getElementById('notif-page-list')
  if(!el)return
  if(!list.length){el.innerHTML=`<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fa-regular fa-bell-slash" style="font-size:36px"></i><div style="margin-top:12px">لا توجد إشعارات</div></div>`;return}
  el.innerHTML=list.map(n=>`<div class="notif-item-card${n.unread?' unread':''}"><div class="notif-icon-wrap" style="background:${n.unread?'var(--primary-light)':'var(--bg)'};color:${n.unread?'var(--primary)':'var(--text-muted)'}"><i class="fa-solid fa-calendar-check"></i></div><div style="flex:1"><div style="font-size:13px;font-weight:${n.unread?'600':'400'}">${n.title}</div><div style="font-size:12px;color:var(--text-muted);margin-top:2px">${n.body}</div></div><div style="font-size:11px;color:var(--text-light);white-space:nowrap">${new Date(n.time).toLocaleDateString('ar-EG')}</div></div>`).join('')
}
window.filterNotif=(type)=>{
  document.querySelectorAll('[id^="nf-"]').forEach(b=>b.className='btn btn-ghost btn-sm')
  const el=document.getElementById(`nf-${type}`)
  if(el)el.className='btn btn-primary btn-sm'
  renderNotifPage(type==='all'?allNotifs:allNotifs.filter(n=>n.type===type))
}
window.markAllRead=()=>{allNotifs.forEach(n=>n.unread=false);renderNotifPage(allNotifs);toast('تم','تم تحديد الكل كمقروء','success')}

// ── Services Page ──
let allServices=[]
async function loadServices(){
  const{data}=await sb.from('services').select('*').eq('organization_id',orgId).order('name')
  allServices=data||[]
  renderServices(allServices)
}
function renderServices(list){
  const tb=document.getElementById('services-table')
  if(!tb)return
  tb.innerHTML=list.map(s=>`<tr><td><b>${s.name}</b>${s.description?`<div style="font-size:11px;color:var(--text-muted)">${s.description}</div>`:''}</td><td>${s.category||'—'}</td><td style="font-weight:700;color:var(--primary)">${fmoney(s.price)}</td><td>${s.duration_minutes||'—'} د</td><td><span class="badge ${s.is_active?'badge-success':'badge-gray'}">${s.is_active?'نشط':'متوقف'}</span></td><td><button class="btn btn-ghost btn-sm btn-icon" onclick="toggleService('${s.id}',${!s.is_active})"><i class="fa-solid fa-power-off"></i></button></td></tr>`).join('')||'<tr><td colspan="6" class="table-empty">لا توجد خدمات</td></tr>'
}
window.filterServices=()=>{const q=document.getElementById('svc-search')?.value.toLowerCase()||'';renderServices(allServices.filter(s=>(s.name||'').toLowerCase().includes(q)))}
window.saveService=async()=>{
  const name=document.getElementById('svc-name')?.value.trim()
  if(!name){toast('الاسم مطلوب','','warning');return}
  const{error}=await sb.from('services').insert({organization_id:orgId,name,category:document.getElementById('svc-category')?.value,price:+document.getElementById('svc-price')?.value||0,duration_minutes:+document.getElementById('svc-duration')?.value||30,description:document.getElementById('svc-desc')?.value,is_active:true})
  if(error){toast('خطأ',error.message,'error');return}
  toast('تمت الإضافة','','success');closeModal('modal-service');loadServices()
}
window.toggleService=async(id,active)=>{await sb.from('services').update({is_active:active}).eq('id',id);loadServices()}

// ── Reminders Page ──
async function loadReminders(){
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1)
  const tStr=tomorrow.toISOString().slice(0,10)
  const{data}=await sb.from('appointments').select('*,patients(full_name,phone)').eq('organization_id',orgId).gte('scheduled_at',tStr+'T00:00:00').lte('scheduled_at',tStr+'T23:59:59').order('scheduled_at')
  const el=document.getElementById('tomorrow-appts')
  if(!el)return
  el.innerHTML=(data||[]).map(a=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--border)"><div><div style="font-size:13px;font-weight:600">${a.patients?.full_name||'—'}</div><div style="font-size:11px;color:var(--text-muted)">${new Date(a.scheduled_at).toLocaleTimeString('ar-EG',{hour:'2-digit',minute:'2-digit'})} · ${a.patients?.phone||'—'}</div></div><button class="btn btn-ghost btn-sm" onclick="quickReminder('${a.patients?.phone||''}','${a.patients?.full_name||''}','${a.scheduled_at}')"><i class="fa-brands fa-whatsapp" style="color:#25D366"></i></button></div>`).join('')||'<div style="text-align:center;color:var(--text-muted);padding:20px">لا توجد مواعيد غداً</div>'
  // Load patients for select
  const{data:pts}=await sb.from('patients').select('id,full_name,phone').eq('organization_id',orgId).order('full_name')
  const sel=document.getElementById('reminder-patient')
  if(sel)sel.innerHTML='<option value="">— اختر مريض —</option>'+(pts||[]).map(p=>`<option value="${p.id}" data-phone="${p.phone||''}" data-name="${p.full_name}">${p.full_name}</option>`).join('')
}
window.selectChannel=(ch)=>{
  document.getElementById('ch-whatsapp')?.classList.toggle('active',ch==='whatsapp')
  document.getElementById('ch-sms')?.classList.toggle('active',ch==='sms')
}
window.quickReminder=(phone,name,time)=>{
  const msg=encodeURIComponent(`مرحباً ${name}،\nنذكّركم بموعدكم غداً: ${new Date(time).toLocaleString('ar-EG',{hour:'2-digit',minute:'2-digit'})}\nسليم لإدارة العيادات 🏥`)
  const num=(phone||'').replace(/[^0-9]/g,'')
  if(!num){toast('لا يوجد رقم هاتف','','warning');return}
  window.open(`https://wa.me/2${num}?text=${msg}`,'_blank')
}
window.sendReminder=()=>{
  const sel=document.getElementById('reminder-patient')
  const opt=sel?.options[sel.selectedIndex]
  const phone=opt?.dataset.phone||''
  const name=opt?.dataset.name||''
  const msg=encodeURIComponent(document.getElementById('reminder-msg')?.value||`مرحباً ${name}، هذا تذكير من سليم لإدارة العيادات.`)
  const num=phone.replace(/[^0-9]/g,'')
  if(!num){toast('لا يوجد رقم هاتف','','warning');return}
  window.open(`https://wa.me/2${num}?text=${msg}`,'_blank')
}

// ── Export Data ──
window.exportData=async(type)=>{
  toast('جاري التصدير...','','info')
  let data,filename
  if(type==='patients'){
    const{data:r}=await sb.from('patients').select('*').eq('organization_id',orgId)
    data=(r||[]).map(p=>({الاسم:p.full_name,MRN:p.mrn,الهاتف:p.phone,الجنس:p.gender==='male'?'ذكر':'أنثى',تاريخ_الميلاد:p.date_of_birth,الحالة:p.status}))
    filename='patients'
  } else if(type==='invoices'){
    const{data:r}=await sb.from('invoices').select('*,patients(full_name)').eq('organization_id',orgId)
    data=(r||[]).map(i=>({رقم_الفاتورة:i.invoice_number,المريض:i.patients?.full_name,الإجمالي:i.total,المدفوع:i.paid_amount,الحالة:i.status,التاريخ:i.created_at?.slice(0,10)}))
    filename='invoices'
  } else if(type==='appointments'){
    const{data:r}=await sb.from('appointments').select('*,patients(full_name)').eq('organization_id',orgId)
    data=(r||[]).map(a=>({المريض:a.patients?.full_name,التاريخ:a.scheduled_at?.slice(0,10),الوقت:a.scheduled_at?.slice(11,16),النوع:a.type,الحالة:a.status}))
    filename='appointments'
  } else if(type==='employees'){
    const{data:r}=await sb.from('profiles').select('*').eq('organization_id',orgId)
    data=(r||[]).map(e=>({الاسم:e.full_name,البريد:e.email,الدور:e.role,التخصص:e.specialty,الحالة:e.is_active?'نشط':'متوقف'}))
    filename='employees'
  }
  if(!data?.length){toast('لا توجد بيانات','','warning');return}
  const ws=XLSX.utils.json_to_sheet(data)
  const wb=XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb,ws,'البيانات')
  XLSX.writeFile(wb,`${filename}_${new Date().toISOString().slice(0,10)}.xlsx`)
  toast('تم التصدير','','success')
}

// ── Roles Page ──
const ROLE_PERMS={
  admin:{pages:['dashboard','appointments','patients','doctors','employees','invoices','inventory','branches','reports','settings','calendar','financial','services','contracts','notifications','roles','export','reminders'],label:'كل الصلاحيات'},
  doctor:{pages:['schedule','patients','prescriptions','lab','week'],label:'المرضى والوصفات والمختبر'},
  reception:{pages:['today','appointments','patients','pos','invoices'],label:'الاستقبال والفواتير'},
  accountant:{pages:['invoices','financial','reports'],label:'الفواتير والتقارير المالية'}
}
window.selectRole=(role)=>{
  document.querySelectorAll('.role-card').forEach(c=>c.classList.remove('selected'))
  document.getElementById(`role-${role}`)?.classList.add('selected')
  const perms=ROLE_PERMS[role]
  const labels={dashboard:'لوحة التحكم',appointments:'المواعيد',patients:'المرضى',doctors:'الأطباء',employees:'الموظفون',invoices:'الفواتير',inventory:'المخزون',branches:'الفروع',reports:'التقارير',settings:'الإعدادات',calendar:'التقويم',financial:'التقرير المالي',services:'الخدمات',contracts:'التعاقدات',notifications:'الإشعارات',roles:'الصلاحيات',export:'التصدير',reminders:'التذكير',schedule:'الجدول',prescriptions:'الوصفات',lab:'المختبر',week:'الجدول الأسبوعي',today:'مواعيد اليوم',pos:'الفواتير الفورية'}
  const ALL=['dashboard','appointments','patients','doctors','employees','invoices','inventory','branches','reports','settings','calendar','financial','services','contracts','notifications','roles','export','reminders','schedule','prescriptions','lab','pos']
  const el=document.getElementById('roles-perms')
  if(el)el.innerHTML=`<p style="font-size:13px;color:var(--text-muted);margin-bottom:16px">${perms.label}</p>${ALL.map(p=>`<div class="perm-row"><div style="flex:1;font-size:13px">${labels[p]||p}</div><div class="perm-check ${perms.pages.includes(p)?'on':''}">${perms.pages.includes(p)?'<i class="fa-solid fa-check"></i>':''}</div></div>`).join('')}`
}

// ── Extend nav loader ──
const _origNav=window.nav
window.nav=(id)=>{
  _origNav?.(id)
  const extra={calendar:loadCalendar,financial:loadFinancial,notifications:loadNotificationsPage,services:loadServices,reminders:loadReminders}
  extra[id]?.()
}
