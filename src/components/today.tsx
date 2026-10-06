"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { Database, Task } from "@/lib/models";
import {
  activeFocusCycle,
  cycleCalendarLabel,
  primaryTaskForDate,
  sessionForTask,
  tasksForDate,
} from "@/lib/flow";
import { TaskIcon } from "./ui";

export default function Today({
  db,
  date,
  onSelect,
  onSummary,
}: {
  db: Database;
  date: string;
  onSelect: (task: Task) => void;
  onSummary: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const tasks = tasksForDate(db, date);
  const cycle = activeFocusCycle(db);
  const primary = primaryTaskForDate(db, date);
  const others = tasks.filter(
    (task) =>
      task.id !== primary?.id && !sessionForTask(db, task.id)?.completed,
  );
  const done = tasks.filter((task) => sessionForTask(db, task.id)?.completed);
  return (
    <div className="child-today cycle-today">
      {cycle && (
        <section className="cycle-context" aria-labelledby="cycle-title">
          <h2>🔥 我最近在练</h2>
          <h1 id="cycle-title">{cycle.title}</h1>
          <p>{cycleCalendarLabel(cycle, date)}</p>
        </section>
      )}
      {primary ? (
        <section className="current-task" aria-labelledby="current-title">
          <h2>现在</h2>
          <div className="current-card">
            <TaskIcon type={primary.type} />
            <h2 id="current-title">{primary.title}</h2>
            {primary.description && <p>{primary.description}</p>}
            <button className="primary full" onClick={() => onSelect(primary)}>
              开始
            </button>
          </div>
        </section>
      ) : (
        <section className="today-empty">
          {tasks.length ? (
            <>
              <h1>今天完成啦</h1>
              <button className="primary full" onClick={onSummary}>
                查看今天
              </button>
            </>
          ) : (
            <h1>今天没有任务</h1>
          )}
        </section>
      )}
      {!!others.length && (
        <section className="remaining-tasks">
          <button
            className="remaining-toggle"
            aria-expanded={expanded}
            aria-controls="remaining-list"
            onClick={() => setExpanded(!expanded)}
          >
            今天还有 <ChevronDown size={20} aria-hidden="true" />
          </button>
          {expanded && (
            <div id="remaining-list" className="remaining-list">
              {others.map((task) => (
                <button
                  key={task.id}
                  className="remaining-task"
                  onClick={() => onSelect(task)}
                >
                  {task.title}
                </button>
              ))}
            </div>
          )}
        </section>
      )}
      {!!primary && !!done.length && (
        <button className="text-button completed-link" onClick={onSummary}>
          查看已完成
        </button>
      )}
    </div>
  );
}
