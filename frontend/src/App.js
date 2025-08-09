import React, { useMemo, useState } from "react";
import "./index.css";
import "./App.css";
import { BrowserRouter } from "react-router-dom";
import { CalendarView, EventModal, LeftSidebar, TopBar, rangeTitle, useCalendarState } from "./components.jss";

function App() {
  const [view, setView] = useState("week");
  const [date, setDate] = useState(new Date());
  const title = useMemo(() => rangeTitle(view, date), [view, date]);

  const { calendars, setCalendars, events, addEvent, updateEvent } = useCalendarState();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);

  const handleCreate = ({ start, end, allDay }) => {
    setModalInitial({ start, end, allDay });
    setModalOpen(true);
  };

  const handleEdit = (evt) => {
    setModalInitial(evt);
    setModalOpen(true);
  };

  const onSave = (payload) => {
    if (modalInitial?.id) {
      updateEvent(modalInitial.id, payload);
    } else {
      addEvent(payload);
    }
    setModalOpen(false);
  };

  const onPrev = () => {
    if (view === "day") setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1));
    else if (view === "week") setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() - 7));
    else if (view === "month") setDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  };
  const onNext = () => {
    if (view === "day") setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1));
    else if (view === "week") setDate((d) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7));
    else if (view === "month") setDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  };
  const onToday = () => setDate(new Date());

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-[#1f1f1f]">
        <TopBar title={title} onPrev={onPrev} onNext={onNext} onToday={onToday} view={view} setView={setView} />
        <div className="flex">
          <LeftSidebar date={date} onDateChange={setDate} onCreate={handleCreate} calendars={calendars} setCalendars={setCalendars} />
          <main className="flex-1">
            <CalendarView view={view} date={date} events={events} calendars={calendars} onCreate={handleCreate} onEdit={handleEdit} />
          &lt;/main&gt;
        &lt;/div&gt;

        <EventModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={onSave} initial={modalInitial} calendars={calendars} />
      &lt;/div&gt;
    &lt;/BrowserRouter&gt;
  );
}

export default App;