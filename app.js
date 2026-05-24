const STORAGE_KEY = "course-planner-deliverables";
const SELECTION_KEY = "course-planner-selected-courses";

const COURSE_COLORS = {
  ECE457A: "#2563eb",
  ECE457B: "#7c3aed",
  ECE481: "#059669",
  ECE486: "#d97706",
  PHIL201: "#db2777",
};

const TYPE_COLORS = {
  Assignment: "#2563eb",
  Exam: "#dc2626",
  Lab: "#059669",
  Homework: "#7c3aed",
  Project: "#d97706",
  Presentation: "#0891b2",
};

const FALLBACK_PALETTE = [
  "#2563eb",
  "#7c3aed",
  "#059669",
  "#d97706",
  "#db2777",
  "#0891b2",
  "#4b5563",
];

/** @typedef {{ id: string, course: string, type: string, task: string, startDate: string | null, endDate: string | null, weight: number }} Deliverable */

const desktop = window.coursePlanner?.isDesktop === true;

let deliverables = [];
/** @type {Set<string>} */
let selectedCourses = new Set();
/** @type {Set<string>} */
let lastKnownCourses = new Set();
let dataFilePath = "";

// --- persistence ---

async function loadSeed() {
  if (desktop) {
    const raw = await window.coursePlanner.loadSeed();
    return raw.map(normalizeRow);
  }
  const res = await fetch("data/seed.json");
  if (!res.ok) throw new Error("Could not load seed data");
  const raw = await res.json();
  return raw.map(normalizeRow);
}

async function loadPersisted() {
  if (desktop) {
    const stored = await window.coursePlanner.loadData();
    if (!stored) return null;
    if (Array.isArray(stored)) {
      return { deliverables: stored.map(normalizeRow), selectedCourses: null, timelineDayWidth: null };
    }
    return {
      deliverables: (stored.deliverables ?? []).map(normalizeRow),
      selectedCourses: stored.selectedCourses ?? null,
      timelineDayWidth: stored.timelineDayWidth ?? null,
    };
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return { deliverables: parsed.map(normalizeRow), selectedCourses: null, timelineDayWidth: null };
    }
    return {
      deliverables: (parsed.deliverables ?? []).map(normalizeRow),
      selectedCourses: parsed.selectedCourses ?? null,
      timelineDayWidth: parsed.timelineDayWidth ?? null,
    };
  } catch {
    return null;
  }
}

const MIN_DAY_WIDTH = 8;
const MAX_DAY_WIDTH = 56;
const DEFAULT_DAY_WIDTH = 20;
const TIMELINE_LABEL_WIDTH = 200;
const TIMELINE_ROW_HEIGHT_PX = 34;
const TIMELINE_HEADER_HEIGHT_PX = 36;
const TIMELINE_MONTH_LOOKAHEAD_DAYS = 31;

let timelineDayWidth = DEFAULT_DAY_WIDTH;
let lastTimelineNumDays = 0;
let timelineZoomWired = false;

async function savePersisted() {
  const payload = {
    deliverables,
    selectedCourses: [...selectedCourses],
    timelineDayWidth,
  };

  if (desktop) {
    dataFilePath = await window.coursePlanner.saveData(payload);
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem(SELECTION_KEY, JSON.stringify([...selectedCourses]));
  }

  updateStorageHint();
}

function updateStorageHint() {
  const el = document.getElementById("storage-hint");
  if (!el) return;
  const n = deliverables.length;
  if (desktop && dataFilePath) {
    el.textContent = `${n} deliverables · saved to disk`;
    el.title = dataFilePath;
  } else {
    el.textContent = `${n} deliverables · saved locally`;
    el.title = "";
  }
}

function syncSelectionFromStored(storedSelection) {
  const courses = uniqueCourses();
  if (storedSelection && Array.isArray(storedSelection)) {
    selectedCourses = new Set(storedSelection.filter((c) => courses.includes(c)));
  } else {
    selectedCourses = new Set(courses);
  }
}

// --- data helpers ---

