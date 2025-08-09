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

/********************** Colors & Fonts **********************/
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
const makeId = () => `evt-${idCounter++}`;

const seedEvents = [
  {
    id: makeId(),
    title: "Standup",
    start: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+1, 9, 30)),
    end: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+1, 10, 0)),
    allDay: false,
    calendarId: "cal-2",
  },
  {
    id: makeId(),
    title: "Design Review",
    start: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+2, 13, 0)),
    end: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+2, 14, 30)),
    allDay: false,
    calendarId: "cal-1",
  },
  {
    id: makeId(),
    title: "Team Lunch",
    start: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+3, 12, 0)),
    end: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+3, 13, 0)),
    allDay: false,
    calendarId: "cal-3",
  },
  {
    id: makeId(),
    title: "Conference",
    start: toISO(addDays(weekStart, 2)),
    end: toISO(addDays(weekStart, 4)),
    allDay: true,
    calendarId: "cal-1",
  },
  {
    id: makeId(),
    title: "Workout",
    start: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+5, 18, 0)),
    end: toISO(new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate()+5, 19, 0)),
    allDay: false,
    calendarId: "cal-4",
  },
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

        <div className="flex-1 max-w-[520px] mx-4 hidden md:flex items-center">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"><Icon name="search" /></span>
            <input className="w-full pl-10 pr-3 py-2 bg-gray-100 rounded-full outline-none text-sm focus:ring-2 focus:ring-blue-500" placeholder="Search" />
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1">
          <button className="p-2 rounded hover:bg-gray-100" aria-label="Help"><Icon name="help" /></button>
          <button className="p-2 rounded hover:bg-gray-100" aria-label="Settings"><Icon name="settings" /></button>
          <button className="p-2 rounded hover:bg-gray-100" aria-label="Apps"><Icon name="apps" /></button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 grid place-items-center text-white text-xs font-bold ml-1">JD</div>
        </div>
      </div>

      <div className="md:hidden flex items-center gap-2 px-4 pb-3">
        <button onClick={onPrev} className="p-1.5 rounded hover:bg-gray-100" aria-label="Previous"><Icon name="chev-left" /></button>
        <button onClick={onNext} className="p-1.5 rounded hover:bg-gray-100" aria-label="Next"><Icon name="chev-right" /></button>
        <button onClick={onToday} className="px-3 py-1 border rounded text-sm">Today</button>
        <div className="text-[18px] font-semibold">{title}</div>
      </div>

      <div className="px-4 sm:px-6 py-2 border-t border-gray-100 flex items-center gap-2">
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
          <button key={o} onClick={() => setView(o.toLowerCase())} className={`px-3 py-1.5 text-sm ${active ? "bg-blue-50 text-blue-700" : "bg-white text-gray-700 hover:bg-gray-50"}`}>{o}</button>
        );
      })}
    </div>
  );
};

