import { z } from "zod";

export const taskTypes = [
  "math",
  "reading",
  "english",
  "writing",
  "organization",
  "other",
] as const;
const legacyStuckReasons = [
  "不会做",
  "找不到东西",
  "不知道下一步",
  "走神了",
  "其他",
] as const;
export const stuckReasons = [
  "不认识字",
  "读不懂题目",
  "想上厕所 / 喝水",
] as const;
const storedStuckReasons = [...legacyStuckReasons, ...stuckReasons] as const;
export const reflectionReasons = [
  "比想象中难",
  "中间走神了",
  "有题不会",
  "东西没准备好",
  "我估计错了",
  "其他",
] as const;
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.number().finite().nonnegative();

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  stage: z.literal(1),
  preparationReminderNeeded: z.boolean().default(false),
});
export const taskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1).max(40),
  description: z.string().max(120),
  type: z.enum(taskTypes),
  checkQuestion: z.string().min(1).max(100),
  plannedDate: date,
  priority: z.number().int().min(1).max(3),
  createdAt: timestamp,
  deletedAt: timestamp.nullable(),
  reminderPending: z.boolean(),
  materials: z.array(z.string().trim().min(1).max(40)).max(30).default([]),
  focusCycleId: z.string().nullable().default(null),
});
export const preparationSchema = z.object({
  materials: z.array(z.string()),
  bathroomAndWaterChecked: z.boolean(),
  breathStartedAt: timestamp,
  breathCompletedAt: timestamp,
});
export const sessionSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  userId: z.string(),
  date,
  taskTitle: z.string(),
  taskType: z.enum(taskTypes),
  checkQuestion: z.string(),
  estimatedMinutes: z.number().int().min(1).max(180),
  actualMinutes: z.number().nonnegative(),
  extensionCount: z.number().int().nonnegative(),
  startedIndependently: z.boolean(),
  stuckReason: z.enum(storedStuckReasons).nullable(),
  stuckEvents: z.array(
    z.object({ reason: z.enum(storedStuckReasons), at: timestamp }),
  ),
  reflectionReason: z.enum(reflectionReasons).nullable(),
  completed: z.boolean(),
  checkCompleted: z.boolean(),
  status: z.enum(["focusing", "checking", "reflecting", "completed"]),
  startedAt: timestamp,
  targetEndsAt: timestamp,
  finishedAt: timestamp.nullable(),
  completedAt: timestamp.nullable(),
  preparation: preparationSchema.nullable().default(null),
});
export const planSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date,
  taskIds: z.array(z.string()),
  createdAt: timestamp,
});
export const reflectionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date,
  sessionId: z.string().nullable(),
  kind: z.enum(["session", "daily"]),
  reason: z.enum(reflectionReasons).nullable(),
  moreTimeTaskId: z.string().nullable(),
  createdAt: timestamp,
});
const cycleDate = date.refine((value) => {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}, "请填写有效日期。");
export const focusCycleInputSchema = z
  .object({
    title: z.string().trim().min(1, "请填写主攻名称。").max(40),
    startDate: cycleDate,
    targetEndDate: cycleDate,
  })
  .refine((cycle) => cycle.targetEndDate >= cycle.startDate, {
    message: "结束日期不能早于开始日期。",
    path: ["targetEndDate"],
  });
export const focusCycleSchema = focusCycleInputSchema.safeExtend({
  id: z.string(),
  userId: z.string(),
  active: z.boolean(),
  createdAt: timestamp,
});
const commonDatabase = {
  user: userSchema,
  tasks: z.array(taskSchema),
  sessions: z.array(sessionSchema),
  plans: z.array(planSchema),
  reflections: z.array(reflectionSchema),
};
export const legacyDatabaseSchema = z.object({
  ...commonDatabase,
  version: z.literal(1),
  tasks: z.array(taskSchema.omit({ focusCycleId: true })),
});
export const databaseSchema = z
  .object({
    ...commonDatabase,
    version: z.literal(2),
    focusCycles: z.array(focusCycleSchema),
  })
  .superRefine((db, ctx) => {
    if (db.focusCycles.filter((cycle) => cycle.active).length > 1)
      ctx.addIssue({
        code: "custom",
        message: "同一时间只能有一个本期主攻。",
        path: ["focusCycles"],
      });
    const cycles = new Map(db.focusCycles.map((cycle) => [cycle.id, cycle]));
    for (const cycle of db.focusCycles)
      if (cycle.userId !== db.user.id)
        ctx.addIssue({
          code: "custom",
          message: "主攻周期用户不匹配。",
          path: ["focusCycles"],
        });
    for (const task of db.tasks)
      if (
        task.focusCycleId &&
        cycles.get(task.focusCycleId)?.userId !== task.userId
      )
        ctx.addIssue({
          code: "custom",
          message: "任务关联的主攻周期不存在。",
          path: ["tasks"],
        });
  });

// Explicit, pure migration. Never silently reset unsupported or damaged records.
export function migrateDatabase(input: unknown): Database {
  if (
    typeof input === "object" &&
    input !== null &&
    "version" in input &&
    input.version === 1
  ) {
    const legacy = legacyDatabaseSchema.parse(input);
    return databaseSchema.parse({
      ...legacy,
      version: 2,
      focusCycles: [],
      tasks: legacy.tasks.map((task) => ({ ...task, focusCycleId: null })),
    });
  }
  return databaseSchema.parse(input);
}
export type FocusCycle = z.infer<typeof focusCycleSchema>;
export type FocusCycleInput = z.infer<typeof focusCycleInputSchema>;

export type User = z.infer<typeof userSchema>;
export type Task = z.infer<typeof taskSchema>;
export type TaskSession = z.infer<typeof sessionSchema>;
export type DailyPlan = z.infer<typeof planSchema>;
export type Reflection = z.infer<typeof reflectionSchema>;
export type Database = z.infer<typeof databaseSchema>;
export type TaskType = Task["type"];
export type StuckReason = (typeof stuckReasons)[number];
export type ReflectionReason = (typeof reflectionReasons)[number];
export type TaskPreparation = z.infer<typeof preparationSchema>;
export type TaskInput = Pick<
  Task,
  "title" | "description" | "type" | "priority"
> & { materials?: string[]; focusCycleId?: string | null };

export const typeLabels: Record<TaskType, string> = {
  math: "数学",
  reading: "阅读",
  english: "英语",
  writing: "写作",
  organization: "整理",
  other: "其他",
};
export const checkQuestions: Record<TaskType, string> = {
  math: "有没有漏题？",
  reading: "能说出刚才读了什么吗？",
  english: "有没有读完今天的内容？",
  writing: "有没有漏字或标点？",
  organization: "明天需要的东西都带了吗？",
  other: "有没有漏掉的地方？",
};
