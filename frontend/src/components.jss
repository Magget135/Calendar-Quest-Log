/*
  components.jss
  Monolithic components file for Google Calendar UI replica (frontend-only)
  - No backend calls
  - TailwindCSS classes for styling
  - All data mocked locally
*/

import React, { useEffect, useMemo, useRef, useState } from "react";

/********************** Utils **********************/
const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const startOfDay = (d) =&gt; new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) =&gt; new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const addDays = (d, n) =&gt; {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + n);
  return nd;
};
const addMonths = (d, n) =&gt; {
  const nd = new Date(d);
  nd.setMonth(nd.getMonth() + n);
  return nd;
};
const addYears = (d, n) =&gt; {
  const nd = new Date(d);
  nd.setFullYear(nd.getFullYear() + n);
  return nd;
};
const sameDay = (a, b) =&gt; a.getFullYear() === b.getFullYear() &amp;&amp; a.getMonth() === b.getMonth() &amp;&amp; a.getDate() === b.getDate();
const toISO = (d) =&gt; `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const parseISOish = (s) =&gt; new Date(s);
const getWeekStart = (d, weekStartsOnSunday = true) =&gt; {
  const day = d.getDay(); // 0 Sun - 6 Sat
  const diff = weekStartsOnSunday ? -day : (day === 0 ? -6 : 1 - day);
  const nd = new Date(d);
  nd.setDate(d.getDate() + diff);
  nd.setHours(0,0,0,0);
  return nd;
};
const clamp = (val, min, max) =&gt; Math.max(min, Math.min(val, max));

// range helpers
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart <= bEnd && aEnd >= bStart;
const addInterval = (date, frequency) =&gt; {
  switch (frequency) {
    case "daily": return addDays(date, 1);
    case "weekly": return addDays(date, 7);
    case "monthly": return addMonths(date, 1);
    case "yearly": return addYears(date, 1);
    default: return date;
  }
};

const isRecurring = (freq) =&gt; ["daily", "weekly", "monthly", "yearly"].includes((freq || "").toLowerCase());

// Expand recurring events into individual instances within [rangeStart, rangeEnd]
const expandRecurringEvents = (events, rangeStart, rangeEnd) =&gt; {
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
      if (diffDays &gt; 0) {
        const skips = Math.floor(diffDays / step);
        if (skips &gt; 0) {
          occStart = addDays(occStart, skips * step);
          occEnd = addDays(occEnd, skips * step);
        }
      }
    } else if (freq === "monthly") {
      // naive fast-forward by months difference
      const monthsDiff = (rangeStart.getFullYear() - baseStart.getFullYear()) * 12 + (rangeStart.getMonth() - baseStart.getMonth());
      if (monthsDiff &gt; 0) {
        occStart = addMonths(occStart, monthsDiff);
        occEnd = addMonths(occEnd, monthsDiff);
      }
    } else if (freq === "yearly") {
      const yearsDiff = rangeStart.getFullYear() - baseStart.getFullYear();
      if (yearsDiff &gt; 0) {
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
const expandRecurringTasks = (tasks, rangeStart, rangeEnd) =&gt; {
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
      if (diffDays &gt; 0) {
        const skips = Math.floor(diffDays / step);
        if (skips &gt; 0) occ = addDays(occ, skips * step);
      }
    } else if (freq === "monthly") {
      const monthsDiff = (rangeStart.getFullYear() - baseDate.getFullYear()) * 12 + (rangeStart.getMonth() - baseDate.getMonth());
      if (monthsDiff &gt; 0) occ = addMonths(occ, monthsDiff);
    } else if (freq === "yearly") {
      const yearsDiff = rangeStart.getFullYear() - baseDate.getFullYear();
      if (yearsDiff &gt; 0) occ = addYears(occ, yearsDiff);
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

/********************** Colors &amp; Fonts **********************/
// Google Calendar primary and accents (approx)
export const GC_COLORS = {
  primary: "#1a73e8",
  primaryDark: "#1557b0",
  text: "#1f1f1f",
  mutedText: "#5f6368",
  border: "#e0e0e0",
  bg: "#ffffff",
  subBg: "#fafafa",
  now: "#ea4335", // red line
};
export const EVENT_COLORS = [
  "#7986cb", "#33b679", "#8e24aa", "#e67c73", "#f4511e",
  "#f6c026", "#0b8043", "#3f51b5", "#039be5", "#616161"
];

/********************** Mock Data **********************/
const today = new Date();
const weekStart = getWeekStart(today, true);
const defaultCalendars = [
  { id: "cal-1", name: "My Calendar", color: GC_COLORS.primary, checked: true },
  { id: "cal-2", name: "Product", color: "#33b679", checked: true },
  { id: "cal-3", name: "Personal", color: "#8e24aa", checked: true },
  { id: "cal-4", name: "Fitness", color: "#f4511e", checked: false },
];

let idCounter = 1000;
const makeId = () =&gt; `evt-${idCounter++}`;

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
const makeTaskId = () =&gt; `task-${taskIdCounter++}`;
const seedTasks = [
  { id: makeTaskId(), title: "Pay bills", date: toISO(addDays(weekStart, 1)), status: "pending", color: "#f59e0b", category: "Personal", frequency: "weekly" },
  { id: makeTaskId(), title: "Draft PRD", date: toISO(addDays(weekStart, 2)), status: "incomplete", color: "#3b82f6", category: "Work", frequency: "none" },
  { id: makeTaskId(), title: "Buy groceries", date: toISO(addDays(weekStart, 3)), status: "completed", color: "#10b981", category: "Personal", frequency: "none" },
  { id: makeTaskId(), title: "Call plumber", date: toISO(addDays(weekStart, 4)), status: "pending", color: "#ef4444", category: "Home", frequency: "daily" },
];

/********************** Icons **********************/
const Icon = ({ name, className = "w-5 h-5" }) =&gt; {
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
      <div className="flex items-center justify-between px-4 sm:px-6 h-14">
        <div className="flex items-center gap-3">
          <button className="p-2 rounded hover:bg-gray-100" aria-label="Menu">
            <Icon name="menu" />
          </button>
          <div className="flex items-center gap-2 select-none">
            <div className="w-6 h-6 rounded-md bg-[#1a73e8] grid place-items-center text-white font-bold">31</div>
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

        &lt;div className="flex-1 max-w-[520px] mx-4 hidden md:flex items-center"&gt;
          &lt;div className="relative flex-1"&gt;
            &lt;span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"&gt;&lt;Icon name="search" /&gt;&lt;/span&gt;
            &lt;input className="w-full pl-10 pr-3 py-2 bg-gray-100 rounded-full outline-none text-sm focus:ring-2 focus:ring-blue-500" placeholder="Search" /&gt;
          &lt;/div&gt;
        &lt;/div&gt;

        &lt;div className="hidden md:flex items-center gap-1"&gt;
          &lt;button className="p-2 rounded hover:bg-gray-100" aria-label="Help"&gt;&lt;Icon name="help" /&gt;&lt;/button&gt;
          &lt;button className="p-2 rounded hover:bg-gray-100" aria-label="Settings"&gt;&lt;Icon name="settings" /&gt;&lt;/button&gt;
          &lt;button className="p-2 rounded hover:bg-gray-100" aria-label="Apps"&gt;&lt;Icon name="apps" /&gt;&lt;/button&gt;
          &lt;div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 grid place-items-center text-white text-xs font-bold ml-1"&gt;JD&lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;

      &lt;div className="md:hidden flex items-center gap-2 px-4 pb-3"&gt;
        &lt;button onClick={onPrev} className="p-1.5 rounded hover:bg-gray-100" aria-label="Previous"&gt;&lt;Icon name="chev-left" /&gt;&lt;/button&gt;
        &lt;button onClick={onNext} className="p-1.5 rounded hover:bg-gray-100" aria-label="Next"&gt;&lt;Icon name="chev-right" /&gt;&lt;/button&gt;
        &lt;button onClick={onToday} className="px-3 py-1 border rounded text-sm"&gt;Today&lt;/button&gt;
        &lt;div className="text-[18px] font-semibold"&gt;{title}&lt;/div&gt;
      &lt;/div&gt;

      &lt;div className="px-4 sm:px-6 py-2 border-t border-gray-100 flex items-center gap-2"&gt;
        &lt;ViewToggle view={view} setView={setView} /&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

const ViewToggle = ({ view, setView }) =&gt; {
  const opt = ["Day", "Week", "Month", "Schedule"]; // schedule is placeholder
  return (
    &lt;div className="inline-flex rounded-md border border-gray-200 overflow-hidden" role="tablist"&gt;
      {opt.map((o) =&gt; {
        const active = view === o.toLowerCase();
        return (
          &lt;button key={o} onClick={() =&gt; setView(o.toLowerCase())} className={`px-3 py-1.5 text-sm ${active ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700 hover:bg-gray-50"}`}&gt;{o}&lt;/button&gt;
        );
      })}
    &lt;/div&gt;
  );
};