/********************** Left Sidebar **********************/
export const LeftSidebar = ({ date, onDateChange, onCreate, calendars, setCalendars }) => {
  return (
    <aside className="w-[300px] shrink-0 border-r border-gray-200 bg-white hidden lg:block">
      <div className="p-4">
        <button data-testid="create" onClick={() => onCreate({ start: new Date(), end: addDays(new Date(), 0), allDay: false })} className="w-full flex items-center justify-center gap-2 bg-[#1a73e8] hover:bg-[#1557b0] text-white rounded-md py-2.5 shadow-sm transition">
          <Icon name="plus" className="w-5 h-5" />
          <span className="font-medium">Create</span>
        </button>
      </div>

      <div className="px-3 pb-4">
        <MiniMonth date={date} onDateChange={onDateChange} />
      </div>

      <div className="px-3 pb-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">My calendars</div>
        <div className="space-y-2">
          {calendars.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer select-none">
              <input type="checkbox" checked={c.checked} onChange={(e) => setCalendars((prev) => prev.map(p => p.id === c.id ? { ...p, checked: e.target.checked } : p))} />
              <span className="inline-block w-3 h-3 rounded" style={{ background: c.color }} />
              <span>{c.name}</span>
            </label>
          ))}
        </div>
      </div>
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
            <button key={idx} onClick={() => onDateChange(d)} className={`aspect-[1/0.8] bg-white p-2 text-left hover:bg-blue-50 focus:outline-none ${isSelected ? "ring-2 ring-blue-500" : ""}`}>
              <div className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[12px] ${isToday ? "text-white bg-[#1a73e8]" : "text-gray-800"} ${isOther ? "opacity-40" : ""}`}>{d.getDate()}</div>
              <div className="mt-1 flex gap-0.5">
                <span className="w-1 h-1 rounded-full bg-[#1a73e8]" />
                <span className="w-1 h-1 rounded-full bg-[#33b679]" />
                <span className="w-1 h-1 rounded-full bg-[#f4511e]" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

/********************** Calendar Grids **********************/
export const CalendarView = ({ view, date, events, calendars, onCreate, onEdit }) => {
  if (view === "day") return <DayView date={date} events={events} calendars={calendars} onCreate={onCreate} onEdit={onEdit} />;
  if (view === "week") return <WeekView date={date} events={events} calendars={calendars} onCreate={onCreate} onEdit={onEdit} />;
  if (view === "month") return <MonthView date={date} events={events} calendars={calendars} onCreate={onCreate} onEdit={onEdit} />;
  return <SchedulePlaceholder />;
};

const hours = [...Array(24)].map((_, i) => i);

// Auto-scroll helper to bring a target hour into view on initial render
const useAutoScrollToHour = (scrollRef, targetHour) => {
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const t = typeof targetHour === "number" ? targetHour : Math.max(0, new Date().getHours() - 2);
    const measureAndScroll = () => {
      const hourCell = el.querySelector('[data-hour="8"]') || el.querySelector('[data-hour="0"]');
      const hourHeight = hourCell ? hourCell.offsetHeight : 64;
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
    <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${top}%` }}>
      <div className="absolute -left-2 w-2 h-2 bg-[#ea4335] rounded-full" />
      <div className="border-t-2 border-[#ea4335]" />
    </div>
  );
};

const filterEventsByCalendars = (events, calendars) => {
  const allowed = new Set(calendars.filter(c => c.checked).map(c => c.id));
  return events.filter(e => allowed.has(e.calendarId));
};

const DayView = ({ date, events, calendars, onCreate, onEdit }) => {
  const filtered = useMemo(() => filterEventsByCalendars(events, calendars), [events, calendars]);
  const dayEvents = filtered.filter(e => sameDay(parseISOish(e.start), date) || (e.allDay && (parseISOish(e.start) <= endOfDay(date) && parseISOish(e.end) >= startOfDay(date))));

  const scrollRef = useRef(null);
  useAutoScrollToHour(scrollRef);
  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: "64px 1fr" }}>
        <div className="bg-white" />
        <div className="bg-white border-b border-gray-200 px-4 py-2">
          <AllDayRow date={date} events={dayEvents.filter(e => e.allDay)} timedEvents={dayEvents.filter(e => !e.allDay)} onEdit={onEdit} calendars={calendars} />
        </div>
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: "64px 1fr" }}>
        <div className="bg-white">
          {hours.map((h) => (
            <div key={h} data-hour={h} className="h-16 border-t border-gray-100 text-[11px] text-right pr-2 text-gray-500">
              <div className="-mt-2">{h === 0 ? "" : h > 12 ? `${h-12}pm` : h === 12 ? "12pm" : `${h}am`}</div>
            </div>
          ))}
        </div>
        <div className="bg-white border-l border-gray-100 relative">
          <div className="absolute inset-0">
            {hours.map((h) => (
              <div key={h} className="h-16 border-t border-gray-100" />
            ))}
          </div>
          <NowIndicator date={date} />
          <GridClickCatcher date={date} onCreate={onCreate} />
          <EventBlocks events={dayEvents.filter(e => !e.allDay)} date={date} onEdit={onEdit} calendars={calendars} />
        </div>
      </div>
    </div>
  );
};

