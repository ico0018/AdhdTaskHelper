import { describe, expect, it } from "vitest";
import {
  createDatabase,
  editTask,
  startTask,
  startPreparedTask,
  recordStuck,
  finishWork,
  completeCheck,
  completeReflection,
  chooseOverrunReason,
  needsOverrunReflection,
  journeyForDate,
  activeSession,
} from "./flow";
import {
  databaseSchema,
  stuckReasons,
  timeOptionsSchema,
  overrunReasons,
  type TaskPreparation,
} from "./models";

const time = 1_800_000_000_000;
const preparation: TaskPreparation = {
  materials: ["尺子", "铅笔", "橡皮"],
  bathroomAndWaterChecked: false,
  breathStartedAt: time,
  breathCompletedAt: time + 24000,
  guidedBreaths: 3,
  guidedBreathingMs: 24000,
};
function planned() {
  const db = createDatabase("2026-10-06", time);
  return editTask(db, db.tasks[0].id, {
    title: "数学",
    description: "",
    type: "math",
    priority: 1,
    materials: preparation.materials,
  });
}
describe("task preparation", () => {
  it("blocks missing materials, unfinished breath and unsupported time choices", () => {
    const db = planned();
    const taskId = db.tasks[0].id;
    expect(() =>
      startPreparedTask(
        db,
        taskId,
        20,
        { ...preparation, materials: ["尺子"] },
        time + 25000,
      ),
    ).toThrow("所有材料");
    expect(() =>
      startPreparedTask(
        db,
        taskId,
        20,
        { ...preparation, breathCompletedAt: time + 23999 },
        time + 25000,
      ),
    ).toThrow("3 次");
    expect(() =>
      startPreparedTask(
        db,
        taskId,
        20,
        { ...preparation, breathCompletedAt: time + 26000 },
        time + 25000,
      ),
    ).toThrow("3 次");
    expect(() =>
      startPreparedTask(db, taskId, 15, preparation, time + 25000),
    ).toThrow("时间");
  });
  it("starts timing only on formal start and saves preparation snapshots", () => {
    const db = planned();
    const next = startPreparedTask(
      db,
      db.tasks[0].id,
      20,
      preparation,
      time + 30000,
    );
    expect(next.sessions[0]).toMatchObject({
      startedAt: time + 30000,
      targetEndsAt: time + 30000 + 20 * 60000,
      actualMinutes: 0,
      preparation,
    });
    expect(databaseSchema.safeParse(next).success).toBe(true);
  });
  it("keeps bathroom/water reminder through reload, requires confirmation next time and then consumes it", () => {
    let db = createDatabase("2026-10-06", time);
    db = startTask(db, db.tasks[0].id, 10, time);
    const sid = db.sessions[0].id;
    db = recordStuck(db, sid, "想上厕所 / 喝水", time + 1000);
    db = databaseSchema.parse(JSON.parse(JSON.stringify(db)));
    expect(db.user.preparationReminderNeeded).toBe(true);
    db = completeReflection(
      completeCheck(finishWork(db, sid, time + 60000), sid, time + 61000),
      sid,
      null,
      time + 62000,
    );
    const nextPrep = {
      ...preparation,
      materials: [],
      breathStartedAt: time + 70000,
      breathCompletedAt: time + 94000,
    };
    expect(() =>
      startPreparedTask(db, db.tasks[1].id, 10, nextPrep, time + 95000),
    ).toThrow("上厕所和喝水");
    db = startPreparedTask(
      db,
      db.tasks[1].id,
      10,
      { ...nextPrep, bathroomAndWaterChecked: true },
      time + 95000,
    );
    expect(db.user.preparationReminderNeeded).toBe(false);
    expect(db.sessions[1].preparation?.bathroomAndWaterChecked).toBe(true);
  });
  it("uses exactly three new choices and does not trigger bathroom reminders for reading difficulty", () => {
    expect(stuckReasons).toEqual(["不认识字", "读不懂题目", "想上厕所 / 喝水"]);
    let db = createDatabase("2026-10-06", time);
    db = startTask(db, db.tasks[0].id, 10, time);
    db = recordStuck(db, db.sessions[0].id, "不认识字", time + 1000);
    db = recordStuck(db, db.sessions[0].id, "读不懂题目", time + 2000);
    expect(db.sessions[0].stuckEvents).toHaveLength(2);
    expect(db.user.preparationReminderNeeded).toBe(false);
  });
  it("reads older records without losing old reasons or overwriting tasks", () => {
    let db = createDatabase("2026-10-06", time);
    db = startTask(db, db.tasks[0].id, 20, time);
    db = recordStuck(db, db.sessions[0].id, "走神了", time);
    const legacy = {
      ...db,
      user: Object.fromEntries(
        Object.entries(db.user).filter(
          ([key]) => key !== "preparationReminderNeeded",
        ),
      ),
      tasks: db.tasks.map((task) =>
        Object.fromEntries(
          Object.entries(task).filter(([key]) => key !== "materials"),
        ),
      ),
      sessions: db.sessions.map((session) =>
        Object.fromEntries(
          Object.entries(session).filter(([key]) => key !== "preparation"),
        ),
      ),
    };
    const restored = databaseSchema.parse(legacy);
    expect(restored.user.preparationReminderNeeded).toBe(false);
    expect(restored.tasks[0].materials).toEqual([]);
    expect(restored.tasks[0].id).toBe(db.tasks[0].id);
    expect(restored.sessions[0].preparation).toBeNull();
    expect(restored.sessions[0].stuckReason).toBe("走神了");
  });
});

