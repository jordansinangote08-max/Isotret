const STORAGE_KEY = "doseTrackerData_v2";
const LEGACY_STORAGE_KEY = "doseTrackerData_v1";
const CLOUD_CONFIG_KEY = "doseTrackerCloudConfig_v1";

const todayPH = () => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
};

const state = {
  entries: [],
  settings: {
    weight: 75,
    plannedDose: 30,
    targetLevel: 135,
    historyStartDate: ""
  },
  theme: window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
};

let cloudConfig = { apiKey: "", binId: "" };
let editingEntryId = null;
let selectedDate = todayPH();
let miniCursor = monthStartFromKey(todayPH());
let historyCursor = monthStartFromKey(todayPH());
let toastTimer = null;

const $ = id => document.getElementById(id);
const $$ = selector => [...document.querySelectorAll(selector)];

const els = {
  views: $$("[data-view]"),
  viewTargets: $$("[data-view-target]"),
  openDoseButtons: $$("[data-open-dose]"),
  closeDoseButtons: $$("[data-close-dose]"),
  desktopThemeToggle: $("desktopThemeToggle"),
  mobileThemeToggle: $("mobileThemeToggle"),
  preferenceThemeToggle: $("preferenceThemeToggle"),
  mobileMenuButton: $("mobileMenuButton"),
  mobileMenu: $("mobileMenu"),
  exportNav: $("exportNav"),
  mobileExport: $("mobileExport"),
  greetingTitle: $("greetingTitle"),
  sidebarSyncStatus: $("sidebarSyncStatus"),
  toast: $("toast"),

  todayPlannedDose: $("todayPlannedDose"),
  todayStatus: $("todayStatus"),
  targetWeightHome: $("targetWeightHome"),
  targetDoseHome: $("targetDoseHome"),
  targetLevelHome: $("targetLevelHome"),
  startDateHome: $("startDateHome"),
  homeTotalTaken: $("homeTotalTaken"),
  homeMgKg: $("homeMgKg"),
  progressRing: $("progressRing"),
  ringPercent: $("ringPercent"),
  progressLineFill: $("progressLineFill"),
  remainingHome: $("remainingHome"),
  daysLeftHome: $("daysLeftHome"),
  editLastEntry: $("editLastEntry"),
  lastEntryCaption: $("lastEntryCaption"),

  miniPrevMonth: $("miniPrevMonth"),
  miniNextMonth: $("miniNextMonth"),
  miniMonthLabel: $("miniMonthLabel"),
  miniCalendar: $("miniCalendar"),
  recentSelectedDate: $("recentSelectedDate"),
  recentSelectedStatus: $("recentSelectedStatus"),
  summaryTaken: $("summaryTaken"),
  summaryTotal: $("summaryTotal"),
  summaryConsistency: $("summaryConsistency"),

  historyPrevMonth: $("historyPrevMonth"),
  historyNextMonth: $("historyNextMonth"),
  historyMonthLabel: $("historyMonthLabel"),
  historyCalendar: $("historyCalendar"),
  historySelectedDate: $("historySelectedDate"),
  historySelectedStatus: $("historySelectedStatus"),
  historySelectedActions: $("historySelectedActions"),
  historySummaryTaken: $("historySummaryTaken"),
  historySummaryTotal: $("historySummaryTotal"),
  historySummaryConsistency: $("historySummaryConsistency"),
  clearHistory: $("clearHistory"),

  settingsForm: $("settingsForm"),
  weightKg: $("weightKg"),
  plannedDose: $("plannedDose"),
  treatmentStartDate: $("treatmentStartDate"),
  settingsStatus: $("settingsStatus"),

  jsonbinKey: $("jsonbinKey"),
  jsonbinBinId: $("jsonbinBinId"),
  connectCloud: $("connectCloud"),
  syncCloudNow: $("syncCloudNow"),
  cloudStatus: $("cloudStatus"),

  doseModal: $("doseModal"),
  doseForm: $("doseForm"),
  doseModalTitle: $("doseModalTitle"),
  doseDate: $("doseDate"),
  doseMg: $("doseMg"),
  doseSubmit: $("doseSubmit"),
  deleteDose: $("deleteDose")
};

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value) || 0);
}

