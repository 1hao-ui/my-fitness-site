const STORAGE_KEYS = {
  logs: 'fitness_logs_v3',
  weekly: 'fitness_weekly_v2',
  templates: 'fitness_templates_v1'
};

const DAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const metricTypeLabels = {
  duration: '时长（分钟）',
  reps: '次数',
  sets_reps: '组数 × 次数',
  distance: '距离（公里）',
  weight: '重量（公斤）',
  custom: '自定义'
};

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
const logMetricType = document.getElementById('logMetricType');
const logsList = document.getElementById('logsList');
const logsEmpty = document.getElementById('logsEmpty');
const exportLogsBtn = document.getElementById('exportLogs');
const importLogsBtn = document.getElementById('importLogs');
const importLogsFile = document.getElementById('importLogsFile');
const clearLogsBtn = document.getElementById('clearLogs');
const addQuickLogBtn = document.getElementById('addQuickLog');
const metricFieldsWrap = document.getElementById('metricFields');

const statsSummary = document.getElementById('statsSummary');
const templateNameInput = document.getElementById('templateName');
const templateMetricType = document.getElementById('templateMetricType');
const addTemplateBtn = document.getElementById('addTemplate');
const templateList = document.getElementById('templateList');

const itemModal = document.getElementById('itemModal');
const itemForm = document.getElementById('itemForm');
const itemName = document.getElementById('itemName');
const itemMetricType = document.getElementById('itemMetricType');
const itemNotes = document.getElementById('itemNotes');
const selectedDayIndex = document.getElementById('selectedDayIndex');

let weeklyPlans = loadStored(STORAGE_KEYS.weekly, {});
let logs = loadStored(STORAGE_KEYS.logs, []);
let templates = loadStored(STORAGE_KEYS.templates, [
  { id: 'run', name: '跑步', metricType: 'distance' },
  { id: 'bench', name: '卧推', metricType: 'sets_reps' },
  { id: 'squat', name: '深蹲', metricType: 'sets_reps' },
  { id: 'cycling', name: '骑行', metricType: 'duration' },
  { id: 'pushup', name: '俯卧撑', metricType: 'reps' }
]);

init();

function init() {
  const today = new Date();
  weekPicker.value = dateToWeekInput(today);
  logDate.value = toISODate(today);
  renderWeek();
  renderLogs();
  renderStats();
  renderTemplates();
  bindTabs();
  bindMetricType();
  bindEvents();
  bindItemModal();
}

function bindTabs() {
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('panel-' + tab).classList.add('active');
    });
  });
}

function bindMetricType() {
  logMetricType.addEventListener('change', () => showMetricFields(logMetricType.value));
  showMetricFields(logMetricType.value);

  itemMetricType.addEventListener('change', () => showItemMetricFields(itemMetricType.value));
  showItemMetricFields(itemMetricType.value);
}

