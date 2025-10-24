
// script.js
const STORAGE_KEY = 'email_reminders_v1';
const CHECK_INTERVAL = 15000;

let reminders = [];
let scheduler = null;
let editingId = null;
let nextCheckAt = null;
let schedulerRunning = true;

// === ELEMENT REFERENCES ===
const recipientEl = document.getElementById('recipient');
const subjectEl = document.getElementById('subject');
const messageEl = document.getElementById('message');
const whenEl = document.getElementById('when');
const repeatEl = document.getElementById('repeat');
const priorityEl = document.getElementById('priority');
const saveBtn = document.getElementById('saveBtn');
const testBtn = document.getElementById('testBtn');
const clearBtn = document.getElementById('clearBtn');
const listEl = document.getElementById('list');
const statusEl = document.getElementById('status');
const schedulerStateEl = document.getElementById('schedulerState');
const nextCheckEl = document.getElementById('nextCheck');
const intervalLabelEl = document.getElementById('intervalLabel');
const toggleSchedBtn = document.getElementById('toggleSched');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const importFileEl = document.getElementById('importFile');
const clearAllBtn = document.getElementById('clearAllBtn');
const searchEl = document.getElementById('search');
const filterEl = document.getElementById('filter');

// === INITIAL SETUP ===
intervalLabelEl.textContent = (CHECK_INTERVAL / 1000) + 's';

// === UTILITIES ===
function uid(len = 10) {
  return Math.random().toString(36).slice(2, 2 + len);
}
function nowISO() { return new Date().toISOString(); }
function fmtDatetimeLocal(date) {
  const dt = new Date(date);
  const pad = n => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
}
function formatReadable(date) {
  const dt = new Date(date);
  return dt.toLocaleString();
}

// === LOCAL STORAGE ===
function loadReminders() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    reminders = raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to load reminders', e);
    reminders = [];
  }
}
function saveReminders() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reminders));
}

// === FORM HANDLING ===
function buildReminderFromForm() {
  const recipient = recipientEl.value.trim();
  const subject = subjectEl.value.trim();
  const message = messageEl.value.trim();
  const when = whenEl.value;
  const repeat = repeatEl.value;
  const priority = priorityEl.value;

  if (!recipient || !subject || !message || !when) {
    alert('Please fill recipient, subject, message and date/time.');
    return null;
  }

  const ts = new Date(when).toISOString();
  if (isNaN(Date.parse(ts))) {
    alert('Invalid date/time.');
    return null;
  }

  return {
    id: editingId || uid(12),
    recipient, subject, message, when: ts,
    repeat, priority,
    createdAt: editingId ? (reminders.find(r => r.id === editingId)?.createdAt || nowISO()) : nowISO(),
    lastSentAt: null,
    sentCount: 0,
    active: true
  };
}

function resetForm() {
  recipientEl.value = '';
  subjectEl.value = '';
  messageEl.value = '';
  whenEl.value = '';
  repeatEl.value = 'none';
  priorityEl.value = 'normal';
  editingId = null;
  saveBtn.textContent = 'Save Reminder';
}

function loadToForm(id) {
  const r = reminders.find(x => x.id === id);
  if (!r) return;
  recipientEl.value = r.recipient;
  subjectEl.value = r.subject;
  messageEl.value = r.message;
  whenEl.value = fmtDatetimeLocal(r.when);
  repeatEl.value = r.repeat || 'none';
  priorityEl.value = r.priority || 'normal';
  editingId = r.id;
  saveBtn.textContent = 'Update Reminder';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// === CRUD OPERATIONS ===
function addOrUpdateReminder() {
  const r = buildReminderFromForm();
  if (!r) return;
  if (editingId) {
    const idx = reminders.findIndex(x => x.id === editingId);
    if (idx >= 0) reminders[idx] = { ...reminders[idx], ...r };
    editingId = null;
  } else {
    reminders.push(r);
  }
  saveReminders();
  resetForm();
  renderList();
  setStatus('Saved');
}

function deleteReminder(id) {
  if (!confirm('Delete this reminder?')) return;
  reminders = reminders.filter(x => x.id !== id);
  saveReminders();
  renderList();
  setStatus('Deleted');
}

// === EMAIL LOGIC ===
function sendMail(r) {
  const params = new URLSearchParams();
  if (r.subject) params.set('subject', r.subject);
  if (r.message) params.set('body', r.message + "\n\n(Automated reminder)");
  const mailto = `mailto:${encodeURIComponent(r.recipient)}?${params.toString()}`;
  window.open(mailto, '_blank');
}

// === SCHEDULER + NOTIFICATIONS ===
function computeNextOccurrence(isoWhen, repeat) {
  const dt = new Date(isoWhen);
  if (isNaN(dt)) return null;
  const next = new Date(dt);
  if (repeat === 'daily') next.setDate(next.getDate() + 1);
  else if (repeat === 'weekly') next.setDate(next.getDate() + 7);
  else if (repeat === 'monthly') next.setMonth(next.getMonth() + 1);
  else return null;
  return next.toISOString();
}

function notify(title, body, onClick) {
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      const n = new Notification(title, { body });
      n.onclick = ev => {
        ev.preventDefault();
        window.focus();
        if (typeof onClick === 'function') onClick();
        n.close();
      };
    } else if (Notification.permission !== "denied") {
      Notification.requestPermission().then(permission => {
        if (permission === "granted") notify(title, body, onClick);
      });
    }
  } else {
    if (confirm(title + "\n\n" + body + "\n\nOpen mail client?")) {
      if (typeof onClick === 'function') onClick();
    }
  }
}

