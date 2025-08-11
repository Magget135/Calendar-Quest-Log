import React, { useMemo, useState } from "react";
import "./index.css";
import "./App.css";
import { BrowserRouter } from "react-router-dom";
import { CalendarView, EventModal, LeftSidebar, TopBar, TaskModal, rangeTitle, useCalendarState, LeftNav, CreateChooser } from "./components.jss";

function App() {
  const [view, setView] = useState("week");
  const [date, setDate] = useState(new Date());
  const title = useMemo(() => rangeTitle(view, date), [view, date]);

  const { calendars, setCalendars, events, addEvent, updateEvent, removeEvent, tasks, addTask, updateTask, removeTask } = useCalendarState();

  const [showTasks, setShowTasks] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitial, setModalInitial] = useState(null);

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalInitial, setTaskModalInitial] = useState(null);

  const [createChooserOpen, setCreateChooserOpen] = useState(false);
  const [createContext, setCreateContext] = useState(null);

  const handleCreate = ({ start, end, allDay }) => {
    // Ask user what they want to create: Event or Task
    setCreateContext({ start, end, allDay: !!allDay });
    setCreateChooserOpen(true);
  };

  const handleChooseCreate = (type) => {
    setCreateChooserOpen(false);
    if (!createContext) return;
    if (type === "event") {
      setModalInitial({ start: createContext.start, end: createContext.end, allDay: createContext.allDay });
      setModalOpen(true);
    } else if (type === "task") {
      setTaskModalInitial({
        title: "Untitled task",
        date: createContext.start,
        allDay: !!createContext.allDay,
        status: "pending",
      });
      setTaskModalOpen(true);
    }
  };

  const handleEdit = (evt) => {
    setModalInitial(evt);
    setModalOpen(true);
  };

  const handleEditTask = (task) => {
    setTaskModalInitial(task);
    setTaskModalOpen(true);
  };

  const onSave = (payload) => {
    if (modalInitial?.id) {
      updateEvent(modalInitial.id, payload);
    } else {
      addEvent(payload);
    }
    setModalOpen(false);
  };

  const onDeleteEvent = (id) => {
    removeEvent(id);
    setModalOpen(false);
  };

  const onSaveTask = (payload) => {
    if (taskModalInitial?.id) {
      updateTask(taskModalInitial.id, payload);
    } else {
      addTask(payload);
    }
    setTaskModalOpen(false);
  };

  const onDeleteTask = (id) => {
    removeTask(id);
    setTaskModalOpen(false);
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
      <div className="min-h-screen bg-white text-black">
        <TopBar title={title} onPrev={onPrev} onNext={onNext} onToday={onToday} view={view} setView={setView} />
        <div className="flex">
          <LeftNav />
          <LeftSidebar
            date={date}
            onDateChange={setDate}
            onCreate={handleCreate}
            calendars={calendars}
            setCalendars={setCalendars}
            showTasks={showTasks}
            setShowTasks={setShowTasks}
          />
          <main className="flex-1">
            <CalendarView
              view={view}
              date={date}
              events={events}
              calendars={calendars}
              onCreate={handleCreate}
              onEdit={handleEdit}
              tasks={tasks}
              showTasks={showTasks}
              onEditTask={handleEditTask}
            />
          </main>
        </div>

        <EventModal open={modalOpen} onClose={() => setModalOpen(false)} onSave={onSave} initial={modalInitial} calendars={calendars} onDelete={onDeleteEvent} />
        <TaskModal open={taskModalOpen} onClose={() => setTaskModalOpen(false)} initial={taskModalInitial} onSave={onSaveTask} onDelete={onDeleteTask} />
        <CreateChooser open={createChooserOpen} onClose={() => setCreateChooserOpen(false)} onChoose={handleChooseCreate} />
      </div>
    </BrowserRouter>
  );
}

export default App;