/********************** Left Sidebar **********************/
export const LeftSidebar = ({ date, onDateChange, onCreate, calendars, setCalendars, showTasks, setShowTasks }) =&gt; {
  return (
    &lt;aside className="w-[300px] shrink-0 border-r border-gray-200 bg-white hidden lg:block"&gt;
      &lt;div className="p-4"&gt;
        &lt;button data-testid="create" onClick={() =&gt; onCreate({ start: new Date(), end: addDays(new Date(), 0), allDay: false })} className="w-full flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-md py-2.5 shadow-sm transition"&gt;
          &lt;Icon name="plus" className="w-5 h-5" /&gt;
          &lt;span className="font-medium"&gt;Create&lt;/span&gt;
        &lt;/button&gt;
      &lt;/div&gt;

      &lt;div className="px-3 pb-4"&gt;
        &lt;MiniMonth date={date} onDateChange={onDateChange} /&gt;
      &lt;/div&gt;

      &lt;div className="px-3 pb-4"&gt;
        &lt;div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"&gt;My calendars&lt;/div&gt;
        &lt;div className="space-y-2"&gt;
          {calendars.map((c) =&gt; (
            &lt;label key={c.id} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none"&gt;
              &lt;input type="checkbox" checked={c.checked} onChange={(e) =&gt; setCalendars((prev) =&gt; prev.map(p =&gt; p.id === c.id ? { ...p, checked: e.target.checked } : p))} /&gt;
              &lt;span className="inline-block w-3 h-3 rounded" style={{ background: c.color }} /&gt;
              &lt;span&gt;{c.name}&lt;/span&gt;
            &lt;/label&gt;
          ))}
        &lt;/div&gt;
      &lt;/div&gt;

      &lt;div className="px-3 pb-6 border-t border-gray-100 pt-4"&gt;
        &lt;div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2"&gt;Tasks&lt;/div&gt;
        &lt;label className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none"&gt;
          &lt;input type="checkbox" checked={showTasks} onChange={(e) =&gt; setShowTasks(e.target.checked)} /&gt;
          &lt;span className="inline-flex items-center gap-1"&gt;
            &lt;span className="inline-block w-3 h-3 rounded bg-amber-500" /&gt;
            Show tasks on calendar
          &lt;/span&gt;
        &lt;/label&gt;
      &lt;/div&gt;
    &lt;/aside&gt;
  );
};

