import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addTask } from "./flow";

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
