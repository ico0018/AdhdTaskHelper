import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { addTask, createDatabase, ensurePlan, markReminder, startTask } from './flow';
const values=new Map<string,string>();
const sessionValues=new Map<string,string>();
const chineseDigits=['','壹','贰','叁','肆','伍','陆','柒','捌','玖'];
beforeEach(()=>{
  values.clear();sessionValues.clear();vi.resetModules();vi.doUnmock('./account-sync');
  vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)});
  vi.stubGlobal('sessionStorage',{getItem:(key:string)=>sessionValues.get(key)??null,setItem:(key:string,value:string)=>sessionValues.set(key,value),removeItem:(key:string)=>sessionValues.delete(key)});
  vi.stubGlobal('crypto',webcrypto);
});
describe('parent permission boundary',()=>{
  it('uses three arithmetic choices, retains guest access without a 15-minute timeout, and exits explicitly',async()=>{
    const auth=await import('./parent-auth');auth.enableParentProtection();const db=createDatabase('2026-10-08',Date.now());
    const edited=addTask(db,'2026-10-08',{title:'计划变更',description:'',type:'other',priority:2},Date.now());
    expect(()=>auth.assertParentMutation(db,edited)).toThrow('验证家长');
    const challenge=await auth.loadParentChallenge();
    expect(challenge.choices).toHaveLength(3);expect(new Set(challenge.choices).size).toBe(3);
    const [left,right]=challenge.question.replace('=?','').split('×');
    const answer=chineseDigits.indexOf(left)*chineseDigits.indexOf(right);
    await expect(auth.unlockParent(challenge.challenge,challenge.choices.find(value=>value!==answer)!)).rejects.toThrow('答案不正确');
    await auth.unlockParent(challenge.challenge,answer);
    expect(()=>auth.assertParentMutation(db,edited)).not.toThrow();
    const originalNow=Date.now;Date.now=()=>originalNow()+24*60*60*1000;
    try {expect(auth.parentIsUnlocked()).toBe(true);} finally {Date.now=originalNow;}
    vi.resetModules();const refreshed=await import('./parent-auth');expect(refreshed.parentIsUnlocked()).toBe(true);
    await refreshed.exitParentMode();expect(refreshed.parentIsUnlocked()).toBe(false);
    expect(values.size).toBe(0);
  });
  it('retains task start after parent reminder and automatic midnight settlement',async()=>{
    const auth=await import('./parent-auth');auth.enableParentProtection();const db=createDatabase('2026-10-06',Date.now());
    const reminded=markReminder(db,db.tasks[0].id,true);const started=startTask(reminded,db.tasks[0].id,20,Date.now());
    expect(()=>auth.assertParentMutation(reminded,started)).not.toThrow();
    expect(()=>auth.assertParentMutation(db,ensurePlan(db,'2026-10-07',Date.now()))).not.toThrow();
    expect(()=>auth.assertParentMutation(db,reminded)).toThrow('验证家长');
  });
  it('uses the server session grant for signed-in parents and locks when it is revoked',async()=>{
    const cloud={sessionUser:{id:'parent'},parentReady:false,verified:true,request:vi.fn(async(path:string,method?:string,body?:unknown)=>{
      if(path==='/api/v1/parent-challenge')return {challenge:'signed',question:'贰×捌=?',choices:[14,16,18]};
      if(path==='/api/v1/parent-unlock') {expect(method).toBe('POST');expect(body).toEqual({challenge:'signed',answer:16});return {parentReady:true};}
      if(path==='/api/v1/parent-lock')return {};
      throw new Error('unexpected request');
    }),notify:vi.fn(),flush:vi.fn(async()=>{})};
    sessionValues.set('xbb:guest-parent-ready:v1','true');
    vi.doMock('./account-sync',()=>({getCloud:()=>cloud}));
    const auth=await import('./parent-auth');expect(auth.parentIsUnlocked()).toBe(false);
    const challenge=await auth.loadParentChallenge();await auth.unlockParent(challenge.challenge,16);expect(auth.parentIsUnlocked()).toBe(true);
    cloud.parentReady=false;expect(auth.parentIsUnlocked()).toBe(false);
    cloud.parentReady=true;await auth.exitParentMode();expect(auth.parentIsUnlocked()).toBe(false);expect(sessionValues.size).toBe(0);
  });
});