function bindEvents() {
  saveWeekBtn.addEventListener('click', () => {
    saveCurrentWeek();
    alert('已保存本周计划');
  });

  applyWeekBtn.addEventListener('click', () => {
    const count = applyWeekToLogs();
    saveLogs();
    renderLogs();
    renderStats();
    alert('已将本周计划应用为 ' + count + ' 条记录');
  });

  clearWeekBtn.addEventListener('click', () => {
    if (!confirm('确认清空当前周计划？')) return;
    const key = weekPicker.value;
    delete weeklyPlans[key];
    saveWeekly();
    renderWeek();
  });

  exportWeekBtn.addEventListener('click', () => {
    const key = weekPicker.value;
    const payload = weeklyPlans[key] || { week: key, days: {} };
    downloadJSON(payload, `weekly-plan-${key}.json`);
  });

  importWeekBtn.addEventListener('click', () => importWeekFile.click());
  importWeekFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const key = data.week || weekPicker.value;
      weeklyPlans[key] = { week: key, days: data.days || {} };
      saveWeekly();
      weekPicker.value = key;
      renderWeek();
      alert('导入成功');
    } catch {
      alert('导入失败：请上传正确的 JSON 计划文件');
    }
  });

  logForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const metricType = logMetricType.value;
    if (!logActivity.value.trim()) {
      alert('请输入项目名称');
      return;
    }

    const payload = buildMetricPayload(metricType, null, 'log');
    if (!payload.valid) {
      alert('请补全对应计量信息');
      return;
    }

    logs.push({
      id: createId(),
      date: logDate.value,
      activity: logActivity.value.trim(),
      metricType,
      metricValue: payload.value,
      notes: document.getElementById('logNotes').value.trim()
    });

    saveLogs();
    renderLogs();
    renderStats();
    logForm.reset();
    logDate.value = toISODate(new Date());
    logMetricType.value = 'duration';
    showMetricFields('duration');
  });

  exportLogsBtn.addEventListener('click', () => downloadJSON(logs, 'fitness-logs.json'));
  importLogsBtn.addEventListener('click', () => importLogsFile.click());
  importLogsFile.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error();
      logs = parsed.map(normalizeLegacyLog);
      saveLogs();
      renderLogs();
      renderStats();
      alert('导入成功');
    } catch {
      alert('导入失败：请上传导出的训练记录 JSON');
    }
  });

  clearLogsBtn.addEventListener('click', () => {
    if (!confirm('确定清空全部记录？')) return;
    logs = [];
    saveLogs();
    renderLogs();
    renderStats();
  });

  addQuickLogBtn.addEventListener('click', () => {
    document.querySelector('.nav-item[data-tab="log"]').click();
    logActivity.focus();
  });

  addTemplateBtn.addEventListener('click', () => {
    const name = templateNameInput.value.trim();
    if (!name) {
      alert('请填写模板名称');
      return;
    }
    templates.push({ id: createId(), name, metricType: templateMetricType.value });
    saveTemplates();
    renderTemplates();
    templateNameInput.value = '';
  });

  weekPicker.addEventListener('change', renderWeek);
}

function bindItemModal() {
  document.querySelectorAll('[data-close="true"]').forEach(el => {
    el.addEventListener('click', closeItemModal);
  });

  itemForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const dayIndex = Number(selectedDayIndex.value);
    const activeName = itemName.value.trim();
    if (!activeName) {
      alert('请输入项目名称');
      return;
    }
    const metricType = itemMetricType.value;
    const payload = buildMetricPayload(metricType, null, 'item');
    if (!payload.valid) {
      alert('请补全对应计量信息');
      return;
    }

    const key = weekPicker.value;
    const weekData = weeklyPlans[key] || { week: key, days: {} };
    weekData.days[dayIndex] = weekData.days[dayIndex] || [];
    weekData.days[dayIndex].push({
      id: createId(),
      activity: activeName,
      metricType,
      metricValue: payload.value,
      notes: itemNotes.value.trim(),
    });

    weeklyPlans[key] = weekData;
    saveWeekly();
    closeItemModal();
    renderWeek();
  });
}

function saveCurrentWeek() {
  const key = weekPicker.value;
  weeklyPlans[key] = weeklyPlans[key] || { week: key, days: {} };
  saveWeekly();
}

