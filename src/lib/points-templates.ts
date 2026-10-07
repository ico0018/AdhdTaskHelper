import {
  type Database,
  type TaskQuality,
  type TaskInput,
  templateSchema,
} from "./models";
import { addTask, id, journeyForDate, tasksForDate } from "./flow";

export const qualityLabels: Record<TaskQuality, string> = {
  all_correct: "全对 · 2分",
  within_quarter: "错误不超过¼ · 1分",
  over_quarter: "错误超过¼ · 0分",
};
export function reviewTask(
  db: Database,
  sessionId: string,
  quality: TaskQuality,
): Database {
  if (!Object.hasOwn(qualityLabels, quality))
    throw new Error("请选择正确情况。");
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session?.completed || !session.checkCompleted)
    throw new Error("请先完成任务和自检。");
  if (!db.scoringStartedOn || session.date < db.scoringStartedOn)
    throw new Error("启用前的历史任务不计分。");
  return {
    ...db,
    sessions: db.sessions.map((s) =>
      s.id === sessionId ? { ...s, quality } : s,
    ),
  };
}
export function pointsForDate(db: Database, date: string) {
  const sessions =
    db.scoringStartedOn && date >= db.scoringStartedOn
      ? db.sessions.filter(
          (s) => s.date === date && s.completed && s.checkCompleted,
        )
      : [];
  const earned = sessions.reduce(
    (sum, s) =>
      sum +
      (s.quality === "all_correct" ? 2 : s.quality === "over_quarter" ? 0 : 1),
    0,
  );
  const penalty = db.plans.find((p) => p.date === date)?.dailyPenalty ?? 0;
  const journey = journeyForDate(db, date);
  const bonus =
    db.plans.find((p) => p.date === date)?.completionBonus === 2
      ? 2
      : db.scoringStartedOn &&
          date >= db.scoringStartedOn &&
          journey.total > 0 &&
          journey.completed === journey.total
        ? 2
        : 0;
  return {
    earned,
    bonus,
    penalty,
    total: earned + bonus + penalty,
    pending: sessions.filter((s) => s.quality === null).length,
  };
}
export function totalPoints(db: Database) {
  return [
    ...new Set([
      ...db.plans.map((p) => p.date),
      ...db.sessions.map((s) => s.date),
    ]),
  ].reduce((sum, date) => sum + pointsForDate(db, date).total, 0);
}
export function saveTemplate(
  db: Database,
  input: TaskInput,
  now: number,
): Database {
  const template = templateSchema.parse({
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    id: id(),
    createdAt: now,
  });
  // Saving the same task again updates its reusable settings.
  const existing = db.templates.find(
    (t) => t.title === template.title && t.type === template.type,
  );
  return {
    ...db,
    templates: existing
      ? db.templates.map((t) =>
          t.id === existing.id
            ? { ...template, id: t.id, createdAt: t.createdAt }
            : t,
        )
      : [...db.templates, template],
  };
}
export function addFromTemplate(
  db: Database,
  templateId: string,
  date: string,
  now: number,
): Database {
  const template = db.templates.find((t) => t.id === templateId);
  if (!template) throw new Error("模板不存在。");
  if (
    tasksForDate(db, date).some(
      (t) => t.title === template.title && t.type === template.type,
    )
  )
    throw new Error("今天已有这项任务。");
  return addTask(db, date, template, now);
}
export function removeTemplate(db: Database, templateId: string): Database {
  return { ...db, templates: db.templates.filter((t) => t.id !== templateId) };
}