function checkDueReminders() {
  if (!schedulerRunning) return;
  const now = new Date();
  const due = reminders.filter(r => r.active && Date.parse(r.when) <= now.getTime());
  if (due.length === 0) {
    setStatus('No reminders due');
    updateNextCheck();
    return;
  }

  due.forEach(r => {
    const lastSent = r.lastSentAt ? Date.parse(r.lastSentAt) : 0;
    if (Math.abs(now.getTime() - lastSent) < 1000 * 30) return;

    notify(`${r.subject}`, `Reminder for ${r.recipient}\n${(r.message || '').slice(0, 120)}`, () => sendMail(r));
    r.lastSentAt = now.toISOString();
    r.sentCount = (r.sentCount || 0) + 1;
    if (r.repeat && r.repeat !== 'none') {
      const next = computeNextOccurrence(r.when, r.repeat);
      if (next) r.when = next;
    } else {
      r.active = false;
    }
  });

  saveReminders();
  renderList();
  setStatus(`${due.length} reminder(s) processed`);
  updateNextCheck();
}

// === UI RENDERING ===
function renderList() {
  const q = searchEl.value.trim().toLowerCase();
  const filter = filterEl.value;
  const arr = reminders.slice().sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
  const nodes = arr.filter(r => {
    if (filter === 'due' && !(r.active && Date.parse(r.when) <= Date.now())) return false;
    if (filter === 'future' && !(r.active && Date.parse(r.when) > Date.now())) return false;
    if (filter === 'sent' && !(r.sentCount && r.sentCount > 0 && !r.active)) return false;
    if (!q) return true;
    return (r.recipient + ' ' + r.subject + ' ' + r.message).toLowerCase().includes(q);
  }).map(r => renderReminderNode(r));

  listEl.innerHTML = '';
  if (nodes.length === 0) {
    listEl.innerHTML = `<div class="muted-block">No reminders yet. Create one in the left panel.</div>`;
    return;
  }
  nodes.forEach(n => listEl.appendChild(n));
}

function renderReminderNode(r) {
  const wrap = document.createElement('div');
  wrap.className = 'reminder';
  const left = document.createElement('div');
  left.className = 'rem-left';
  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.textContent = r.recipient.split('@')[0].slice(0, 2).toUpperCase();
  const meta = document.createElement('div');
  meta.className = 'meta';
  const h3 = document.createElement('h3');
  h3.textContent = r.subject;
  const p = document.createElement('p');
  p.innerHTML = `<strong>${r.recipient}</strong> • ${formatReadable(r.when)} • ${r.repeat !== 'none' ? r.repeat : '<span style="opacity:0.8">one-time</span>'}`;
  meta.appendChild(h3);
  meta.appendChild(p);
  left.appendChild(avatar);
  left.appendChild(meta);
  const right = document.createElement('div');
  right.className = 'actions';
  const pri = document.createElement('div');
  pri.className = 'pill';
  pri.textContent = r.priority || 'normal';
  right.appendChild(pri);
  if (!r.active) {
    const p2 = document.createElement('div');
    p2.className = 'pill';
    p2.textContent = `Inactive`;
    right.appendChild(p2);
  } else if (Date.parse(r.when) <= Date.now()) {
    const due = document.createElement('div');
    due.className = 'pill due';
    due.textContent = 'Due';
    right.appendChild(due);
  } else {
    const soon = document.createElement('div');
    soon.className = 'pill';
    soon.textContent = 'Scheduled';
    right.appendChild(soon);
  }

  const editBtn = document.createElement('button');
  editBtn.className = 'btn secondary';
  editBtn.innerText = 'Edit';
  editBtn.onclick = () => loadToForm(r.id);

  const sendBtn = document.createElement('button');
  sendBtn.className = 'btn';
  sendBtn.innerText = 'Send Now';
  sendBtn.onclick = () => {
    sendMail(r);
    r.lastSentAt = nowISO();
    r.sentCount = (r.sentCount || 0) + 1;
    saveReminders();
    renderList();
  };

  const delBtn = document.createElement('button');
  delBtn.className = 'btn secondary';
  delBtn.innerText = 'Delete';
  delBtn.onclick = () => deleteReminder(r.id);

  right.append(editBtn, sendBtn, delBtn);
  wrap.append(left, right);
  return wrap;
}