function renderWeek() {
  const key = weekPicker.value;
  const source = weeklyPlans[key] || { week: key, days: {} };
  weekDaysEl.innerHTML = '';

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const items = source.days[dayIndex] || [];
    const dayCard = document.createElement('div');
    dayCard.className = 'day-card';

    const title = document.createElement('h3');
    title.textContent = DAY_LABELS[dayIndex];
    dayCard.appendChild(title);

    const list = document.createElement('div');
    list.className = 'plan-list';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'meta';
      empty.textContent = '暂无计划';
      empty.style.color = '#94a3b8';
      list.appendChild(empty);
    } else {
      items.forEach(item => {
        const row = document.createElement('div');
        row.className = 'plan-pill';
        row.innerHTML = `
          <div>
            <strong>${escapeHtml(item.activity)}</strong>
            <div class="meta">${formatMetric(item.metricType, item.metricValue)}${item.notes ? ' · ' + escapeHtml(item.notes) : ''}</div>
          </div>
          <button class="action-mini" data-day="${dayIndex}" data-id="${item.id}">删</button>
        `;
        list.appendChild(row);
      });
    }

    const addBtn = document.createElement('button');
    addBtn.className = 'ghost small';
    addBtn.textContent = '+ 添加';
    addBtn.addEventListener('click', () => openItemModal(dayIndex));
    dayCard.appendChild(list);
    dayCard.appendChild(addBtn);

    const deleteButtons = dayCard.querySelectorAll('.action-mini');
    deleteButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetDay = Number(btn.dataset.day);
        const targetId = btn.dataset.id;
        const weekData = weeklyPlans[key] || { week: key, days: {} };
        weekData.days[targetDay] = (weekData.days[targetDay] || []).filter(x => x.id !== targetId);
        weeklyPlans[key] = weekData;
        saveWeekly();
        renderWeek();
      });
    });

    weekDaysEl.appendChild(dayCard);
  }
}

function openItemModal(dayIndex) {
  selectedDayIndex.value = String(dayIndex);
  itemForm.reset();
  itemMetricType.value = 'duration';
  showItemMetricFields('duration');
  itemModal.classList.remove('hidden');
  itemModal.setAttribute('aria-hidden', 'false');
}

function closeItemModal() {
  itemModal.classList.add('hidden');
  itemModal.setAttribute('aria-hidden', 'true');
  itemForm.reset();
}

function showItemMetricFields(type) {
  const allRaw = document.querySelectorAll('.item-metric');
  allRaw.forEach(el => el.classList.remove('active'));

  const setReps = document.querySelector('.item-metric.sets_reps');
  if (type === 'sets_reps') {
    setReps.classList.add('active');
    return;
  }

  const target = document.querySelector(`.item-metric.${type}`);
  if (target) target.classList.add('active');
}

function applyWeekToLogs() {
  const key = weekPicker.value;
  const data = weeklyPlans[key];
  if (!data || !data.days) return 0;

  const monday = weekInputToMonday(key);
  let count = 0;

  for (let dayIndex = 0; dayIndex < 7; dayIndex++) {
    const items = data.days[dayIndex] || [];
    for (const item of items) {
      const currentDate = addDays(monday, dayIndex);
      logs.push({
        id: createId(),
        date: toISODate(currentDate),
        activity: item.activity,
        metricType: item.metricType || 'duration',
        metricValue: item.metricValue || { value: item.duration || 30 },
        notes: item.notes || ''
      });
      count += 1;
    }
  }

  return count;
}

function renderLogs() {
  logsList.innerHTML = '';
  if (!logs.length) {
    logsEmpty.style.display = 'block';
    return;
  }
  logsEmpty.style.display = 'none';

  const sorted = [...logs].sort((a, b) => b.date.localeCompare(a.date));
  sorted.forEach(log => {
    const row = document.createElement('div');
    row.className = 'log-item';
    row.innerHTML = `
      <div>
        <strong>${escapeHtml(log.activity)}</strong>
        <div class="log-meta">${log.date} · ${formatMetric(log.metricType, normalizeMetricValue(log.metricType, log.metricValue))}</div>
      </div>
      <button class="action-mini" data-id="${log.id}">删</button>
    `;
    row.querySelector('.action-mini').addEventListener('click', () => {
      logs = logs.filter(x => x.id !== log.id);
      saveLogs();
      renderLogs();
      renderStats();
    });
    logsList.appendChild(row);
  });
}

