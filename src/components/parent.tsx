"use client";

import { useState } from "react";
import { Check, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { type Database, type Task } from "@/lib/models";
import { markReminder, sessionForTask, tasksForDate } from "@/lib/flow";
import { repository } from "@/lib/repository";
import { Modal, TaskIcon, formatMinutes } from "./ui";

export function exportRecords() {
  const url = URL.createObjectURL(
    new Blob([repository.exportData()], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `nora-flow-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Parent({
  db,
  today,
  onAdd,
  onEdit,
  onDelete,
  commit,
}: {
  db: Database;
  today: string;
  onAdd: () => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  commit: (transform: (db: Database) => Database) => boolean;
}) {
  const [date, setDate] = useState(today);
  const [details, setDetails] = useState<string | null>(null);
  const tasks = tasksForDate(db, date);
  const sessions = db.sessions.filter((s) => s.date === date);
  const shown = sessions.find((s) => s.id === details);
  // Include deleted tasks in historical records while keeping them off the child's plan.
  const deletedSessions = sessions.filter(
    (s) => !tasks.some((t) => t.id === s.taskId),
  );
  return (
    <div className="parent-screen">
      <div className="parent-heading">
        <div>
          <h1>家长端</h1>
        </div>
      </div>
      <div className="parent-toolbar">
        <label>
          查看日期
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) setDate(e.target.value);
            }}
            max={today}
          />
        </label>
        <button className="secondary" onClick={onAdd}>
          <Plus size={18} />
          添加今天的任务
        </button>
      </div>
      <div className="parent-table" role="table" aria-label="学习任务记录">
        <div className="parent-row table-head" role="row">
          <span role="columnheader">任务</span>
          <span role="columnheader">预计</span>
          <span role="columnheader">实际</span>
          <span role="columnheader">状态</span>
        </div>
        {tasks.map((task) => {
          const session = sessionForTask(db, task.id);
          const reminded = session
            ? !session.startedIndependently
            : task.reminderPending;
          return (
            <div className="parent-record" key={task.id}>
              <div className="parent-row" role="row">
                <span className="table-task" role="cell">
                  <TaskIcon small type={task.type} />
                  <span>{session?.taskTitle ?? task.title}</span>
                </span>
                <span role="cell">
                  {session ? `${session.estimatedMinutes}m` : "—"}
                </span>
                <span role="cell">
                  {session
                    ? session.finishedAt === null
                      ? "计时中"
                      : `${formatMinutes(session.actualMinutes)}m`
                    : "—"}
                </span>
                <span
                  role="cell"
                  className={session?.completed ? "status-done" : "muted"}
                >
                  {session?.completed
                    ? "完成"
                    : session?.status === "checking"
                      ? "自检中"
                      : session
                        ? "进行中"
                        : "待开始"}
                </span>
              </div>
              <p className="parent-materials">
                准备材料：
                {task.materials.length ? task.materials.join("、") : "未设置"}
              </p>
              <div className="record-actions">
                <label className="reminder-checkbox">
                  <input
                    type="checkbox"
                    checked={reminded}
                    onChange={(e) =>
                      commit((current) =>
                        markReminder(current, task.id, e.target.checked),
                      )
                    }
                  />
                  提醒后开始
                </label>
                <div className="record-buttons">
                  {session && (
                    <button
                      className="text-button compact"
                      onClick={() => setDetails(session.id)}
                    >
                      过程记录
                    </button>
                  )}
                  {!session && (
                    <button
                      className="icon-button"
                      aria-label={`编辑${task.title}`}
                      onClick={() => onEdit(task)}
                    >
                      <Pencil size={17} />
                    </button>
                  )}
                  <button
                    className="icon-button"
                    disabled={!!session && session.status !== "completed"}
                    aria-label={`删除${task.title}`}
                    onClick={() => onDelete(task)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {deletedSessions.map((s) => (
          <div key={s.id} className="parent-record">
            <div className="parent-row" role="row">
              <span role="cell">
                {s.taskTitle}
                <small className="muted">（已移出计划）</small>
              </span>
              <span role="cell">{s.estimatedMinutes}m</span>
              <span role="cell">{formatMinutes(s.actualMinutes)}m</span>
              <span role="cell">{s.completed ? "完成" : "未完成"}</span>
            </div>
            <button
              className="text-button compact"
              onClick={() => setDetails(s.id)}
            >
              过程记录
            </button>
          </div>
        ))}
        {!tasks.length && !deletedSessions.length && (
          <p className="table-empty">这一天还没有任务记录。</p>
        )}
      </div>
      <div className="parent-stats">
        <div>
          <span>主动开始</span>
          <strong>
            {sessions.filter((s) => s.startedIndependently).length}
            <small>次</small>
          </strong>
        </div>
        <div>
          <span>需要提醒</span>
          <strong>
            {sessions.filter((s) => !s.startedIndependently).length}
            <small>次</small>
          </strong>
        </div>
        <div>
          <span>卡住</span>
          <strong>
            {sessions.reduce((n, s) => n + s.stuckEvents.length, 0)}
            <small>次</small>
          </strong>
        </div>
      </div>
      <p className="parent-note">
        “提醒后开始”可在开始前勾选，也可以事后更正。没勾选的任务默认记为主动开始。
      </p>
      <div className="parent-bottom">
        <p>
          记录只保存在当前设备的浏览器里。
          <br />
          换设备前，可以导出一份备份。
        </p>
        <button className="text-button" onClick={exportRecords}>
          <Download size={17} />
          导出历史记录
        </button>
      </div>
      {shown && (
        <Modal title={shown.taskTitle} onClose={() => setDetails(null)}>
          <div className="session-details">
            <p>
              延时 <strong>{shown.extensionCount}</strong> 次
            </p>
            <p>
              启动方式：{shown.startedIndependently ? "主动开始" : "提醒后开始"}
            </p>
            <p>自检：{shown.checkCompleted ? "检查过了" : "尚未检查"}</p>
            <p>复盘：{shown.reflectionReason ?? "尚未填写 / 已跳过"}</p>
            {shown.preparation && (
              <>
                <p>
                  已检查材料：
                  {shown.preparation.materials.join("、") || "无材料"}
                </p>
                <p>深呼吸：已完成 3 秒</p>
                <p>
                  如厕和喝水：
                  {shown.preparation.bathroomAndWaterChecked
                    ? "已确认"
                    : "本次未触发提醒"}
                </p>
              </>
            )}
            <h3>卡住的记录</h3>
            {shown.stuckEvents.length ? (
              shown.stuckEvents.map((event, i) => (
                <p key={i}>
                  <span className="muted">
                    {new Date(event.at).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>{" "}
                  · {event.reason}
                </p>
              ))
            ) : (
              <p className="muted">没有卡住的记录。</p>
            )}
            <button className="primary full" onClick={() => setDetails(null)}>
              <Check size={18} />
              看好了
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
