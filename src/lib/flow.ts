import {
  checkQuestions,
  timeOptionsSchema,
  overrunReasons,
  type Database,
  type Task,
  type TaskInput,
  type TaskSession,
  type ReflectionReason,
  type TaskPreparation,
} from "./models";
import { BREATH_CYCLE_MS, REQUIRED_BREATHS } from "./breathing";

export function localDate(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function id(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
export function createDatabase(date: string, now: number): Database {
  const user = {
    id: "nora",
    name: "Nora",
    stage: 1 as const,
    preparationReminderNeeded: false,
  };
  const samples: TaskInput[] = [
    {
      title: "数学作业",
      description: "完成练习册 P18",
      type: "math",
      priority: 1,
    },
    {
      title: "英语阅读",
      description: "读一读今天的英语故事",
      type: "english",
      priority: 2,
    },
    {
      title: "整理书包",
      description: "准备好明天要用的东西",
      type: "organization",
      priority: 3,
    },
  ];
  const tasks = samples.map((input): Task => ({
    ...input,
    id: id(),
    userId: user.id,
    plannedDate: date,
    checkQuestion: checkQuestions[input.type],
    createdAt: now,
    deletedAt: null,
    reminderPending: false,
    materials: input.materials ?? [],
    timeOptions: timeOptionsSchema.parse(input.timeOptions ?? [10, 20, 30]),
  }));
  return {
    version: 1,
    user,
    tasks,
    sessions: [],
    reflections: [],
    plans: [
      {
        id: id(),
        userId: user.id,
        date,
        taskIds: tasks.map((t) => t.id),
        createdAt: now,
      },
    ],
  };
}
export function ensurePlan(db: Database, date: string, now: number): Database {
  if (db.plans.some((p) => p.date === date)) return db;
  return {
    ...db,
    plans: [
      ...db.plans,
      { id: id(), userId: db.user.id, date, taskIds: [], createdAt: now },
    ],
  };
}
export function tasksForDate(db: Database, date: string): Task[] {
  const plan = db.plans.find((p) => p.date === date);
  return db.tasks
    .filter((t) => !t.deletedAt && plan?.taskIds.includes(t.id))
    .sort((a, b) => a.priority - b.priority || a.createdAt - b.createdAt);
}
export function activeSession(db: Database): TaskSession | undefined {
  return db.sessions.find((s) => s.status !== "completed");
}
export function sessionForTask(
  db: Database,
  taskId: string,
): TaskSession | undefined {
  return db.sessions.find((s) => s.taskId === taskId);
}
export function elapsedMinutes(session: TaskSession, now: number): number {
  return Math.max(
    0,
    ((session.finishedAt ?? now) - session.startedAt) / 60_000,
  );
}
export function predictionError(session: TaskSession): number {
  return session.actualMinutes === 0
    ? Infinity
    : Math.abs(session.actualMinutes - session.estimatedMinutes) /
        session.actualMinutes;
}
export function addTask(
  db: Database,
  date: string,
  input: TaskInput,
  now: number,
): Database {
  const next = ensurePlan(db, date, now);
  const task: Task = {
    ...input,
    title: input.title.trim(),
    description: input.description.trim(),
    checkQuestion: checkQuestions[input.type],
    id: id(),
    userId: db.user.id,
    plannedDate: date,
    createdAt: now,
    deletedAt: null,
    reminderPending: false,
    materials: input.materials ?? [],
    timeOptions: timeOptionsSchema.parse(input.timeOptions ?? [10, 20, 30]),
  };
  if (!task.title) throw new Error("请写下任务名称。");
  return {
    ...next,
    tasks: [...next.tasks, task],
    plans: next.plans.map((p) =>
      p.date === date ? { ...p, taskIds: [...p.taskIds, task.id] } : p,
    ),
  };
}
export function editTask(
  db: Database,
  taskId: string,
  input: TaskInput,
): Database {
  if (sessionForTask(db, taskId))
    throw new Error("已经开始的任务保留原来的记录，请添加新任务。");
  if (!input.title.trim()) throw new Error("请写下任务名称。");
  return {
    ...db,
    tasks: db.tasks.map((t) =>
      t.id === taskId
        ? {
            ...t,
            ...input,
            title: input.title.trim(),
            description: input.description.trim(),
            checkQuestion: checkQuestions[input.type],
            materials: input.materials ?? t.materials,
            timeOptions: timeOptionsSchema.parse(
              input.timeOptions ?? t.timeOptions,
            ),
          }
        : t,
    ),
  };
}
export function deleteTask(
  db: Database,
  taskId: string,
  now: number,
): Database {
  if (activeSession(db)?.taskId === taskId)
    throw new Error("请先完成正在进行的任务。");
  return {
    ...db,
    tasks: db.tasks.map((t) =>
      t.id === taskId ? { ...t, deletedAt: now } : t,
    ),
    plans: db.plans.map((p) => ({
      ...p,
      taskIds: p.taskIds.filter((t) => t !== taskId),
    })),
  };
}
export function startTask(
  db: Database,
  taskId: string,
  estimate: number,
  now: number,
  preparation: TaskPreparation | null = null,
): Database {
  if (activeSession(db)) throw new Error("先完成现在这件事，再开始下一件。");
  const task = db.tasks.find((t) => t.id === taskId && !t.deletedAt);
  if (!task || sessionForTask(db, taskId))
    throw new Error("这项任务已经完成或不存在。");
  if (!Number.isInteger(estimate) || estimate < 1 || estimate > 180)
    throw new Error("请填写 1 到 180 分钟。");
  const session: TaskSession = {
    id: id(),
    taskId,
    userId: task.userId,
    date: task.plannedDate,
    taskTitle: task.title,
    taskType: task.type,
    checkQuestion: task.checkQuestion,
    estimatedMinutes: estimate,
    actualMinutes: 0,
    extensionCount: 0,
    startedIndependently: !task.reminderPending,
    stuckReason: null,
    stuckEvents: [],
    reflectionReason: null,
    completed: false,
    checkCompleted: false,
    status: "focusing",
    startedAt: now,
    targetEndsAt: now + estimate * 60_000,
    finishedAt: null,
    completedAt: null,
    preparation,
  };
  return {
    ...db,
    user: preparation?.bathroomAndWaterChecked
      ? { ...db.user, preparationReminderNeeded: false }
      : db.user,
    tasks: db.tasks.map((t) =>
      t.id === taskId ? { ...t, reminderPending: false } : t,
    ),
    sessions: [...db.sessions, session],
  };
}
export function startPreparedTask(
  db: Database,
  taskId: string,
  estimate: number,
  preparation: TaskPreparation,
  now: number,
): Database {
  const task = db.tasks.find((t) => t.id === taskId && !t.deletedAt);
  if (!task) throw new Error("任务不存在。");
  if (!task.timeOptions.includes(estimate)) throw new Error("请选择时间。");
  if (
    task.materials.some((material) => !preparation.materials.includes(material))
  )
    throw new Error("请先检查所有材料。");
  if (db.user.preparationReminderNeeded && !preparation.bathroomAndWaterChecked)
    throw new Error("请先准备好上厕所和喝水。");
  if (
    preparation.guidedBreaths < REQUIRED_BREATHS ||
    preparation.guidedBreathingMs < REQUIRED_BREATHS * BREATH_CYCLE_MS ||
    preparation.guidedBreathingMs <
      preparation.guidedBreaths * BREATH_CYCLE_MS ||
    preparation.breathCompletedAt - preparation.breathStartedAt <
      preparation.guidedBreathingMs ||
    preparation.breathCompletedAt > now ||
    preparation.breathStartedAt > now
  )
    throw new Error("请先完成 3 次完整深呼吸。");
  return startTask(db, taskId, estimate, now, {
    ...preparation,
    materials: [...task.materials],
  });
}
function changeSession(
  db: Database,
  sessionId: string,
  update: (s: TaskSession) => TaskSession,
): Database {
  if (!db.sessions.some((s) => s.id === sessionId))
    throw new Error("没有找到这次任务记录。");
  return {
    ...db,
    sessions: db.sessions.map((s) => (s.id === sessionId ? update(s) : s)),
  };
}
export function extendSession(
  db: Database,
  sessionId: string,
  now: number,
): Database {
  return changeSession(db, sessionId, (s) => {
    if (s.status !== "focusing") throw new Error("这项任务已结束计时。");
    return {
      ...s,
      extensionCount: s.extensionCount + 1,
      targetEndsAt: Math.max(now, s.targetEndsAt) + 5 * 60_000,
    };
  });
}
export function recordStuck(
  db: Database,
  sessionId: string,
  reason: TaskSession["stuckEvents"][number]["reason"],
  now: number,
): Database {
  const next = changeSession(db, sessionId, (s) => {
    if (s.status !== "focusing") throw new Error("这项任务已结束计时。");
    return {
      ...s,
      stuckReason: reason,
      stuckEvents: [...s.stuckEvents, { reason, at: now }],
    };
  });
  return reason === "想上厕所 / 喝水"
    ? { ...next, user: { ...next.user, preparationReminderNeeded: true } }
    : next;
}
export function finishWork(
  db: Database,
  sessionId: string,
  now: number,
): Database {
  return changeSession(db, sessionId, (s) => {
    if (s.status !== "focusing") throw new Error("已经结束计时了。");
    return {
      ...s,
      status: "checking",
      finishedAt: now,
      actualMinutes: elapsedMinutes(s, now),
    };
  });
}
export function completeCheck(
  db: Database,
  sessionId: string,
  now: number,
): Database {
  return changeSession(db, sessionId, (s) => {
    if (s.status !== "checking") throw new Error("请先完成任务，再检查一下。");
    return {
      ...s,
      checkCompleted: true,
      completed: true,
      completedAt: now,
      status: "reflecting",
    };
  });
}
export function completeReflection(
  db: Database,
  sessionId: string,
  reason: ReflectionReason | null,
  now: number,
): Database {
  const next = changeSession(db, sessionId, (s) => {
    if (s.status !== "reflecting" || !s.checkCompleted)
      throw new Error("请先检查一下。");
    return { ...s, reflectionReason: reason, status: "completed" };
  });
  const session = next.sessions.find((s) => s.id === sessionId)!;
  return {
    ...next,
    reflections: [
      ...next.reflections,
      {
        id: id(),
        userId: db.user.id,
        date: session.date,
        sessionId,
        kind: "session",
        reason,
        moreTimeTaskId: null,
        createdAt: now,
      },
    ],
  };
}
export function markReminder(
  db: Database,
  taskId: string,
  reminded: boolean,
): Database {
  const session = sessionForTask(db, taskId);
  return session
    ? changeSession(db, session.id, (s) => ({
        ...s,
        startedIndependently: !reminded,
      }))
    : {
        ...db,
        tasks: db.tasks.map((t) =>
          t.id === taskId ? { ...t, reminderPending: reminded } : t,
        ),
      };
}
export function dailyReflection(
  db: Database,
  date: string,
  taskId: string | null,
  now: number,
): Database {
  return {
    ...db,
    reflections: [
      ...db.reflections.filter((r) => !(r.date === date && r.kind === "daily")),
      {
        id: id(),
        userId: db.user.id,
        date,
        sessionId: null,
        kind: "daily",
        reason: null,
        moreTimeTaskId: taskId,
        createdAt: now,
      },
    ],
  };
}

export function needsOverrunReflection(session: TaskSession): boolean {
  return session.actualMinutes > session.estimatedMinutes;
}
export function chooseOverrunReason(
  db: Database,
  sessionId: string,
  reason: (typeof overrunReasons)[number],
): Database {
  if (!overrunReasons.includes(reason)) throw new Error("请选择一个原因。");
  return changeSession(db, sessionId, (session) => {
    if (
      session.status !== "reflecting" ||
      !session.checkCompleted ||
      !needsOverrunReflection(session)
    )
      throw new Error("请先完成任务并自检。");
    return { ...session, reflectionReason: reason };
  });
}
export function journeyForDate(db: Database, date: string) {
  const tasks = tasksForDate(db, date);
  const completed = tasks.filter((task) => {
    const session = sessionForTask(db, task.id);
    return (
      session?.completed &&
      (session.status === "completed" ||
        !needsOverrunReflection(session) ||
        session.reflectionReason !== null)
    );
  }).length;
  return { total: tasks.length, completed };
}

