"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { getCloud } from '@/lib/account-sync';
import { loadParentChallenge, parentIsUnlocked, unlockParent, type ParentChallenge } from '@/lib/parent-auth';
export default function ParentGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(parentIsUnlocked);
  const [challenge, setChallenge] = useState<ParentChallenge | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const cloud = getCloud();
    return cloud?.subscribe(() => setUnlocked(parentIsUnlocked()));
  }, []);
  useEffect(() => {
    let active = true;
    if (!unlocked) loadParentChallenge().then(value => { if (active) setChallenge(value); }).catch(error => { if (active) setError(error.message); });
    return () => { active = false; };
  }, [unlocked]);
  if (unlocked) return children;
  return <section className="parent-gate">
    <h1>进入家长页面</h1>
    <p>请家长选择这道计算题的答案。</p>
    {challenge && <>
      <p className="parent-question" aria-label="家长计算题">{challenge.question}</p>
      <div className="parent-choices" aria-label="选择计算结果">
        {challenge.choices.map(answer => <button key={answer} className="primary" disabled={busy} onClick={async () => {
          setBusy(true); setError('');
          try { await unlockParent(challenge.challenge, answer); setUnlocked(true); }
          catch (error) { setError(error instanceof Error ? error.message : '请重试。'); }
          finally { setBusy(false); }
        }}>{answer}</button>)}
      </div>
    </>}
    <button className="secondary" disabled={busy} onClick={async () => {
      setBusy(true); setError('');
      try { setChallenge(await loadParentChallenge()); }
      catch (error) { setError(error instanceof Error ? error.message : '请重试。'); }
      finally { setBusy(false); }
    }}>{challenge ? '换一道题' : '重试'}</button>
    {error && <p role="alert">{error}</p>}
    {!challenge && !error && <p>正在准备计算题…</p>}
  </section>;
}
