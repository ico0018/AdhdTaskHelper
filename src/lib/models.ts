import { z } from "zod";

export const taskTypes = [
  "math",
  "chinese",
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
export const overrunReasons = [
  "比想象中难",
  "中间走神了",
  "有题不会",
  "东西没准备好",
] as const;
export const timeOptionsSchema = z
  .array(z.number().int().min(1).max(180))
  .length(3)
  .refine((values) => new Set(values).size === 3, "请设置三个不同的时间。");
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
  timeOptions: timeOptionsSchema.default([10, 20, 30]),
});
export const preparationSchema = z.object({
  materials: z.array(z.string()),
  bathroomAndWaterChecked: z.boolean(),
  breathStartedAt: timestamp,
  breathCompletedAt: timestamp,
  guidedBreaths: z.number().int().nonnegative().default(0),
  guidedBreathingMs: z.number().int().nonnegative().default(0),
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
  quality: z
    .enum(["all_correct", "within_quarter", "over_quarter"])
    .nullable()
    .default(null),
});
export const planSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date,
  taskIds: z.array(z.string()),
  completionBonus: z.union([z.literal(0), z.literal(2)]).default(0),
  dailyPenalty: z
    .union([z.literal(-1), z.literal(0)])
    .nullable()
    .default(null),
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
export const templateSchema = taskSchema
  .pick({
    title: true,
    description: true,
    type: true,
    priority: true,
    materials: true,
    timeOptions: true,
  })
  .extend({
    id: z.string(),
    createdAt: timestamp,
  });
export const databaseSchema = z.object({
  version: z.literal(1),
  user: userSchema,
  tasks: z.array(taskSchema),
  sessions: z.array(sessionSchema),
  plans: z.array(planSchema),
  reflections: z.array(reflectionSchema),
  templates: z.array(templateSchema).default([]),
  scoringStartedOn: date.nullable().default(null),
});

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
export type TaskTemplate = z.infer<typeof templateSchema>;
export type TaskQuality = NonNullable<TaskSession["quality"]>;
export type TaskInput = Pick<
  Task,
  "title" | "description" | "type" | "priority"
> & { materials?: string[]; timeOptions?: number[] };

export const typeLabels: Record<TaskType, string> = {
  math: "数学",
  chinese: "语文",
  reading: "阅读",
  english: "英语",
  writing: "写作",
  organization: "整理",
  other: "其他",
};
export const checkQuestions: Record<TaskType, string> = {
  math: "有没有漏题？",
  chinese: "有没有漏题或漏字？",
  reading: "能说出刚才读了什么吗？",
  english: "有没有读完今天的内容？",
  writing: "有没有漏字或标点？",
  organization: "明天需要的东西都带了吗？",
  other: "有没有漏掉的地方？",
};