function newId() {
  return crypto.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function normalizeRow(row) {
  return {
    id: String(row.id ?? newId()),
    course: String(row.course ?? "").trim(),
    type: String(row.type ?? "Assignment").trim(),
    task: String(row.task ?? "").trim(),
    startDate: row.startDate ? String(row.startDate).slice(0, 10) : null,
    endDate: row.endDate ? String(row.endDate).slice(0, 10) : null,
    weight: Number(row.weight) || 0,
  };
}

function parseDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function formatDateInput(dt) {
  if (!dt) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function countDaysInclusive(start, end) {
  const ms = startOfDay(end) - startOfDay(start);
  return Math.max(1, Math.floor(ms / DAY_MS) + 1);
}

function dayOffset(minDate, date) {
  return (startOfDay(date) - startOfDay(minDate)) / DAY_MS;
}

function buildDayWeightMap(items, days) {
  const map = new Map();
  for (const day of days) {
    map.set(formatDateInput(day), 0);
  }
  for (const item of items) {
    const key = formatDateInput(startOfDay(item.range.end));
    if (map.has(key)) {
      map.set(key, map.get(key) + item.weight);
    }
  }
  return map;
}

function weightHeatBackground(dayWeight, maxDayWeight) {
  if (dayWeight <= 0 || maxDayWeight <= 0) return "";
  const t = dayWeight / maxDayWeight;
  const alpha = 0.18 + t * 0.82;
  return `background-color: rgba(29, 78, 216, ${alpha.toFixed(3)});`;
}

function dayWeightMeta(day, dayWeights, maxDayWeight) {
  const key = formatDateInput(day);
  const w = dayWeights.get(key) ?? 0;
  const title = w > 0 ? `${w.toFixed(2)}% of grade weight due` : "Nothing due this day";
  return { weight: w, style: weightHeatBackground(w, maxDayWeight), title };
}

let todayMarkerContext = null;

function updateTodayMarker() {
  const viewport = document.querySelector(".timeline-viewport");
  const marker = document.getElementById("today-marker");
  const ctx = todayMarkerContext;
  if (!viewport || !marker || !ctx) {
    if (marker) marker.hidden = true;
    return;
  }

  const today = startOfDay(ctx.today);
  if (today < ctx.minDate || today > ctx.maxDate) {
    marker.hidden = true;
    return;
  }

  const x =
    ctx.labelWidth +
    dayOffset(ctx.minDate, today) * ctx.timelineDayWidth +
    ctx.timelineDayWidth / 2 -
    viewport.scrollLeft;

  if (x <= ctx.labelWidth + 4) {
    marker.hidden = true;
    return;
  }

  marker.hidden = false;
  marker.style.left = `${x}px`;
  marker.title = ctx.todayLabel;
}

function wireTodayMarkerScroll() {
  const viewport = document.querySelector(".timeline-viewport");
  if (!viewport || viewport.dataset.todayWired) return;
  viewport.dataset.todayWired = "1";
  viewport.addEventListener("scroll", updateTodayMarker, { passive: true });
}

function deliverableInWindow(item, windowStart, windowEnd) {
  const start = startOfDay(item.range.start);
  const end = startOfDay(item.range.end);
  return start <= windowEnd && end >= windowStart;
}

function countDeliverablesInNextMonth(items, fromDate = startOfDay(new Date())) {
  const windowEnd = addDays(fromDate, TIMELINE_MONTH_LOOKAHEAD_DAYS);
  return items.filter((d) => deliverableInWindow(d, fromDate, windowEnd)).length;
}

function computeTimelineViewportHeight(upcomingRowCount, totalRows) {
  const header = TIMELINE_HEADER_HEIGHT_PX;
  const row = TIMELINE_ROW_HEIGHT_PX;
  const targetRows = Math.max(1, upcomingRowCount || Math.min(3, totalRows));
  const preferred = header + targetRows * row + 2;
  const contentHeight = header + totalRows * row + 2;
  const maxCap = Math.floor(window.innerHeight * 0.5);
  const minHeight = header + row * 2;
  return Math.min(contentHeight, maxCap, Math.max(minHeight, preferred));
}

/** @param {Date} start @param {number} count */
function enumerateDays(start, count) {
  const days = [];
  for (let i = 0; i < count; i++) days.push(addDays(start, i));
  return days;
}

const MIN_LABEL_SPACING_PX = 48;
const TICK_STEPS = [1, 2, 7, 14, 28, 56];

function computeTickInterval(dayWidthPx) {
  const raw = Math.max(1, Math.ceil(MIN_LABEL_SPACING_PX / Math.max(1, dayWidthPx)));
  return TICK_STEPS.find((step) => step >= raw) ?? raw;
}

function formatDayTick(date, tickEvery, dayWidthPx) {
  const day = date.getDate();
  const month = date.toLocaleDateString(undefined, { month: "short" });

  if (dayWidthPx < 5) {
    return date.getDate() === 1 ? month : "";
  }
  if (tickEvery >= 28) {
    return date.getDate() === 1 ? month : "";
  }
  if (tickEvery >= 14) {
    return date.getDate() === 1 ? `${month} ${day}` : String(day);
  }
  if (tickEvery >= 7) {
    return date.getDate() === 1 ? `${month} ${day}` : String(day);
  }
  if (tickEvery >= 2) {
    return date.getDate() === 1 ? `${month} ${day}` : String(day);
  }
  return date.getDate() === 1 ? `${month} ${day}` : String(day);
}

function timelineDensityClass(dayWidth) {
  if (dayWidth < 6) return "timeline-tight";
  if (dayWidth < 10) return "timeline-dense";
  if (dayWidth < 16) return "timeline-compact";
  return "";
}

function getFitDayWidth() {
  const viewport = document.querySelector(".timeline-viewport");
  if (!viewport || lastTimelineNumDays < 1) return MIN_DAY_WIDTH;
  const trackWidth = Math.max(0, viewport.clientWidth - TIMELINE_LABEL_WIDTH - 16);
  return trackWidth / lastTimelineNumDays;
}

/** Smallest day width allowed — entire timeline fits in the viewport at this zoom. */
function getMinZoomDayWidth() {
  return Math.max(MIN_DAY_WIDTH, getFitDayWidth());
}

function clampDayWidth(px) {
  const minW = lastTimelineNumDays > 0 ? getMinZoomDayWidth() : MIN_DAY_WIDTH;
  return Math.min(MAX_DAY_WIDTH, Math.max(minW, Math.round(px)));
}

function updateZoomSliderBounds() {
  const slider = document.getElementById("timeline-zoom");
  if (!slider || lastTimelineNumDays < 1) return;

  const minW = Math.ceil(getMinZoomDayWidth());
  const maxW = MAX_DAY_WIDTH;
  const sliderMin = Math.min(minW, maxW);

  slider.min = String(sliderMin);
  slider.max = String(maxW);
  slider.value = String(timelineDayWidth);
}

function applyTimelineDayWidth(width) {
  timelineDayWidth = clampDayWidth(width);
  const slider = document.getElementById("timeline-zoom");
  if (slider) slider.value = String(timelineDayWidth);
}

function setTimelineDayWidth(width, opts = { save: true, render: true }) {
  applyTimelineDayWidth(width);
  if (opts.save) savePersisted();
  if (opts.render) renderTimeline();
}

let viewportResizeTimer = null;

function setupViewportResize() {
  const viewport = document.querySelector(".timeline-viewport");
  if (!viewport || viewport.dataset.resizeWired) return;
  viewport.dataset.resizeWired = "1";

  new ResizeObserver(() => {
    clearTimeout(viewportResizeTimer);
    viewportResizeTimer = setTimeout(() => {
      if (lastTimelineNumDays < 1) return;
      const minW = getMinZoomDayWidth();
      const needsWiderDays = timelineDayWidth < minW;
      if (needsWiderDays) {
        timelineDayWidth = Math.ceil(minW);
      }
      renderTimeline();
      if (needsWiderDays) savePersisted();
    }, 100);
  }).observe(viewport);

  window.addEventListener("resize", () => {
    clearTimeout(viewportResizeTimer);
    viewportResizeTimer = setTimeout(() => {
      if (lastTimelineNumDays >= 1) renderTimeline();
    }, 150);
  });
}

const DEFAULT_START_DAYS_BEFORE_DUE = 10;

function effectiveRange(item) {
  const end = parseDate(item.endDate);
  if (!end) return { start: null, end: null };
  const start = parseDate(item.startDate) ?? addDays(end, -DEFAULT_START_DAYS_BEFORE_DUE);
  if (start > end) return { start: end, end };
  return { start, end };
}

function uniqueCourses() {
  return [...new Set(deliverables.map((d) => d.course).filter(Boolean))].sort();
}

function coursePassesFilter(course) {
  if (!course) return false;
  if (selectedCourses.size === 0) return false;
  return selectedCourses.has(course);
}

function colorFor(key, mode) {
  if (mode === "course") return COURSE_COLORS[key] ?? pickColor(key);
  return TYPE_COLORS[key] ?? pickColor(key);
}

function pickColor(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return FALLBACK_PALETTE[h % FALLBACK_PALETTE.length];
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

// --- course filter UI ---

function renderCourseFilter() {
  const list = document.getElementById("course-filter-list");
  if (!list) return;

  const courses = uniqueCourses();
  for (const c of courses) {
    if (!lastKnownCourses.has(c)) selectedCourses.add(c);
  }
  lastKnownCourses = new Set(courses);

  list.innerHTML = courses
    .map((c) => {
      const color = colorFor(c, "course");
      const checked = selectedCourses.has(c);
      return `
    <label class="course-chip${checked ? " is-selected" : ""}" style="--course-color: ${color}">
      <input type="checkbox" class="course-chip-input" value="${escapeAttr(c)}" ${checked ? "checked" : ""} />
      <span class="course-chip-check" aria-hidden="true"></span>
      <span class="course-chip-label">${escapeAttr(c)}</span>
    </label>`;
    })
    .join("");

  list.querySelectorAll(".course-chip-input").forEach((input) => {
    input.addEventListener("change", () => {
      const chip = input.closest(".course-chip");
      if (input.checked) {
        selectedCourses.add(input.value);
        chip?.classList.add("is-selected");
      } else {
        selectedCourses.delete(input.value);
        chip?.classList.remove("is-selected");
      }
      savePersisted();
      renderTimeline();
    });
  });
}

function selectAllCourses() {
  selectedCourses = new Set(uniqueCourses());
  renderCourseFilter();
  savePersisted();
  renderTimeline();
}

function selectNoCourses() {
  selectedCourses = new Set();
  renderCourseFilter();
  savePersisted();
  renderTimeline();
}

// --- timeline ---

function renderTimeline() {
  const colorMode = document.getElementById("timeline-color")?.value ?? "course";
  const scroll = document.getElementById("timeline-scroll");
  const viewport = document.querySelector(".timeline-viewport");
  const legendEl = document.getElementById("timeline-legend");
  if (!scroll) return;

  wireTimelineZoom();

  if (selectedCourses.size === 0) {
    scroll.innerHTML =
      '<p class="hint empty-msg">No courses selected. Use the course checkboxes above or click “All”.</p>';
    if (legendEl) legendEl.innerHTML = "";
    if (viewport) viewport.style.height = "";
    todayMarkerContext = null;
    updateTodayMarker();
    viewport?.classList.add("is-empty");
    return;
  }

  const items = deliverables
    .filter((d) => d.task && d.endDate)
    .filter((d) => coursePassesFilter(d.course))
    .map((d) => {
      const range = effectiveRange(d);
      return { ...d, range };
    })
    .filter((d) => d.range.start && d.range.end)
    .sort(
      (a, b) =>
        a.range.start - b.range.start ||
        a.course.localeCompare(b.course) ||
        a.task.localeCompare(b.task)
    );

  if (!items.length) {
    scroll.innerHTML =
      '<p class="hint empty-msg">No deliverables for the selected courses with due dates.</p>';
    if (legendEl) legendEl.innerHTML = "";
    if (viewport) viewport.style.height = "";
    todayMarkerContext = null;
    updateTodayMarker();
    viewport?.classList.add("is-empty");
    return;
  }

  viewport?.classList.remove("is-empty");

  const minDate = startOfDay(
    items.reduce((m, d) => (d.range.start < m ? d.range.start : m), items[0].range.start)
  );
  const maxDate = startOfDay(
    items.reduce((m, d) => (d.range.end > m ? d.range.end : m), items[0].range.end)
  );

  const numDays = countDaysInclusive(minDate, maxDate);
  const days = enumerateDays(minDate, numDays);
  const daySpan = Math.max(1, numDays - 1);

  lastTimelineNumDays = numDays;

  const minZoom = getMinZoomDayWidth();
  if (timelineDayWidth < minZoom) {
    timelineDayWidth = Math.ceil(minZoom);
  }

  const labelWidth = TIMELINE_LABEL_WIDTH;
  const trackWidthPx = numDays * timelineDayWidth;
  const timelineWidthPx = labelWidth + trackWidthPx;
  const tickEvery = computeTickInterval(timelineDayWidth);
  const densityClass = timelineDensityClass(timelineDayWidth);
  const gridCols = `${labelWidth}px repeat(${numDays}, ${timelineDayWidth}px)`;

  const today = startOfDay(new Date());
  const todayLabel = today.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  todayMarkerContext = {
    labelWidth,
    minDate,
    maxDate,
    today,
    timelineDayWidth,
    todayLabel: `Today — ${todayLabel}`,
  };

  const dayWeights = buildDayWeightMap(items, days);
  const maxDayWeight = Math.max(0, ...dayWeights.values());

  const legendKeys = [...new Set(items.map((d) => (colorMode === "course" ? d.course : d.type)))];
  if (legendEl) {
    legendEl.innerHTML = legendKeys
      .map(
        (k) =>
          `<span class="legend-item"><span class="legend-swatch" style="background:${colorFor(k, colorMode)}"></span>${k}</span>`
      )
      .join("");
  }

  let html = `<div class="timeline-wrapper" style="--label-width: ${labelWidth}px; --num-days: ${numDays}; --day-width: ${timelineDayWidth}px; width: ${timelineWidthPx}px">`;
  html += `<div class="timeline timeline-days ${densityClass}">`;

  html += `<div class="timeline-weight-bg" style="grid-template-columns:${gridCols}">`;
  html += '<div class="timeline-weight-spacer"></div>';
  days.forEach((day) => {
    const meta = dayWeightMeta(day, dayWeights, maxDayWeight);
    html += `<div class="timeline-weight-day" style="${meta.style}" data-day-weight="${meta.weight}" title="${escapeAttr(meta.title)}"></div>`;
  });
  html += "</div>";

  html += `<div class="timeline-header" style="grid-template-columns:${gridCols}">`;
  html += '<div class="timeline-label">Task</div>';
  days.forEach((day, i) => {
    const showLabel = i % tickEvery === 0;
    const isMonthStart = day.getDate() === 1;
    const isWeekStart = day.getDay() === 1;
    const label = showLabel ? formatDayTick(day, tickEvery, timelineDayWidth) : "";
    const meta = dayWeightMeta(day, dayWeights, maxDayWeight);
    const classes = [
      "timeline-tick",
      "timeline-tick-day",
      showLabel ? "has-label" : "",
      isMonthStart ? "month-start" : "",
      isWeekStart ? "week-start" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const dateTitle = day.toLocaleDateString(undefined, {
      weekday: "short",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    html += `<div class="${classes}" style="${meta.style}" data-day-weight="${meta.weight}" title="${escapeAttr(`${dateTitle} · ${meta.title}`)}">${label}</div>`;
  });
  html += "</div>";

  for (const d of items) {
    const rangeStart = startOfDay(d.range.start);
    const rangeEnd = startOfDay(d.range.end);
    const leftPct = (dayOffset(minDate, rangeStart) / daySpan) * 100;
    const spanDays = countDaysInclusive(rangeStart, rangeEnd);
    const widthPct = Math.max(100 / numDays, (spanDays / numDays) * 100);
    const color = colorFor(colorMode === "course" ? d.course : d.type, colorMode);
    const label = `${d.course} · ${d.task}`;
    const startStr = formatDateInput(d.range.start);
    const endStr = formatDateInput(d.range.end);

    html += `<div class="timeline-row" style="grid-template-columns:${gridCols}">`;
    html += `<div class="timeline-label" title="${escapeAttr(label)}">${label}</div>`;
    html += '<div class="timeline-track" style="grid-column: 2 / -1;">';
    html += `<div class="timeline-bar" style="left:${leftPct}%;width:${widthPct}%;background:${color}"
      data-course="${escapeAttr(d.course)}"
      data-task="${escapeAttr(d.task)}"
      data-type="${escapeAttr(d.type)}"
      data-weight="${d.weight}"
      data-start="${startStr}"
      data-end="${endStr}"></div>`;
    html += "</div></div>";
  }

  html += "</div></div>";
  scroll.innerHTML = html;
  wireBarTooltips(scroll);
  wireColumnTooltips(scroll);
  wireTodayMarkerScroll();
  updateTodayMarker();

  if (viewport) {
    const upcomingCount = countDeliverablesInNextMonth(items, today);
    const viewportHeight = computeTimelineViewportHeight(upcomingCount, items.length);
    viewport.style.height = `${viewportHeight}px`;
    viewport.dataset.upcomingRows = String(upcomingCount);
    viewport.style.setProperty("--timeline-label-width", `${labelWidth}px`);
  }

  updateZoomSliderBounds();
  setupViewportResize();
}

function wireTimelineZoom() {
  if (timelineZoomWired) return;
  timelineZoomWired = true;

  const slider = document.getElementById("timeline-zoom");

  slider?.addEventListener("input", () => {
    setTimelineDayWidth(Number(slider.value), { save: false, render: true });
  });
  slider?.addEventListener("change", () => savePersisted());

  setupViewportResize();
  wireTimelineDragScroll();
}

let timelineDragWired = false;

function wireTimelineDragScroll() {
  const viewport = document.querySelector(".timeline-viewport");
  if (!viewport || timelineDragWired) return;
  timelineDragWired = true;

  let dragging = false;
  let startX = 0;
  let startY = 0;
  let scrollStartLeft = 0;
  let scrollStartTop = 0;

  const shouldIgnoreDrag = (target) => {
    if (target.closest(".timeline-bar")) return true;
    if (target.closest("input, button, select, a, label, .course-chip")) return true;
    return false;
  };

  viewport.addEventListener("mousedown", (e) => {
    if (e.button !== 0 || shouldIgnoreDrag(e.target)) return;
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    scrollStartLeft = viewport.scrollLeft;
    scrollStartTop = viewport.scrollTop;
    viewport.classList.add("is-drag-scrolling");
  });

  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    viewport.scrollLeft = scrollStartLeft - (e.clientX - startX);
    viewport.scrollTop = scrollStartTop - (e.clientY - startY);
    updateTodayMarker();
  });

  window.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    viewport.classList.remove("is-drag-scrolling");
  });
}

function wireColumnTooltips(scroll) {
  const tooltip = document.getElementById("bar-tooltip");
  if (!tooltip || !scroll) return;

  const hide = () => {
    tooltip.hidden = true;
  };

  scroll.querySelectorAll("[data-day-weight]").forEach((cell) => {
    cell.addEventListener("mouseenter", (e) => {
      const w = Number(cell.dataset.dayWeight);
      const weightLabel = w > 0 ? `${w.toFixed(2)}%` : "0%";
      tooltip.innerHTML = `
        <p class="tooltip-weight">${escapeAttr(weightLabel)}</p>
        <p class="tooltip-title">Total weight due this day</p>
      `;
      tooltip.hidden = false;
      positionTooltip(tooltip, e.clientX, e.clientY);
    });
    cell.addEventListener("mousemove", (e) => positionTooltip(tooltip, e.clientX, e.clientY));
    cell.addEventListener("mouseleave", hide);
  });
}

function wireBarTooltips(container) {
  const tooltip = document.getElementById("bar-tooltip");
  if (!tooltip) return;

  const hide = () => {
    tooltip.hidden = true;
  };

  const show = (bar, clientX, clientY) => {
    const course = bar.dataset.course ?? "";
    const task = bar.dataset.task ?? "";
    const type = bar.dataset.type ?? "";
    const weight = Number(bar.dataset.weight);
    const start = bar.dataset.start ?? "";
    const end = bar.dataset.end ?? "";
    const weightLabel = Number.isFinite(weight) ? `${weight}%` : "—";

    tooltip.innerHTML = `
      <p class="tooltip-weight">${escapeAttr(weightLabel)}</p>
      <p class="tooltip-title">${escapeAttr(course)} · ${escapeAttr(task)}</p>
      <p class="tooltip-meta">${escapeAttr(type)}</p>
      <p class="tooltip-dates">${escapeAttr(start)} → ${escapeAttr(end)}</p>
    `;
    tooltip.hidden = false;
    positionTooltip(tooltip, clientX, clientY);
  };

  container.querySelectorAll(".timeline-bar").forEach((bar) => {
    bar.addEventListener("mouseenter", (e) => show(bar, e.clientX, e.clientY));
    bar.addEventListener("mousemove", (e) => show(bar, e.clientX, e.clientY));
    bar.addEventListener("mouseleave", hide);
  });
}

function positionTooltip(tooltip, clientX, clientY) {
  const pad = 12;
  tooltip.style.visibility = "hidden";
  tooltip.style.left = "0";
  tooltip.style.top = "0";
  const rect = tooltip.getBoundingClientRect();
  tooltip.style.visibility = "";

  let x = clientX + pad;
  let y = clientY + pad;

  if (x + rect.width > window.innerWidth - pad) {
    x = clientX - rect.width - pad;
  }
  if (y + rect.height > window.innerHeight - pad) {
    y = clientY - rect.height - pad;
  }

  tooltip.style.left = `${Math.max(pad, x)}px`;
  tooltip.style.top = `${Math.max(pad, y)}px`;
}

// --- editor ---

function renderEditor() {
  const tbody = document.getElementById("editor-body");
  if (!tbody) return;
  tbody.innerHTML = "";

  deliverables.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.dataset.id = row.id;

    tr.innerHTML = `
      <td><input data-field="course" value="${escapeAttr(row.course)}" placeholder="ECE457A" /></td>
      <td><input data-field="type" list="type-suggestions" value="${escapeAttr(row.type)}" /></td>
      <td><input data-field="task" value="${escapeAttr(row.task)}" placeholder="Assignment 1" /></td>
      <td><input data-field="startDate" type="date" value="${row.startDate ?? ""}" /></td>
      <td><input data-field="endDate" type="date" value="${row.endDate ?? ""}" /></td>
      <td class="col-weight"><input data-field="weight" type="number" min="0" step="0.01" value="${row.weight}" /></td>
      <td class="col-actions"><button type="button" class="icon-btn" data-action="delete" title="Remove">×</button></td>
    `;

    tr.querySelectorAll("input").forEach((input) => {
      input.addEventListener("change", () => commitRowFromDom(tr, index));
      input.addEventListener("blur", () => commitRowFromDom(tr, index));
    });

    tr.querySelector('[data-action="delete"]')?.addEventListener("click", () => {
      deliverables = deliverables.filter((d) => d.id !== row.id);
      refresh();
    });

    tbody.appendChild(tr);
  });

  let dl = document.getElementById("type-suggestions");
  if (!dl) {
    dl = document.createElement("datalist");
    dl.id = "type-suggestions";
    document.body.appendChild(dl);
  }
  dl.innerHTML = [...new Set(deliverables.map((d) => d.type).filter(Boolean))]
    .map((t) => `<option value="${escapeAttr(t)}"></option>`)
    .join("");
}

