import { describe, expect, it } from "vitest";
import {
  createDatabase,
  ensurePlan,
  startTask,
  finishWork,
  completeCheck,
  completeReflection,
  deleteTask,
  settleDailyPoints,
} from "./flow";
import { databaseSchema } from "./models";
import {
  reviewTask,
  pointsForDate,
  totalPoints,
  saveTemplate,
  addFromTemplate,
  removeTemplate,
} from "./points-templates";
const day = "2026-10-07";
const now = new Date(`${day}T09:00:00`).getTime();
function completed() {
  let db = createDatabase(day, now);
  db = startTask(db, db.tasks[0].id, 20, now);
  const sid = db.sessions[0].id;
  db = finishWork(db, sid, now + 60_000);
  db = completeCheck(db, sid, now + 65_000);
  return completeReflection(db, sid, null, now + 70_000);
}
describe("points and reusable task templates", () => {
  it("safely reads legacy records without retroactive penalties", () => {
    const legacy = JSON.parse(JSON.stringify(completed()));
    delete legacy.templates;
    delete legacy.scoringStartedOn;
    legacy.sessions.forEach((s: Record<string, unknown>) => delete s.quality);
    legacy.plans.forEach((p: Record<string, unknown>) => delete p.dailyPenalty);
    const db = ensurePlan(
      databaseSchema.parse(legacy),
      "2026-10-08",
      now + 86400000,
    );
    expect(db.templates).toEqual([]);
    expect(db.sessions[0].quality).toBeNull();
    expect(db.scoringStartedOn).toBe("2026-10-08");
    expect(totalPoints(db)).toBe(0);
    expect(db.plans[0].dailyPenalty).toBeNull();
  });
  it("awards 2, 1 or 0 only after a parent review and never duplicates points", () => {
    let db = completed();
    const sid = db.sessions[0].id;
    expect(pointsForDate(db, day)).toMatchObject({ total: 0, pending: 1 });
    db = reviewTask(db, sid, "all_correct");
    expect(totalPoints(db)).toBe(2);
    db = reviewTask(db, sid, "all_correct");
    expect(totalPoints(db)).toBe(2);
    db = reviewTask(db, sid, "within_quarter");
    expect(totalPoints(db)).toBe(1);
    db = reviewTask(db, sid, "over_quarter");
    expect(totalPoints(db)).toBe(0);
    expect(
      databaseSchema.parse(JSON.parse(JSON.stringify(db))).sessions[0].quality,
    ).toBe("over_quarter");
  });
  it("rejects incomplete, unchecked, unknown and old task reviews", () => {
    let db = createDatabase(day, now);
    db = startTask(db, db.tasks[0].id, 20, now);
    expect(() => reviewTask(db, db.sessions[0].id, "all_correct")).toThrow();
    expect(() => reviewTask(db, "missing", "all_correct")).toThrow();
    db = completed();
    db.scoringStartedOn = "2026-10-08";
    expect(() => reviewTask(db, db.sessions[0].id, "all_correct")).toThrow();
  });
  it("settles incomplete days once at midnight, ignores today and empty days", () => {
    let db = completed();
    expect(settleDailyPoints(db, day).plans[0].dailyPenalty).toBeNull();
    db = ensurePlan(db, "2026-10-08", now + 86400000);
    expect(pointsForDate(db, day).penalty).toBe(-1);
    db = ensurePlan(db, "2026-10-09", now + 2 * 86400000);
    expect(totalPoints(db)).toBe(-1);
    expect(pointsForDate(db, "2026-10-08").penalty).toBe(0);
    expect(settleDailyPoints(db, "2026-10-09")).toEqual(db);
    db = deleteTask(db, db.tasks[1].id, now + 2 * 86400000);
    expect(pointsForDate(db, day).penalty).toBe(-1);
  });
  it("does not penalize reaching home even when correctness is still pending", () => {
    let db = completed();
    for (const task of db.tasks.slice(1)) {
      db = startTask(db, task.id, 20, now + 120000);
      const sid = db.sessions.at(-1)!.id;
      db = finishWork(db, sid, now + 130000);
      db = completeCheck(db, sid, now + 135000);
      db = completeReflection(db, sid, null, now + 140000);
    }
    db = ensurePlan(db, "2026-10-08", now + 86400000);
    expect(pointsForDate(db, day)).toMatchObject({ penalty: 0, pending: 3 });
  });
  it("preserves active cross-midnight sessions and their penalty after late completion", () => {
    let db = createDatabase(day, now);
    db = startTask(db, db.tasks[0].id, 20, now);
    db = ensurePlan(db, "2026-10-08", now + 86400000);
    expect(db.sessions[0].status).toBe("focusing");
    const sid = db.sessions[0].id;
    db = finishWork(db, sid, now + 86400000);
    db = completeCheck(db, sid, now + 86401000);
    db = completeReflection(db, sid, "有题不会", now + 86402000);
    expect(pointsForDate(db, day).penalty).toBe(-1);
  });
  it("reuses materials and times, keeps independent sessions and does not duplicate a daily task", () => {
    let db = completed();
    const input = {
      ...db.tasks[0],
      materials: ["尺子", "字卡"],
      timeOptions: [5, 10, 15],
    };
    db = saveTemplate(db, input, now);
    db = saveTemplate(db, { ...input, timeOptions: [10, 15, 20] }, now + 1);
    expect(db.templates).toHaveLength(1);
    const templateId = db.templates[0].id;
    expect(() => addFromTemplate(db, templateId, day, now)).toThrow();
    db = addFromTemplate(db, templateId, "2026-10-08", now + 86400000);
    expect(db.tasks.at(-1)).toMatchObject({
      materials: ["尺子", "字卡"],
      timeOptions: [10, 15, 20],
      reminderPending: false,
    });
    expect(db.tasks.at(-1)!.id).not.toBe(input.id);
    expect(db.sessions).toHaveLength(1);
    db = removeTemplate(db, templateId);
    expect(db.templates).toHaveLength(0);
    expect(db.sessions).toHaveLength(1);
    expect(db.tasks).toHaveLength(4);
    expect(() => addFromTemplate(db, templateId, "2026-10-09", now)).toThrow();
  });
});