function dateFromKey(key) {
  const [year, month, day] = String(key).split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(key, options = {}) {
  if (!key) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
    ...options
  }).format(dateFromKey(key));
}

function monthStartFromKey(key) {
  const d = dateFromKey(key);
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function toKey(year, monthIndex, day) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function localDateKey(date) {
  return toKey(date.getFullYear(), date.getMonth(), date.getDate());
}

function computeStats() {
  const totalMg = state.entries.reduce((sum, entry) => sum + Number(entry.mg || 0), 0);
  const weight = Number(state.settings.weight) || 0;
  const targetLevel = Number(state.settings.targetLevel) || 135;
  const plannedDose = Number(state.settings.plannedDose) || 0;
  const targetTotal = weight * targetLevel;
  const mgPerKg = weight ? totalMg / weight : 0;
  const remaining = Math.max(targetTotal - totalMg, 0);
  const progress = targetTotal ? Math.min((totalMg / targetTotal) * 100, 100) : 0;
  const daysLeft = plannedDose ? Math.ceil(remaining / plannedDose) : 0;
  return { totalMg, weight, targetLevel, plannedDose, targetTotal, mgPerKg, remaining, progress, daysLeft };
}

function entriesForDate(key) {
  return state.entries.filter(entry => entry.date === key);
}

function totalForDate(key) {
  return entriesForDate(key).reduce((sum, entry) => sum + Number(entry.mg || 0), 0);
}

function lastEntry() {
  return [...state.entries].sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return String(b.id).localeCompare(String(a.id));
  })[0] || null;
}

function saveLocal() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadLocal() {
  let raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    if (Array.isArray(data.entries)) state.entries = data.entries;
    if (data.settings) state.settings = { ...state.settings, ...data.settings };
    if (data.theme) state.theme = data.theme;
    saveLocal();
  } catch (error) {
    console.warn("Could not load saved tracker data", error);
  }
}

function loadCloudConfig() {
  try {
    const raw = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (raw) cloudConfig = { ...cloudConfig, ...JSON.parse(raw) };
  } catch (error) {
    console.warn("Could not load cloud config", error);
  }
  els.jsonbinKey.value = cloudConfig.apiKey || "";
  els.jsonbinBinId.value = cloudConfig.binId || "";
}

function saveCloudConfig() {
  cloudConfig.apiKey = els.jsonbinKey.value.replace(/\s+/g, "").trim();
  cloudConfig.binId = els.jsonbinBinId.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24);
  els.jsonbinKey.value = cloudConfig.apiKey;
  els.jsonbinBinId.value = cloudConfig.binId;
  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig));
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  const dark = state.theme === "dark";
  els.mobileThemeToggle.textContent = dark ? "☀" : "☾";
  els.preferenceThemeToggle.setAttribute("aria-pressed", String(dark));
  els.desktopThemeToggle.setAttribute("aria-pressed", String(dark));
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#171b19" : "#315f63");
}

function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  saveLocal();
  applyTheme();
  pushToCloud({ silent: true });
}

function setGreeting() {
  const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", hour: "2-digit", hour12: false }).format(new Date()));
  els.greetingTitle.textContent = hour < 12 ? "Good morning!" : hour < 18 ? "Good afternoon!" : "Good evening!";
}

function showToast(message) {
  clearTimeout(toastTimer);
  els.toast.textContent = message;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 2400);
}

