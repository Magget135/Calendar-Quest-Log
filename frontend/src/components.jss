/*
  components.jss
  Monolithic components file for Google Calendar UI replica (frontend-only)
  - No backend calls
  - TailwindCSS classes for styling
  - All data mocked locally
  - HTML entities have been converted to proper JSX syntax
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import axios from "axios";

/********************** Utils **********************/
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d, n) => {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
};
const addMonths = (d, n) => {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + n);
  return nd;
};
const addYears = (d, n) => {
  const nd = new Date(d);
  nd.setFullYear(nd.getFullYear() + n);
  return nd;
};
const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseISOish = (s) => new Date(s);
const getWeekStart = (d, weekStartsOnSunday = true) => {
  const day = d.getDay(); // 0 Sun - 6 Sat
  const diff = weekStartsOnSunday ? -day : (day === 0 ? -6 : 1 - day);
  const nd = new Date(d);
  nd.setDate(d.getDate() + diff);
  nd.setHours(0,0,0,0);
  return nd;
};
const clamp = (val, min, max) => Math.max(min, Math.min(val, max));

// range helpers
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart <= bEnd && aEnd >= bStart;
const addInterval = (date, frequency) => {
  switch (frequency) {
    case "daily": return addDays(date, 1);
    case "weekly": return addDays(date, 7);
    case "monthly": return addMonths(date, 1);
    case "yearly": return addYears(date, 1);
    default: return date;
  }
};

const isRecurring = (freq) => ["daily", "weekly", "monthly", "yearly"].includes((freq || "").toLowerCase());

// Expand recurring events into individual instances within [rangeStart, rangeEnd]
const expandRecurringEvents = (events, rangeStart, rangeEnd) => {
  const out = [];
  const maxIters = 500; // safety cap
  for (const e of events) {
    const freq = (e.frequency || "none").toLowerCase();
    const baseStart = e.start instanceof Date ? e.start : parseISOish(e.start);
    const baseEnd = e.end instanceof Date ? e.end : parseISOish(e.end);
    if (!isRecurring(freq)) {
      // push original if it intersects the range
      if (overlaps(baseStart, baseEnd, rangeStart, rangeEnd)) out.push(e);
      continue;
    }
    let occStart = new Date(baseStart);
    let occEnd = new Date(baseEnd);
    let iter = 0;
    // Optional fast-forward to near rangeStart (simple skips for daily/weekly)
    if (freq === "daily" || freq === "weekly") {
      const step = freq === "daily" ? 1 : 7;
      const diffDays = Math.floor((rangeStart - baseStart) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        const skips = Math.floor(diffDays / step);
        if (skips > 0) {
          occStart = addDays(occStart, skips * step);
          occEnd = addDays(occEnd, skips * step);
        }
      }
    } else if (freq === "monthly") {
      // naive fast-forward by months difference
      const monthsDiff = (rangeStart.getFullYear() - baseStart.getFullYear()) * 12 + (rangeStart.getMonth() - baseStart.getMonth());
      if (monthsDiff > 0) {
        occStart = addMonths(occStart, monthsDiff);
        occEnd = addMonths(occEnd, monthsDiff);
      }
    } else if (freq === "yearly") {
      const yearsDiff = rangeStart.getFullYear() - baseStart.getFullYear();
      if (yearsDiff > 0) {
        occStart = addYears(occStart, yearsDiff);
        occEnd = addYears(occEnd, yearsDiff);
      }
    }

    while (iter < maxIters && occStart <= rangeEnd) {
      if (overlaps(occStart, occEnd, rangeStart, rangeEnd)) {
        out.push({
          ...e,
          start: toISO(occStart),
          end: toISO(occEnd),
          _key: `${e.id}@${occStart.toISOString()}`,
        });
      }
      // advance
      occStart = addInterval(occStart, freq);
      occEnd = addInterval(occEnd, freq);
      iter++;
    }
  }
  return out;
};

// Expand recurring tasks within range
const expandRecurringTasks = (tasks, rangeStart, rangeEnd) => {
  const out = [];
  const maxIters = 500;
  for (const t of tasks) {
    const freq = (t.frequency || "none").toLowerCase();
    const baseDate = t.date instanceof Date ? t.date : parseISOish(t.date);
    if (!isRecurring(freq)) {
      if (overlaps(baseDate, baseDate, rangeStart, rangeEnd)) out.push(t);
      continue;
    }
    let occ = new Date(baseDate);
    let iter = 0;
    if (freq === "daily" || freq === "weekly") {
      const step = freq === "daily" ? 1 : 7;
      const diffDays = Math.floor((rangeStart - baseDate) / (1000 * 60 * 60 * 24));
      if (diffDays > 0) {
        const skips = Math.floor(diffDays / step);
        if (skips > 0) occ = addDays(occ, skips * step);
      }
    } else if (freq === "monthly") {
      const monthsDiff = (rangeStart.getFullYear() - baseDate.getFullYear()) * 12 + (rangeStart.getMonth() - baseDate.getMonth());
      if (monthsDiff > 0) occ = addMonths(occ, monthsDiff);
    } else if (freq === "yearly") {
      const yearsDiff = rangeStart.getFullYear() - baseDate.getFullYear();
      if (yearsDiff > 0) occ = addYears(occ, yearsDiff);
    }

    while (iter < maxIters && occ <= rangeEnd) {
      if (overlaps(occ, occ, rangeStart, rangeEnd)) {
        out.push({
          ...t,
          date: toISO(occ),
          _key: `${t.id}@${occ.toISOString()}`,
        });
      }
      occ = addInterval(occ, freq);
      iter++;
    }
  }
  return out;
};

/********************** Colors & Fonts **********************/
export const GC_COLORS = {
  primary: "#000000",
  primaryDark: "#111111",
  text: "#000000",
  mutedText: "#6b7280",
  border: "#e5e7eb",
  bg: "#ffffff",
  subBg: "#fafafa",
  now: "#000000",
};
export const EVENT_COLORS = [
  "#7986cb", "#33b679", "#8e24aa", "#e67c73", "#f4511e",
  "#f6c026", "#0b8043", "#3f51b5", "#039be5", "#616161"
];

// Minimal aesthetic palette for events (user-selectable)
const EVENT_COLOR_PALETTE = [
  // neutrals
  "#111827", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB",
  // warms
  "#EF4444", "#F97316", "#F59E0B", "#EAB308",
  // greens/teals
  "#84CC16", "#22C55E", "#10B981", "#14B8A6",
  // cyans/blues/indigo
  "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  // violets/fuchsia/pinks
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E",
];

