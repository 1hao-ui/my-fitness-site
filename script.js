/* 更强的本地化周计划 + 训练记录逻辑 */
const LOG_KEY = 'my_fitness_logs_v2';
const WEEK_KEY = 'my_fitness_weekly_v1';

const weekPicker = document.getElementById('weekPicker');
const weekDaysEl = document.getElementById('weekDays');
const saveWeekBtn = document.getElementById('saveWeek');
const applyWeekBtn = document.getElementById('applyWeek');
const clearWeekBtn = document.getElementById('clearWeek');
const exportWeekBtn = document.getElementById('exportWeek');
const importWeekBtn = document.getElementById('importWeek');
const importWeekFile = document.getElementById('importWeekFile');

const logForm = document.getElementById('logForm');
const logDate = document.getElementById('logDate');
const logActivity = document.getElementById('logActivity');
const logDuration = document.getElementById('logDuration');
const logNotes = document.getElementById('logNotes');
const logsList = document.getElementById('logsList');
const logsEmpty = document.getElementById('logsEmpty');
const exportLogsBtn = document.getElementById('exportLogs');
const importLogsBtn = document.getElementById('importLogs');
const importLogsFile = document.getElementById('importLogsFile');
const clearLogsBtn = document.getElementById('clearLogs');

const DAY_LABELS = ['周一','周二','周三','周四','周五','周六','周日'];

let weeklyPlans = loadWeekly();
let logs = loadLogs();

// 初始化 week 输入为当前周
(function initWeekPicker(){
  const today = new Date();
  const w = dateToWeekInput(today);
  weekPicker.value = w;
  renderWeek();
  renderLogs();
})();

// 事件绑定
saveWeekBtn.addEventListener('click', ()=>{
  saveCurrentWeekFromUI();
  alert('已保存本周计划');
});

applyWeekBtn.addEventListener('click', ()=>{
  const cnt = applyWeekToLogs();
  saveLogs();
  renderLogs();
  alert('已将计划应用为 ' + cnt + ' 条训练记录');
});

clearWeekBtn.addEventListener('click', ()=>{
  if (!confirm('清空本周计划？')) return;
  const key = weekPicker.value;
  delete weeklyPlans[key];
  saveWeekly();
  renderWeek();
});

exportWeekBtn.addEventListener('click', ()=>{
  const key = weekPicker.value;
  const data = weeklyPlans[key] || {week:key, days:{}};
  downloadJSON(data, `weekly-plan-${key}.json`);
});

importWeekBtn.addEventListener('click', ()=> importWeekFile.click());
importWeekFile.addEventListener('change', async (e)=>{
  const f = e.target.files[0];
  if (!f) return;
  const txt = await f.text();
  try{
    const obj = JSON.parse(txt);
    if (!obj.week) obj.week = weekPicker.value;
    weeklyPlans[obj.week] = obj;
    saveWeekly();
    weekPicker.value = obj.week;
    renderWeek();
    alert('导入成功');
  }catch(err){ alert('导入失败：文件不是合法 JSON'); }
});

logForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const entry = {
    id: Date.now().toString(),
    date: logDate.value,
    activity: logActivity.value.trim(),
    duration: Number(logDuration.value),
    notes: logNotes.value.trim()
  };
  logs.push(entry);
  saveLogs();
  logForm.reset();
  renderLogs();
});

exportLogsBtn.addEventListener('click', ()=> downloadJSON(logs, 'fitness-logs.json'));
importLogsBtn.addEventListener('click', ()=> importLogsFile.click());
importLogsFile.addEventListener('change', async (e)=>{
  const f = e.target.files[0]; if (!f) return;
  const txt = await f.text();
  try{
    const arr = JSON.parse(txt);
    if (!Array.isArray(arr)) throw new Error('not array');
    logs = logs.concat(arr.map(a=>({ ...a, id: a.id || Date.now().toString() + Math.random() }))); 
    saveLogs(); renderLogs(); alert('导入成功');
  }catch(err){ alert('导入失败：请上传导出的 JSON 数组文件'); }
});

clearLogsBtn.addEventListener('click', ()=>{
  if (!confirm('清空所有训练记录？此操作不可撤销')) return;
  logs = [];
  saveLogs();
  renderLogs();
});

weekPicker.addEventListener('change', renderWeek);

// 渲染周计划 UI
function renderWeek(){
  const key = weekPicker.value;
  const plan = weeklyPlans[key] ? (weeklyPlans[key].days || {}) : {};
  weekDaysEl.innerHTML = '';
  for (let i=0;i<7;i++){
    const d = document.createElement('div'); d.className='day';
    const dowLabel = DAY_LABELS[i];
    d.innerHTML = `<h3>${dowLabel}</h3>`;
    const list = document.createElement('div'); list.className='plan-list';
    const items = plan[i] || [];
    for (const it of items){
      const item = document.createElement('div'); item.className='plan-item';
      item.innerHTML = `<div class="meta"><div class="title">${escapeHtml(it.activity)}</div><div class="small">${it.duration} 分钟 ${it.notes? '· '+escapeHtml(it.notes): ''}</div></div><div><button class=btn-ghost data-day="${i}" data-id="${it.id}" data-act="del">删除</button></div>`;
      list.appendChild(item);
    }
    // add button
    const addBtn = document.createElement('button'); addBtn.className='btn-ghost'; addBtn.textContent='添加计划';
    addBtn.addEventListener('click', ()=> openAddPlanDialog(i));
    d.appendChild(list);
    d.appendChild(addBtn);
    weekDaysEl.appendChild(d);
  }
  // delegate delete
  weekDaysEl.querySelectorAll('button[data-act="del"]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const day = b.getAttribute('data-day');
      const id = b.getAttribute('data-id');
      const key = weekPicker.value; const p = weeklyPlans[key] || {week:key, days:{}};
      p.days[day] = (p.days[day]||[]).filter(x=>x.id !== id);
      weeklyPlans[key] = p; saveWeekly(); renderWeek();
    });
  });
}

