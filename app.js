// ==============================
// COLLEGE TIMETABLE - Supabase
// ==============================
// Replace these two values with your Supabase Project URL and Publishable key.
const SUPABASE_URL = "https://dlkbrhrsflyxxykjfqyc.supabase.co";
const SUPABASE_KEY = "sb_publishable_rA6PKUIOCn0Mxiv3D7pqIw_k64ubXlU";

const configured = !SUPABASE_URL.includes("YOUR_") && !SUPABASE_KEY.includes("YOUR_");
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
let currentProfile = null;
let currentSection = "dashboard";
let authMode = "login";

const $ = id => document.getElementById(id);
const esc = v => String(v ?? "").replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const toast = msg => { const t=$('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); };
const fmt = v => v ? new Date(v).toLocaleString([], {dateStyle:'medium', timeStyle:'short'}) : '-';

function showAuthMessage(msg, error=false){ $('authMessage').textContent=msg; $('authMessage').style.color=error?'#b91c1c':'#047857'; }
function roleName(r){ return r ? r[0].toUpperCase()+r.slice(1) : 'User'; }

function setAuthMode(mode){
  authMode=mode;
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.auth===mode));
  $('signupFields').classList.toggle('hidden',mode!=='signup');
  $('authSubmit').textContent=mode==='login'?'Login':'Create account';
  $('authMessage').textContent='';
}

document.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>setAuthMode(b.dataset.auth)));
$('authForm').addEventListener('submit', async e=>{
  e.preventDefault();
  if(!configured){showAuthMessage('Add your Supabase URL and Publishable key in app.js first.',true);return;}
  const email=$('email').value.trim(), password=$('password').value;
  if(authMode==='login'){
    const {error}=await sb.auth.signInWithPassword({email,password});
    if(error) showAuthMessage(error.message,true); else showAuthMessage('Logged in.');
  }else{
    const full_name=$('fullName').value.trim() || email.split('@')[0];
    const role=$('role').value;
    const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name,role}}});
    if(error) showAuthMessage(error.message,true);
    else showAuthMessage(data.session?'Account created.':'Account created. Check your email if confirmation is enabled.');
  }
});
$('logoutBtn').addEventListener('click',()=>sb.auth.signOut());

document.querySelectorAll('.nav-item').forEach(b=>b.addEventListener('click',()=>{currentSection=b.dataset.section; renderSection();}));

async function loadProfile(){
  const {data:{user}}=await sb.auth.getUser();
  if(!user) return null;
  let {data,error}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error) console.warn(error);
  if(!data){
    const payload={id:user.id,full_name:user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',email:user.email,role:user.user_metadata?.role || 'student'};
    const ins=await sb.from('profiles').insert(payload).select().single();
    data=ins.data;
  }
  return data || {id:user.id,full_name:user.email, email:user.email, role:'student'};
}

async function boot(){
  const {data:{session}}=await sb.auth.getSession();
  if(session) await enterApp(); else showLogin();
  sb.auth.onAuthStateChange(async (_event,session)=>{ if(session) await enterApp(); else showLogin(); });
}
function showLogin(){ $('authView').classList.remove('hidden'); $('appView').classList.add('hidden'); }
async function enterApp(){
  currentProfile=await loadProfile();
  $('authView').classList.add('hidden'); $('appView').classList.remove('hidden');
  $('userName').textContent=currentProfile?.full_name || 'User'; $('userEmail').textContent=currentProfile?.email || '';
  $('userInitial').textContent=(currentProfile?.full_name||'U').charAt(0).toUpperCase();
  $('sideRole').textContent=roleName(currentProfile?.role);
  document.querySelectorAll('.professor-only').forEach(x=>x.classList.toggle('hidden',currentProfile?.role!=='professor'));
  document.querySelectorAll('.admin-only').forEach(x=>x.classList.toggle('hidden',currentProfile?.role!=='admin'));
  await renderSection();
}

