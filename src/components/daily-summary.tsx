"use client";

import { Check, Home } from "lucide-react";
import type { Database } from "@/lib/models";
import { dailyReflection, sessionForTask, tasksForDate } from "@/lib/flow";
import { BackButton, TaskIcon, formatMinutes } from "./ui";

export default function DailySummary({
  db,
  date,
  onBack,
  commit,
}: {
  db: Database;
  date: string;
  onBack: () => void;
  commit: (transform: (db: Database) => Database) => boolean;
}) {
  const tasks = tasksForDate(db, date);
  const sessions = db.sessions.filter((s) => s.date === date && s.completed);
  const done = tasks.filter((t) => sessionForTask(db, t.id)?.completed).length;
  const allDone = tasks.length > 0 && done === tasks.length;
  const reflection = db.reflections.find(
    (r) => r.date === date && r.kind === "daily",
  );
  return (
    <div className="decision-screen">
      <BackButton onClick={onBack} />
      <div className="decision-content daily-summary">
        <div className="finish-path">
          {tasks.map((task) => (
            <span
              key={task.id}
              className={`finish-dot ${sessionForTask(db, task.id)?.completed ? "filled" : ""}`}
            >
              {sessionForTask(db, task.id)?.completed && <Check size={13} />}
            </span>
          ))}
          <Home size={30} strokeWidth={1.4} />
        </div>
        <h1>{allDone ? "今天完成啦" : "今日任务"}</h1>
        <div className="daily-stats">
          <div>
            <strong>{tasks.length}</strong>
            <span>计划任务</span>
          </div>
          <div>
            <strong>{done}</strong>
            <span>完成任务</span>
          </div>
          <div>
            <strong>
              {formatMinutes(
                sessions.reduce((sum, s) => sum + s.actualMinutes, 0),
              )}
              <small>分钟</small>
            </strong>
            <span>今天总学习时间</span>
          </div>
        </div>
        {allDone && (
          <div className="daily-question">
            <h2>
              今天哪件事比你想象中
              <br className="mobile-break" />
              花的时间更多？
            </h2>
            <div className="reason-list">
              {tasks.map((task) => (
                <button
                  className={`choice-button task-choice ${reflection?.moreTimeTaskId === task.id ? "selected" : ""}`}
                  key={task.id}
                  onClick={() =>
                    commit((current) =>
                      dailyReflection(current, date, task.id, Date.now()),
                    )
                  }
                >
                  <TaskIcon type={task.type} small />
                  {task.title}
                  {reflection?.moreTimeTaskId === task.id && (
                    <Check size={18} />
                  )}
                </button>
              ))}
              <button
                className={`choice-button ${reflection && !reflection.moreTimeTaskId ? "selected" : ""}`}
                onClick={() =>
                  commit((current) =>
                    dailyReflection(current, date, null, Date.now()),
                  )
                }
              >
                都和我想的差不多
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