function openAddPlanDialog(day){
  const activity = prompt('项目（例如：跑步/力量/瑜伽）');
  if (!activity) return;
  const duration = prompt('时长（分钟）', '30');
  if (!duration) return;
  const notes = prompt('备注（可选）', '');
  const key = weekPicker.value;
  const p = weeklyPlans[key] || {week:key, days:{}};
  p.days[day] = p.days[day] || [];
  p.days[day].push({ id: Date.now().toString() + Math.random(), activity: activity.trim(), duration: Number(duration), notes: (notes||'').trim() });
  weeklyPlans[key] = p; saveWeekly(); renderWeek();
}

function saveCurrentWeekFromUI(){
  // UI changes already persisted on add/delete; ensure structure exists
  const key = weekPicker.value;
  weeklyPlans[key] = weeklyPlans[key] || {week:key, days:{}};
  saveWeekly();
}

// 将周计划应用为训练记录（生成具体日期）
function applyWeekToLogs(){
  const key = weekPicker.value;
  const p = weeklyPlans[key];
  if (!p || !p.days) return 0;
  const monday = weekInputToMonday(key);
  let count = 0;
  for (let i=0;i<7;i++){
    const items = p.days[i]||[];
    for (const it of items){
      const date = addDays(monday, i);
      logs.push({ id: Date.now().toString()+Math.random(), date: formatDate(date), activity: it.activity, duration: it.duration, notes: it.notes });
      count++;
    }
  }
  return count;
}

// 日志渲染
function renderLogs(){
  logsList.innerHTML = '';
  if (!logs || logs.length===0){ logsEmpty.style.display='block'; return; }
  logsEmpty.style.display='none';
  const sorted = logs.slice().sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  for (const l of sorted){
    const el = document.createElement('div'); el.className='log-item';
    el.innerHTML = `<div class="log-left"><div class="title">${escapeHtml(l.activity)}</div><div class="small">${l.date} · ${l.duration} 分钟 ${l.notes? '· '+escapeHtml(l.notes):''}</div></div><div><button class=btn-ghost data-id="${l.id}" data-act="del">删除</button></div>`;
    logsList.appendChild(el);
  }
  logsList.querySelectorAll('button[data-act="del"]').forEach(b=> b.addEventListener('click', ()=>{
    const id = b.getAttribute('data-id'); logs = logs.filter(x=>x.id !== id); saveLogs(); renderLogs();
  }));
}

// storage helpers
function loadWeekly(){
  try{ const raw = localStorage.getItem(WEEK_KEY); return raw ? JSON.parse(raw) : {}; }catch(e){ console.error(e); return {}; }
}
function saveWeekly(){ localStorage.setItem(WEEK_KEY, JSON.stringify(weeklyPlans)); }
function loadLogs(){ try{ const raw = localStorage.getItem(LOG_KEY); return raw ? JSON.parse(raw) : []; }catch(e){ console.error(e); return []; } }
function saveLogs(){ localStorage.setItem(LOG_KEY, JSON.stringify(logs)); }

// utils
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }
function downloadJSON(obj, filename){ const blob = new Blob([JSON.stringify(obj,null,2)], {type:'application/json'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }

// date helpers
function dateToWeekInput(d){
  // returns YYYY-Www
  const tmp = new Date(d.getTime());
  // get ISO week number
  const dayNum = (d.getUTCDay() + 6) % 7; // Monday=0
  tmp.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(),0,4));
  const weekNo = Math.floor(1 + ( (tmp - firstThursday) / 86400000 + 3)/7);
  const year = tmp.getUTCFullYear();
  const w = String(weekNo).padStart(2,'0');
  return `${year}-W${w}`;
}

function weekInputToMonday(weekInput){
  // weekInput like 2026-W41
  const [y, w] = weekInput.split('-W');
  const year = Number(y); const week = Number(w);
  // ISO week: week 1 is week with Jan 4th
  const jan4 = new Date(Date.UTC(year,0,4));
  const dayOfJan4 = (jan4.getUTCDay()+6)%7; // Mon=0
  const monday1 = new Date(Date.UTC(year,0,4 - dayOfJan4));
  const monday = addDays(monday1, (week-1)*7);
  // convert to local Date (no timezone shifting for formatting)
  return new Date(monday.getFullYear(), monday.getMonth(), monday.getDate());
}

function addDays(d, n){ const r = new Date(d); r.setDate(r.getDate()+n); return r; }
function formatDate(d){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,'0'); const dd=String(d.getDate()).padStart(2,'0'); return `${y}-${m}-${dd}`; }

function downloadText(filename, text){ const blob = new Blob([text],{type:'text/plain'}); const url = URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url); }

