import { databaseSchema, type Database } from "./models";
import {
  awardCompletionBonuses,
  createDatabase,
  ensurePlan,
  localDate,
} from "./flow";

import { getCloud, initializeCloud } from "./account-sync";
import { assertParentMutation, enableParentProtection } from "./parent-auth";

export const STORAGE_KEY = "nora-flow:database:v1";
export interface Repository {
  getSnapshot(): Database | null;
  subscribe(listener: () => void): () => void;
  initialize(): void;
  initializeAccount(): Promise<void>;
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
  async initializeAccount() {
    await initializeCloud(() => this.initialize());
    enableParentProtection();
    this.initialize();
  }
  private readRaw() {
    const cloud = getCloud();
    return cloud?.identity ? (cloud.payload ? JSON.stringify(cloud.payload) : null) : localStorage.getItem(STORAGE_KEY);
  }
  initialize() {
    const stored = this.readRaw();
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
    if (!stored && getCloud()?.identity) {
      const cloud = getCloud()!;
      const profile = cloud.profiles.find(candidate => candidate.id === cloud.identity!.activeProfileId);
      loaded = { ...loaded, tasks: [], plans: [], user: { ...loaded.user, id: cloud.identity!.activeProfileId, name: profile?.nickname || "孩子" } };
    }
    const next = ensurePlan(loaded, localDate(), Date.now());
    this.persist(next);
    if (!this.listening) {
      window.addEventListener("storage", this.handleStorage);
      this.listening = true;
    }
  }
  private handleStorage = (event: StorageEvent) => {
    if (getCloud()?.identity && event.key === getCloud()?.key) { this.initialize(); return; }
    if (getCloud()?.identity || event.key !== STORAGE_KEY || !event.newValue) return;
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
      const cloud = getCloud();
      if (cloud?.identity) cloud.setPayload(validated);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(validated));
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
    const stored = this.readRaw();
    const latest = stored
      ? databaseSchema.parse(JSON.parse(stored))
      : this.snapshot;
    if (!latest) throw new Error("请等待记录加载。");
    const next = transform(ensurePlan(latest, localDate(), Date.now()));
    assertParentMutation(latest, next);
    this.persist(next);
  }
  exportData() {
    return this.readRaw() ?? "{}";
  }
}

export const repository: Repository = new LocalRepository();
export const serverSnapshot = () => null;
