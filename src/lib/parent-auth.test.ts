import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { addTask, createDatabase, ensurePlan, markReminder, startTask } from './flow';
const values=new Map<string,string>();
beforeEach(()=>{
  values.clear();vi.resetModules();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
  vi.stubGlobal('crypto',webcrypto);
});
describe('parent permission boundary',()=>{
  it('rejects changes to the learning plan and requires a verified local PIN',async()=>{
    const auth=await import('./parent-auth');auth.enableParentProtection();const db=createDatabase('2026-10-08',Date.now());
    const edited=addTask(db,'2026-10-08',{title:'计划变更',description:'',type:'other',priority:2},Date.now());
    expect(()=>auth.assertParentMutation(db,edited)).toThrow('验证家长');
    await auth.unlockParent('846291','846291');expect(()=>auth.assertParentMutation(db,edited)).not.toThrow();
    expect(values.get('xbb:guest-parent-pin:v1')).not.toContain('846291');
  });
  it('retains task start after parent reminder and automatic midnight settlement',async()=>{
    const auth=await import('./parent-auth');auth.enableParentProtection();const db=createDatabase('2026-10-06',Date.now());
    const reminded=markReminder(db,db.tasks[0].id,true);const started=startTask(reminded,db.tasks[0].id,20,Date.now());
    expect(()=>auth.assertParentMutation(reminded,started)).not.toThrow();
    expect(()=>auth.assertParentMutation(db,ensurePlan(db,'2026-10-07',Date.now()))).not.toThrow();
    expect(()=>auth.assertParentMutation(db,reminded)).toThrow('验证家长');
  });
  it('rejects incorrect PIN and rate-limits repeated attempts',async()=>{
    const auth=await import('./parent-auth');await auth.unlockParent('846291','846291');
    for(let i=0;i<5;i++) await expect(auth.unlockParent('wrong')).rejects.toThrow('不正确');
    await expect(auth.unlockParent('846291')).rejects.toThrow('过于频繁');
  });
});