function showView(viewName) {
  els.views.forEach(view => view.classList.toggle("is-active", view.dataset.view === viewName));
  $$(".nav-item[data-view-target]").forEach(btn => btn.classList.toggle("is-active", btn.dataset.viewTarget === viewName));
  $$(".bottom-nav-item").forEach(btn => btn.classList.toggle("is-active", btn.dataset.viewTarget === viewName));
  els.mobileMenu.hidden = true;
  els.mobileMenuButton.setAttribute("aria-expanded", "false");
  window.scrollTo({ top: 0, behavior: "smooth" });
  if (viewName === "history") renderHistory();
  if (viewName === "settings") syncSettingsForm();
  if (viewName === "sync") syncCloudForm();
}

function renderHome() {
  const stats = computeStats();
  const today = todayPH();
  const todayTotal = totalForDate(today);

  els.todayPlannedDose.textContent = formatNumber(stats.plannedDose);
  els.todayStatus.textContent = todayTotal > 0 ? `${formatNumber(todayTotal)} mg recorded today.` : "No dose recorded yet today.";

  els.targetWeightHome.textContent = `${formatNumber(stats.weight, stats.weight % 1 ? 1 : 0)} kg`;
  els.targetDoseHome.textContent = `${formatNumber(stats.plannedDose)} mg/day`;
  els.targetLevelHome.textContent = `${formatNumber(stats.targetLevel)} mg/kg`;
  els.startDateHome.textContent = state.settings.historyStartDate ? `Started on ${formatDate(state.settings.historyStartDate)}` : "Treatment start date not set.";

  els.homeTotalTaken.textContent = `${formatNumber(stats.totalMg)} mg`;
  els.homeMgKg.textContent = `${formatNumber(stats.mgPerKg, 2)} mg/kg`;
  els.progressRing.style.setProperty("--progress", stats.progress.toFixed(2));
  els.ringPercent.textContent = `${formatNumber(stats.progress, 1)}%`;
  els.progressLineFill.style.width = `${stats.progress}%`;
  els.remainingHome.textContent = `${formatNumber(stats.remaining)} mg`;
  els.daysLeftHome.textContent = stats.remaining <= 0 ? "Complete" : stats.daysLeft ? `~${formatNumber(stats.daysLeft)} days` : "—";

  const last = lastEntry();
  els.lastEntryCaption.textContent = last ? `${formatDate(last.date, { month: "short" })} • ${formatNumber(last.mg)} mg` : "No entry yet";
  els.editLastEntry.disabled = !last;

  renderMiniCalendar();
}

function monthStats(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const entries = state.entries.filter(entry => String(entry.date).startsWith(prefix));
  const uniqueDates = [...new Set(entries.map(entry => entry.date))];
  const total = entries.reduce((sum, entry) => sum + Number(entry.mg || 0), 0);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  let eligibleDays = 0;
  let eligibleTaken = 0;
  const start = state.settings.historyStartDate;
  if (start) {
    const monthStart = toKey(year, month, 1);
    const monthEnd = toKey(year, month, daysInMonth);
    const eligibleStart = start > monthStart ? start : monthStart;
    const today = todayPH();
    const eligibleEnd = today < monthEnd ? today : monthEnd;
    if (eligibleStart <= eligibleEnd) {
      const a = dateFromKey(eligibleStart);
      const b = dateFromKey(eligibleEnd);
      eligibleDays = Math.floor((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000) + 1;
      eligibleTaken = uniqueDates.filter(key => key >= eligibleStart && key <= eligibleEnd).length;
    }
  }
  return { uniqueDates, total, consistency: eligibleDays ? Math.min((eligibleTaken / eligibleDays) * 100, 100) : null };
}

function calendarCells(cursor) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < 42; i++) {
    let cellYear = year;
    let cellMonth = month;
    let day;
    let outside = false;
    if (i < firstDay) {
      outside = true;
      day = prevMonthDays - firstDay + i + 1;
      cellMonth -= 1;
      if (cellMonth < 0) { cellMonth = 11; cellYear -= 1; }
    } else if (i >= firstDay + daysInMonth) {
      outside = true;
      day = i - (firstDay + daysInMonth) + 1;
      cellMonth += 1;
      if (cellMonth > 11) { cellMonth = 0; cellYear += 1; }
    } else {
      day = i - firstDay + 1;
    }
    const key = toKey(cellYear, cellMonth, day);
    const total = totalForDate(key);
    const taken = !outside && total > 0;
    const start = state.settings.historyStartDate;
    const missed = !outside && Boolean(start) && key >= start && key < todayPH() && !taken;
    cells.push({ key, day, outside, total, taken, missed });
  }
  return cells;
}