function renderStats() {
  const stats = {
    totalSessions: logs.length,
    totalMinutes: logs.reduce((sum, item) => sum + parseMetricMinutes(item), 0),
    lastDate: logs.length ? [...logs].sort((a, b) => b.date.localeCompare(a.date))[0].date : '—',
    favorite: summarizeFavorite(logs)
  };

  statsSummary.innerHTML = `
    <div class="stat-box"><span>本月记录</span><strong>${stats.totalSessions}</strong></div>
    <div class="stat-box"><span>总时长</span><strong>${stats.totalMinutes} 分</strong></div>
    <div class="stat-box"><span>最近一次</span><strong>${stats.lastDate}</strong></div>
    <div class="stat-box"><span>最常做</span><strong>${stats.favorite}</strong></div>
  `;
}

function renderTemplates() {
  templateList.innerHTML = '';
  templates.forEach(temp => {
    const item = document.createElement('div');
    item.className = 'template-item';
    item.innerHTML = `
      <span>${escapeHtml(temp.name)}</span>
      <small>${metricTypeLabels[temp.metricType] || temp.metricType}</small>
    `;
    item.addEventListener('click', () => {
      logActivity.value = temp.name;
      logMetricType.value = temp.metricType;
      showMetricFields(temp.metricType);
      document.querySelector('.nav-item[data-tab="log"]').click();
    });
    templateList.appendChild(item);
  });
}

function showMetricFields(type) {
  const fieldNodes = metricFieldsWrap.querySelectorAll('.metric-field, .sets_reps');
  fieldNodes.forEach(node => node.classList.remove('active'));

  if (type === 'duration') {
    document.querySelector('.metric-field.duration').classList.add('active');
  } else if (type === 'reps') {
    document.querySelector('.metric-field.reps').classList.add('active');
  } else if (type === 'sets_reps') {
    document.querySelector('.sets_reps').classList.add('active');
  } else if (type === 'distance') {
    document.querySelector('.metric-field.distance').classList.add('active');
  } else if (type === 'weight') {
    document.querySelector('.metric-field.weight').classList.add('active');
  } else if (type === 'custom') {
    document.querySelector('.metric-field.custom').classList.add('active');
  }
}

function buildMetricPayload(type, fromPrompt = null, source = 'log') {
  const logDuration = Number(document.getElementById('logDuration').value || 0);
  const logReps = Number(document.getElementById('logReps').value || 0);
  const logSets = Number(document.getElementById('logSets').value || 0);
  const logRepsPerSet = Number(document.getElementById('logRepsPerSet').value || 0);
  const logDistance = Number(document.getElementById('logDistance').value || 0);
  const logWeight = Number(document.getElementById('logWeight').value || 0);
  const logCustom = document.getElementById('logCustomMetric').value || '';

  const itemDuration = Number(document.getElementById('itemDuration').value || 0);
  const itemReps = Number(document.getElementById('itemReps').value || 0);
  const itemSets = Number(document.getElementById('itemSets').value || 0);
  const itemRepsPerSet = Number(document.getElementById('itemRepsPerSet').value || 0);
  const itemDistance = Number(document.getElementById('itemDistance').value || 0);
  const itemWeight = Number(document.getElementById('itemWeight').value || 0);
  const itemCustom = document.getElementById('itemCustom').value || '';

  const valueMap = {
    duration: source === 'item' ? itemDuration : logDuration,
    reps: source === 'item' ? itemReps : logReps,
    sets_reps: {
      sets: source === 'item' ? itemSets : logSets,
      reps: source === 'item' ? itemRepsPerSet : logRepsPerSet,
    },
    distance: source === 'item' ? itemDistance : logDistance,
    weight: source === 'item' ? itemWeight : logWeight,
    custom: source === 'item' ? itemCustom : logCustom,
  };

  const val = valueMap[type];

  if (type === 'sets_reps') {
    const valid = Number.isFinite(val.sets) && Number.isFinite(val.reps) && val.sets > 0 && val.reps > 0;
    return { valid, value: valid ? val : null };
  }

  if (type === 'custom') {
    const valid = typeof val === 'string' && val.trim().length > 0;
    return { valid, value: valid ? val.trim() : null };
  }

  const valid = Number.isFinite(val) && Number(val) > 0;
  return { valid, value: valid ? Number(val) : null };
}

