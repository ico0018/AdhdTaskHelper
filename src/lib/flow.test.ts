import { describe, expect, it } from "vitest";
import {
  activeSession,
  addTask,
  completeCheck,
  completeReflection,
  createDatabase,
  dailyReflection,
  deleteTask,
  editTask,
  elapsedMinutes,
  ensurePlan,
  extendSession,
  finishWork,
  markReminder,
  predictionError,
  recordStuck,
  startTask,
  tasksForDate,
} from "./flow";
import { databaseSchema } from "./models";

const day = "2026-10-06";
const start = new Date("2026-10-06T09:00:00+08:00").getTime();
const minute = 60_000;
function started() {
  const db = createDatabase(day, start);
  return startTask(db, db.tasks[0].id, 20, start);
}
describe("the learning loop", () => {
  it("restores elapsed time from timestamps after a background gap", () => {
    const restored = databaseSchema.parse(
      JSON.parse(JSON.stringify(started())),
    );
    expect(elapsedMinutes(activeSession(restored)!, start + 27 * minute)).toBe(
      27,
    );
  });
  it("requires self-check and keeps checking / reflection out of study time", () => {
    let db = started();
    const sessionId = activeSession(db)!.id;
    expect(() => completeCheck(db, sessionId, start)).toThrow();
    db = finishWork(db, sessionId, start + 27 * minute);
    expect(activeSession(db)?.completed).toBe(false);
    expect(() => completeReflection(db, sessionId, null, start)).toThrow();
    db = completeCheck(db, sessionId, start + 30 * minute);
    db = completeReflection(db, sessionId, "有题不会", start + 32 * minute);
    expect(db.sessions[0]).toMatchObject({
      actualMinutes: 27,
      checkCompleted: true,
      completed: true,
      reflectionReason: "有题不会",
      status: "completed",
    });
    expect(activeSession(db)).toBeUndefined();
    expect(db.reflections).toHaveLength(1);
    expect(() => completeReflection(db, sessionId, null, start)).toThrow();
  });
  it("extends from now when overdue without judging failure", () => {
    let db = started();
    db = extendSession(db, activeSession(db)!.id, start + 24 * minute);
    expect(activeSession(db)).toMatchObject({
      extensionCount: 1,
      targetEndsAt: start + 29 * minute,
      completed: false,
    });
  });
  it("records every stuck event and the latest reason", () => {
    let db = started();
    const sessionId = activeSession(db)!.id;
    db = recordStuck(db, sessionId, "找不到东西", start + minute);
    db = recordStuck(db, sessionId, "走神了", start + 2 * minute);
    expect(activeSession(db)?.stuckEvents).toHaveLength(2);
    expect(activeSession(db)?.stuckReason).toBe("走神了");
  });
  it("records reminder before start and allows later correction", () => {
    let db = createDatabase(day, start);
    db = markReminder(db, db.tasks[0].id, true);
    db = startTask(db, db.tasks[0].id, 10, start);
    expect(db.sessions[0].startedIndependently).toBe(false);
    db = markReminder(db, db.tasks[0].id, false);
    expect(db.sessions[0].startedIndependently).toBe(true);
  });
  it("prevents concurrent / duplicate starts and invalid estimates", () => {
    const db = started();
    expect(() => startTask(db, db.tasks[1].id, 20, start)).toThrow();
    const empty = createDatabase(day, start);
    for (const estimate of [0, -1, 181, 2.5, NaN])
      expect(() =>
        startTask(empty, empty.tasks[0].id, estimate, start),
      ).toThrow();
  });
  it("creates an empty next day while preserving yesterday and the active session", () => {
    const db = ensurePlan(started(), "2026-10-07", start + 24 * 60 * minute);
    expect(tasksForDate(db, "2026-10-07")).toHaveLength(0);
    expect(tasksForDate(db, day)).toHaveLength(3);
    expect(activeSession(db)?.date).toBe(day);
  });
  it("handles prediction thresholds and very short tasks without division errors", () => {
    const session = started().sessions[0];
    expect(predictionError({ ...session, actualMinutes: 25 })).toBe(0.2);
    expect(predictionError({ ...session, actualMinutes: 0 })).toBe(Infinity);
  });
  it("edits unstarted tasks, preserves snapshots, and soft deletes historical tasks", () => {
    let db = createDatabase(day, start);
    const taskId = db.tasks[0].id;
    db = editTask(db, taskId, {
      title: "新名称",
      type: "reading",
      description: "读书",
      priority: 1,
    });
    db = startTask(db, taskId, 10, start);
    expect(() =>
      editTask(db, taskId, {
        title: "改名",
        type: "math",
        description: "",
        priority: 2,
      }),
    ).toThrow();
    expect(() => deleteTask(db, taskId, start)).toThrow();
    const sid = activeSession(db)!.id;
    db = completeReflection(
      completeCheck(finishWork(db, sid, start + minute), sid, start + minute),
      sid,
      null,
      start + minute,
    );
    db = deleteTask(db, taskId, start + 2 * minute);
    expect(tasksForDate(db, day)).toHaveLength(2);
    expect(db.sessions[0].taskTitle).toBe("新名称");
    expect(db.sessions[0].taskType).toBe("reading");
  });
  it("adds to the daily plan and updates a single daily reflection", () => {
    let db = createDatabase(day, start);
    db = addTask(
      db,
      day,
      { title: "写字", description: "", type: "writing", priority: 1 },
      start,
    );
    expect(tasksForDate(db, day)).toHaveLength(4);
    db = dailyReflection(db, day, db.tasks[0].id, start);
    db = dailyReflection(db, day, null, start + minute);
    expect(db.reflections).toHaveLength(1);
    expect(databaseSchema.safeParse(db).success).toBe(true);
  });
});