const MiniMonth = ({ date, onDateChange }) =&gt; {
  const [cursor, setCursor] = useState(startOfDay(new Date(date)));

  useEffect(() =&gt; { setCursor(startOfDay(new Date(date))); }, [date]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const start = getWeekStart(first, true);
  const days = [...Array(42)].map((_, i) =&gt; addDays(start, i));

  return (
    &lt;div className="rounded-lg border border-gray-200 overflow-hidden"&gt;
      &lt;div className="flex items-center justify-between px-3 py-2 bg-white"&gt;
        &lt;button className="p-1 rounded hover:bg-gray-100" onClick={() =&gt; setCursor(addMonths(cursor, -1))}&gt;&lt;Icon name="chev-left" /&gt;&lt;/button&gt;
        &lt;div className="text-sm font-medium"&gt;{cursor.toLocaleString(undefined, { month: "long", year: "numeric" })}&lt;/div&gt;
        &lt;button className="p-1 rounded hover:bg-gray-100" onClick={() =&gt; setCursor(addMonths(cursor, 1))}&gt;&lt;Icon name="chev-right" /&gt;&lt;/button&gt;
      &lt;/div&gt;
      &lt;div className="grid grid-cols-7 gap-px bg-gray-200 text-[11px] text-gray-500"&gt;
        {["S","M","T","W","T","F","S"].map((d, i) =&gt; (
          &lt;div key={`${d}-${i}`} className="bg-white px-2 py-1 text-center font-medium"&gt;{d}&lt;/div&gt;
        ))}
      &lt;/div&gt;
      &lt;div className="grid grid-cols-7 gap-px bg-gray-200"&gt;
        {days.map((d, idx) =&gt; {
          const isOther = d.getMonth() !== month;
          const isToday = sameDay(d, new Date());
          const isSelected = sameDay(d, date);
          return (
            &lt;button key={idx} onClick={() =&gt; onDateChange(d)} className={`aspect-[1/0.8] bg-white p-2 text-left hover:bg-blue-50 focus:outline-none ${isSelected ? "ring-2 ring-blue-500" : ""}`}&gt;
              &lt;div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] ${isToday ? "text-white bg-[#1a73e8]" : "text-gray-800"} ${isOther ? "opacity-40" : ""}`}&gt;{d.getDate()}&lt;/div&gt;
              &lt;div className="mt-1 flex gap-0.5"&gt;
                &lt;span className="w-1 h-1 rounded-full bg-[#1a73e8]" /&gt;
                &lt;span className="w-1 h-1 rounded-full bg-[#33b679]" /&gt;
                &lt;span className="w-1 h-1 rounded-full bg-[#f4511e]" /&gt;
              &lt;/div&gt;
            &lt;/button&gt;
          );
        })}
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

/********************** Calendar Grids **********************/
export const CalendarView = ({ view, date, events, calendars, onCreate, onEdit, tasks = [], showTasks = true, onToggleTaskStatus, onEditTask }) =&gt; {
  if (view === "day") return &lt;DayView date={date} events={events} calendars={calendars} onCreate={onCreate} onEdit={onEdit} tasks={tasks} showTasks={showTasks} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} /&gt;;
  if (view === "week") return &lt;WeekView date={date} events={events} calendars={calendars} onCreate={onCreate} onEdit={onEdit} tasks={tasks} showTasks={showTasks} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} /&gt;;
  if (view === "month") return &lt;MonthView date={date} events={events} calendars={calendars} onCreate={onCreate} onEdit={onEdit} tasks={tasks} showTasks={showTasks} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} /&gt;;
  return &lt;SchedulePlaceholder /&gt;;
};

const hours = [...Array(24)].map((_, i) =&gt; i);
const HOUR_PX = 64; // visual height per hour for day/week columns

// Auto-scroll helper to bring a target hour into view on initial render
const useAutoScrollToHour = (scrollRef, targetHour) =&gt; {
  useEffect(() =&gt; {
    const el = scrollRef.current;
    if (!el) return;
    const t = typeof targetHour === "number" ? targetHour : Math.max(0, new Date().getHours() - 2);
    const measureAndScroll = () =&gt; {
      const hourCell = el.querySelector('[data-hour="8"]') || el.querySelector('[data-hour="0"]');
      const hourHeight = hourCell ? hourCell.offsetHeight : HOUR_PX;
      const y = Math.max(0, t * hourHeight - 40);
      el.scrollTo({ top: y, behavior: "smooth" });
    };
    const id = setTimeout(measureAndScroll, 60);
    return () =&gt; clearTimeout(id);
  }, [scrollRef, targetHour]);
};

const NowIndicator = ({ date }) =&gt; {
  // Only render for today in Day/Week views
  const [top, setTop] = useState(0);
  useEffect(() =&gt; {
    const tick = () =&gt; {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      const pct = minutes / (24 * 60);
      setTop(pct * 100);
    };
    tick();
    const t = setInterval(tick, 60 * 1000);
    return () =&gt; clearInterval(t);
  }, []);
  const isToday = sameDay(date, new Date());
  if (!isToday) return null;
  return (
    &lt;div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: `${top}%` }}&gt;
      &lt;div className="absolute -left-2 w-2 h-2 bg-[#ea4335] rounded-full" /&gt;
      &lt;div className="border-t-2 border-[#ea4335]" /&gt;
    &lt;/div&gt;
  );
};

const filterEventsByCalendars = (events, calendars) =&gt; {
  const allowed = new Set(calendars.filter(c =&gt; c.checked).map(c =&gt; c.id));
  return events.filter(e =&gt; allowed.has(e.calendarId));
};

const DayView = ({ date, events, calendars, onCreate, onEdit, tasks, showTasks, onToggleTaskStatus, onEditTask }) =&gt; {
  const rangeStart = startOfDay(date);
  const rangeEnd = endOfDay(date);
  const filtered = useMemo(() =&gt; filterEventsByCalendars(events, calendars), [events, calendars]);
  const expanded = useMemo(() =&gt; expandRecurringEvents(filtered, rangeStart, rangeEnd), [filtered, rangeStart, rangeEnd]);
  const dayEvents = expanded.filter(e =&gt; {
    const s = parseISOish(e.start); const en = parseISOish(e.end);
    return overlaps(s, en, rangeStart, rangeEnd) || (e.allDay &amp;&amp; overlaps(s, endOfDay(s), rangeStart, rangeEnd));
  });
  const expandedTasks = useMemo(() =&gt; expandRecurringTasks(tasks, rangeStart, rangeEnd), [tasks, rangeStart, rangeEnd]);
  const dayTasks = useMemo(() =&gt; expandedTasks.filter(t =&gt; sameDay(parseISOish(t.date), date)), [expandedTasks, date]);

  const scrollRef = useRef(null);
  useAutoScrollToHour(scrollRef);
  return (
    &lt;div ref={scrollRef} className="flex-1 overflow-auto"&gt;
      &lt;div className="grid" style={{ gridTemplateColumns: "64px 1fr" }}&gt;
        &lt;div className="bg-white" /&gt;
        &lt;div className="bg-white border-b border-gray-200 px-4 py-2"&gt;
          &lt;AllDayRow date={date} events={dayEvents.filter(e =&gt; e.allDay)} timedEvents={dayEvents.filter(e =&gt; !e.allDay)} onEdit={onEdit} calendars={calendars} tasks={showTasks ? dayTasks : []} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} /&gt;
        &lt;/div&gt;
      &lt;/div&gt;
      &lt;div className="grid" style={{ gridTemplateColumns: "64px 1fr" }}&gt;
        &lt;div className="bg-white"&gt;
          {hours.map((h) =&gt; (
            &lt;div key={h} data-hour={h} className="h-16 border-t border-gray-100 text-[11px] text-right pr-2 text-gray-500"&gt;
              &lt;div className="-mt-2"&gt;{h === 0 ? "" : h &gt; 12 ? `${h-12}pm` : h === 12 ? "12pm" : `${h}am`}&lt;/div&gt;
            &lt;/div&gt;
          ))}
        &lt;/div&gt;
        &lt;div className="bg-white border-l border-gray-100"&gt;
          &lt;div className="relative" style={{ height: `${hours.length * HOUR_PX}px` }}&gt;
            &lt;div className="absolute inset-0 pointer-events-none"&gt;
              {hours.map((h) =&gt; (
                &lt;div key={h} className="h-16 border-t border-gray-100" /&gt;
              ))}
            &lt;/div&gt;
            &lt;div className="absolute inset-0"&gt;
              &lt;NowIndicator date={date} /&gt;
            &lt;/div&gt;
            &lt;div className="absolute inset-0" style={{ zIndex: 10 }}&gt;
              &lt;GridClickCatcher date={date} onCreate={onCreate} /&gt;
            &lt;/div&gt;
            &lt;div className="absolute inset-0" style={{ zIndex: 20 }}&gt;
              &lt;EventBlocks events={dayEvents.filter(e =&gt; !e.allDay)} date={date} onEdit={onEdit} calendars={calendars} /&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

const WeekView = ({ date, events, calendars, onCreate, onEdit, tasks, showTasks, onToggleTaskStatus, onEditTask }) =&gt; {
  const start = getWeekStart(date, true);
  const end = endOfDay(addDays(start, 6));
  const days = [...Array(7)].map((_, i) =&gt; addDays(start, i));
  const filtered = useMemo(() =&gt; filterEventsByCalendars(events, calendars), [events, calendars]);
  const expandedEvents = useMemo(() =&gt; expandRecurringEvents(filtered, start, end), [filtered, start, end]);
  const byDay = days.map(d =&gt; expandedEvents.filter(e =&gt; {
    const s = parseISOish(e.start); const en = parseISOish(e.end);
    return overlaps(s, en, startOfDay(d), endOfDay(d)) || (e.allDay &amp;&amp; overlaps(s, endOfDay(s), startOfDay(d), endOfDay(d)));
  }));
  const expandedTasks = useMemo(() =&gt; expandRecurringTasks(tasks, start, end), [tasks, start, end]);
  const tasksByDay = useMemo(() =&gt; days.map(d =&gt; expandedTasks.filter(t =&gt; sameDay(parseISOish(t.date), d))), [expandedTasks, date]);

  const scrollRef = useRef(null);
  useAutoScrollToHour(scrollRef);

  return (
    &lt;div ref={scrollRef} className="flex-1 overflow-auto"&gt;
      &lt;div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}&gt;
        &lt;div className="bg-white" /&gt;
        {days.map((d, i) =&gt; (
          &lt;div key={i} className="bg-white border-b border-gray-200 px-4 py-2"&gt;
            &lt;AllDayRow date={d} events={byDay[i].filter(e =&gt; e.allDay)} timedEvents={byDay[i].filter(e =&gt; !e.allDay)} onEdit={onEdit} calendars={calendars} tasks={showTasks ? tasksByDay[i] : []} onToggleTaskStatus={onToggleTaskStatus} onEditTask={onEditTask} /&gt;
          &lt;/div&gt;
        ))}
      &lt;/div&gt;
      &lt;div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}&gt;
        &lt;div className="bg-white"&gt;
          {hours.map((h) =&gt; (
            &lt;div key={h} data-hour={h} className="h-16 border-t border-gray-100 text-[11px] text-right pr-2 text-gray-500"&gt;
              &lt;div className="-mt-2"&gt;{h === 0 ? "" : h &gt; 12 ? `${h-12}pm` : h === 12 ? "12pm" : `${h}am`}&lt;/div&gt;
            &lt;/div&gt;
          ))}
        &lt;/div&gt;
        {days.map((d, i) =&gt; (
          &lt;div key={i} className={`bg-white border-l border-gray-100 ${sameDay(d, new Date()) ? "bg-blue-50/20" : ""}`}&gt;
            &lt;div className="relative" style={{ height: `${hours.length * HOUR_PX}px` }}&gt;
              &lt;div className="absolute inset-0 pointer-events-none"&gt;
                {hours.map((h) =&gt; (
                  &lt;div key={h} className="h-16 border-t border-gray-100" /&gt;
                ))}
              &lt;/div&gt;
              &lt;div className="absolute inset-0"&gt;
                &lt;NowIndicator date={d} /&gt;
              &lt;/div&gt;
              &lt;div className="absolute inset-0" style={{ zIndex: 10 }}&gt;
                &lt;GridClickCatcher date={d} onCreate={onCreate} /&gt;
              &lt;/div&gt;
              &lt;div className="absolute inset-0" style={{ zIndex: 20 }}&gt;
                &lt;EventBlocks events={byDay[i].filter(e =&gt; !e.allDay)} date={d} onEdit={onEdit} calendars={calendars} /&gt;
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        ))}
      &lt;/div&gt;
      &lt;div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}&gt;
        &lt;div className="bg-white" /&gt;
        {days.map((d, i) =&gt; (
          &lt;div key={i} className="bg-white border-t border-gray-100 px-4 py-2 text-xs text-gray-500"&gt;
            &lt;div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${sameDay(d, new Date()) ? "bg-[#1a73e8] text-white" : "bg-gray-100"}`}&gt;
              &lt;span className="font-semibold"&gt;{d.toLocaleDateString(undefined, { weekday: "short" })}&lt;/span&gt;
              &lt;span&gt;{d.getDate()}&lt;/span&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        ))}
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

const MonthView = ({ date, events, calendars, onCreate, onEdit, tasks, showTasks, onToggleTaskStatus, onEditTask }) =&gt; {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = getWeekStart(first, true);
  const days = [...Array(42)].map((_, i) =&gt; addDays(start, i));
  const end = endOfDay(days[41]);
  const filtered = useMemo(() =&gt; filterEventsByCalendars(events, calendars), [events, calendars]);
  const expanded = useMemo(() =&gt; expandRecurringEvents(filtered, start, end), [filtered, start, end]);
  const expandedTasks = useMemo(() =&gt; expandRecurringTasks(tasks, start, end), [tasks, start, end]);

  const grouped = useMemo(() =&gt; {
    const m = new Map();
    days.forEach((d) =&gt; {
      const key = d.toDateString();
      m.set(key, { events: [], tasks: [] });
    });
    expanded.forEach((e) =&gt; {
      const s = startOfDay(parseISOish(e.start));
      const until = e.allDay ? endOfDay(parseISOish(e.end)) : endOfDay(parseISOish(e.start));
      for (let d = new Date(s); d &lt;= until; d = addDays(d, 1)) {
        const key = d.toDateString();
        if (m.has(key)) m.get(key).events.push(e);
      }
    });
    expandedTasks.forEach((t) =&gt; {
      const d = startOfDay(parseISOish(t.date));
      const key = d.toDateString();
      if (m.has(key)) m.get(key).tasks.push(t);
    });
    return m;
  }, [expanded, expandedTasks, date]);

  return (
    &lt;div className="flex-1 overflow-auto"&gt;
      &lt;div className="grid grid-cols-7 gap-px bg-gray-200 text-xs"&gt;
        {["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"].map((d) =&gt; (
          &lt;div key={d} className="bg-white px-3 py-2 text-gray-600 font-medium"&gt;{d}&lt;/div&gt;
        ))}
      &lt;/div&gt;
      &lt;div className="grid grid-cols-7 gap-px bg-gray-200"&gt;
        {days.map((d, idx) =&gt; {
          const other = d.getMonth() !== date.getMonth();
          const key = d.toDateString();
          const evs = grouped.get(key)?.events || [];
          const tks = grouped.get(key)?.tasks || [];
          return (
            &lt;div key={idx} className={`bg-white min-h-[160px] hover:bg-gray-50 transition ${sameDay(d, new Date()) ? "outline outline-2 outline-[#1a73e8] -outline-offset-2" : ""}`}&gt;
              &lt;div className="flex items-center justify-between px-2 py-1"&gt;
                &lt;button data-testid="month-date" onClick={() =&gt; onCreate({ start: d, end: d, allDay: true })} className={`text-xs font-medium px-1.5 py-0.5 rounded ${other ? "text-gray-400" : "text-gray-700"}`}&gt;{d.getDate()}&lt;/button&gt;
              &lt;/div&gt;
              &lt;div className="px-2 pb-2 space-y-1"&gt;
                {evs.slice(0, 3).map((e) =&gt; (
                  &lt;button key={e._key || e.id} onClick={() =&gt; onEdit(e)} className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 text-left"&gt;
                    &lt;span className="inline-block w-2 h-2 rounded" style={{ background: getEventColor(e, calendars) }} /&gt;
                    &lt;span className="truncate text-[12px]"&gt;{e.title}&lt;/span&gt;
                  &lt;/button&gt;
                ))}
                {evs.length &gt; 3 &amp;&amp; (
                  &lt;div className="text-xs text-blue-700"&gt;+{evs.length - 3} more&lt;/div&gt;
                )}

                {showTasks &amp;&amp; (
                  &lt;div className="mt-1 space-y-1"&gt;
                    {tks.slice(0, 2).map((t) =&gt; (
                      &lt;button key={t._key || t.id} onClick={() =&gt; onEditTask &amp;&amp; onEditTask(t)} className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 text-left"&gt;
                        &lt;span className="inline-block w-2 h-2 rounded" style={{ background: t.color || "#f59e0b" }} /&gt;
                        &lt;span className="truncate text-[12px]"&gt;{t.title}&lt;/span&gt;
                      &lt;/button&gt;
                    ))}
                    {tks.length &gt; 2 &amp;&amp; (
                      &lt;div className="text-xs text-amber-700"&gt;+{tks.length - 2} more tasks&lt;/div&gt;
                    )}
                  &lt;/div&gt;
                )}
              &lt;/div&gt;
            &lt;/div&gt;
          );
        })}
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

const AllDayRow = ({ date, events, timedEvents = [], onEdit, calendars, tasks = [], onToggleTaskStatus, onEditTask }) =&gt; {
  return (
    &lt;div className="min-h-[38px] flex flex-col gap-1"&gt;
      &lt;div className="flex flex-wrap gap-1"&gt;
        {events.map((e) =&gt; (
          &lt;button key={e._key || e.id} onClick={() =&gt; onEdit(e)} className="px-2 py-0.5 rounded text-[12px] text-white shadow-sm hover:brightness-95" style={{ background: getEventColor(e, calendars) }}&gt;{e.title}&lt;/button&gt;
        ))}
      &lt;/div&gt;
      {timedEvents.length &gt; 0 &amp;&amp; (
        &lt;div className="flex flex-wrap gap-1"&gt;
          {timedEvents.slice(0, 2).map((e) =&gt; {
            const s = parseISOish(e.start);
            return (
              &lt;button key={`t-${e._key || e.id}`} onClick={() =&gt; onEdit(e)} className="px-1.5 py-0.5 rounded bg-gray-50 hover:bg-gray-100 text-[11px] text-gray-700 inline-flex items-center gap-1"&gt;
                &lt;span className="inline-block w-2 h-2 rounded" style={{ background: getEventColor(e, calendars) }} /&gt;
                &lt;span&gt;{toTimeLabel(s)} {e.title}&lt;/span&gt;
              &lt;/button&gt;
            );
          })}
          {timedEvents.length &gt; 2 &amp;&amp; (
            &lt;div className="text-[11px] text-blue-700"&gt;+{timedEvents.length - 2} more&lt;/div&gt;
          )}
        &lt;/div&gt;
      )}

      {tasks.length &gt; 0 &amp;&amp; (
        &lt;div className="flex flex-wrap gap-1 mt-1"&gt;
          {tasks.slice(0, 3).map((t) =&gt; (
            &lt;button key={t._key || t.id} onClick={() =&gt; onEditTask &amp;&amp; onEditTask(t)} className={`px-2 py-0.5 rounded text-[11px] inline-flex items-center gap-2 border bg-white hover:bg-gray-50 text-gray-800`}&gt;
              &lt;span className="inline-block w-2 h-2 rounded" style={{ background: t.color || "#f59e0b" }} /&gt;
              &lt;span className="truncate"&gt;{t.title}&lt;/span&gt;
            &lt;/button&gt;
          ))}
          {tasks.length &gt; 3 &amp;&amp; (
            &lt;div className="text-[11px] text-amber-700"&gt;+{tasks.length - 3} more tasks&lt;/div&gt;
          )}
        &lt;/div&gt;
      )}
    &lt;/div&gt;
  );
};

const GridClickCatcher = ({ date, onCreate }) =&gt; {
  const ref = useRef(null);

  const onDoubleClick = (e) =&gt; {
    const bounds = ref.current.getBoundingClientRect();
    const y = e.clientY - bounds.top; // px from top
    const minutes = clamp(Math.round((y / bounds.height) * 24 * 60 / 15) * 15, 0, 24*60);
    const start = new Date(date);
    start.setHours(Math.floor(minutes/60), minutes%60, 0, 0);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 60);
    onCreate({ start, end, allDay: false });
  };

  return &lt;div ref={ref} className="absolute inset-0" onDoubleClick={onDoubleClick} /&gt;;
};

const getCalendarColor = (calendarId, calendars) =&gt; calendars.find(c =&gt; c.id === calendarId)?.color || GC_COLORS.primary;
const getEventColor = (e, calendars) =&gt; e.color || getCalendarColor(e.calendarId, calendars);

const EventBlocks = ({ events, date, onEdit, calendars }) =&gt; {
  // Simple stacking without collision resolution beyond basic offset
  return (
    &lt;div className="relative h-full"&gt;
      {events.map((e, idx) =&gt; {
        const s = parseISOish(e.start);
        const en = parseISOish(e.end);
        const minutesFromTop = (s.getHours() * 60 + s.getMinutes()) / (24 * 60) * 100;
        const duration = Math.max(30, (en - s) / (1000 * 60));
        const heightPct = (duration / (24 * 60)) * 100;
        const leftOffset = (idx % 3) * 6; // naive overlap
        return (
          &lt;button
            key={e._key || e.id}
            onClick={() =&gt; onEdit(e)}
            className="absolute right-2 left-2 text-left rounded-md shadow-sm text-white px-2 py-1 overflow-hidden hover:brightness-95"
            style={{ top: `${minutesFromTop}%`, height: `${heightPct}%`, background: getEventColor(e, calendars), transform: `translateX(${leftOffset}px)` }}
          &gt;
            &lt;div className="text-[12px] font-medium leading-tight"&gt;{e.title}&lt;/div&gt;
            &lt;div className="text-[10px] opacity-90"&gt;{toTimeRange(s, en)}&lt;/div&gt;
          &lt;/button&gt;
        );
      })}
    &lt;/div&gt;
  );
};

const toTimeLabel = (d) =&gt; {
  const h = d.getHours();
  const m = pad(d.getMinutes());
  const ap = h &gt;= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${m} ${ap}`;
};

const toTimeRange = (s, e) =&gt; `${toTimeLabel(s)} - ${toTimeLabel(e)}`;

/********************** Event Modal **********************/
export const EventModal = ({ open, onClose, onSave, initial, calendars, onDelete }) =&gt; {
  const [title, setTitle] = useState(initial?.title || "Untitled event");
  const [allDay, setAllDay] = useState(initial?.allDay || false);
  const [start, setStart] = useState(initial?.start ? toISO(parseISOish(initial.start)) : toISO(new Date()));
  const [end, setEnd] = useState(initial?.end ? toISO(parseISOish(initial.end)) : toISO(addDays(new Date(), 0)));
  const [calendarId, setCalendarId] = useState(initial?.calendarId || calendars[0]?.id);
  const [color, setColor] = useState(initial?.color || "");
  const [category, setCategory] = useState(initial?.category || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "none");

  useEffect(() =&gt; {
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
  }, [open, initial, calendars]);

  if (!open) return null;

  return (
    &lt;div className="fixed inset-0 z-50" aria-modal="true" role="dialog"&gt;
      &lt;div className="absolute inset-0 bg-black/30" onClick={onClose} /&gt;
      &lt;div className="absolute inset-0 flex items-center justify-center p-4"&gt;
        &lt;div className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-xl overflow-hidden animate-[fadeIn_200ms_ease]"&gt;
          &lt;div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"&gt;
            &lt;div className="text-[18px] font-semibold"&gt;Event details&lt;/div&gt;
            &lt;button onClick={onClose} className="text-gray-500 hover:text-gray-700"&gt;✕&lt;/button&gt;
          &lt;/div&gt;
          &lt;div className="p-4 space-y-4"&gt;
            &lt;div&gt;
              &lt;input value={title} onChange={(e) =&gt; setTitle(e.target.value)} className="w-full text-[20px] font-medium outline-none" /&gt;
            &lt;/div&gt;
            &lt;div className="flex items-center gap-3"&gt;
              &lt;label className="flex items-center gap-2 text-sm"&gt;
                &lt;input type="checkbox" checked={allDay} onChange={(e) =&gt; setAllDay(e.target.checked)} /&gt;
                All day&lt;/label&gt;
              &lt;div className="text-xs text-gray-500"&gt;Double-click on a time grid to create quicker&lt;/div&gt;
            &lt;/div&gt;
            &lt;div className="grid grid-cols-2 gap-3"&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;Start&lt;/div&gt;
                &lt;input type="datetime-local" value={start} onChange={(e) =&gt; setStart(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /&gt;
              &lt;/div&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;End&lt;/div&gt;
                &lt;input type="datetime-local" value={end} onChange={(e) =&gt; setEnd(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /&gt;
              &lt;/div&gt;
            &lt;/div&gt;
            &lt;div className="grid grid-cols-2 gap-3"&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;Calendar&lt;/div&gt;
                &lt;select value={calendarId} onChange={(e) =&gt; setCalendarId(e.target.value)} className="w-full border rounded px-2 py-2 text-sm"&gt;
                  {calendars.map((c) =&gt; (
                    &lt;option key={c.id} value={c.id}&gt;{c.name}&lt;/option&gt;
                  ))}
                &lt;/select&gt;
              &lt;/div&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;Color (override)&lt;/div&gt;
                &lt;input type="color" value={color || "#ffffff"} onChange={(e) =&gt; setColor(e.target.value)} className="w-full h-9 border rounded" /&gt;
              &lt;/div&gt;
            &lt;/div&gt;
            &lt;div className="grid grid-cols-2 gap-3"&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;Category&lt;/div&gt;
                &lt;input value={category} onChange={(e) =&gt; setCategory(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /&gt;
              &lt;/div&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;Frequency&lt;/div&gt;
                &lt;select value={frequency} onChange={(e) =&gt; setFrequency(e.target.value)} className="w-full border rounded px-2 py-2 text-sm"&gt;
                  &lt;option value="none"&gt;None&lt;/option&gt;
                  &lt;option value="daily"&gt;Daily&lt;/option&gt;
                  &lt;option value="weekly"&gt;Weekly&lt;/option&gt;
                  &lt;option value="monthly"&gt;Monthly&lt;/option&gt;
                  &lt;option value="yearly"&gt;Yearly&lt;/option&gt;
                &lt;/select&gt;
              &lt;/div&gt;
            &lt;/div&gt;
          &lt;/div&gt;
          &lt;div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2 sticky bottom-0 bg-white"&gt;
            &lt;button onClick={() =&gt; onDelete &amp;&amp; initial?.id &amp;&amp; onDelete(initial.id)} className="px-3 py-1.5 rounded text-red-600 hover:bg-red-50"&gt;Delete&lt;/button&gt;
            &lt;div className="flex items-center gap-2"&gt;
              &lt;button onClick={onClose} className="px-3 py-1.5 rounded hover:bg-gray-100"&gt;Cancel&lt;/button&gt;
              &lt;button
                data-testid="save-event"
                onClick={() =&gt; {
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
                className="px-3 py-1.5 rounded bg-[#1a73e8] text-white hover:bg-[#1557b0]"
              &gt;Save&lt;/button&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

/********************** Task Modal **********************/
export const TaskModal = ({ open, onClose, initial, onSave, onDelete }) =&gt; {
  const [title, setTitle] = useState(initial?.title || "Untitled task");
  const [date, setDate] = useState(initial?.date ? toISO(parseISOish(initial.date)) : toISO(new Date()));
  const [status, setStatus] = useState(initial?.status || "pending");
  const [color, setColor] = useState(initial?.color || "#f59e0b");
  const [category, setCategory] = useState(initial?.category || "");
  const [frequency, setFrequency] = useState(initial?.frequency || "none");

  useEffect(() =&gt; {
    if (!open) return;
    setTitle(initial?.title || "Untitled task");
    const d = initial?.date instanceof Date ? initial.date : initial?.date ? parseISOish(initial.date) : new Date();
    setDate(toISO(d));
    setStatus(initial?.status || "pending");
    setColor(initial?.color || "#f59e0b");
    setCategory(initial?.category || "");
    setFrequency(initial?.frequency || "none");
  }, [open, initial]);

  if (!open) return null;

  return (
    &lt;div className="fixed inset-0 z-50" aria-modal="true" role="dialog"&gt;
      &lt;div className="absolute inset-0 bg-black/30" onClick={onClose} /&gt;
      &lt;div className="absolute inset-0 flex items-center justify-center p-4"&gt;
        &lt;div className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-white rounded-xl shadow-xl overflow-hidden animate-[fadeIn_200ms_ease]"&gt;
          &lt;div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between"&gt;
            &lt;div className="text-[18px] font-semibold"&gt;Task details&lt;/div&gt;
            &lt;button onClick={onClose} className="text-gray-500 hover:text-gray-700"&gt;✕&lt;/button&gt;
          &lt;/div&gt;
          &lt;div className="p-4 space-y-4"&gt;
            &lt;div&gt;
              &lt;input value={title} onChange={(e) =&gt; setTitle(e.target.value)} className="w-full text-[20px] font-medium outline-none" /&gt;
            &lt;/div&gt;
            &lt;div className="grid grid-cols-2 gap-3"&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;Date &amp; Time&lt;/div&gt;
                &lt;input type="datetime-local" value={date} onChange={(e) =&gt; setDate(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /&gt;
              &lt;/div&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;Status&lt;/div&gt;
                &lt;select value={status} onChange={(e) =&gt; setStatus(e.target.value)} className="w-full border rounded px-2 py-2 text-sm"&gt;
                  &lt;option value="pending"&gt;Pending&lt;/option&gt;
                  &lt;option value="completed"&gt;Completed&lt;/option&gt;
                  &lt;option value="incomplete"&gt;Incomplete&lt;/option&gt;
                &lt;/select&gt;
              &lt;/div&gt;
            &lt;/div&gt;
            &lt;div className="grid grid-cols-2 gap-3"&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;Color&lt;/div&gt;
                &lt;input type="color" value={color} onChange={(e) =&gt; setColor(e.target.value)} className="w-full h-9 border rounded" /&gt;
              &lt;/div&gt;
              &lt;div&gt;
                &lt;div className="text-xs text-gray-500 mb-1"&gt;Category&lt;/div&gt;
                &lt;input value={category} onChange={(e) =&gt; setCategory(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" /&gt;
              &lt;/div&gt;
            &lt;/div&gt;
            &lt;div&gt;
              &lt;div className="text-xs text-gray-500 mb-1"&gt;Frequency&lt;/div&gt;
              &lt;select value={frequency} onChange={(e) =&gt; setFrequency(e.target.value)} className="w-full border rounded px-2 py-2 text-sm"&gt;
                &lt;option value="none"&gt;None&lt;/option&gt;
                &lt;option value="daily"&gt;Daily&lt;/option&gt;
                &lt;option value="weekly"&gt;Weekly&lt;/option&gt;
                &lt;option value="monthly"&gt;Monthly&lt;/option&gt;
                &lt;option value="yearly"&gt;Yearly&lt;/option&gt;
              &lt;/select&gt;
            &lt;/div&gt;
          &lt;/div&gt;
          &lt;div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between gap-2 sticky bottom-0 bg-white"&gt;
            &lt;button onClick={() =&gt; onDelete &amp;&amp; initial?.id &amp;&amp; onDelete(initial.id)} className="px-3 py-1.5 rounded text-red-600 hover:bg-red-50"&gt;Delete&lt;/button&gt;
            &lt;div className="flex items-center gap-2"&gt;
              &lt;button onClick={onClose} className="px-3 py-1.5 rounded hover:bg-gray-100"&gt;Cancel&lt;/button&gt;
              &lt;button
                onClick={() =&gt; {
                  const payload = {
                    title: title?.trim() || "Untitled task",
                    date: date,
                    status,
                    color,
                    category: category || undefined,
                    frequency,
                  };
                  onSave(payload);
                }}
                className="px-3 py-1.5 rounded bg-[#1a73e8] text-white hover:bg-[#1557b0]"
              &gt;Save&lt;/button&gt;
            &lt;/div&gt;
          &lt;/div&gt;
        &lt;/div&gt;
      &lt;/div&gt;
    &lt;/div&gt;
  );
};

/********************** Placeholder **********************/
const SchedulePlaceholder = () =&gt; (
  &lt;div className="flex-1 grid place-items-center text-gray-500 p-10"&gt;
    Schedule view coming soon
  &lt;/div&gt;
);

/********************** Exports: State Helpers **********************/
export const useCalendarState = () =&gt; {
  const [calendars, setCalendars] = useState(defaultCalendars);
  const [events, setEvents] = useState(seedEvents);
  const [tasks, setTasks] = useState(seedTasks);
  const addEvent = (payload) =&gt; {
    const ev = {
      id: makeId(),
      ...payload,
    };
    setEvents((prev) =&gt; [...prev, ev]);
  };
  const updateEvent = (id, patch) =&gt; {
    setEvents((prev) =&gt; prev.map((e) =&gt; (e.id === id ? { ...e, ...patch } : e)));
  };
  const removeEvent = (id) =&gt; setEvents((prev) =&gt; prev.filter((e) =&gt; e.id !== id));

  const addTask = (payload) =&gt; {
    const t = { id: makeTaskId(), ...payload };
    setTasks((prev) =&gt; [...prev, t]);
  };
  const updateTask = (id, patch) =&gt; {
    setTasks((prev) =&gt; prev.map((t) =&gt; (t.id === id ? { ...t, ...patch } : t)));
  };
  const removeTask = (id) =&gt; setTasks((prev) =&gt; prev.filter((t) =&gt; t.id !== id));

  const updateTaskStatus = (id) =&gt; {
    setTasks((prev) =&gt; prev.map((t) =&gt; {
      if (t.id !== id) return t;
      const order = ["pending", "completed", "incomplete"];
      const idx = order.indexOf(t.status);
      const next = order[(idx + 1) % order.length];
      return { ...t, status: next };
    }));
  };
  return { calendars, setCalendars, events, setEvents, addEvent, updateEvent, removeEvent, tasks, setTasks, addTask, updateTask, removeTask, updateTaskStatus };
};

export const rangeTitle = (view, date) =&gt; {
  if (view === "day") return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  if (view === "week") {
    const s = getWeekStart(date, true);
    const e = addDays(s, 6);
    const sFmt = s.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const eFmt = e.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `${sFmt} – ${eFmt}`;
  }
  if (view === "month") return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return "";
};