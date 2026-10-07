import { databaseSchema, type Database } from "./models";
import {
  awardCompletionBonuses,
  createDatabase,
  ensurePlan,
  localDate,
} from "./flow";

export const STORAGE_KEY = "nora-flow:database:v1";
export interface Repository {
  getSnapshot(): Database | null;
  subscribe(listener: () => void): () => void;
  initialize(): void;
  update(transform: (db: Database) => Database): void;
  exportData(): string;
}

// The only persistence boundary. A database/IndexedDB adapter can replace this repository.
class LocalRepository implements Repository {
  private snapshot: Database | null = null;
  private listeners = new Set<() => void>();
  private listening = false;
  getSnapshot = (): Database | null => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private emit() {
    this.listeners.forEach((listener) => listener());
  }
  initialize() {
    const stored = localStorage.getItem(STORAGE_KEY);
    let loaded: Database;
    try {
      loaded = stored
        ? databaseSchema.parse(JSON.parse(stored))
        : createDatabase(localDate(), Date.now());
    } catch {
      throw new Error(
        "本机记录暂时无法读取。原始数据已保留，请在家长页面导出原始记录后再检查。",
      );
    }
    const next = ensurePlan(loaded, localDate(), Date.now());
    this.persist(next);
    if (!this.listening) {
      window.addEventListener("storage", this.handleStorage);
      this.listening = true;
    }
  }
  private handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      const parsed = databaseSchema.safeParse(JSON.parse(event.newValue));
      if (parsed.success) {
        this.snapshot = parsed.data;
        this.emit();
      }
    } catch {
      /* Keep the last readable state if another tab writes invalid data. */
    }
  };
  private persist(next: Database) {
    const validated = databaseSchema.parse(awardCompletionBonuses(next));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
    } catch {
      throw new Error(
        "这次记录没有保存。请检查浏览器是否允许本机存储，或先导出历史记录腾出空间，再重试。",
      );
    }
    this.snapshot = validated;
    this.emit();
  }
  update(transform: (db: Database) => Database) {
    // Read the latest committed data before a mutation, including another tab's changes.
    const stored = localStorage.getItem(STORAGE_KEY);
    const latest = stored
      ? databaseSchema.parse(JSON.parse(stored))
      : this.snapshot;
    if (!latest) throw new Error("请等待记录加载。");
    this.persist(transform(ensurePlan(latest, localDate(), Date.now())));
  }
  exportData() {
    return localStorage.getItem(STORAGE_KEY) ?? "{}";
  }
}

export const repository: Repository = new LocalRepository();
export const serverSnapshot = () => null;
