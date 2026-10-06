"use client";

import { useEffect, useState } from "react";
import { Check, HelpCircle, Plus } from "lucide-react";
import {
  type TaskSession,
  type Database,
  stuckReasons,
  overrunReasons,
  type StuckReason,
} from "@/lib/models";
import {
  chooseOverrunReason,
  needsOverrunReflection,
  completeCheck,
  completeReflection,
  extendSession,
  finishWork,
  recordStuck,
} from "@/lib/flow";
import { formatMinutes } from "./ui";
import TaskJourney, { Confetti } from "./task-journey";
import QuietPet from "./quiet-pet";

type Commit = (transform: (db: Database) => Database) => boolean;
const stuckGuidance: Record<StuckReason, string> = {
  不认识字: "用点读笔读一读。",
  读不懂题目: "先做下一题。",
  "想上厕所 / 喝水": "先去上厕所、喝水，回来继续。",
};
function useClock() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const update = () => setNow(Date.now());
    const interval = setInterval(update, 500);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, []);
  return now;
}
export function Focus({
  session,
  commit,
}: {
  session: TaskSession;
  commit: Commit;
}) {
  const now = useClock();
  const [stuck, setStuck] = useState(false);
  const [reason, setReason] = useState<StuckReason | null>(null);
  const seconds = Math.max(0, Math.ceil((session.targetEndsAt - now) / 1000));
  const expired = seconds === 0;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const span = (session.estimatedMinutes + session.extensionCount * 5) * 60_000;
  const progress = Math.min(
    1,
    Math.max(0, 1 - (session.targetEndsAt - now) / span),
  );
  return (
    <section className="focus-screen">
      <h1 className="focus-task">{session.taskTitle}</h1>
      <div className="timer-ring">
        <svg viewBox="0 0 320 320" aria-hidden="true">
          <circle className="ring-track" cx="160" cy="160" r="149" />
          {[
            { start: 0, end: 50, color: "#83ad80" },
            { start: 50, end: 75, color: "#e4c45f" },
            { start: 75, end: 100, color: "#d78378" },
          ].map(({ start, end, color }) => {
            const remainingStart = Math.max(start, progress * 100);
            return (
              <circle
                key={color}
                className="ring-time-segment"
                cx="160"
                cy="160"
                r="149"
                pathLength="100"
                stroke={color}
                strokeDasharray={`${Math.max(0, end - remainingStart)} 100`}
                strokeDashoffset={-remainingStart}
              />
            );
          })}
        </svg>
        <div className="timer-face">
          <span
            className="timer-digits"
            role="timer"
            aria-label={`剩余 ${clock}`}
          >
            {clock}
          </span>
        </div>
      </div>
      <QuietPet />
      {stuck ? (
        <div className="focus-question" aria-labelledby="stuck-title">
          <h2 id="stuck-title">
            {reason ? stuckGuidance[reason] : "卡在哪里？"}
          </h2>
          {reason ? (
            <button
              className="primary full"
              onClick={() => {
                setStuck(false);
                setReason(null);
              }}
            >
              继续任务
            </button>
          ) : (
            <div className="reason-list">
              {stuckReasons.map((r) => (
                <button
                  className="choice-button"
                  key={r}
                  onClick={() => {
                    if (
                      commit((db) => recordStuck(db, session.id, r, Date.now()))
                    )
                      setReason(r);
                  }}
                >
                  {r}
                </button>
              ))}
              <button className="text-button" onClick={() => setStuck(false)}>
                返回
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={`focus-controls ${expired ? "time-up" : ""}`}>
          {expired && <h2 aria-live="polite">做完了吗？</h2>}
          <button
            className="primary full"
            onClick={() =>
              commit((db) => finishWork(db, session.id, Date.now()))
            }
          >
            <Check size={20} />
            做完了
          </button>
          {expired && (
            <button
              className="secondary full"
              onClick={() =>
                commit((db) => extendSession(db, session.id, Date.now()))
              }
            >
              <Plus size={19} />
              还要 5 分钟
            </button>
          )}
          <button className="text-button" onClick={() => setStuck(true)}>
            <HelpCircle size={18} />
            我卡住了
          </button>
        </div>
      )}
    </section>
  );
}
export function SelfCheck({
  session,
  commit,
}: {
  session: TaskSession;
  commit: Commit;
}) {
  return (
    <div className="decision-screen">
      <div className="decision-content check-screen">
        <span className="check-illustration">
          <Check size={38} strokeWidth={1.4} />
        </span>
        <h1>检查一下</h1>
        <p className="check-question">{session.checkQuestion}</p>
        <button
          className="primary full"
          onClick={() =>
            commit((db) => completeCheck(db, session.id, Date.now()))
          }
        >
          检查过了
          <Check size={20} />
        </button>
      </div>
    </div>
  );
}
export function Result({
  session,
  db,
  commit,
}: {
  session: TaskSession;
  db: Database;
  commit: Commit;
}) {
  const overrun = needsOverrunReflection(session);
  const celebrating = !overrun || session.reflectionReason !== null;
  const reason = overrun ? session.reflectionReason : null;
  return (
    <div className="decision-screen">
      <div className="decision-content result-screen">
        <Confetti />
        <h1>恭喜，完成啦！</h1>
        <p className="completed-task-name">{session.taskTitle}</p>
        {celebrating && <TaskJourney db={db} date={session.date} advance />}
        <div className="time-comparison">
          <div>
            <span>预计</span>
            <p>
              {session.estimatedMinutes}
              <small>分钟</small>
            </p>
          </div>
          <span className="comparison-line" />
          <div>
            <span>实际</span>
            <p>
              {formatMinutes(session.actualMinutes)}
              <small>分钟</small>
            </p>
          </div>
        </div>
        {!celebrating ? (
          <>
            <h2>为什么多花了时间？</h2>
            <div className="reflection-grid">
              {overrunReasons.map((r) => (
                <button
                  className="choice-button"
                  key={r}
                  onClick={() =>
                    commit((current) =>
                      chooseOverrunReason(current, session.id, r),
                    )
                  }
                >
                  {r}
                </button>
              ))}
            </div>
          </>
        ) : (
          <button
            className="primary full"
            onClick={() =>
              commit((current) =>
                completeReflection(current, session.id, reason, Date.now()),
              )
            }
          >
            回到今天
          </button>
        )}
      </div>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      加载中
    </div>
  );
}