function commitRowFromDom(tr, index) {
  const get = (field) => tr.querySelector(`[data-field="${field}"]`)?.value ?? "";

  deliverables[index] = normalizeRow({
    id: tr.dataset.id,
    course: get("course"),
    type: get("type"),
    task: get("task"),
    startDate: get("startDate") || null,
    endDate: get("endDate") || null,
    weight: get("weight"),
  });

  refresh({ skipEditor: true });
  renderEditor();
}

function addRow() {
  deliverables.push(
    normalizeRow({
      course: "",
      type: "Assignment",
      task: "New task",
      startDate: null,
      endDate: null,
      weight: 0,
    })
  );
  refresh();
}

function refresh(opts = {}) {
  savePersisted();
  renderCourseFilter();
  renderTimeline();
  if (!opts.skipEditor) renderEditor();
}

async function exportJson() {
  const text = JSON.stringify(
    { deliverables, selectedCourses: [...selectedCourses], timelineDayWidth },
    null,
    2
  );

  if (desktop) {
    const result = await window.coursePlanner.exportJson(text);
    if (!result.canceled && result.filePath) {
      alert(`Exported to ${result.filePath}`);
    }
    return;
  }

  const blob = new Blob([text], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "course-deliverables.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importJsonFromFile(file) {
  const text = await file.text();
  applyImportedJson(JSON.parse(text));
}

function applyImportedJson(data) {
  if (Array.isArray(data)) {
    deliverables = data.map(normalizeRow);
    selectedCourses = new Set(uniqueCourses());
  } else {
    if (!Array.isArray(data.deliverables)) throw new Error("Expected deliverables array");
    deliverables = data.deliverables.map(normalizeRow);
    syncSelectionFromStored(data.selectedCourses);
    if (data.timelineDayWidth != null) applyTimelineDayWidth(data.timelineDayWidth);
  }
  refresh();
  alert(`Imported ${deliverables.length} deliverables.`);
}

async function importJson() {
  if (desktop) {
    const result = await window.coursePlanner.importJson();
    if (result.canceled) return;
    applyImportedJson(result.data);
    return;
  }
  document.getElementById("import-file")?.click();
}

async function resetToSeed() {
  if (!confirm("Replace all deliverables with the built-in seed data?")) return;
  deliverables = await loadSeed();
  selectedCourses = new Set(uniqueCourses());
  refresh();
}

async function init() {
  const persisted = await loadPersisted();
  if (persisted) {
    deliverables = persisted.deliverables;
    syncSelectionFromStored(persisted.selectedCourses);
    if (persisted.timelineDayWidth != null) {
      applyTimelineDayWidth(persisted.timelineDayWidth);
    }
  } else {
    deliverables = await loadSeed();
    selectedCourses = new Set(uniqueCourses());
  }

  if (desktop) {
    document.body.classList.add("is-desktop");
    dataFilePath = await window.coursePlanner.getDataPath();
    const hint = document.getElementById("editor-hint");
    if (hint) {
      hint.textContent = "Changes save automatically to your user data folder.";
    }
  }

  lastKnownCourses = new Set(uniqueCourses());
  refresh();

  document.getElementById("btn-add-row")?.addEventListener("click", addRow);
  document.getElementById("btn-export")?.addEventListener("click", exportJson);
  document.getElementById("btn-import")?.addEventListener("click", importJson);
  document.getElementById("btn-reset")?.addEventListener("click", resetToSeed);

  document.getElementById("import-file")?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        await importJsonFromFile(file);
      } catch (err) {
        alert(`Import failed: ${err.message}`);
      }
    }
    e.target.value = "";
  });

  document.getElementById("timeline-color")?.addEventListener("change", renderTimeline);
  document.getElementById("course-select-all")?.addEventListener("click", selectAllCourses);
  document.getElementById("course-select-none")?.addEventListener("click", selectNoCourses);
}

init().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<p class="fatal-error">Failed to start: ${err.message}</p>`
  );
});