function renderMiniCalendar() {
  els.miniMonthLabel.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(miniCursor);
  els.miniCalendar.innerHTML = "";
  for (const cell of calendarCells(miniCursor)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mini-day";
    if (cell.outside) button.classList.add("is-outside");
    if (cell.taken) button.classList.add("is-taken");
    if (cell.missed) button.classList.add("is-missed");
    if (cell.key === selectedDate) button.classList.add("is-selected");
    button.textContent = cell.day;
    button.dataset.date = cell.key;
    button.disabled = cell.outside;
    els.miniCalendar.appendChild(button);
  }
  const summary = monthStats(miniCursor);
  els.summaryTaken.textContent = formatNumber(summary.uniqueDates.length);
  els.summaryTotal.textContent = `${formatNumber(summary.total)} mg`;
  els.summaryConsistency.textContent = summary.consistency === null ? "—" : `${formatNumber(summary.consistency)}%`;
  updateRecentSelected();
}

function updateRecentSelected() {
  els.recentSelectedDate.textContent = formatDate(selectedDate);
  const total = totalForDate(selectedDate);
  if (total > 0) {
    els.recentSelectedStatus.textContent = `✓ Dose recorded • ${formatNumber(total)} mg`;
    els.recentSelectedStatus.style.background = "var(--success-soft)";
  } else if (state.settings.historyStartDate && selectedDate >= state.settings.historyStartDate && selectedDate < todayPH()) {
    els.recentSelectedStatus.textContent = "× No dose recorded";
    els.recentSelectedStatus.style.background = "var(--danger-soft)";
  } else {
    els.recentSelectedStatus.textContent = "No dose recorded";
    els.recentSelectedStatus.style.background = "var(--surface-2)";
  }
}

function renderHistory() {
  els.historyMonthLabel.textContent = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(historyCursor);
  els.historyCalendar.innerHTML = "";
  for (const cell of calendarCells(historyCursor)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "history-day";
    if (cell.outside) button.classList.add("is-outside");
    if (cell.taken) button.classList.add("is-taken");
    if (cell.missed) button.classList.add("is-missed");
    if (cell.key === selectedDate) button.classList.add("is-selected");
    button.dataset.date = cell.key;
    button.disabled = cell.outside;
    const statusDot = cell.taken
      ? `<span class="history-status-dot is-taken-dot" aria-hidden="true"></span>`
      : cell.missed
        ? `<span class="history-status-dot is-missed-dot" aria-hidden="true"></span>`
        : `<span class="history-status-dot is-empty-dot" aria-hidden="true"></span>`;
    const record = cell.taken ? `${formatNumber(cell.total)} mg` : cell.missed ? "Missed" : "";
    button.innerHTML = `<span class="day-number">${cell.day}</span>${statusDot}<span class="day-record">${record}</span>`;
    if (cell.taken) button.setAttribute("aria-label", `${formatDate(cell.key)}. Dose recorded: ${formatNumber(cell.total)} mg.`);
    else if (cell.missed) button.setAttribute("aria-label", `${formatDate(cell.key)}. Missed dose.`);
    else button.setAttribute("aria-label", formatDate(cell.key));
    els.historyCalendar.appendChild(button);
  }
  const summary = monthStats(historyCursor);
  els.historySummaryTaken.textContent = formatNumber(summary.uniqueDates.length);
  els.historySummaryTotal.textContent = `${formatNumber(summary.total)} mg`;
  els.historySummaryConsistency.textContent = summary.consistency === null ? "—" : `${formatNumber(summary.consistency)}%`;
  updateHistorySelected();
}

