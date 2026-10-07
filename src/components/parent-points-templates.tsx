"use client";
import { useState } from "react";
import type { Database, TaskQuality, TaskSession } from "@/lib/models";
import {
  addFromTemplate,
  pointsForDate,
  qualityLabels,
  removeTemplate,
  reviewTask,
  totalPoints,
} from "@/lib/points-templates";
type Commit = (transform: (db: Database) => Database) => boolean;

export function QualityReview({
  db,
  session,
  commit,
}: {
  db: Database;
  session: TaskSession;
  commit: Commit;
}) {
  const [draft, setDraft] = useState<{
    sessionId: string;
    savedQuality: TaskSession["quality"];
    quality: TaskQuality;
  } | null>(null);
  const selectedQuality =
    draft?.sessionId === session.id && draft.savedQuality === session.quality
      ? draft.quality
      : (session.quality ?? "");
  if (
    !session.completed ||
    !session.checkCompleted ||
    !db.scoringStartedOn ||
    session.date < db.scoringStartedOn
  )
    return null;
  return (
    <div className="quality-review">
      <label>
        正确情况
        <select
          aria-label={`${session.taskTitle}正确情况`}
          value={selectedQuality}
          onChange={(e) =>
            setDraft({
              sessionId: session.id,
              savedQuality: session.quality,
              quality: e.target.value as TaskQuality,
            })
          }
        >
          <option value="" disabled>
            待家长确认
          </option>
          {Object.entries(qualityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        className="secondary quality-submit"
        disabled={!selectedQuality || selectedQuality === session.quality}
        onClick={() => {
          if (
            selectedQuality &&
            commit((current) =>
              reviewTask(current, session.id, selectedQuality),
            )
          )
            setDraft(null);
        }}
      >
        提交积分修改
      </button>
    </div>
  );
}
export default function ParentPointsTemplates({
  db,
  today,
  date,
  commit,
}: {
  db: Database;
  today: string;
  date: string;
  commit: Commit;
}) {
  const [selected, setSelected] = useState("");
  const points = pointsForDate(db, date);
  return (
    <>
      <section className="parent-feature" aria-label="积分">
        <h2>积分</h2>
        <p>
          总积分 <strong>{totalPoints(db)}</strong> · 所选日期{" "}
          <strong>{points.total}</strong>
        </p>
        <p>
          任务得分 {points.earned} · 全部完成 +{points.bonus} · 未到小房子{" "}
          {points.penalty}
          {points.pending > 0 ? ` · ${points.pending}项待确认` : ""}
        </p>
        <p className="form-note">
          每完成一项先得1分，全部完成另加2分。检查后提交调整：全对每项2分，错误不超过¼每项1分，超过¼每项0分。当天有任务但0:00没到小房子，扣1分。
        </p>
      </section>
      <section className="parent-feature" aria-label="任务模板">
        <h2>任务模板</h2>
        {db.templates.length ? (
          <>
            <label>
              选择模板
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
              >
                <option value="">请选择</option>
                {db.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="template-actions">
              <button
                className="secondary"
                disabled={!selected}
                onClick={() => {
                  if (
                    commit((current) =>
                      addFromTemplate(current, selected, today, Date.now()),
                    )
                  )
                    setSelected("");
                }}
              >
                添加到今天
              </button>
              <button
                className="text-button"
                disabled={!selected}
                onClick={() => {
                  if (commit((current) => removeTemplate(current, selected)))
                    setSelected("");
                }}
              >
                删除模板
              </button>
            </div>
          </>
        ) : (
          <p>添加任务时勾选“保存为模板”，下次直接使用。</p>
        )}
      </section>
    </>
  );
}
