"use client";

import { useState } from "react";
import { ArrowUpRight, Check, ChevronDown } from "lucide-react";
import type { Database, Task } from "@/lib/models";
import { sessionForTask, tasksForDate } from "@/lib/flow";
import TaskJourney from "./task-journey";
import { totalPoints } from "@/lib/points-templates";
import { QuietLandscape, TaskIcon } from "./ui";

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
  const [showAll, setShowAll] = useState(false);
  const tasks = tasksForDate(db, date);
  const done = tasks.filter((t) => sessionForTask(db, t.id)?.completed);
  const ordered = [
    ...tasks.filter((t) => !sessionForTask(db, t.id)?.completed),
    ...done,
  ];
  return (
    <div className="child-today">
      <section className="hero">
        <h1>今天做什么？</h1>
        <QuietLandscape />
      </section>
      <TaskJourney db={db} date={date} />
      <p className="child-points">积分 {totalPoints(db)}</p>
      <section className="task-section" aria-label="今天的任务">
        {!tasks.length ? (
          <div className="empty-state">
            <h2>今天没有任务</h2>
          </div>
        ) : (
          <div className="task-list">
            {(showAll ? ordered : ordered.slice(0, 3)).map((task) => {
              const completed = !!sessionForTask(db, task.id)?.completed;
              return (
                <button
                  key={task.id}
                  className={`task-card ${completed ? "is-done" : ""}`}
                  onClick={() => (completed ? onSummary() : onSelect(task))}
                  aria-label={`${task.title}，${completed ? "已完成，查看今天" : "选择这件事"}`}
                >
                  <TaskIcon type={task.type} />
                  <div className="task-copy">
                    <div className="task-title">{task.title}</div>
                    {task.description && <p>{task.description}</p>}
                  </div>
                  <span className={`task-status ${completed ? "checked" : ""}`}>
                    {completed ? (
                      <Check size={19} />
                    ) : (
                      <ArrowUpRight size={20} />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {tasks.length > 3 && (
          <button className="more-button" onClick={() => setShowAll(!showAll)}>
            <ChevronDown size={18} />
            {showAll ? "收起" : `更多任务（${tasks.length - 3}）`}
          </button>
        )}
        {tasks.length > 0 && done.length === tasks.length && (
          <button className="primary full summary-link" onClick={onSummary}>
            今天完成啦
          </button>
        )}
      </section>
    </div>
  );
}