function updateHistorySelected() {
  els.historySelectedDate.textContent = formatDate(selectedDate);
  const entries = entriesForDate(selectedDate);
  const total = entries.reduce((sum, entry) => sum + Number(entry.mg || 0), 0);
  els.historySelectedActions.innerHTML = "";

  if (entries.length) {
    els.historySelectedStatus.textContent = `${formatNumber(total)} mg recorded across ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.`;
    entries.forEach(entry => {
      const btn = document.createElement("button");
      btn.className = "btn btn-secondary";
      btn.type = "button";
      btn.textContent = `Edit ${formatNumber(entry.mg)} mg`;
      btn.addEventListener("click", () => openDoseModal(entry));
      els.historySelectedActions.appendChild(btn);
    });
  } else {
    const missed = state.settings.historyStartDate && selectedDate >= state.settings.historyStartDate && selectedDate < todayPH();
    els.historySelectedStatus.textContent = missed ? "No dose recorded for this date." : "No dose recorded.";
    const add = document.createElement("button");
    add.className = "btn btn-primary";
    add.type = "button";
    add.textContent = "Add dose for this date";
    add.addEventListener("click", () => openDoseModal(null, selectedDate));
    els.historySelectedActions.appendChild(add);
  }
}

function syncSettingsForm() {
  els.weightKg.value = state.settings.weight;
  els.plannedDose.value = state.settings.plannedDose;
  els.treatmentStartDate.value = state.settings.historyStartDate || "";
  $$('input[name="targetLevel"]').forEach(radio => { radio.checked = Number(radio.value) === Number(state.settings.targetLevel); });
}

function syncCloudForm() {
  els.jsonbinKey.value = cloudConfig.apiKey || "";
  els.jsonbinBinId.value = cloudConfig.binId || "";
}

function renderAll() {
  applyTheme();
  renderHome();
  renderHistory();
  syncSettingsForm();
}

function openDoseModal(entry = null, requestedDate = null) {
  editingEntryId = entry?.id || null;
  els.doseModal.hidden = false;
  document.body.style.overflow = "hidden";
  els.doseModalTitle.textContent = entry ? "Edit dose" : "Log a dose";
  els.doseSubmit.textContent = entry ? "Save changes" : "Add entry";
  els.deleteDose.hidden = !entry;
  els.doseDate.value = entry?.date || requestedDate || todayPH();
  els.doseMg.value = entry?.mg ?? state.settings.plannedDose;
  setTimeout(() => els.doseDate.focus(), 50);
}

function closeDoseModal() {
  editingEntryId = null;
  els.doseModal.hidden = true;
  document.body.style.overflow = "";
}

function upsertDose(event) {
  event.preventDefault();
  const date = els.doseDate.value;
  const mg = Number(els.doseMg.value);
  if (!date || Number.isNaN(mg) || mg < 0) return;

  if (editingEntryId) {
    const entry = state.entries.find(item => item.id === editingEntryId);
    if (entry) { entry.date = date; entry.mg = mg; }
    showToast("Dose updated");
  } else {
    state.entries.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, date, mg });
    showToast("Dose saved");
  }
  selectedDate = date;
  miniCursor = monthStartFromKey(date);
  historyCursor = monthStartFromKey(date);
  saveLocal();
  renderAll();
  pushToCloud({ silent: true });
  closeDoseModal();
}

function deleteEditingDose() {
  if (!editingEntryId) return;
  if (!confirm("Delete this dose entry?")) return;
  state.entries = state.entries.filter(entry => entry.id !== editingEntryId);
  saveLocal();
  renderAll();
  pushToCloud({ silent: true });
  closeDoseModal();
  showToast("Dose deleted");
}