/********************** Mock Data **********************/
const today = new Date();
const weekStart = getWeekStart(today, true);
const defaultCalendars = [
  { id: "cal-1", name: "My Calendar", color: "#111111", checked: true },
  { id: "cal-2", name: "Product", color: "#6b7280", checked: true },
  { id: "cal-3", name: "Personal", color: "#9ca3af", checked: true },
  { id: "cal-4", name: "Fitness", color: "#374151", checked: false },
];

let idCounter = 1000;
const makeId = () => `evt-${idCounter++}`;

const seedEvents = [
  {
    id: makeId(),
    title: "Standup",
    start: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+1, 9, 30)),
    end: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+1, 10, 0)),
    allDay: false,
    calendarId: "cal-2",
    frequency: "daily",
  },
  {
    id: makeId(),
    title: "Design Review",
    start: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+2, 13, 0)),
    end: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+2, 14, 30)),
    allDay: false,
    calendarId: "cal-1",
    frequency: "none",
  },
  {
    id: makeId(),
    title: "Team Lunch",
    start: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+3, 12, 0)),
    end: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+3, 13, 0)),
    allDay: false,
    calendarId: "cal-3",
    frequency: "weekly",
  },
  {
    id: makeId(),
    title: "Conference",
    start: toISO(addDays(weekStart, 2)),
    end: toISO(addDays(weekStart, 4)),
    allDay: true,
    calendarId: "cal-1",
    frequency: "none",
  },
  {
    id: makeId(),
    title: "Workout",
    start: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+5, 18, 0)),
    end: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+5, 19, 0)),
    allDay: false,
    calendarId: "cal-4",
    frequency: "monthly",
  },
];

// Seed tasks (separate from events)
let taskIdCounter = 5000;
const makeTaskId = () => `task-${taskIdCounter++}`;
const seedTasks = [
  { id: makeTaskId(), title: "Pay bills", date: toISO(addDays(weekStart, 1)), status: "pending", color: "#000000", category: "Personal", frequency: "weekly", allDay: false },
  { id: makeTaskId(), title: "Draft PRD", date: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+2, 15, 0)), status: "incomplete", color: "#000000", category: "Work", frequency: "none", allDay: false },
  { id: makeTaskId(), title: "Buy groceries", date: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+3, 17, 30)), status: "completed", color: "#000000", category: "Personal", frequency: "none", allDay: false },
  { id: makeTaskId(), title: "Call plumber", date: toISO(addDays(weekStart, 4)), status: "pending", color: "#000000", category: "Home", frequency: "daily", allDay: false },
];

/********************** Icons **********************/
const Icon = ({ name, className = "w-5 h-5" }) => {
  const props = { className, fill: "none", stroke: "currentColor", strokeWidth: 1.8 };
  switch (name) {
    case "menu":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
        </svg>
      );
    case "chev-left":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "chev-right":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <circle cx="11" cy="11" r="7" strokeLinecap="round" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      );
    case "help":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M12 18h.01M9.09 9a3 3 0 115.83 1c-.5.9-1.33 1.3-1.92 1.75-.37.28-.67.64-.86 1.06-.14.31-.24.65-.24 1.19" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7z" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06c.46-.46.6-1.14.33-1.82.27-.6.88-1 1.58-1H21a2 2 0 010 4h-.09c-.7 0-1.31.4-1.51 1z" />
        </svg>
      );
    case "apps":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <circle cx="5" cy="5" r="2" />
          <circle cx="12" cy="5" r="2" />
          <circle cx="19" cy="5" r="2" />
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="12" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
        </svg>
      );
    case "plus":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "dot":
      return (
        <svg viewBox="0 0 24 24" {...props}>
          <circle cx="12" cy="12" r="5" fill="currentColor" />
        </svg>
      );
    default:
      return null;
  }
};

/********************** Top Bar **********************/
export const TopBar = ({ title, onPrev, onNext, onToday, view, setView }) => {
  return (
    <div className="w-full border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="flex items-center justify-between px-6 h-14">
        <div className="flex items-center gap-3">
          <button className="p-2 rounded hover:bg-gray-100" aria-label="Menu">
            <Icon name="menu" />
          </button>
          <div className="flex items-center gap-2 select-none">
            <div className="w-6 h-6 rounded-md bg-black grid place-items-center text-white font-bold">31</div>
            <div className="text-[18px] font-medium tracking-tight">Calendar</div>
          </div>
          <div className="hidden md:flex items-center gap-2 ml-4">
            <button onClick={onPrev} className="p-1.5 rounded hover:bg-gray-100" aria-label="Previous">
              <Icon name="chev-left" />
            </button>
            <button onClick={onNext} className="p-1.5 rounded hover:bg-gray-100" aria-label="Next">
              <Icon name="chev-right" />
            </button>
            <button onClick={onToday} className="ml-2 px-3 py-1.5 border rounded text-sm hover:bg-gray-50">Today</button>
            <div className="ml-3 text-[20px] font-semibold tracking-tight" data-testid="current-range">{title}</div>
          </div>
        </div>

        <div className="flex-1 max-w-[520px] mx-4 hidden md:flex items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Icon name="search" /></span>
            <input className="w-full pl-10 pr-3 py-2 bg-gray-100 rounded-full outline-none text-sm focus:ring-2 focus:ring-black" placeholder="Search" />
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <button className="p-2 rounded hover:bg-gray-100" aria-label="Help"><Icon name="help" /></button>
          <button className="p-2 rounded hover:bg-gray-100" aria-label="Settings"><Icon name="settings" /></button>
          <button className="p-2 rounded hover:bg-gray-100" aria-label="Apps"><Icon name="apps" /></button>
          <div className="w-8 h-8 rounded-full bg-black grid place-items-center text-white text-xs font-bold ml-1">JD</div>
        </div>
      </div>

      <div className="md:hidden flex items-center gap-2 px-4 pb-3">
        <button onClick={onPrev} className="p-1.5 rounded hover:bg-gray-100" aria-label="Previous"><Icon name="chev-left" /></button>
        <button onClick={onNext} className="p-1.5 rounded hover:bg-gray-100" aria-label="Next"><Icon name="chev-right" /></button>
        <button onClick={onToday} className="px-3 py-1 border rounded text-sm">Today</button>
        <div className="text-[18px] font-semibold">{title}</div>
      </div>

      <div className="px-6 py-2 border-t border-gray-100 flex items-center gap-2">
        <ViewToggle view={view} setView={setView} />
      </div>
    </div>
  );
};