function normalizeLegacyLog(item) {
  if (item.metricType) {
    return {
      id: item.id || createId(),
      date: item.date || toISODate(new Date()),
      activity: item.activity || '训练',
      metricType: item.metricType,
      metricValue: normalizeMetricValue(item.metricType, item.metricValue),
      notes: item.notes || ''
    };
  }

  return {
    id: item.id || createId(),
    date: item.date || toISODate(new Date()),
    activity: item.activity || '训练',
    metricType: 'duration',
    metricValue: { value: Number(item.duration || item.minutes || 30) },
    notes: item.notes || ''
  };
}

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLogs() {
  localStorage.setItem(STORAGE_KEYS.logs, JSON.stringify(logs));
}

function saveWeekly() {
  localStorage.setItem(STORAGE_KEYS.weekly, JSON.stringify(weeklyPlans));
}

function saveTemplates() {
  localStorage.setItem(STORAGE_KEYS.templates, JSON.stringify(templates));
}

function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(href);
}

function parseMetricMinutes(item) {
  const type = item.metricType || 'duration';
  const value = normalizeMetricValue(type, item.metricValue);

  if (type === 'duration') return Number(value.value || 0);
  if (type === 'reps') return Math.max(0, Number(value.value || 0) / 20);
  if (type === 'sets_reps') return Math.max(0, Number(value.sets || 0) * Number(value.reps || 0) / 20);
  if (type === 'distance') return Math.max(0, Number(value.value || 0) * 10);
  if (type === 'weight') return Math.max(0, Number(value.value || 0) / 5);
  return 0;
}

function summarizeFavorite(logs) {
  if (!logs.length) return '暂无';
  const map = {};
  logs.forEach(log => {
    map[log.activity] = (map[log.activity] || 0) + 1;
  });
  const best = Object.entries(map).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : '暂无';
}

function formatMetric(type, value) {
  if (type === 'duration') return `${value.value || 0} 分钟`;
  if (type === 'reps') return `${value.value || 0} 次`;
  if (type === 'sets_reps') return `${value.sets || 0} × ${value.reps || 0} 次`;
  if (type === 'distance') return `${value.value || 0} 公里`;
  if (type === 'weight') return `${value.value || 0} 公斤`;
  if (type === 'custom') return value.value || '自定义';
  return `${value.value || 0}`;
}

function normalizeMetricValue(type, value) {
  if (!value) {
    return { value: 0 };
  }
  if (type === 'sets_reps') {
    if (typeof value === 'string') {
      const [sets, reps] = value.split('x').map(n => Number(n.trim()));
      return { sets: Number(sets || 0), reps: Number(reps || 0) };
    }
    return { sets: Number(value.sets || 0), reps: Number(value.reps || 0) };
  }
  if (type === 'custom') {
    return { value: String(value) };
  }
  return { value: Number(value.value ?? value ?? 0) };
}

function toISODate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateToWeekInput(date) {
  const tmp = new Date(date);
  const day = (tmp.getDay() + 6) % 7;
  tmp.setDate(tmp.getDate() - day + 3);
  const jan4 = new Date(tmp.getFullYear(), 0, 4);
  const week = 1 + Math.round((tmp - jan4) / 86400000 / 7);
  return `${tmp.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function weekInputToMonday(weekInput) {
  const [year, weekStr] = weekInput.split('-W');
  const targetWeek = Number(weekStr);
  const jan4 = new Date(Number(year), 0, 4);
  const jan4Day = (jan4.getDay() + 6) % 7;
  const mondayOfWeek1 = new Date(jan4); mondayOfWeek1.setDate(jan4.getDate() - jan4Day);
  const monday = new Date(mondayOfWeek1);
  monday.setDate(mondayOfWeek1.getDate() + (targetWeek - 1) * 7);
  return monday;
}

function addDays(date, offset) {
  const d = new Date(date); d.setDate(d.getDate() + offset); return d;
}

(function backfill() {
  logs = logs.map(normalizeLegacyLog);
  saveLogs();
})();