describe("new preparation and completion rules", () => {
  it("saves different parent time choices per task and rejects a stale choice", () => {
    let db = planned();
    const input = {
      title: "数学",
      description: "",
      type: "math" as const,
      priority: 1,
      materials: preparation.materials,
      timeOptions: [5, 15, 25],
    };
    db = editTask(db, db.tasks[0].id, input);
    expect(db.tasks[1].timeOptions).toEqual([10, 20, 30]);
    expect(() =>
      startPreparedTask(db, db.tasks[0].id, 20, preparation, time + 25000),
    ).toThrow("时间");
    db = startPreparedTask(db, db.tasks[0].id, 15, preparation, time + 25000);
    expect(db.sessions[0].estimatedMinutes).toBe(15);
    const invalidDb = planned();
    expect(() =>
      editTask(invalidDb, invalidDb.tasks[0].id, {
        ...input,
        timeOptions: [10, 10, 30],
      }),
    ).toThrow();
    for (const options of [
      [0, 10, 20],
      [10, 10, 20],
      [10, 20],
      [1.5, 10, 20],
      [10, 20, 181],
    ])
      expect(timeOptionsSchema.safeParse(options).success).toBe(false);
  });
  it("requires three guided cycles, not just elapsed wall time; extra breaths are recorded", () => {
    const db = planned();
    for (const prep of [
      { ...preparation, guidedBreaths: 2 },
      { ...preparation, guidedBreathingMs: 23999 },
      { ...preparation, guidedBreaths: 4 },
    ])
      expect(() =>
        startPreparedTask(db, db.tasks[0].id, 20, prep, time + 60000),
      ).toThrow("3 次");
    const extra = {
      ...preparation,
      guidedBreaths: 4,
      guidedBreathingMs: 32000,
      breathCompletedAt: time + 32000,
    };
    expect(
      startPreparedTask(db, db.tasks[0].id, 20, extra, time + 40000).sessions[0]
        .preparation,
    ).toEqual(extra);
  });
  it("old tasks and preparation snapshots receive safe defaults without losing history", () => {
    let db = planned();
    db = startTask(db, db.tasks[0].id, 20, time, preparation);
    const raw = JSON.parse(JSON.stringify(db));
    delete raw.tasks[0].timeOptions;
    delete raw.sessions[0].preparation.guidedBreaths;
    delete raw.sessions[0].preparation.guidedBreathingMs;
    const restored = databaseSchema.parse(raw);
    expect(restored.tasks[0].timeOptions).toEqual([10, 20, 30]);
    expect(restored.sessions[0].preparation?.guidedBreaths).toBe(0);
    expect(restored.sessions[0].id).toBe(db.sessions[0].id);
    expect(restored.sessions[0].startedAt).toBe(time);
  });
  it("asks only for overrun and advances once after choosing a persisted reason", () => {
    let db = planned();
    const taskId = db.tasks[0].id;
    db = startPreparedTask(db, taskId, 10, preparation, time + 25000);
    const sid = activeSession(db)!.id;
    db = completeCheck(
      finishWork(db, sid, time + 25000 + 11 * 60000),
      sid,
      time + 25000 + 12 * 60000,
    );
    expect(needsOverrunReflection(db.sessions[0])).toBe(true);
    expect(journeyForDate(db, "2026-10-06")).toEqual({
      total: 3,
      completed: 0,
    });
    expect(overrunReasons).toHaveLength(4);
    db = chooseOverrunReason(db, sid, "中间走神了");
    db = databaseSchema.parse(JSON.parse(JSON.stringify(db)));
    expect(db.sessions[0].reflectionReason).toBe("中间走神了");
    expect(journeyForDate(db, "2026-10-06").completed).toBe(1);
    db = completeReflection(
      db,
      sid,
      db.sessions[0].reflectionReason,
      time + 1000000,
    );
    expect(journeyForDate(db, "2026-10-06").completed).toBe(1);
    expect(db.reflections).toHaveLength(1);
    expect(() => completeReflection(db, sid, null, time + 1000001)).toThrow();
    expect(() => chooseOverrunReason(db, sid, "有题不会")).toThrow();
  });
  it("moves only after self-check for on-time work and reaches home after all tasks", () => {
    let db = createDatabase("2026-10-06", time);
    for (const task of db.tasks) {
      db = startTask(db, task.id, 10, time);
      const sid = activeSession(db)!.id;
      const before = journeyForDate(db, "2026-10-06").completed;
      db = finishWork(db, sid, time + 10 * 60000);
      expect(journeyForDate(db, "2026-10-06").completed).toBe(before);
      db = completeCheck(db, sid, time + 11 * 60000);
      expect(needsOverrunReflection(db.sessions.at(-1)!)).toBe(false);
      expect(() => chooseOverrunReason(db, sid, "有题不会")).toThrow();
      expect(journeyForDate(db, "2026-10-06").completed).toBe(before + 1);
      db = completeReflection(db, sid, null, time + 12 * 60000);
    }
    expect(journeyForDate(db, "2026-10-06")).toEqual({
      total: 3,
      completed: 3,
    });
  });
});

