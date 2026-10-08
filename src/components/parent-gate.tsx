"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { getCloud } from '@/lib/account-sync';
import { guestHasPin, parentIsUnlocked, unlockParent } from '@/lib/parent-auth';
export default function ParentGate({ children }: {children:ReactNode}) {
  const [unlocked,setUnlocked]=useState(parentIsUnlocked);
  const [password,setPassword]=useState(''); const [confirmation,setConfirmation]=useState('');
  const [error,setError]=useState(''); const [busy,setBusy]=useState(false);
  const logged=!!getCloud()?.identity; const setup=!logged&&!guestHasPin();
  useEffect(()=>{ const timer=setInterval(()=>setUnlocked(parentIsUnlocked()),1000); return ()=>clearInterval(timer); },[]);
  if(unlocked) return children;
  return <section className="parent-gate">
    <h1>家长验证</h1>
    <p>{logged?'输入账号密码后，才能修改孩子的学习计划。验证14分钟后过期。':setup?'首次使用请由家长设置本机PIN。PIN仅保护当前浏览器，登录账号可获得服务端保护。':'输入本机家长PIN后，才能管理学习计划。'}</p>
    <form onSubmit={async event=>{event.preventDefault();setBusy(true);setError('');try {await unlockParent(password,confirmation);setUnlocked(true);setPassword('');setConfirmation('');}catch(error){setError(error instanceof Error?error.message:'验证未完成');}finally{setBusy(false);}}}>
      <label>{logged?'账号密码':setup?'设置6至12位数字PIN':'家长PIN'}<input type="password" autoComplete={logged?'current-password':'off'} value={password} onChange={event=>setPassword(event.target.value)} required /></label>
      {setup&&<label>再次输入PIN<input type="password" autoComplete="off" value={confirmation} onChange={event=>setConfirmation(event.target.value)} required /></label>}
      {error&&<p role="alert">{error}</p>}
      <button className="primary" disabled={busy}>{busy?'正在验证…':'验证并进入'}</button>
    </form>
  </section>;
}
