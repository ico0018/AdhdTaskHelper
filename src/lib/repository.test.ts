import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addTask, createDatabase, startTask } from "./flow";

const values = new Map<string, string>();
const storage = {
  getItem: vi.fn((key: string) => values.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => {
    values.set(key, value);
  }),
};
beforeEach(() => {
  vi.resetModules();
  values.clear();
  storage.getItem.mockClear();
  storage.setItem.mockReset();
  storage.setItem.mockImplementation((key, value) => {
    values.set(key, value);
  });
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("window", { addEventListener: vi.fn() });
});
afterEach(() => vi.unstubAllGlobals());

describe("local persistence", () => {
  it("writes a first plan and reads it back from a fresh repository", async () => {
    const { repository } = await import("./repository");
    repository.initialize();
    const original = repository.getSnapshot();
    vi.resetModules();
    const restored = (await import("./repository")).repository;
    restored.initialize();
    expect(restored.getSnapshot()).toEqual(original);
  });
  it("leaves corrupted data untouched and allows raw export", async () => {
    const { repository, STORAGE_KEY } = await import("./repository");
    values.set(STORAGE_KEY, "broken-json");
    expect(() => repository.initialize()).toThrow("原始数据已保留");
    expect(values.get(STORAGE_KEY)).toBe("broken-json");
    expect(repository.exportData()).toBe("broken-json");
    expect(repository.getSnapshot()).toBeNull();
  });
  it("does not report a successful mutation when storage is full", async () => {
    const { repository } = await import("./repository");
    repository.initialize();
    const original = repository.getSnapshot();
    storage.setItem.mockImplementationOnce(() => {
      throw new Error("QuotaExceededError");
    });
    expect(() =>
      repository.update((db) =>
        addTask(
          db,
          db.plans[0].date,
          { title: "新任务", description: "", type: "other", priority: 2 },
          Date.now(),
        ),
      ),
    ).toThrow("没有保存");
    expect(repository.getSnapshot()).toBe(original);
  });
  it("reads the latest committed record before applying a mutation", async () => {
    const { repository, STORAGE_KEY } = await import("./repository");
    repository.initialize();
    const original = repository.getSnapshot()!;
    const date = original.plans[0].date;
    const anotherTab = addTask(
      original,
      date,
      { title: "另一个标签页", description: "", type: "other", priority: 2 },
      Date.now(),
    );
    values.set(STORAGE_KEY, JSON.stringify(anotherTab));
    repository.update((db) =>
      addTask(
        db,
        date,
        { title: "这个标签页", description: "", type: "other", priority: 2 },
        Date.now(),
      ),
    );
    expect(repository.getSnapshot()?.tasks).toHaveLength(5);
  });
});

describe("versioned repository migration", () => {
  function oldRecord() {
    let db = createDatabase("2026-10-06", 1000);
    db = startTask(db, db.tasks[0].id, 20, 1000);
    return JSON.stringify({
      ...db,
      version: 1,
      focusCycles: undefined,
      tasks: db.tasks.map((task) =>
        Object.fromEntries(
          Object.entries(task).filter(([key]) => key !== "focusCycleId"),
        ),
      ),
    });
  }
  it("backs up exact v1 bytes and commits a v2 payload without dropping active history", async () => {
    const { repository, STORAGE_KEY, MIGRATION_BACKUP_KEY } =
      await import("./repository");
    const raw = oldRecord();
    values.set(STORAGE_KEY, raw);
    repository.initialize();
    expect(values.get(MIGRATION_BACKUP_KEY)).toBe(raw);
    expect(JSON.parse(values.get(STORAGE_KEY)!).version).toBe(2);
    expect(repository.getSnapshot()?.sessions).toEqual(
      JSON.parse(raw).sessions,
    );
    const snapshot = repository.getSnapshot();
    repository.initialize();
    expect(values.get(MIGRATION_BACKUP_KEY)).toBe(raw);
    expect(repository.getSnapshot()).toEqual(snapshot);
  });
  it("leaves v1 data intact when the backup cannot be saved", async () => {
    const { repository, STORAGE_KEY } = await import("./repository");
    const raw = oldRecord();
    values.set(STORAGE_KEY, raw);
    storage.setItem.mockImplementationOnce(() => {
      throw new Error("full");
    });
    expect(() => repository.initialize()).toThrow("原始数据已保留");
    expect(repository.getSnapshot()).toBeNull();
    expect(values.get(STORAGE_KEY)).toBe(raw);
  });
  it("keeps original v1 and backup if the final migrated write fails", async () => {
    const { repository, STORAGE_KEY, MIGRATION_BACKUP_KEY } =
      await import("./repository");
    const raw = oldRecord();
    values.set(STORAGE_KEY, raw);
    storage.setItem.mockImplementationOnce((key, value) => {
      values.set(key, value);
    });
    storage.setItem.mockImplementationOnce(() => {
      throw new Error("full");
    });
    expect(() => repository.initialize()).toThrow("没有保存");
    expect(values.get(STORAGE_KEY)).toBe(raw);
    expect(values.get(MIGRATION_BACKUP_KEY)).toBe(raw);
    expect(repository.getSnapshot()).toBeNull();
  });
  it("rejects unsupported future versions without overwriting raw data", async () => {
    const { repository, STORAGE_KEY } = await import("./repository");
    const raw = JSON.stringify({ version: 99 });
    values.set(STORAGE_KEY, raw);
    expect(() => repository.initialize()).toThrow("原始数据已保留");
    expect(repository.exportData()).toBe(raw);
  });
});