function saveSettings(event) {
  event.preventDefault();
  const target = document.querySelector('input[name="targetLevel"]:checked');
  state.settings.weight = Number(els.weightKg.value) || 0;
  state.settings.plannedDose = Number(els.plannedDose.value) || 0;
  state.settings.targetLevel = Number(target?.value) || 135;
  state.settings.historyStartDate = els.treatmentStartDate.value || "";
  saveLocal();
  renderAll();
  pushToCloud({ silent: true });
  els.settingsStatus.textContent = "Settings saved.";
  showToast("Treatment settings saved");
  setTimeout(() => { els.settingsStatus.textContent = ""; }, 2500);
}

function setCloudStatus(message, type = "normal") {
  els.cloudStatus.textContent = message;
  els.cloudStatus.style.color = type === "error" ? "var(--danger)" : type === "success" ? "var(--success)" : "var(--muted)";
  const strong = els.sidebarSyncStatus.querySelector("strong");
  const sub = els.sidebarSyncStatus.querySelector("span:last-child");
  if (type === "success") { strong.textContent = "Synced"; sub.textContent = "Just now"; }
  if (type === "error") { strong.textContent = "Saved locally"; sub.textContent = "Cloud unavailable"; }
}

async function pullFromCloud() {
  saveCloudConfig();
  if (!navigator.onLine) { setCloudStatus("Offline. Using local data.", "error"); return false; }
  if (!cloudConfig.apiKey || !cloudConfig.binId) { setCloudStatus("Enter both API key and Bin ID.", "error"); return false; }
  setCloudStatus("Loading from cloud…");
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${cloudConfig.binId}/latest`, { headers: { "X-Master-Key": cloudConfig.apiKey } });
    if (!response.ok) throw new Error(`Load failed (${response.status})`);
    const json = await response.json();
    const data = json.record;
    if (Array.isArray(data.entries)) state.entries = data.entries;
    if (data.settings) state.settings = { ...state.settings, ...data.settings };
    if (data.theme) state.theme = data.theme;
    saveLocal();
    renderAll();
    setCloudStatus("Connected and loaded successfully.", "success");
    showToast("Cloud data loaded");
    return true;
  } catch (error) {
    setCloudStatus(`Cloud load failed: ${error.message}`, "error");
    return false;
  }
}

async function pushToCloud({ silent = false } = {}) {
  saveLocal();
  if (!navigator.onLine || !cloudConfig.apiKey) return false;
  try {
    const body = JSON.stringify({ entries: state.entries, settings: state.settings, theme: state.theme });
    let response;
    if (cloudConfig.binId) {
      response = await fetch(`https://api.jsonbin.io/v3/b/${cloudConfig.binId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "X-Master-Key": cloudConfig.apiKey },
        body
      });
    } else {
      response = await fetch("https://api.jsonbin.io/v3/b", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Master-Key": cloudConfig.apiKey, "X-Bin-Private": "true" },
        body
      });
      if (response.ok) {
        const json = await response.json();
        cloudConfig.binId = json.metadata.id;
        localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(cloudConfig));
        syncCloudForm();
      }
    }
    if (!response.ok) throw new Error(`Sync failed (${response.status})`);
    setCloudStatus("Synced successfully.", "success");
    if (!silent) showToast("Cloud sync complete");
    return true;
  } catch (error) {
    setCloudStatus(`Cloud sync failed: ${error.message}`, "error");
    if (!silent) showToast("Cloud sync failed; local data is safe");
    return false;
  }
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    app: "Daily Dose Tracker",
    ...state
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `daily-dose-tracker-backup-${todayPH()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("Backup exported");
}

function bindEvents() {
  els.viewTargets.forEach(button => button.addEventListener("click", () => showView(button.dataset.viewTarget)));
  els.openDoseButtons.forEach(button => button.addEventListener("click", () => openDoseModal()));
  els.closeDoseButtons.forEach(button => button.addEventListener("click", closeDoseModal));
  els.doseForm.addEventListener("submit", upsertDose);
  els.deleteDose.addEventListener("click", deleteEditingDose);
  els.settingsForm.addEventListener("submit", saveSettings);

  [els.desktopThemeToggle, els.mobileThemeToggle, els.preferenceThemeToggle].forEach(button => button.addEventListener("click", toggleTheme));
  els.mobileMenuButton.addEventListener("click", () => {
    const open = els.mobileMenu.hidden;
    els.mobileMenu.hidden = !open;
    els.mobileMenuButton.setAttribute("aria-expanded", String(open));
  });
  document.addEventListener("click", event => {
    if (!els.mobileMenu.hidden && !els.mobileMenu.contains(event.target) && event.target !== els.mobileMenuButton) {
      els.mobileMenu.hidden = true;
      els.mobileMenuButton.setAttribute("aria-expanded", "false");
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !els.doseModal.hidden) closeDoseModal();
  });

  els.exportNav.addEventListener("click", exportData);
  els.mobileExport.addEventListener("click", exportData);
  els.editLastEntry.addEventListener("click", () => { const entry = lastEntry(); if (entry) openDoseModal(entry); });

  els.miniPrevMonth.addEventListener("click", () => { miniCursor = new Date(miniCursor.getFullYear(), miniCursor.getMonth() - 1, 1); selectedDate = localDateKey(miniCursor); renderMiniCalendar(); });
  els.miniNextMonth.addEventListener("click", () => { miniCursor = new Date(miniCursor.getFullYear(), miniCursor.getMonth() + 1, 1); selectedDate = localDateKey(miniCursor); renderMiniCalendar(); });
  els.miniCalendar.addEventListener("click", event => {
    const btn = event.target.closest("[data-date]");
    if (!btn || btn.disabled) return;
    selectedDate = btn.dataset.date;
    renderMiniCalendar();
  });

  els.historyPrevMonth.addEventListener("click", () => { historyCursor = new Date(historyCursor.getFullYear(), historyCursor.getMonth() - 1, 1); selectedDate = localDateKey(historyCursor); renderHistory(); });
  els.historyNextMonth.addEventListener("click", () => { historyCursor = new Date(historyCursor.getFullYear(), historyCursor.getMonth() + 1, 1); selectedDate = localDateKey(historyCursor); renderHistory(); });
  els.historyCalendar.addEventListener("click", event => {
    const btn = event.target.closest("[data-date]");
    if (!btn || btn.disabled) return;
    selectedDate = btn.dataset.date;
    renderHistory();
  });

  els.clearHistory.addEventListener("click", () => {
    if (!state.entries.length) { showToast("History is already empty"); return; }
    if (!confirm("Clear all dose history? This cannot be undone.")) return;
    state.entries = [];
    saveLocal();
    renderAll();
    pushToCloud({ silent: true });
    showToast("History cleared");
  });

  els.connectCloud.addEventListener("click", pullFromCloud);
  els.syncCloudNow.addEventListener("click", () => { saveCloudConfig(); pushToCloud(); });
  els.jsonbinKey.addEventListener("input", () => { els.jsonbinKey.value = els.jsonbinKey.value.replace(/\s+/g, ""); });
  els.jsonbinBinId.addEventListener("input", () => { els.jsonbinBinId.value = els.jsonbinBinId.value.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24); });

  document.querySelector(".treatment-card")?.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") showView("settings"); });

  window.addEventListener("online", () => { if (cloudConfig.apiKey && cloudConfig.binId) pushToCloud({ silent: true }); });
  window.addEventListener("offline", () => setCloudStatus("Offline. Changes remain saved locally.", "error"));
}

function init() {
  loadLocal();
  loadCloudConfig();
  setGreeting();
  bindEvents();
  renderAll();
  if (navigator.onLine && cloudConfig.apiKey && cloudConfig.binId) pullFromCloud();
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(error => console.warn("Service worker registration failed", error)));
  }
}

init();