const ViewToggle = ({ view, setView }) => {
  const opt = ["Day", "Week", "Month", "Schedule"]; // schedule is placeholder
  return (
    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden" role="tablist">
      {opt.map((o) => {
        const active = view === o.toLowerCase();
        return (
          <button key={o} onClick={() => setView(o.toLowerCase())} className={`px-3 py-1.5 text-sm ${active ? "bg-black text-white" : "bg-white text-black hover:bg-gray-50"}`}>{o}</button>
        );
      })}
    </div>
  );
};

/********************** Left Nav (new) **********************/
export const LeftNav = ({ collapsed = false, onToggle }) => {
  const items = [
    { label: "ActiveQuests", path: "/active-quests" },
    { label: "CompletedQuests", path: "/completed-quests" },
    { label: "RewardStore", path: "/reward-store" },
    { label: "RedeemRewards", path: "/redeem-rewards" },
    { label: "RewardLog", path: "/reward-log" },
    { label: "Recurringtasks", path: "/recurringtasks" },
    { label: "Inventory", path: "/inventory" },
    { label: "Rules", path: "/rules" },
    { label: "Trash/Archive", path: "/trash-archive" },
    { label: "Settings", path: "/settings" },
  ];
  const location = useLocation();
  return (
    <aside className={`relative shrink-0 border-r border-gray-200 bg-white hidden md:block transition-all duration-200 ${collapsed ? "w-[40px]" : "w-[200px]"}`}>
      <div className={`p-4 space-y-2 ${collapsed ? "p-2" : "p-4"}`}>
      {/* Collapse toggle button */}
      <button onClick={onToggle} aria-label="Toggle LeftNav" className="absolute -right-3 top-4 z-10 w-6 h-6 rounded-full border bg-white text-gray-600 hover:bg-gray-50 grid place-items-center shadow">
        <span className="transform">{collapsed ? "›" : "‹"}</span>
      </button>
              {collapsed ? item.label.charAt(0) : item.label}


        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} className={`block rounded font-medium text-sm border ${collapsed ? "px-0 py-2 text-center" : "px-3 py-2"} ${active ? "bg-black text-white border-black" : "text-black border-transparent hover:bg-gray-100"}`}>
              {item.label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
};

/********************** Left Sidebar **********************/
export const LeftSidebar = ({ date, onDateChange, onCreate, calendars, setCalendars, showTasks, setShowTasks, collapsed = false, onToggle }) => {
  const [legendOpen, setLegendOpen] = useState(false);
  const [presetsOpen, setPresetsOpen] = useState(false);
  return (
    <aside className={`relative shrink-0 border-r border-gray-200 bg-white hidden lg:block transition-all duration-200 ${collapsed ? "w-[40px]" : "w-[300px]"}`}>
      <div className="p-4">
        <button data-testid="create" onClick={() => onCreate({ start: new Date(), end: addDays(new Date(), 0), allDay: false })} className="w-full flex items-center justify-center gap-2 bg-black hover:bg-gray-900 text-white rounded-md py-2.5 shadow-sm transition">
          <Icon name="plus" className="w-5 h-5" />
          <span className="font-medium">Create</span>
        </button>
      </div>

      <div className="px-3 pb-4">
        <MiniMonth date={date} onDateChange={onDateChange} />
      </div>

      <div className="px-3 pb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">My calendars</div>
          <button className="text-xs underline text-gray-600 hover:text-black" onClick={() => setPresetsOpen(true)}>Manage presets</button>
        </div>
        <div className="space-y-2">
          {calendars.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 text-sm text-gray-800 select-none">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={c.checked} onChange={(e) => setCalendars((prev) => prev.map(p => p.id === c.id ? { ...p, checked: e.target.checked } : p))} />
                <span className="inline-block w-3 h-3 rounded" style={{ background: c.color }} />
                <span>{c.name}</span>
              </label>
              <PresetQuickApply calendars={calendars} onApply={(presetColor) => setCalendars(prev => prev.map(p => p.id === c.id ? { ...p, color: presetColor } : p))} />
            </div>
          ))}
        </div>
      </div>

      <div className="px-3 pb-6 border-t border-gray-100 pt-4 relative">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tasks</div>
          <button className="text-xs text-gray-600 hover:text-black" onClick={() => setLegendOpen((v) => !v)}>Legend</button>
        </div>
        {legendOpen && <TaskLegend />}
        <label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none mt-2">
          <input type="checkbox" checked={showTasks} onChange={(e) => setShowTasks(e.target.checked)} />
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded bg-gray-400" />
            Show tasks on calendar
          </span>
        </label>
      </div>

      {presetsOpen && <PresetsModal onClose={() => setPresetsOpen(false)} onApplyToCalendar={(calendarId, color) => setCalendars(prev => prev.map(p => p.id === calendarId ? { ...p, color } : p))} calendars={calendars} />}
    </aside>
  );
};

