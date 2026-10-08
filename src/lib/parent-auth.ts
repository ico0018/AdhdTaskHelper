import type { Database } from './models';
import { localDate, settleDailyPoints } from './flow';
import { getCloud } from './account-sync';
let enforce = false;
const guestGateKey = 'xbb:guest-parent-ready:v1';
export interface ParentChallenge { challenge: string; question: string; choices: number[] }
let guestChallenge: (ParentChallenge & { answer: number }) | null = null;
const chineseDigits = ['', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
export function enableParentProtection() { enforce = true; }
export function parentIsUnlocked() {
  const cloud = getCloud();
  if (cloud?.sessionUser) return cloud.parentReady;
  return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(guestGateKey) === 'true';
}
export async function loadParentChallenge(): Promise<ParentChallenge> {
  const cloud = getCloud();
  if (cloud?.sessionUser) return await cloud.request('/api/v1/parent-challenge') as ParentChallenge;
  const a = 2 + Math.floor(Math.random() * 8), b = 2 + Math.floor(Math.random() * 8);
  const answer = a * b;
  const choices = [answer, answer + a, answer - a];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  guestChallenge = { challenge: crypto.randomUUID(), question: `${chineseDigits[a]}×${chineseDigits[b]}=?`, choices, answer };
  return { challenge: guestChallenge.challenge, question: guestChallenge.question, choices };
}
export async function unlockParent(challenge: string, answer: number) {
  const cloud = getCloud();
  if (cloud?.sessionUser) {
    const result = await cloud.request('/api/v1/parent-unlock', 'POST', { challenge, answer }) as { parentReady: boolean };
    if (!result.parentReady) throw new Error('答案不正确，请再试一次。');
    cloud.parentReady = true;
    cloud.verified = true;
    cloud.notify();
    await cloud.flush();
  } else {
    if (!guestChallenge || guestChallenge.challenge !== challenge || guestChallenge.answer !== answer) throw new Error('答案不正确，请再试一次。');
    sessionStorage.setItem(guestGateKey, 'true');
    guestChallenge = null;
  }
}
export async function exitParentMode() {
  const cloud = getCloud();
  if (cloud?.sessionUser) {
    await cloud.request('/api/v1/parent-lock', 'POST', {});
    cloud.parentReady = false;
    cloud.notify();
  }
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(guestGateKey);
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
