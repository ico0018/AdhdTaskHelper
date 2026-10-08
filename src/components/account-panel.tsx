"use client";
import { useEffect, useReducer } from 'react';
import { getCloud, portalBase } from '@/lib/account-sync';
import { parentIsUnlocked } from '@/lib/parent-auth';
export default function AccountPanel() {
  const [, refresh]=useReducer(value=>value+1,0);
  const cloud=getCloud();
  useEffect(()=>cloud?.subscribe(refresh),[cloud]);
  if(!cloud) return null;
  async function run(action:()=>Promise<void>) { try { await action(); } catch(error) { cloud?.notify(error instanceof Error?error.message:'操作未完成'); } }
  function download() {
    const url=URL.createObjectURL(new Blob([cloud!.exportData()],{type:'application/json'}));
    const link=document.createElement('a'); link.href=url; link.download='任务小帮手-云同步备份.json'; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  return <aside className="account-panel" aria-label="账号与云同步">
    <span role="status">{cloud.status}</span>
    <a href={`${portalBase}/${cloud.identity?'account':'login'}`}>{cloud.identity?'账号中心':'登录 / 注册'}</a>
    {cloud.identity&&<>
      <select aria-label="当前孩子" value={cloud.identity.activeProfileId} onChange={event=>run(()=>cloud.switchProfile(event.target.value))}>
        {cloud.profiles.map(profile=><option key={profile.id} value={profile.id}>{profile.nickname}</option>)}
      </select>
      <button onClick={()=>run(async()=>{ if(!parentIsUnlocked()) throw new Error('导入前请先在家长页面验证身份。'); if(confirm('将游客记录导入当前孩子？原始游客数据会保留，已有云数据时会要求选择。')) await cloud.migrateGuest(); })}>导入本机记录</button>
      <button onClick={()=>run(()=>cloud.retry())}>重试同步</button>
    </>}
    <button onClick={download}>导出备份</button>
    {cloud.conflict&&<>
      <button onClick={()=>run(async()=>{ if(confirm('使用本机版本更新云端？两份数据会另存恢复副本，请先导出备份。')) await cloud.resolve('local'); })}>保留本机</button>
      <button onClick={()=>run(async()=>{ if(confirm('恢复云端版本？本机记录会另存恢复副本，请先导出备份。')) await cloud.resolve('remote'); })}>恢复云端</button>
    </>}
  </aside>;
}