const MiniMonth = ({ date, onDateChange }) => {
  const [cursor, setCursor] = useState(startOfDay(new Date(date)));

  useEffect(() => { setCursor(startOfDay(new Date(date))); }, [date]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = getWeekStart(first, true);
  const days = [...Array(42)].map((_, i) => addDays(start, i));

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-white">
        <button className="p-1 rounded hover:bg-gray-100" onClick={() => setCursor(addMonths(cursor, -1))}><Icon name="chev-left" /></button>
        <div className="text-sm font-medium">{cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}</div>
        <button className="p-1 rounded hover:bg-gray-100" onClick={() => setCursor(addMonths(cursor, 1))}><Icon name="chev-right" /></button>
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200 text-[11px] text-gray-500">
        {["S","M","T","W","T","F","S"].map((d, i) => (
          <div key={`${d}-${i}`} className="bg-white px-2 py-1 text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {days.map((d, idx) => {
          const isOther = d.getMonth() !== month;
          const isToday = sameDay(d, new Date());
          const isSelected = sameDay(d, date);
          return (
            <button key={idx} onClick={() => onDateChange(d)} className={`aspect-[1/0.8] bg-white p-2 text-left hover:bg-gray-50 focus:outline-none ${isSelected ? "ring-2 ring-black" : ""}`}>
              <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] ${isToday ? "text-white bg-black" : "text-gray-800"} ${isOther ? "opacity-40" : ""}`}>{d.getDate()}</div>
              <div className="mt-1 flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-gray-800" />
                <span className="w-1 h-1 rounded-full bg-gray-500" />
                <span className="w-1 h-1 rounded-full bg-gray-400" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/********************** Calendar Grids **********************/
export const CalendarView = ({ view, date, events, calendars, onCreate, onEdit, tasks = [], showTasks = true, onToggleTaskStatus, onEditTask }) => {
  if (view === "day") return <DayView date={date} events={events} calendars={calendars} onCreate={onCreate} onEdit={onEdit} tasks={tasks} showTasks={showTasks} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} />;
  if (view === "week") return <WeekView date={date} events={events} calendars={calendars} onCreate={onCreate} onEdit={onEdit} tasks={tasks} showTasks={showTasks} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} />;
  if (view === "month") return <MonthView date={date} events={events} calendars={calendars} onCreate={onCreate} onEdit={onEdit} tasks={tasks} showTasks={showTasks} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} />;
  return <SchedulePlaceholder />;
};

const hours = [...Array(24)].map((_, i) => i);
const HOUR_PX = 64; // visual height per hour for day/week columns

// Auto-scroll helper to bring a target hour into view on initial render
const useAutoScrollToHour = (scrollRef, targetHour) => {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = typeof targetHour === "number" ? targetHour : Math.max(0, new Date().getHours() - 2);
    const measureAndScroll = () => {
      const hourCell = el.querySelector('[data-hour="8"]') || el.querySelector('[data-hour="0"]');
      const hourHeight = hourCell ? hourCell.offsetHeight : HOUR_PX;
      const y = Math.max(0, t * hourHeight - 40);
      el.scrollTo({ top: y, behavior: "smooth" });
    };
    const id = setTimeout(measureAndScroll, 60);
    return () => clearTimeout(id);
  }, [scrollRef, targetHour]);
};

const NowIndicator = ({ date }) => {
  // Only render for today in Day/Week views
  const [top, setTop] = useState(0);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const pct = minutes / (24 * 60);
      setTop(pct * 100);
    };
    tick();
    const t = setInterval(tick, 60 * 1000);
    return () => clearInterval(t);
  }, []);
  const isToday = sameDay(date, new Date());
  if (!isToday) return null;
  return (
    <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${top}%` }}>
      <div className="absolute -left-2 w-2 h-2 bg-black rounded-full" />
      <div className="border-t-2 border-black" />
    </div>
  );
};

const filterEventsByCalendars = (events, calendars) => {
  const allowed = new Set(calendars.filter(c => c.checked).map(c => c.id));
  return events.filter(e => allowed.has(e.calendarId));
};

const DayView = ({ date, events, calendars, onCreate, onEdit, tasks, showTasks, onToggleTaskStatus, onEditTask }) => {
  const rangeStart = startOfDay(date);
  const rangeEnd = endOfDay(date);
  const filtered = useMemo(() => filterEventsByCalendars(events, calendars), [events, calendars]);
  const expanded = useMemo(() => expandRecurringEvents(filtered, rangeStart, rangeEnd), [filtered, rangeStart, rangeEnd]);
  const dayEvents = expanded.filter(e => {
    const s = parseISOish(e.start); const en = parseISOish(e.end);
    return overlaps(s, en, rangeStart, rangeEnd) || (e.allDay && overlaps(s, endOfDay(s), rangeStart, rangeEnd));
  });
  const expandedTasks = useMemo(() => expandRecurringTasks(tasks, rangeStart, rangeEnd), [tasks, rangeStart, rangeEnd]);
  const dayTasksAll = useMemo(() => expandedTasks.filter(t => sameDay(parseISOish(t.date), date)), [expandedTasks, date]);
  const dayAllDayTasks = dayTasksAll.filter(t => t.allDay);
  const dayTimedTasks = dayTasksAll.filter(t => !t.allDay);

  const scrollRef = useRef(null);
  useAutoScrollToHour(scrollRef);
  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
      <div className="grid sticky top-0 z-20 bg-white" style={{ gridTemplateColumns: "64px 1fr" }}>
        <div className="bg-white border-b border-gray-200" />
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <div className="flex flex-col items-start leading-tight">
            <div className="text-xs text-gray-500 font-medium">{date.toLocaleDateString(undefined, { weekday: "short" })}</div>
            <div className={`text-[18px] font-semibold ${sameDay(date, new Date()) ? "text-black" : "text-gray-800"}`}>{date.getDate()}</div>
          </div>
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "64px 1fr" }}>
        <div className="bg-white" />
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <AllDayRow date={date} events={dayEvents.filter(e => e.allDay)} timedEvents={dayEvents.filter(e => !e.allDay)} onEdit={onEdit} calendars={calendars} tasks={showTasks ? dayAllDayTasks : []} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} />
        </div>
      </div>
      <div className="grid" style={{ gridTemplateColumns: "64px 1fr" }}>
        <div className="bg-white">
          {hours.map((h) => (
            <div key={h} data-hour={h} className="h-16 border-t border-gray-100 text-[11px] text-right pr-2 text-gray-500">
              <div className="-mt-2">{h === 0 ? "" : h > 12 ? `${h-12}pm` : h === 12 ? "12pm" : `${h}am`}</div>
            </div>
          ))}
        </div>
        <div className="bg-white border-l border-gray-100">
          <div className="relative" style={{ height: `${hours.length * HOUR_PX}px` }}>
            <div className="absolute inset-0 pointer-events-none">
              {hours.map((h) => (
                <div key={h} className="h-16 border-t border-gray-100" />
              ))}
            </div>
            <div className="absolute inset-0">
              <NowIndicator date={date} />
            </div>
            <div className="absolute inset-0" style={{ zIndex: 10 }}>
              <GridClickCatcher date={date} onCreate={onCreate} />
            </div>
            <div className="absolute inset-0" style={{ zIndex: 20 }}>
              <EventBlocks events={dayEvents.filter(e => !e.allDay)} date={date} onEdit={onEdit} calendars={calendars} />
            </div>
            <div className="absolute inset-0" style={{ zIndex: 25 }}>
              {showTasks && <TaskBlocks tasks={dayTimedTasks} date={date} onEditTask={onEditTask} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const WeekView = ({ date, events, calendars, onCreate, onEdit, tasks, showTasks, onToggleTaskStatus, onEditTask }) => {
  const start = getWeekStart(date, true);
  const end = endOfDay(addDays(start, 6));
  const days = [...Array(7)].map((_, i) => addDays(start, i));
  const filtered = useMemo(() => filterEventsByCalendars(events, calendars), [events, calendars]);
  const expandedEvents = useMemo(() => expandRecurringEvents(filtered, start, end), [filtered, start, end]);
  const byDay = days.map(d => expandedEvents.filter(e => {
    const s = parseISOish(e.start); const en = parseISOish(e.end);
    return overlaps(s, en, startOfDay(d), endOfDay(d)) || (e.allDay && overlaps(s, endOfDay(s), startOfDay(d), endOfDay(d)));
  }));
  const expandedTasks = useMemo(() => expandRecurringTasks(tasks, start, end), [tasks, start, end]);
  const tasksByDayAll = useMemo(() => days.map(d => expandedTasks.filter(t => sameDay(parseISOish(t.date), d))), [expandedTasks, date]);
  const tasksByDayAllDay = tasksByDayAll.map(list => list.filter(t => t.allDay));
  const tasksByDayTimed = tasksByDayAll.map(list => list.filter(t => !t.allDay));

  const scrollRef = useRef(null);
  useAutoScrollToHour(scrollRef);

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
      <div className="grid sticky top-0 z-20 bg-white" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="bg-white border-b border-gray-200" />
        {days.map((d, i) => (
          <div key={i} className="bg-white border-b border-gray-200 px-4 py-2">
            <div className="flex flex-col items-start leading-tight">
              <div className="text-xs text-gray-500 font-medium">{d.toLocaleDateString(undefined, { weekday: "short" })}</div>
              <div className={`text-[18px] font-semibold ${sameDay(d, new Date()) ? "text-black" : "text-gray-800"}`}>{d.getDate()}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="bg-white" />
        {days.map((d, i) => (
          <div key={i} className="bg-white border-b border-gray-200 px-4 py-2">
            <AllDayRow date={d} events={byDay[i].filter(e => e.allDay)} timedEvents={byDay[i].filter(e => !e.allDay)} onEdit={onEdit} calendars={calendars} tasks={showTasks ? tasksByDayAllDay[i] : []} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} />
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="bg-white">
          {hours.map((h) => (
            <div key={h} data-hour={h} className="h-16 border-t border-gray-100 text-[11px] text-right pr-2 text-gray-500">
              <div className="-mt-2">{h === 0 ? "" : h > 12 ? `${h-12}pm` : h === 12 ? "12pm" : `${h}am`}</div>
            </div>
          ))}
        </div>
        {days.map((d, i) => (
          <div key={i} className={`bg-white border-l border-gray-100 ${sameDay(d, new Date()) ? "bg-gray-50" : ""}`}>
            <div className="relative" style={{ height: `${hours.length * HOUR_PX}px` }}>
              <div className="absolute inset-0 pointer-events-none">
                {hours.map((h) => (
                  <div key={h} className="h-16 border-t border-gray-100" />
                ))}
              </div>
              <div className="absolute inset-0">
                <NowIndicator date={d} />
              </div>
              <div className="absolute inset-0" style={{ zIndex: 10 }}>
                <GridClickCatcher date={d} onCreate={onCreate} />
              </div>
              <div className="absolute inset-0" style={{ zIndex: 20 }}>
                <EventBlocks events={byDay[i].filter(e => !e.allDay)} date={d} onEdit={onEdit} calendars={calendars} />
              </div>
              <div className="absolute inset-0" style={{ zIndex: 25 }}>
                {showTasks && <TaskBlocks tasks={tasksByDayTimed[i]} date={d} onEditTask={onEditTask} />}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="bg-white" />
        {days.map((d, i) => (
          <div key={i} className="bg-white border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100`}>
              <span className="font-semibold">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span>{d.getDate()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MonthView = ({ date, events, calendars, onCreate, onEdit, tasks, showTasks, onToggleTaskStatus, onEditTask }) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = getWeekStart(first, true);
  const days = [...Array(42)].map((_, i) => addDays(start, i));
  const end = endOfDay(days[41]);
  const filtered = useMemo(() => filterEventsByCalendars(events, calendars), [events, calendars]);
  const expanded = useMemo(() => expandRecurringEvents(filtered, start, end), [filtered, start, end]);
  const expandedTasks = useMemo(() => expandRecurringTasks(tasks, start, end), [tasks, start, end]);

  const grouped = useMemo(() => {
    const m = new Map();
    days.forEach((d) => {
      const key = d.toDateString();
      m.set(key, { events: [], tasks: [] });
    });
    expanded.forEach((e) => {
      const s = startOfDay(parseISOish(e.start));
      const until = e.allDay ? endOfDay(parseISOish(e.end)) : endOfDay(parseISOish(e.start));
      for (let d = new Date(s); d <= until; d = addDays(d, 1)) {
        const key = d.toDateString();
        if (m.has(key)) m.get(key).events.push(e);
      }
    });
    expandedTasks.forEach((t) => {
      const d = startOfDay(parseISOish(t.date));
      const key = d.toDateString();
      if (m.has(key)) m.get(key).tasks.push(t);
    });
    return m;
  }, [expanded, expandedTasks, date]);

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 gap-px bg-gray-200 text-xs">
        {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d) => (
          <div key={d} className="bg-white px-3 py-2 text-gray-600 font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200">
        {days.map((d, idx) => {
          const other = d.getMonth() !== date.getMonth();
          const key = d.toDateString();
          const evs = grouped.get(key)?.events || [];
          const tks = grouped.get(key)?.tasks || [];
          return (
            <div key={idx} className={`bg-white min-h-[160px] hover:bg-gray-50 transition ${sameDay(d, new Date()) ? "outline outline-2 outline-black -outline-offset-2" : ""}`}>
              <div className="flex items-center justify-between px-2 py-1">
                <button data-testid="month-date" onClick={() => onCreate({ start: d, end: d, allDay: true })} className={`text-xs font-medium px-1.5 py-0.5 rounded ${other ? "text-gray-400" : "text-gray-700"}`}>{d.getDate()}</button>
              </div>
              <div className="px-2 pb-2 space-y-1">
                {evs.slice(0, 3).map((e) => (
                  <button key={e._key || e.id} onClick={() => onEdit(e)} className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 text-left border-l-4" style={{ borderLeftColor: getEventColor(e, calendars) }}>
                    <span className="inline-block text-[10px] uppercase tracking-wide text-gray-500">Event</span>
                    <span className="truncate text-[12px] text-black">{e.title}</span>
                  </button>
                ))}
                {evs.length > 3 && (
                  <div className="text-xs text-gray-700">+{evs.length - 3} more</div>
                )}

                {showTasks && (
                  <div className="mt-1 space-y-1">
                    {tks.slice(0, 2).map((t) => (
                      <button key={t._key || t.id} onClick={() => onEditTask && onEditTask(t)} className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 text-left border-l-4" style={{ borderLeftColor: taskDueStripeColor(parseISOish(t.date)) }}>
                        <span className="inline-block text-[10px] uppercase tracking-wide text-gray-500">Task</span>
                        <span className="truncate text-[12px] text-black">{timeBadge(parseISOish(t.date))} {t.title}</span>
                      </button>
                    ))}
                    {tks.length > 2 && (
                      <div className="text-xs text-gray-700">+{tks.length - 2} more tasks</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AllDayRow = ({ date, events, timedEvents = [], onEdit, calendars, tasks = [], onToggleTaskStatus, onEditTask }) => {
  return (
    <div className="min-h-[38px] flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {events.map((e) => (
          <button key={e._key || e.id} onClick={() => onEdit(e)} className="px-2 py-0.5 rounded text-[12px] bg-white text-black border border-gray-200 hover:bg-gray-50 shadow-sm">
            <span className="mr-2 inline-block w-2 h-2 rounded-full" style={{ background: getEventColor(e, calendars) }} />
            <span className="uppercase text-[10px] text-gray-500 mr-1">Event</span>
            {e.title}
          </button>
        ))}
      </div>
      {timedEvents.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {timedEvents.slice(0, 2).map((e) => {
            const s = parseISOish(e.start);
            return (
              <button key={`t-${e._key || e.id}`} onClick={() => onEdit(e)} className="px-1.5 py-0.5 rounded bg-white hover:bg-gray-50 text-[11px] text-black border border-gray-200 inline-flex items-center gap-1">
                <span className="inline-block w-1.5 h-4 rounded-sm" style={{ background: getEventColor(e, calendars) }} />
                <span className="uppercase text-[9px] text-gray-500">Event</span>
                <span>{toTimeLabel(s)} {e.title}</span>
              </button>
            );
          })}
          {timedEvents.length > 2 && (
            <div className="text-[11px] text-gray-700">+{timedEvents.length - 2} more</div>
          )}
        </div>
      )}

      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {tasks.slice(0, 3).map((t) => (
            <button key={t._key || t.id} onClick={() => onEditTask && onEditTask(t)} className={`px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-2 border bg-white hover:bg-gray-50 text-black border-l-4`} style={{ borderLeftColor: taskDueStripeColor(parseISOish(t.date)) }}>
              <span className="uppercase text-[9px] text-gray-500">Task</span>
              <span className="truncate">{t.title}</span>
            </button>
          ))}
          {tasks.length > 3 && (
            <div className="text-[11px] text-gray-700">+{tasks.length - 3} more tasks</div>
          )}
        </div>
      )}
    </div>
  );
};

const GridClickCatcher = ({ date, onCreate }) => {
  const ref = useRef(null);

  const onDoubleClick = (e) => {
    const bounds = ref.current.getBoundingClientRect();
    const y = e.clientY - bounds.top; // px from top
    const minutes = clamp(Math.round((y / bounds.height) * 24 * 60 / 15) * 15, 0, 24*60);
    const start = new Date(date);
    start.setHours(Math.floor(minutes/60), minutes%60, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 60);
    onCreate({ start, end, allDay: false });
  };

  return <div ref={ref} className="absolute inset-0" onDoubleClick={onDoubleClick} />;
};

const getCalendarColor = (calendarId, calendars) => calendars.find(c => c.id === calendarId)?.color || GC_COLORS.primary;
const getEventColor = (e, calendars) => e.color || getCalendarColor(e.calendarId, calendars);

const EventBlocks = ({ events, date, onEdit, calendars }) => {
  return (
    <div className="relative h-full">
      {events.map((e, idx) => {
        const s = parseISOish(e.start);
        const en = parseISOish(e.end);
        const minutesFromTop = (s.getHours() * 60 + s.getMinutes()) / (24 * 60) * 100;
        const duration = Math.max(30, (en - s) / (1000 * 60));
        const heightPct = (duration / (24 * 60)) * 100;
        const leftOffset = (idx % 3) * 6; // naive overlap
        return (
          <button
            key={e._key || e.id}
            onClick={() => onEdit(e)}
            className="absolute right-2 left-2 text-left rounded-md border border-gray-200 bg-white text-black px-2 py-1 overflow-hidden hover:bg-gray-50"
            style={{ top: `${minutesFromTop}%`, height: `${heightPct}%`, transform: `translateX(${leftOffset}px)`, borderLeftWidth: 4, borderLeftColor: getEventColor(e, calendars) }}
          >
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Event</div>
            <div className="text-[12px] font-medium leading-tight">{e.title}</div>
            <div className="text-[10px] text-gray-600">{toTimeRange(s, en)}</div>
          </button>
        );
      })}
    </div>
  );
};

const TASK_BLOCK_MINUTES = 45;
const taskDueStripeColor = (d) => {
  const t = startOfDay(new Date());
  const dd = startOfDay(new Date(d));
  if (dd.getTime() < t.getTime()) return "#ef4444";
  if (dd.getTime() === t.getTime()) return "#3b82f6";
  return "#10b981";
};

const TaskBlocks = ({ tasks, date, onEditTask }) => {
  return (
    <div className="relative h-full">
      {tasks.map((t, idx) => {
        const s = parseISOish(t.date);
        const minutesFromTop = (s.getHours() * 60 + s.getMinutes()) / (24 * 60) * 100;
        const duration = TASK_BLOCK_MINUTES;
        const heightPct = (duration / (24 * 60)) * 100;
        const leftOffset = (idx % 3) * 6 + 2;
        return (
          <button
            key={t._key || t.id}
            onClick={() => onEditTask && onEditTask(t)}
            className="absolute right-2 left-2 text-left rounded-md border border-gray-200 bg-white text-black px-2 py-1 overflow-hidden hover:bg-gray-50"
            style={{ top: `${minutesFromTop}%`, height: `${heightPct}%`, transform: `translateX(${leftOffset}px)`, borderLeftWidth: 4, borderLeftColor: taskDueStripeColor(s) }}
          >
            <div className="text-[10px] uppercase tracking-wide text-gray-500">Task</div>
            <div className="text-[12px] font-medium leading-tight">{t.title}</div>
            <div className="text-[10px] text-gray-600">{toTimeLabel(s)}</div>
          </button>
        );
      })}
    </div>
  );
};

const toTimeLabel = (d) => {
  const h = d.getHours();
  const m = pad(d.getMinutes());
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m} ${ap}`;
};

const toTimeRange = (s, e) => `${toTimeLabel(s)} - ${toTimeLabel(e)}`;
const timeBadge = (d) => {
  if (!d) return "";
  const h = d.getHours();
  const m = pad(d.getMinutes());
  if (h === 0 && m === "00") return "";
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m} ${ap}`;
};

/********************** Event Modal **********************/
export const EventModal = ({ open, onClose, onSave, initial, calendars, onDelete }) => {
  const [title, setTitle] = useState(initial?.title || "Untitled event");
  const [allDay, setAllDay] = useState(initial?.allDay || false);
  const [start, setStart] = useState(initial?.start ? toISO(parseISOish(initial.start)) : toISO(new Date()));
  const [end, setEnd] = useState(initial?.end ? toISO(parseISOish(initial.end)) : toISO(addDays(new Date(), 0)));
  const [calendarId, setCalendarId] = useState(initial?.calendarId || calendars[0]?.id);
  const [color, setColor] = useState(initial?.color || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "none");
  const [showCustomColor, setShowCustomColor] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || "Untitled event");
    setAllDay(initial?.allDay || false);
    const s = initial?.start instanceof Date ? initial.start : initial?.start ? parseISOish(initial.start) : new Date();
    const e = initial?.end instanceof Date ? initial.end : initial?.end ? parseISOish(initial.end) : addDays(new Date(), 0);
    setStart(toISO(s));
    setEnd(toISO(e));
    setCalendarId(initial?.calendarId || calendars[0]?.id);
    setColor(initial?.color || "");
    setCategory(initial?.category || "");
    setFrequency(initial?.frequency || "none");
    setShowCustomColor(initial?.color ? !EVENT_COLOR_PALETTE.includes((initial?.color || "").toUpperCase()) : false);
  }, [open, initial, calendars]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-xl overflow-hidden animate-[fadeIn_200ms_ease]">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-[18px] font-semibold">Event details</div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-[20px] font-medium outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                All day</label>
              <div className="text-xs text-gray-500">Double-click on a time grid to create quicker</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Start</div>
                <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">End</div>
                <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Calendar</div>
                <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Color</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setColor(""); setShowCustomColor(false); }} className={`px-2 py-1 text-xs rounded border ${!color ? "border-black" : "border-gray-300 hover:border-gray-400"}`}>None</button>
                  {EVENT_COLOR_PALETTE.map((c) => (
                    <button key={c} type="button" onClick={() => { setColor(c); setShowCustomColor(false); }} className={`w-6 h-6 rounded-full border ${color?.toUpperCase() === c ? "ring-2 ring-black border-black" : "border-gray-300 hover:border-gray-400"}`} style={{ background: c }} />
                  ))}
                  <button type="button" onClick={() => setShowCustomColor((v) => !v)} className={`px-2 py-1 text-xs rounded border ${showCustomColor ? "border-black" : "border-gray-300 hover:border-gray-400"}`}>Custom</button>
                </div>
                {showCustomColor && (
                  <div className="mt-2">
                    <input type="color" value={color || "#ffffff"} onChange={(e) => setColor(e.target.value)} className="w-full h-9 border rounded" />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Category</div>
                <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Frequency</div>
                <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                  <option value="none">None</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2 sticky bottom-0 bg-white">
            <button onClick={() => onDelete && initial?.id && onDelete(initial.id)} className="px-3 py-1.5 rounded text-red-600 hover:bg-red-50">Delete</button>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded hover:bg-gray-100">Cancel</button>
              <button
                data-testid="save-event"
                onClick={() => {
                  const payload = {
                    title: title?.trim() || "Untitled event",
                    allDay,
                    start: start,
                    end: end,
                    calendarId,
                    color: color || undefined,
                    category: category || undefined,
                    frequency,
                  };
                  onSave(payload);
                }}
                className="px-3 py-1.5 rounded bg-black text-white hover:bg-gray-900"
              >Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/********************** Task Modal **********************/
export const TaskModal = ({ open, onClose, initial, onSave, onDelete }) => {
  const [title, setTitle] = useState(initial?.title || "Untitled task");
  const [date, setDate] = useState(initial?.date ? toISO(parseISOish(initial.date)) : toISO(new Date()));
  const [allDay, setAllDay] = useState(initial?.allDay || false);
  const [status, setStatus] = useState(initial?.status || "pending");
  const [color, setColor] = useState(initial?.color || "#000000");
  const [category, setCategory] = useState(initial?.category || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "none");

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || "Untitled task");
    const d = initial?.date instanceof Date ? initial.date : initial?.date ? parseISOish(initial.date) : new Date();
    setDate(toISO(d));
    setAllDay(initial?.allDay || false);
    setStatus(initial?.status || "pending");
    setColor(initial?.color || "#000000");
    setCategory(initial?.category || "");
    setFrequency(initial?.frequency || "none");
  }, [open, initial]);

  if (!open) return null;

  const dateInputType = allDay ? "date" : "datetime-local";
  const formatForInput = (val) => {
    const d = parseISOish(val);
    if (allDay) return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
    return toISO(d);
  };

  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-xl overflow-hidden animate-[fadeIn_200ms_ease]">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-[18px] font-semibold">Task details</div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full text-[20px] font-medium outline-none" />
            </div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                All day</label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">{allDay ? "Date" : "Date & Time"}</div>
                <input type={dateInputType} value={formatForInput(date)} onChange={(e) => setDate(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Status</div>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-gray-500 mb-1">Color</div>
                <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-full h-9 border rounded" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Category</div>
                <input value={category} onChange={(e) => setCategory(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Frequency</div>
              <select value={frequency} onChange={(e) => setFrequency(e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                <option value="none">None</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2 sticky bottom-0 bg-white">
            <button onClick={() => onDelete && initial?.id && onDelete(initial.id)} className="px-3 py-1.5 rounded text-red-600 hover:bg-red-50">Delete</button>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded hover:bg-gray-100">Cancel</button>
              <button
                onClick={() => {
                  let normalizedDate = date;
                  if (allDay) {
                    const d = typeof date === "string" ? new Date(date) : parseISOish(date);
                    d.setHours(0,0,0,0);
                    normalizedDate = toISO(d);
                  }
                  const payload = {
                    title: title?.trim() || "Untitled task",
                    date: normalizedDate,
                    allDay,
                    status,
                    color,
                    category: category || undefined,
                    frequency,
                  };
                  onSave(payload);
                }}
                className="px-3 py-1.5 rounded bg-black text-white hover:bg-gray-900"
              >Save</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/********************** Create Chooser **********************/
export const CreateChooser = ({ open, onClose, onChoose }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200">
            <div className="text-[16px] font-semibold">What would you like to create?</div>
          </div>
          <div className="p-4 space-y-3">
            <button onClick={() => onChoose("event")} className="w-full text-left px-4 py-3 border border-gray-200 rounded hover:bg-gray-50">
              <div className="text-[12px] uppercase text-gray-500">Option</div>
              <div className="text-[15px] font-medium">Event</div>
              <div className="text-[12px] text-gray-500">Scheduled with a start and end time</div>
            </button>
            <button onClick={() => onChoose("task")} className="w-full text-left px-4 py-3 border border-gray-200 rounded hover:bg-gray-50">
              <div className="text-[12px] uppercase text-gray-500">Option</div>
              <div className="text-[15px] font-medium">Task</div>
              <div className="text-[12px] text-gray-500">Single due date/time (optional all-day)</div>
            </button>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 text-right">
            <button onClick={onClose} className="px-3 py-1.5 rounded hover:bg-gray-100">Cancel</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/********************** Compact Task Legend **********************/
const TaskLegend = () => {
  return (
    <div className="border border-gray-200 rounded-md p-2 text-xs text-gray-700 bg-white">
      <div className="flex items-center gap-2 mb-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#ef4444" }}></span> Overdue (due date before today)</div>
      <div className="flex items-center gap-2 mb-1"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#3b82f6" }}></span> Due Today</div>
      <div className="flex items-center gap-2"><span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#10b981" }}></span> Upcoming (future due date)</div>
    </div>
  );
};

/********************** Preset Quick Apply **********************/
const loadPresets = () => {
  try {
    const raw = localStorage.getItem("calendarColorPresetsV1");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
const savePresets = (list) => {
  try { localStorage.setItem("calendarColorPresetsV1", JSON.stringify(list)); } catch {}
};

const PresetQuickApply = ({ calendars, onApply }) => {
  const [presets, setPresets] = useState(loadPresets());
  useEffect(() => {
    const onStorage = () => setPresets(loadPresets());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return (
    <select className="text-xs border rounded px-1 py-1 bg-white" defaultValue="" onChange={(e) => { if (e.target.value) { onApply(e.target.value); e.target.value = ""; } }}>
      <option value="">Preset…</option>
      {presets.map((p) => (
        <option key={p.id} value={p.color}>{p.name}</option>
      ))}
    </select>
  );
};

const uid = () => Math.random().toString(36).slice(2, 10);

const PresetsModal = ({ onClose, onApplyToCalendar, calendars }) => {
  const [presets, setPresets] = useState(loadPresets());
  const [name, setName] = useState("");
  const [color, setColor] = useState("#111827");
  const [applyCalendar, setApplyCalendar] = useState(calendars[0]?.id || "");

  const addPreset = () => {
    if (!name.trim()) return;
    const next = [...presets, { id: uid(), name: name.trim(), color: color.toUpperCase() }];
    setPresets(next); savePresets(next); setName("");
  };
  const removePreset = (id) => {
    const next = presets.filter(p => p.id !== id);
    setPresets(next); savePresets(next);
  };

  return (
    <div className="fixed inset-0 z-50" aria-modal="true" role="dialog">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-0 flex items-center justify-center p-4">
        <div className="w-full max-w-lg bg-white rounded-xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <div className="text-[16px] font-semibold">Color Presets</div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-sm font-medium mb-2">Existing presets</div>
              <div className="space-y-2">
                {presets.length === 0 && <div className="text-xs text-gray-500">No presets yet</div>}
                {presets.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 border rounded px-2 py-1.5">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-4 h-4 rounded" style={{ background: p.color }} />
                      <div className="text-sm">{p.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select value={applyCalendar} onChange={(e) => setApplyCalendar(e.target.value)} className="text-xs border rounded px-1 py-1">
                        {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button className="text-xs px-2 py-1 border rounded hover:bg-gray-50" onClick={() => onApplyToCalendar(applyCalendar, p.color)}>Apply</button>
                      <button className="text-xs px-2 py-1 border rounded text-red-600 hover:bg-red-50" onClick={() => removePreset(p.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Create new preset</div>
              <div className="space-y-2">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Preset name" className="w-full border rounded px-2 py-1 text-sm" />
                <div>
                  <div className="text-xs text-gray-500 mb-1">Pick a color</div>
                  <div className="flex flex-wrap gap-2">
                    {EVENT_COLOR_PALETTE.map(c => (
                      <button key={c} className={`w-6 h-6 rounded-full border ${color.toUpperCase() === c ? "ring-2 ring-black border-black" : "border-gray-300 hover:border-gray-400"}`} style={{ background: c }} onClick={() => setColor(c)} />
                    ))}
                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-10 h-8 border rounded" />
                  </div>
                </div>
                <button onClick={addPreset} className="px-3 py-1.5 rounded bg-black text-white hover:bg-gray-900">Add preset</button>
              </div>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 text-right">
            <button onClick={onClose} className="px-3 py-1.5 rounded hover:bg-gray-100">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
};

/********************** Placeholder Page **********************/
export const SectionPage = ({ title }) => (
  <div className="p-8">
    <div className="text-2xl font-semibold mb-2">{title}</div>
    <div className="text-gray-600">This is a placeholder page for {title}. Content coming soon.</div>
  </div>
);

/********************** Placeholder **********************/
const SchedulePlaceholder = () => (
  <div className="flex-1 grid place-items-center text-gray-500 p-10">
    Schedule view coming soon
  </div>
);

/********************** Exports: State Helpers **********************/
export const useCalendarState = () => {
  const [calendars, setCalendars] = useState(defaultCalendars);
  const [events, setEvents] = useState(seedEvents);
  const [tasks, setTasks] = useState(seedTasks);
  const addEvent = (payload) => {
    const ev = {
      id: makeId(),
      ...payload,
    };
    setEvents((prev) => [...prev, ev]);
  };
  const updateEvent = (id, patch) => {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  };
  const removeEvent = (id) => setEvents((prev) => prev.filter((e) => e.id !== id));

  const addTask = (payload) => {
    const t = { id: makeTaskId(), ...payload };
    setTasks((prev) => [...prev, t]);
  };
  const updateTask = (id, patch) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  };
  const removeTask = (id) => setTasks((prev) => prev.filter((t) => t.id !== id));

  const updateTaskStatus = (id) => {
    setTasks((prev) => prev.map((t) => {
      if (t.id !== id) return t;
      const order = ["pending", "completed", "incomplete"];
      const idx = order.indexOf(t.status);
      const next = order[(idx + 1) % order.length];
      return { ...t, status: next };
    }));
  };
  return { calendars, setCalendars, events, setEvents, addEvent, updateEvent, removeEvent, tasks, setTasks, addTask, updateTask, removeTask, updateTaskStatus };
};

export const rangeTitle = (view, date) => {
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
};