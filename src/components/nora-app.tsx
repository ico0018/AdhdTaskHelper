"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Check, Leaf } from "lucide-react";
import Link from "next/link";
import type { Database, Task } from "@/lib/models";
import {
  activeSession,
  addTask,
  deleteTask,
  editTask,
  ensurePlan,
  localDate,
  tasksForDate,
  sessionForTask,
} from "@/lib/flow";
import { repository, serverSnapshot } from "@/lib/repository";
import Today from "./today";
import TaskForm from "./task-form";
import Parent, { exportRecords } from "./parent";
import DailySummary from "./daily-summary";
import Preparation from "./preparation";
import { Focus, SelfCheck, Result, Loading } from "./session-flow";
import { saveTemplate } from "@/lib/points-templates";
import { Modal } from "./ui";

export default function NoraApp({
  parentMode = false,
}: {
  parentMode?: boolean;
}) {
  const db = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    serverSnapshot,
  );
  const [page, setPage] = useState<"today" | "summary">("today");
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState<Task | "new" | null>(null);
  const [remove, setRemove] = useState<Task | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [today, setToday] = useState(() => localDate());
  const commit = useCallback((transform: (db: Database) => Database) => {
    try {
      repository.update(transform);
      setError(null);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败，请重试。");
      return false;
    }
  }, []);
  useEffect(() => {
    const initialization = window.setTimeout(() => {
      try {
        repository.initialize();
        setReady(true);
        setError(null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "无法读取记录。");
      }
    }, 0);
    const updateDate = () => {
      const date = localDate();
      setToday(date);
      if (repository.getSnapshot())
        commit((current) => ensurePlan(current, date, Date.now()));
    };
    const interval = setInterval(updateDate, 60_000);
    window.addEventListener("focus", updateDate);
    return () => {
      window.clearTimeout(initialization);
      clearInterval(interval);
      window.removeEventListener("focus", updateDate);
    };
  }, [commit]);
  const session = db ? activeSession(db) : undefined;
  const selectedTask = db?.tasks.find((t) => t.id === selected && !t.deletedAt);
  const inFocus = !!session && !parentMode;
  const goToday = () => {
    setPage("today");
    setSelected(null);
  };
  let content;
  if (!ready || !db)
    content = error ? (
      <div className="load-error">
        <h1>记录暂时没有打开</h1>
        <p>{error}</p>
        {parentMode && (
          <button className="secondary" onClick={exportRecords}>
            导出原始记录
          </button>
        )}
        <button className="primary" onClick={() => window.location.reload()}>
          重新打开
        </button>
      </div>
    ) : (
      <Loading />
    );
  else if (parentMode)
    content = (
      <Parent
        db={db}
        today={today}
        onAdd={() => setForm("new")}
        onEdit={setForm}
        onDelete={setRemove}
        commit={commit}
      />
    );
  else if (session?.status === "focusing")
    content = <Focus key={session.id} session={session} commit={commit} />;
  else if (session?.status === "checking")
    content = <SelfCheck session={session} commit={commit} />;
  else if (session?.status === "reflecting")
    content = (
      <Result
        session={session}
        db={db}
        commit={(transform) => {
          const success = commit(transform);
          if (success && !activeSession(repository.getSnapshot()!)) {
            setSelected(null);
            const current = repository.getSnapshot()!;
            const tasks = tasksForDate(current, today);
            setPage(
              tasks.length > 0 &&
                tasks.every((t) => sessionForTask(current, t.id)?.completed)
                ? "summary"
                : "today",
            );
          }
          return success;
        }}
      />
    );
  else if (selectedTask)
    content = (
      <Preparation
        key={selectedTask.id}
        task={selectedTask}
        bathroomReminder={db.user.preparationReminderNeeded}
        commit={commit}
        onBack={goToday}
      />
    );
  else if (page === "summary")
    content = (
      <DailySummary db={db} date={today} onBack={goToday} commit={commit} />
    );
  else
    content = (
      <Today
        db={db}
        date={today}
        onSelect={(task) => setSelected(task.id)}
        onSummary={() => setPage("summary")}
      />
    );
  return (
    <div
      className={`app ${parentMode ? "parent-app" : "child-app"} ${inFocus ? "is-focusing" : ""}`}
    >
      {!inFocus && (
        <header className="site-header">
          <Link
            className="wordmark"
            href="/"
            aria-label="任务小帮手 首页"
            onClick={
              parentMode
                ? undefined
                : (e) => {
                    e.preventDefault();
                    goToday();
                  }
            }
          >
            <span className="brand-icon">
              <Leaf size={20} strokeWidth={1.8} />
            </span>
            任务小帮手
          </Link>
        </header>
      )}
      <main className={inFocus ? "focus-main" : "main-container"}>
        {content}
      </main>
      {parentMode && form && (
        <TaskForm
          task={form === "new" ? undefined : form}
          onClose={() => setForm(null)}
          onSave={(input, saveAsTemplate) =>
            commit((current) => {
              const next =
                form === "new"
                  ? addTask(current, today, input, Date.now())
                  : editTask(current, form.id, input);
              return saveAsTemplate
                ? saveTemplate(next, input, Date.now())
                : next;
            })
          }
        />
      )}
      {parentMode && remove && (
        <Modal title="移出计划？" onClose={() => setRemove(null)}>
          <p className="delete-description">{remove.title}</p>
          <div className="modal-actions">
            <button className="secondary" onClick={() => setRemove(null)}>
              取消
            </button>
            <button
              className="primary"
              onClick={() => {
                if (
                  commit((current) =>
                    deleteTask(current, remove.id, Date.now()),
                  )
                )
                  setRemove(null);
              }}
            >
              移出计划
            </button>
          </div>
        </Modal>
      )}
      {error && ready && (
        <div className="error-toast" role="alert">
          <span>{error}</span>
          <button aria-label="关闭提示" onClick={() => setError(null)}>
            <Check size={18} />
          </button>
        </div>
      )}
    </div>
  );
}

