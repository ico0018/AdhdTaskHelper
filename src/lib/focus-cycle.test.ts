import { describe, expect, it } from "vitest";
import {
  createDatabase,
  createFocusCycle,
  editFocusCycle,
  endFocusCycle,
  activeFocusCycle,
  primaryTaskForDate,
  cycleCalendarLabel,
  editTask,
  startTask,
  startPreparedTask,
  activeSession,
  ensurePlan,
  tasksForDate,
  finishWork,
  completeCheck,
  completeReflection,
  extendSession,
  recordStuck,
} from "./flow";
import { databaseSchema, migrateDatabase } from "./models";
const day = "2026-10-06";
const now = new Date("2026-10-06T23:58:00+08:00").getTime();
const input = {
  title: "乘法自动化",
  startDate: "2026-10-01",
  targetEndDate: "2026-10-14",
};
function planned() {
  let db = createFocusCycle(createDatabase(day, now), input, now);
  db = editTask(db, db.tasks[2].id, {
    title: "6、7、8 的乘法",
    description: "",
    type: "math",
    priority: 3,
    materials: ["铅笔"],
    focusCycleId: activeFocusCycle(db)!.id,
  });
  return db;
}
describe("one focus cycle, fewer foreground choices", () => {
  it("migrates v1 without changing sessions, plans, reflections or task identities", () => {
    let db = createDatabase(day, now);
    db = startTask(db, db.tasks[0].id, 20, now);
    const legacy = {
      ...db,
      version: 1,
      focusCycles: undefined,
      tasks: db.tasks.map((task) =>
        Object.fromEntries(
          Object.entries(task).filter(([key]) => key !== "focusCycleId"),
        ),
      ),
    };
    const migrated = migrateDatabase(legacy);
    expect(migrated.version).toBe(2);
    expect(migrated.focusCycles).toEqual([]);
    expect(migrated.tasks.map((task) => task.id)).toEqual(
      db.tasks.map((task) => task.id),
    );
    expect(migrated.tasks.every((task) => task.focusCycleId === null)).toBe(
      true,
    );
    expect(migrated.sessions).toEqual(db.sessions);
    expect(migrated.plans).toEqual(db.plans);
    expect(migrated.reflections).toEqual(db.reflections);
    expect(migrateDatabase(migrated)).toEqual(migrated);
    expect(() => migrateDatabase({ ...db, version: 99 })).toThrow();
  });
  it("allows only one active cycle, including schema and concurrent stale creates", () => {
    const db = planned();
    expect(() => createFocusCycle(db, input, now)).toThrow("先结束");
    expect(
      databaseSchema.safeParse({
        ...db,
        focusCycles: [
          ...db.focusCycles,
          { ...db.focusCycles[0], id: "second" },
        ],
      }).success,
    ).toBe(false);
    const ended = endFocusCycle(db, db.focusCycles[0].id);
    expect(activeFocusCycle(createFocusCycle(ended, input, now))?.active).toBe(
      true,
    );
  });
  it("edits only cycle context and validates dates and titles", () => {
    const db = planned();
    const edited = editFocusCycle(db, db.focusCycles[0].id, {
      ...input,
      title: "乘法熟练度",
    });
    expect(edited.tasks).toEqual(db.tasks);
    expect(edited.sessions).toEqual(db.sessions);
    expect(() =>
      editFocusCycle(db, db.focusCycles[0].id, {
        ...input,
        startDate: "2026-02-30",
      }),
    ).toThrow();
    expect(() =>
      editFocusCycle(db, db.focusCycles[0].id, {
        ...input,
        targetEndDate: "2026-09-01",
      }),
    ).toThrow();
    expect(() =>
      createFocusCycle(
        createDatabase(day, now),
        { ...input, title: "  " },
        now,
      ),
    ).toThrow();
  });
  it("prioritizes the first pending cycle task even when its old priority is lower", () => {
    const db = planned();
    expect(primaryTaskForDate(db, day)?.id).toBe(db.tasks[2].id);
    expect(primaryTaskForDate(db, "2026-10-07")).toBeUndefined();
  });
  it("does not block ordinary choices when a cycle task exists", () => {
    const db = planned();
    const chosen = startTask(db, db.tasks[0].id, 20, now);
    expect(activeSession(chosen)?.taskId).toBe(db.tasks[0].id);
  });
  it("falls back to ordinary tasks when no cycle task exists today", () => {
    const db = createFocusCycle(createDatabase(day, now), input, now);
    expect(primaryTaskForDate(db, day)?.id).toBe(db.tasks[0].id);
    expect(activeSession(startTask(db, db.tasks[1].id, 20, now))?.taskId).toBe(
      db.tasks[1].id,
    );
  });
  it("preserves ordinary tasks and historical associations when a cycle ends", () => {
    const db = planned();
    const ended = endFocusCycle(db, db.focusCycles[0].id);
    expect(ended.tasks).toEqual(db.tasks);
    expect(tasksForDate(ended, day)).toHaveLength(3);
    expect(primaryTaskForDate(ended, day)?.id).toBe(db.tasks[0].id);
    expect(() => editFocusCycle(ended, db.focusCycles[0].id, input)).toThrow();
  });
  it("preserves preparation, active session and original date across midnight and cycle ending", () => {
    let db = planned();
    const taskId = db.tasks[2].id;
    const prep = {
      materials: ["铅笔"],
      bathroomAndWaterChecked: false,
      breathStartedAt: now - 3000,
      breathCompletedAt: now,
    };
    expect(() =>
      startPreparedTask(db, taskId, 20, { ...prep, materials: [] }, now),
    ).toThrow("所有材料");
    db = startPreparedTask(db, taskId, 20, prep, now);
    const session = activeSession(db)!;
    db = ensurePlan(db, "2026-10-07", now + 300000);
    db = endFocusCycle(db, db.focusCycles[0].id);
    db = migrateDatabase(JSON.parse(JSON.stringify(db)));
    expect(activeSession(db)).toEqual(session);
    expect(tasksForDate(db, "2026-10-07")).toEqual([]);
    expect(() => completeReflection(db, session.id, null, now)).toThrow("检查");
    db = recordStuck(db, session.id, "读不懂题目", now + 1000);
    db = extendSession(db, session.id, now + 21 * 60000);
    db = finishWork(db, session.id, now + 24 * 60000);
    expect(() => completeReflection(db, session.id, null, now)).toThrow("检查");
    db = completeCheck(db, session.id, now + 25 * 60000);
    db = completeReflection(db, session.id, "有题不会", now + 26 * 60000);
    expect(db.sessions[0]).toMatchObject({
      taskId,
      date: day,
      actualMinutes: 24,
      preparation: prep,
      completed: true,
      checkCompleted: true,
      extensionCount: 1,
      reflectionReason: "有题不会",
    });
    expect(db.sessions[0].stuckEvents).toHaveLength(1);
    expect(activeSession(db)).toBeUndefined();
    expect(db.reflections[0].date).toBe(day);
  });
  it("keeps completed sessions unchanged when ending and creating another cycle", () => {
    let db = planned();
    db = startTask(db, db.tasks[2].id, 10, now);
    const sid = activeSession(db)!.id;
    db = completeReflection(
      completeCheck(finishWork(db, sid, now + 60000), sid, now + 61000),
      sid,
      null,
      now + 62000,
    );
    const history = db.sessions;
    db = createFocusCycle(
      endFocusCycle(db, db.focusCycles[0].id),
      { ...input, title: "阅读" },
      now + 63000,
    );
    expect(db.sessions).toEqual(history);
    expect(db.tasks).toHaveLength(3);
    expect(databaseSchema.safeParse(db).success).toBe(true);
  });
  it("removes completed cycle tasks from primary choices", () => {
    let db = planned();
    db = startTask(db, db.tasks[2].id, 10, now);
    const sid = activeSession(db)!.id;
    db = completeReflection(
      completeCheck(finishWork(db, sid, now), sid, now),
      sid,
      null,
      now,
    );
    expect(primaryTaskForDate(db, day)?.id).toBe(db.tasks[0].id);
  });
  it("counts calendar days independently of completion, even across DST dates", () => {
    expect(cycleCalendarLabel(input, "2026-10-08")).toBe("Day 8 / 14");
    expect(cycleCalendarLabel(input, "2026-10-20")).toBe(
      "2026-10-01 — 2026-10-14",
    );
    expect(
      cycleCalendarLabel(
        { startDate: "2026-03-07", targetEndDate: "2026-03-10" },
        "2026-03-09",
      ),
    ).toBe("Day 3 / 4");
  });
  it("rejects dangling and ended cycle assignments while allowing normal tasks", () => {
    const db = planned();
    const ordinary = {
      title: "阅读",
      description: "",
      type: "reading" as const,
      priority: 2,
    };
    expect(() =>
      editTask(db, db.tasks[0].id, { ...ordinary, focusCycleId: "missing" }),
    ).toThrow("改变");
    const ended = endFocusCycle(db, db.focusCycles[0].id);
    expect(() =>
      editTask(ended, db.tasks[0].id, {
        ...ordinary,
        focusCycleId: db.focusCycles[0].id,
      }),
    ).toThrow();
    expect(
      editTask(ended, db.tasks[0].id, ordinary).tasks[0].focusCycleId,
    ).toBeNull();
  });
});