async function renderSection(){
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.toggle('active',b.dataset.section===currentSection));
  const titles={dashboard:'Dashboard',timetable:'Timetable',classes:'Classes',classrooms:'Classrooms',subjects:'Subjects',notifications:'Notifications',absences:'My Absences',admin:'Admin'};
  $('pageTitle').textContent=titles[currentSection]||'Dashboard';
  if(currentSection==='dashboard') return dashboard();
  if(currentSection==='timetable') return timetable();
  if(currentSection==='classes') return classes();
  if(currentSection==='classrooms') return classrooms();
  if(currentSection==='subjects') return subjects();
  if(currentSection==='notifications') return notifications();
  if(currentSection==='absences') return absences();
  if(currentSection==='admin') return admin();
}

async function count(table){const {count,error}=await sb.from(table).select('*',{count:'exact',head:true});return error?0:(count||0);}
async function dashboard(){
  $('content').innerHTML='<div class="grid stats"><div class="card stat"><div class="label">Classes</div><div id="s1" class="value">…</div></div><div class="card stat"><div class="label">Classrooms</div><div id="s2" class="value">…</div></div><div class="card stat"><div class="label">Subjects</div><div id="s3" class="value">…</div></div><div class="card stat"><div class="label">Notifications</div><div id="s4" class="value">…</div></div></div><div class="section-head"><h3>Latest notifications</h3><button class="btn" onclick="currentSection='notifications';renderSection()">View all</button></div><div id="dashNotices" class="card">Loading…</div>';
  const [a,b,c,d]=await Promise.all([count('classes'),count('classrooms'),count('subjects'),count('notifications')]);
  ['s1','s2','s3','s4'].forEach((id,i)=>$(id).textContent=[a,b,c,d][i]);
  const {data}=await sb.from('notifications').select('*').order('created_at',{ascending:false}).limit(5);
  $('dashNotices').innerHTML=data?.length?data.map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.message)}</div><small class="muted">${fmt(n.created_at)}</small></div>`).join(''):'<div class="empty">No notifications yet.</div>';
}

async function timetable(){
  const {data,error}=await sb.from('timetable').select('*,classes(name,year,section),subjects(name,code),classrooms(name),profiles(full_name)').order('day').order('start_time');
  if(error){panelError(error.message);return}
  $('content').innerHTML=`<div class="card"><div class="section-head" style="margin-top:0"><div><h3>Weekly timetable</h3><div class="muted">All published timetable entries</div></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Day</th><th>Time</th><th>Subject</th><th>Class</th><th>Room</th><th>Professor</th></tr></thead><tbody>${data?.length?data.map(x=>`<tr><td><span class="pill">${esc(x.day)}</span></td><td>${esc(x.start_time)} - ${esc(x.end_time)}</td><td><b>${esc(x.subjects?.name)}</b><br><small class="muted">${esc(x.subjects?.code)}</small></td><td>${esc(x.classes?.name)} ${esc(x.classes?.section)}</td><td>${esc(x.classrooms?.name)}</td><td>${esc(x.profiles?.full_name)}</td></tr>`).join(''):'<tr><td colspan="6" class="empty">No timetable entries found.</td></tr>'}</tbody></table></div></div>`;
}
async function classes(){
  const {data,error}=await sb.from('classes').select('*,departments(name)').order('year').order('name'); if(error){panelError(error.message);return}
  $('content').innerHTML=`<div class="section-head"><h3>Classes</h3>${currentProfile.role==='admin'?'<button class="primary" onclick="openClassModal()">+ Add class</button>':''}</div><div class="card table-wrap"><table class="table"><thead><tr><th>Name</th><th>Department</th><th>Year</th><th>Section</th><th>Students</th></tr></thead><tbody>${data?.length?data.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.departments?.name)}</td><td>${esc(x.year)}</td><td>${esc(x.section)}</td><td>${esc(x.student_count??'-')}</td></tr>`).join(''):'<tr><td colspan="5" class="empty">No classes found.</td></tr>'}</tbody></table></div>`;
}
async function classrooms(){
  const {data,error}=await sb.from('classrooms').select('*').order('name');if(error){panelError(error.message);return}
  $('content').innerHTML=`<div class="section-head"><h3>Classrooms</h3>${currentProfile.role==='admin'?'<button class="primary" onclick="openRoomModal()">+ Add classroom</button>':''}</div><div class="card table-wrap"><table class="table"><thead><tr><th>Room</th><th>Building</th><th>Capacity</th><th>Type</th><th>Status</th></tr></thead><tbody>${data?.length?data.map(x=>`<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.building)}</td><td>${esc(x.capacity)}</td><td>${esc(x.room_type)}</td><td><span class="pill ${x.is_active?'green':'red'}">${x.is_active?'Active':'Inactive'}</span></td></tr>`).join(''):'<tr><td colspan="5" class="empty">No classrooms found.</td></tr>'}</tbody></table></div>`;
}
async function subjects(){
  const {data,error}=await sb.from('subjects').select('*,departments(name)').order('name');if(error){panelError(error.message);return}
  $('content').innerHTML=`<div class="section-head"><h3>Subjects</h3></div><div class="card table-wrap"><table class="table"><thead><tr><th>Code</th><th>Subject</th><th>Department</th><th>Credits</th></tr></thead><tbody>${data?.length?data.map(x=>`<tr><td><span class="pill">${esc(x.code)}</span></td><td><b>${esc(x.name)}</b></td><td>${esc(x.departments?.name)}</td><td>${esc(x.credits)}</td></tr>`).join(''):'<tr><td colspan="4" class="empty">No subjects found.</td></tr>'}</tbody></table></div>`;
}
async function notifications(){
  const {data,error}=await sb.from('notifications').select('*').order('created_at',{ascending:false});if(error){panelError(error.message);return}
  $('content').innerHTML=`<div class="section-head"><h3>Notifications</h3>${currentProfile.role==='admin'?'<button class="primary" onclick="openNotificationModal()">+ New notification</button>':''}</div><div class="grid">${data?.length?data.map(n=>`<div class="card"><div style="display:flex;justify-content:space-between;gap:10px"><b>${esc(n.title)}</b><small class="muted">${fmt(n.created_at)}</small></div><p>${esc(n.message)}</p>${n.target_role?`<span class="pill">${esc(n.target_role)}</span>`:''}</div>`).join(''):'<div class="card empty">No notifications yet.</div>'}</div>`;
}
async function absences(){
  if(currentProfile.role!=='professor'){panelError('This section is for professors.');return}
  const {data,error}=await sb.from('professor_absences').select('*').eq('professor_id',currentProfile.id).order('absence_date',{ascending:false});if(error){panelError(error.message);return}
  $('content').innerHTML=`<div class="section-head"><h3>My Absences</h3><button class="primary" onclick="openAbsenceModal()">+ Report absence</button></div><div class="card table-wrap"><table class="table"><thead><tr><th>Date</th><th>Reason</th><th>Status</th></tr></thead><tbody>${data?.length?data.map(x=>`<tr><td>${esc(x.absence_date)}</td><td>${esc(x.reason||'-')}</td><td><span class="pill ${x.status==='approved'?'green':''}">${esc(x.status)}</span></td></tr>`).join(''):'<tr><td colspan="3" class="empty">No absence records.</td></tr>'}</tbody></table></div>`;
}
async function admin(){
  if(currentProfile.role!=='admin'){panelError('Admin access required.');return}
  const [users,classesN,rooms,subjectsN]=await Promise.all([count('profiles'),count('classes'),count('classrooms'),count('subjects')]);
  $('content').innerHTML=`<div class="grid stats"><div class="card stat"><div class="label">Users</div><div class="value">${users}</div></div><div class="card stat"><div class="label">Classes</div><div class="value">${classesN}</div></div><div class="card stat"><div class="label">Classrooms</div><div class="value">${rooms}</div></div><div class="card stat"><div class="label">Subjects</div><div class="value">${subjectsN}</div></div></div><div class="section-head"><h3>Quick actions</h3></div><div class="grid two"><div class="card"><h3>Manage data</h3><p class="muted">Use the Supabase Table Editor to import your CSV files and manage timetable data.</p><div class="actions"><button class="btn" onclick="currentSection='classes';renderSection()">Classes</button><button class="btn" onclick="currentSection='classrooms';renderSection()">Classrooms</button><button class="btn" onclick="currentSection='subjects';renderSection()">Subjects</button></div></div><div class="card"><h3>Next step</h3><p class="muted">After importing data, add timetable rows in the <b>timetable</b> table and refresh this website.</p></div></div>`;
}
function panelError(msg){$('content').innerHTML=`<div class="card"><b>Could not load this section.</b><p class="muted">${esc(msg)}</p><p class="tiny">Check that you ran supabase-schema.sql and that the URL/key in app.js are correct.</p></div>`;}