const WeekView = ({ date, events, calendars, onCreate, onEdit }) => {
  const start = getWeekStart(date, true);
  const days = [...Array(7)].map((_, i) => addDays(start, i));
  const filtered = useMemo(() => filterEventsByCalendars(events, calendars), [events, calendars]);
  const byDay = days.map(d => filtered.filter(e => sameDay(parseISOish(e.start), d) || (e.allDay && (parseISOish(e.start) <= endOfDay(d) && parseISOish(e.end) >= startOfDay(d)))));

  const scrollRef = useRef(null);
  useAutoScrollToHour(scrollRef);

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
      <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="bg-white" />
        {days.map((d, i) => (
          <div key={i} className="bg-white border-b border-gray-200 px-4 py-2">
            <AllDayRow date={d} events={byDay[i].filter(e => e.allDay)} timedEvents={byDay[i].filter(e => !e.allDay)} onEdit={onEdit} calendars={calendars} />
          </div>
        ))}
      </div>
      <div className="relative grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="bg-white">
          {hours.map((h) => (
            <div key={h} data-hour={h} className="h-16 border-t border-gray-100 text-[11px] text-right pr-2 text-gray-500">
              <div className="-mt-2">{h === 0 ? "" : h > 12 ? `${h-12}pm` : h === 12 ? "12pm" : `${h}am`}</div>
            </div>
          ))}
        </div>
        {days.map((d, i) => (
          <div key={i} className={`bg-white border-l border-gray-100 relative ${sameDay(d, new Date()) ? "bg-blue-50/20" : ""}`}>
            <div className="absolute inset-0 pointer-events-none">
              {hours.map((h) => (
                <div key={h} className="h-16 border-t border-gray-100" />
              ))}
            </div>
            <NowIndicator date={d} />
            <GridClickCatcher date={d} onCreate={onCreate} />
            <EventBlocks events={byDay[i].filter(e => !e.allDay)} date={d} onEdit={onEdit} calendars={calendars} />
          </div>
        ))}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "64px repeat(7, 1fr)" }}>
        <div className="bg-white" />
        {days.map((d, i) => (
          <div key={i} className="bg-white border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
            <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${sameDay(d, new Date()) ? "bg-[#1a73e8] text-white" : "bg-gray-100"}`}>
              <span className="font-semibold">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
              <span>{d.getDate()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const MonthView = ({ date, events, calendars, onCreate, onEdit }) => {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const start = getWeekStart(first, true);
  const days = [...Array(42)].map((_, i) => addDays(start, i));
  const filtered = useMemo(() => filterEventsByCalendars(events, calendars), [events, calendars]);

  const grouped = useMemo(() => {
    const m = new Map();
    days.forEach((d) => {
      const key = d.toDateString();
      m.set(key, []);
    });
    filtered.forEach((e) => {
      const s = startOfDay(parseISOish(e.start));
      const until = e.allDay ? endOfDay(parseISOish(e.end)) : endOfDay(parseISOish(e.start));
      for (let d = new Date(s); d <= until; d = addDays(d, 1)) {
        const key = d.toDateString();
        if (m.has(key)) m.get(key).push(e);
      }
    });
    return m;
  }, [filtered, date]);

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
          const evs = grouped.get(key) || [];
          return (
            <div key={idx} className={`bg-white min-h-[120px] hover:bg-gray-50 transition ${sameDay(d, new Date()) ? "outline outline-2 outline-[#1a73e8] -outline-offset-2" : ""}`}>
              <div className="flex items-center justify-between px-2 py-1">
                <button data-testid="month-date" onClick={() => onCreate({ start: d, end: d, allDay: true })} className={`text-xs font-medium px-1.5 py-0.5 rounded ${other ? "text-gray-400" : "text-gray-700"}`}>{d.getDate()}</button>
              </div>
              <div className="px-2 pb-2 space-y-1">
                {evs.slice(0, 3).map((e) => (
                  <button key={e.id} onClick={() => onEdit(e)} className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-gray-100 text-left">
                    <span className="inline-block w-2 h-2 rounded" style={{ background: getCalendarColor(e.calendarId, calendars) }} />
                    <span className="truncate text-[12px]">{e.title}</span>
                  </button>
                ))}
                {evs.length > 3 && (
                  <div className="text-xs text-blue-700">+{evs.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const AllDayRow = ({ date, events, timedEvents = [], onEdit, calendars }) => {
  return (
    <div className="min-h-[38px] flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {events.map((e) => (
          <button key={e.id} onClick={() => onEdit(e)} className="px-2 py-0.5 rounded text-[12px] text-white shadow-sm hover:brightness-95" style={{ background: getCalendarColor(e.calendarId, calendars) }}>{e.title}</button>
        ))}
      </div>
      {timedEvents.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {timedEvents.slice(0, 2).map((e) => {
            const s = parseISOish(e.start);
            return (
              <button key={`t-${e.id}`} onClick={() => onEdit(e)} className="px-1.5 py-0.5 rounded bg-gray-50 hover:bg-gray-100 text-[11px] text-gray-700 inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded" style={{ background: getCalendarColor(e.calendarId, calendars) }} />
                <span>{toTimeLabel(s)} {e.title}</span>
              </button>
            );
          })}
          {timedEvents.length > 2 && (
            <div className="text-[11px] text-blue-700">+{timedEvents.length - 2} more</div>
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

const EventBlocks = ({ events, date, onEdit, calendars }) => {
  // Simple stacking without collision resolution beyond basic offset
  return (
    <div className="relative">
      {events.map((e, idx) => {
        const s = parseISOish(e.start);
        const en = parseISOish(e.end);
        const minutesFromTop = (s.getHours() * 60 + s.getMinutes()) / (24 * 60) * 100;
        const duration = Math.max(30, (en - s) / (1000 * 60));
        const heightPct = (duration / (24 * 60)) * 100;
        const leftOffset = (idx % 3) * 6; // naive overlap
        return (
          <button
            key={e.id}
            onClick={() => onEdit(e)}
            className="absolute right-2 left-2 text-left rounded-md shadow-sm text-white px-2 py-1 overflow-hidden hover:brightness-95"
            style={{ top: `${minutesFromTop}%`, height: `${heightPct}%`, background: getCalendarColor(e.calendarId, calendars), transform: `translateX(${leftOffset}px)` }}
          >
            <div className="text-[12px] font-medium leading-tight">{e.title}</div>
            <div className="text-[10px] opacity-90">{toTimeRange(s, en)}</div>
          </button>
        );
      })}
    </div>
  );
};

const toTimeRange = (s, e) => {
  const fmt = (d) => {
    const h = d.getHours();
    const m = pad(d.getMinutes());
    const ap = h >= 12 ? "PM" : "AM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${m} ${ap}`;
  };
  return `${fmt(s)} - ${fmt(e)}`;
};

/********************** Event Modal **********************/
export const EventModal = ({ open, onClose, onSave, initial, calendars }) => {
  const [title, setTitle] = useState(initial?.title || "Untitled event");
  const [allDay, setAllDay] = useState(initial?.allDay || false);
  const [start, setStart] = useState(initial?.start ? toISO(parseISOish(initial.start)) : toISO(new Date()));
  const [end, setEnd] = useState(initial?.end ? toISO(parseISOish(initial.end)) : toISO(addDays(new Date(), 0)));
  const [calendarId, setCalendarId] = useState(initial?.calendarId || calendars[0]?.id);

  useEffect(() => {
    if (!open) return;
    setTitle(initial?.title || "Untitled event");
    setAllDay(initial?.allDay || false);
    const s = initial?.start instanceof Date ? initial.start : initial?.start ? parseISOish(initial.start) : new Date();
    const e = initial?.end instanceof Date ? initial.end : initial?.end ? parseISOish(initial.end) : addDays(new Date(), 0);
    setStart(toISO(s));
    setEnd(toISO(e));
    setCalendarId(initial?.calendarId || calendars[0]?.id);
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
            <div>
              <div className="text-xs text-gray-500 mb-1">Calendar</div>
              <select value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className="w-full border rounded px-2 py-2 text-sm">
                {calendars.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-end gap-2 sticky bottom-0 bg-white">
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
                };
                onSave(payload);
              }}
              className="px-3 py-1.5 rounded bg-[#1a73e8] text-white hover:bg-[#1557b0]"
            >Save</button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
  return { calendars, setCalendars, events, setEvents, addEvent, updateEvent, removeEvent };
};

export const rangeTitle = (view, date) => {
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