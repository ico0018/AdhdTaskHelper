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
} from "./flow";
import { databaseSchema, stuckReasons, type TaskPreparation } from "./models";

const time = 1_800_000_000_000;
const preparation: TaskPreparation = {
  materials: ["尺子", "铅笔", "橡皮"],
  bathroomAndWaterChecked: false,
  breathStartedAt: time,
  breathCompletedAt: time + 3000,
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
        time + 5000,
      ),
    ).toThrow("所有材料");
    expect(() =>
      startPreparedTask(
        db,
        taskId,
        20,
        { ...preparation, breathCompletedAt: time + 2999 },
        time + 5000,
      ),
    ).toThrow("3 秒");
    expect(() =>
      startPreparedTask(
        db,
        taskId,
        20,
        { ...preparation, breathCompletedAt: time + 6000 },
        time + 5000,
      ),
    ).toThrow("3 秒");
    expect(() =>
      startPreparedTask(db, taskId, 15, preparation, time + 5000),
    ).toThrow("时间");
  });
  it("starts timing only on formal start and saves preparation snapshots", () => {
    const db = planned();
    const next = startPreparedTask(
      db,
      db.tasks[0].id,
      20,
      preparation,
      time + 9000,
    );
    expect(next.sessions[0]).toMatchObject({
      startedAt: time + 9000,
      targetEndsAt: time + 9000 + 20 * 60000,
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
      breathCompletedAt: time + 73000,
    };
    expect(() =>
      startPreparedTask(db, db.tasks[1].id, 10, nextPrep, time + 74000),
    ).toThrow("上厕所和喝水");
    db = startPreparedTask(
      db,
      db.tasks[1].id,
      10,
      { ...nextPrep, bathroomAndWaterChecked: true },
      time + 74000,
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
