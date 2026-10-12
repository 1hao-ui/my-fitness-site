// 简单的 localStorage 存储与渲染逻辑
const STORAGE_KEY = 'my_fitness_plans_v1';

const form = document.getElementById('planForm');
const dateIn = document.getElementById('date');
const activityIn = document.getElementById('activity');
const durationIn = document.getElementById('duration');
const notesIn = document.getElementById('notes');
const plansList = document.getElementById('plansList');
const empty = document.getElementById('empty');
const clearAllBtn = document.getElementById('clearAll');

let plans = loadPlans();
render();

form.addEventListener('submit', e => {
  e.preventDefault();
  const plan = {
    id: Date.now().toString(),
    date: dateIn.value,
    activity: activityIn.value.trim(),
    duration: Number(durationIn.value),
    notes: notesIn.value.trim()
  };
  plans.push(plan);
  savePlans();
  form.reset();
  render();
});

clearAllBtn.addEventListener('click', () => {
  if (!confirm('确定要清空所有记录吗？此操作不可撤销。')) return;
  plans = [];
  savePlans();
  render();
});

function loadPlans(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  }catch(e){
    console.error(e);
    return [];
  }
}

function savePlans(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
}

function render(){
  plansList.innerHTML = '';
  if (plans.length === 0){
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const sorted = plans.slice().sort((a,b)=> b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  for (const p of sorted){
    const el = document.createElement('div');
    el.className = 'plan';
    el.innerHTML = `
      <div class="meta">
        <div>
          <div class="title">${escapeHtml(p.activity)}</div>
          <div class="small">${p.date} · ${p.duration} 分钟</div>
        </div>
        ${p.notes ? `<div class="small" style="margin-left:12px">备注：${escapeHtml(p.notes)}</div>` : ''}
      </div>
      <div class="controls">
        <button class="btn-small" data-id="${p.id}" data-act="edit">编辑</button>
        <button class="btn-small" data-id="${p.id}" data-act="delete">删除</button>
      </div>
    `;
    plansList.appendChild(el);
  }
  plansList.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = btn.getAttribute('data-id');
      const act = btn.getAttribute('data-act');
      if (act === 'delete') {
        if (!confirm('删除该条记录？')) return;
        plans = plans.filter(x=>x.id !== id);
        savePlans();
        render();
      } else if (act === 'edit') {
        const p = plans.find(x=>x.id===id);
        if (!p) return;
        dateIn.value = p.date;
        activityIn.value = p.activity;
        durationIn.value = p.duration;
        notesIn.value = p.notes;
        plans = plans.filter(x=>x.id !== id);
        savePlans();
        render();
      }
    });
  });
}

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