function modal(title,body){const old=document.querySelector('.modal');if(old)old.remove();const d=document.createElement('div');d.className='modal';d.innerHTML=`<div class="modal-card"><div class="modal-head"><h3>${title}</h3><button class="close" onclick="this.closest('.modal').remove()">×</button></div>${body}</div>`;document.body.appendChild(d);return d;}
function openNotificationModal(){const m=modal('New notification',`<form id="modalForm"><label>Title<input name="title" required></label><label>Message<textarea name="message" required style="width:100%;min-height:110px;margin-top:7px;border:1px solid #dfe3ea;border-radius:10px;padding:12px"></textarea></label><label>Target role<select name="target_role"><option value="all">Everyone</option><option value="student">Students</option><option value="professor">Professors</option></select></label><button class="primary wide">Publish</button></form>`);m.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from('notifications').insert({title:f.get('title'),message:f.get('message'),target_role:f.get('target_role'),created_by:currentProfile.id});if(error)toast(error.message);else{m.remove();toast('Notification published');renderSection();}}}
function openAbsenceModal(){const m=modal('Report absence',`<form id="modalForm"><label>Date<input name="absence_date" type="date" required></label><label>Reason<input name="reason"></label><button class="primary wide">Submit</button></form>`);m.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from('professor_absences').insert({professor_id:currentProfile.id,absence_date:f.get('absence_date'),reason:f.get('reason'),status:'pending'});if(error)toast(error.message);else{m.remove();toast('Absence submitted');renderSection();}}}
function openRoomModal(){const m=modal('Add classroom',`<form id="modalForm"><div class="form-grid"><label>Name<input name="name" required></label><label>Building<input name="building"></label><label>Capacity<input name="capacity" type="number" min="1"></label><label>Type<input name="room_type" placeholder="Lecture / Lab"></label></div><button class="primary wide">Save</button></form>`);m.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from('classrooms').insert({name:f.get('name'),building:f.get('building'),capacity:Number(f.get('capacity')||0),room_type:f.get('room_type'),is_active:true});if(error)toast(error.message);else{m.remove();toast('Classroom added');renderSection();}}}
function openClassModal(){const m=modal('Add class',`<form id="modalForm"><div class="form-grid"><label>Name<input name="name" required></label><label>Year<input name="year" type="number" min="1" max="6"></label><label>Section<input name="section"></label><label>Students<input name="student_count" type="number" min="0"></label></div><button class="primary wide">Save</button></form>`);m.querySelector('form').onsubmit=async e=>{e.preventDefault();const f=new FormData(e.target);const {error}=await sb.from('classes').insert({name:f.get('name'),year:Number(f.get('year')||1),section:f.get('section'),student_count:Number(f.get('student_count')||0)});if(error)toast(error.message);else{m.remove();toast('Class added');renderSection();}}}

if(!configured) showAuthMessage('Setup required: edit app.js and add your Supabase URL + Publishable key.',true);
boot();
