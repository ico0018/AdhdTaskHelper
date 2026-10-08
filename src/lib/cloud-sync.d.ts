export interface SyncIdentity { user: { id: string; email: string; name: string }; activeProfileId: string }
export interface SyncRecord { revision: number; schemaVersion: number; payload: unknown; dirty: boolean; generation: number; conflict?: boolean }
export class CloudSyncAdapter {
  constructor(options: { tool: string; storage: Storage; apiBase: string; guest: () => unknown; rawGuest?: () => unknown; saveGuest: (payload: unknown) => void; validate?: (payload: unknown) => void; empty?: (payload: unknown) => boolean; reload?: () => void; changed?: () => void });
  identity: SyncIdentity | null; profiles: { id: string; nickname: string; grade?: string }[]; status: string;
  conflict: { payload?: unknown; unavailable?: boolean } | null; key: string | null; verified: boolean; parentReady: boolean; sessionUser: SyncIdentity["user"] | null;
  payload: unknown; read(): SyncRecord; setPayload(payload: unknown): void;
  subscribe(fn: () => void): () => void; notify(status?: string): void;
  start(): Promise<void>; flush(): Promise<void>; retry(): Promise<void>;
  request(path: string, method?: string, body?: unknown): Promise<unknown>;
  migrateGuest(): Promise<void>; resolve(choice: 'local' | 'remote'): Promise<void>;
  exportData(): string; switchProfile(profileId: string): Promise<void>;
}
