import { CloudSyncAdapter } from './cloud-sync.js';
import { databaseSchema } from './models';

export const apiBase = process.env.NEXT_PUBLIC_ACCOUNT_API || 'https://api.xuebabangbang.cn';
export const portalBase = process.env.NEXT_PUBLIC_ACCOUNT_PORTAL || 'https://xuebabangbang.cn';
export const guestKey = 'nora-flow:database:v1';
let adapter: CloudSyncAdapter | null = null;
export function getCloud() { return adapter; }
export async function initializeCloud(changed: () => void) {
  if (!adapter) {
    adapter = new CloudSyncAdapter({ tool:'taskhelper',storage:localStorage,apiBase,
      rawGuest:()=>localStorage.getItem(guestKey),
      guest:()=>{const raw=localStorage.getItem(guestKey);return raw ? JSON.parse(raw) : null;},
      saveGuest:payload=>localStorage.setItem(guestKey,JSON.stringify(databaseSchema.parse(payload))),
      validate:payload=>databaseSchema.parse(payload),
      changed, reload:()=>window.location.reload()
    });
    await adapter.start();
    window.addEventListener('online',()=>adapter?.retry().catch(error=>adapter?.notify(error.message)));
    window.addEventListener('focus',()=>adapter?.retry().catch(error=>adapter?.notify(error.message)));
  }
  return adapter;
}
