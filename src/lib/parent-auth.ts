import type { Database } from './models';
import { localDate, settleDailyPoints } from './flow';
import { getCloud } from './account-sync';
let unlockedUntil = 0;
let enforce = false;
const pinKey = 'xbb:guest-parent-pin:v1';
const delayKey = 'xbb:guest-parent-attempts:v1';
export function enableParentProtection() { enforce = true; }
export function parentIsUnlocked() { return Date.now() < unlockedUntil; }
export function guestHasPin() { return !!localStorage.getItem(pinKey); }
async function hash(pin: string, salt: string) {
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:210000,hash:'SHA-256'},key,256);
  return Array.from(new Uint8Array(bits),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function unlockParent(password: string, confirmation?: string) {
  const cloud=getCloud();
  if(cloud?.identity) {
    await cloud.request('/api/v1/parent-unlock','POST',{password});
    cloud.verified = true;
    await cloud.flush();
  } else {
    const attempts=JSON.parse(localStorage.getItem(delayKey)||'{"count":0,"after":0}');
    if(attempts.after>Date.now()) throw new Error('尝试过于频繁，请稍后重试。');
    const raw=localStorage.getItem(pinKey);
    if(!raw) {
      if(!/^\d{6,12}$/.test(password)||password!==confirmation) throw new Error('请设置6至12位数字PIN，并再次输入确认。');
      const salt=crypto.randomUUID(); localStorage.setItem(pinKey,JSON.stringify({salt,hash:await hash(password,salt)}));
    } else {
      const saved=JSON.parse(raw);
      if(await hash(password,saved.salt)!==saved.hash) {
        const count=attempts.count+1; localStorage.setItem(delayKey,JSON.stringify({count,after:count>=5?Date.now()+60000:0}));
        throw new Error('家长PIN不正确。');
      }
    }
    localStorage.setItem(delayKey,JSON.stringify({count:0,after:0}));
  }
  unlockedUntil=Date.now()+14*60*1000;
}
function protectedPart(db: Database) {
  return { tasks: db.tasks, templates: db.templates, scoringStartedOn:db.scoringStartedOn,
    user:{id:db.user.id,name:db.user.name,stage:db.user.stage},
    plans:db.plans.filter(plan=>plan.taskIds.length).map(plan=>({id:plan.id,taskIds:plan.taskIds,dailyPenalty:plan.dailyPenalty})),
    quality:db.sessions.filter(session=>session.quality!==null).map(session=>({id:session.id,quality:session.quality})) };
}
export function assertParentMutation(before: Database, after: Database) {
  if (!enforce || parentIsUnlocked()) return;
  const settled = settleDailyPoints(before, localDate());
  const normalized: Database = { ...before,
    scoringStartedOn: before.scoringStartedOn === null && after.scoringStartedOn === localDate() ? after.scoringStartedOn : before.scoringStartedOn,
    tasks: before.tasks.map(task => {
      const next = after.tasks.find(candidate => candidate.id === task.id);
      const started = after.sessions.find(session => session.taskId === task.id && !session.startedIndependently && !before.sessions.some(old => old.id === session.id));
      return task.reminderPending && next?.reminderPending === false && started ? { ...task, reminderPending: false } : task;
    }),
    plans: before.plans.map(plan => {
      const next = after.plans.find(candidate => candidate.id === plan.id);
      const automatic = settled.plans.find(candidate => candidate.id === plan.id);
      return plan.dailyPenalty === null && next?.dailyPenalty === automatic?.dailyPenalty ? { ...plan, dailyPenalty: next!.dailyPenalty } : plan;
    })
  };
  if(JSON.stringify(protectedPart(normalized))!==JSON.stringify(protectedPart(after))) {
    throw new Error('修改学习计划或家长评估前，请先验证家长身份。');
  }
}