// === STATUS + SCHEDULER ===
function setStatus(text) {
  statusEl.textContent = text;
  setTimeout(() => {
    if (statusEl.textContent === text) statusEl.textContent = 'Idle';
  }, 3000);
}
function updateNextCheck() {
  nextCheckAt = new Date(Date.now() + CHECK_INTERVAL);
  nextCheckEl.textContent = nextCheckAt.toLocaleTimeString();
}
function startScheduler() {
  if (scheduler) clearInterval(scheduler);
  scheduler = setInterval(checkDueReminders, CHECK_INTERVAL);
  schedulerRunning = true;
  schedulerStateEl.textContent = 'Running';
  toggleSchedBtn.textContent = 'Pause Scheduler';
  updateNextCheck();
}
function stopScheduler() {
  if (scheduler) clearInterval(scheduler);
  scheduler = null;
  schedulerRunning = false;
  schedulerStateEl.textContent = 'Paused';
  toggleSchedBtn.textContent = 'Resume Scheduler';
  nextCheckEl.textContent = '--';
  setStatus('Scheduler paused');
}

// === IMPORT / EXPORT ===
function exportReminders() {
  const data = JSON.stringify(reminders, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'reminders.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setStatus('Exported');
}

function importRemindersFile(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!Array.isArray(parsed)) throw new Error('Expected an array of reminders');
      const existingIds = new Set(reminders.map(r => r.id));
      parsed.forEach(r => {
        if (!r.id) r.id = uid(12);
        if (!existingIds.has(r.id)) reminders.push(r);
      });
      saveReminders();
      renderList();
      setStatus('Imported');
    } catch (err) {
      alert('Failed to import file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// === INIT ===
function init() {
  saveBtn.onclick = addOrUpdateReminder;
  testBtn.onclick = () => {
    const r = buildReminderFromForm();
    if (!r) return;
    sendMail({ ...r, message: r.message + '\n\n[Test email]' });
  };
  clearBtn.onclick = resetForm;
  exportBtn.onclick = exportReminders;
  importBtn.onclick = () => importFileEl.click();
  importFileEl.onchange = (ev) => {
    if (ev.target.files && ev.target.files[0]) importRemindersFile(ev.target.files[0]);
    ev.target.value = '';
  };
  clearAllBtn.onclick = () => {
    if (confirm('Delete ALL reminders? This cannot be undone.')) {
      reminders = [];
      saveReminders();
      renderList();
      setStatus('All cleared');
    }
  };
  toggleSchedBtn.onclick = () => schedulerRunning ? stopScheduler() : startScheduler();
  searchEl.oninput = renderList;
  filterEl.onchange = renderList;
  loadReminders();
  renderList();
  startScheduler();

  // Enable notifications
  if ("Notification" in window && Notification.permission !== "granted" && Notification.permission !== "denied") {
    Notification.requestPermission().then(p => {
      if (p === 'granted') setStatus('Notifications enabled');
    });
  }

  // Periodic status refresh
  setInterval(() => {
    const total = reminders.length;
    const active = reminders.filter(r => r.active).length;
    const due = reminders.filter(r => r.active && Date.parse(r.when) <= Date.now()).length;
    statusEl.textContent = `${total} total, ${active} active, ${due} due`;
  }, 3000);
}

init();
window._ERS = {
  getReminders: () => reminders,
  save: saveReminders,
  checkNow: checkDueReminders
};














