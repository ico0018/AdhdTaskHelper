/* eslint-disable @typescript-eslint/no-require-imports -- Node standalone regression runner. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { CloudSyncAdapter } = require(path.resolve(__dirname, process.argv[2] || '../cloud-sync.js'));
function storage() { const values=new Map(); return {getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; }
function setup(t, options={}) {
  const local=options.local||storage(); let remote={revision:0,schemaVersion:1,payload:null}; let fail=false; let calls=[]; let gate=null;
  let identity={user:{id:'user-1'},activeProfileId:'child-1'};
  const cloud=new CloudSyncAdapter({...options,tool:'hanzi',storage:local,apiBase:'https://api.test',guest:()=>options.guest||{},saveGuest:()=>{},
    fetch:async(url,init)=>{
      calls.push({url,init}); if(fail) throw new Error('offline');
      if(url.endsWith('/session')) return {ok:true,json:async()=>identity};
      if(url.endsWith('/profiles')) return {ok:true,json:async()=>({profiles:[{id:'child-1',nickname:'孩子'}]})};
      if(init.method==='PUT') {
        const data=JSON.parse(init.body); if(data.revision!==remote.revision) return {ok:false,status:409};
        if(gate) await gate(); remote={...data,revision:remote.revision+1}; return {ok:true,json:async()=>remote};
      }
      return {ok:true,json:async()=>remote};
    }});
  t.after(()=>clearTimeout(cloud.timer));
  return {cloud,local,calls,setRemote:value=>remote=value,getRemote:()=>remote,setFail:value=>fail=value,setGate:value=>gate=value,setIdentity:value=>identity=value};
}
test('credentials are included and guest data requires explicit migration',async t=>{
  const ctx=setup(t,{guest:{'hanzi-practice-v3-3-upper':'{"字":true}'}}); await ctx.cloud.start();
  assert.equal(ctx.cloud.payload,null); assert.equal(ctx.calls.filter(call=>call.init.method==='PUT').length,0);
  await ctx.cloud.migrateGuest(); await ctx.cloud.flush(); assert.deepEqual(ctx.getRemote().payload,{'hanzi-practice-v3-3-upper':'{"字":true}'});
  assert.ok(ctx.calls.every(call=>call.init.credentials==='include'));
});
test('persistent outbox survives restart and retries offline changes',async t=>{
  const first=setup(t); await first.cloud.start(); first.setFail(true); first.cloud.setPayload({writing:'saved'}); await first.cloud.flush();
  assert.equal(first.cloud.read().dirty,true); assert.match(first.cloud.status,/失败/);
  const second=setup(t,{local:first.local}); await second.cloud.start(); assert.deepEqual(second.getRemote().payload,{writing:'saved'}); assert.equal(second.cloud.read().dirty,false);
});
test('revision conflict retains local and remote and never overwrites silently',async t=>{
  const ctx=setup(t); await ctx.cloud.start(); ctx.cloud.setPayload({local:'keep'}); ctx.setRemote({revision:1,schemaVersion:1,payload:{remote:'keep'}}); await ctx.cloud.flush();
  assert.equal(ctx.cloud.read().dirty,true); assert.deepEqual(ctx.cloud.payload,{local:'keep'}); assert.deepEqual(ctx.cloud.conflict.payload,{remote:'keep'});
  const puts=ctx.calls.filter(call=>call.init.method==='PUT').length; await ctx.cloud.flush(); assert.equal(ctx.calls.filter(call=>call.init.method==='PUT').length,puts);
  const backup=JSON.parse(ctx.cloud.exportData()); assert.deepEqual(backup.local.payload,{local:'keep'}); assert.deepEqual(backup.remote.payload,{remote:'keep'});
});
test('migration collision remains a conflict across reload',async t=>{
  const ctx=setup(t,{guest:{guest:'data'}}); ctx.setRemote({revision:1,schemaVersion:1,payload:{remote:'data'}}); await ctx.cloud.start(); await ctx.cloud.migrateGuest();
  const next=setup(t,{local:ctx.local}); next.setRemote({revision:1,schemaVersion:1,payload:{remote:'data'}}); await next.cloud.start();
  assert.deepEqual(next.cloud.payload,{guest:'data'}); assert.deepEqual(next.cloud.conflict.payload,{remote:'data'}); assert.equal(next.calls.filter(call=>call.init.method==='PUT').length,0);
});
test('cloud restores a fresh device and isolates different users and children',async t=>{
  const ctx=setup(t); ctx.setRemote({revision:2,schemaVersion:1,payload:{learned:true}}); await ctx.cloud.start(); assert.deepEqual(ctx.cloud.payload,{learned:true});
  const other=setup(t,{local:ctx.local}); other.setIdentity({user:{id:'user-1'},activeProfileId:'child-2'}); await other.cloud.start(); assert.equal(other.cloud.payload,null); assert.notEqual(other.cloud.key,ctx.cloud.key);
  const user=setup(t,{local:ctx.local}); user.setIdentity({user:{id:'user-2'},activeProfileId:'child-1'}); await user.cloud.start(); assert.equal(user.cloud.payload,null); assert.notEqual(user.cloud.key,ctx.cloud.key);
});
test('modifications during an upload retain dirty flag and updated content',async t=>{
  const ctx=setup(t); await ctx.cloud.start(); ctx.cloud.setPayload({value:1}); ctx.setGate(async()=>ctx.cloud.setPayload({value:2})); await ctx.cloud.flush();
  assert.deepEqual(ctx.cloud.payload,{value:2}); assert.equal(ctx.cloud.read().dirty,true); assert.equal(ctx.cloud.read().revision,1);
  ctx.setGate(null); await ctx.cloud.flush(); assert.deepEqual(ctx.getRemote().payload,{value:2}); assert.equal(ctx.cloud.read().dirty,false);
});
test('quota failure leaves last readable payload untouched',async t=>{
  const ctx=setup(t); await ctx.cloud.start(); ctx.cloud.setPayload({safe:true}); const previous=ctx.local.setItem; ctx.local.setItem=()=>{throw new Error('quota');};
  assert.throws(()=>ctx.cloud.setPayload({unsafe:true}),/quota/); assert.deepEqual(ctx.cloud.payload,{safe:true}); assert.match(ctx.cloud.status,/保存失败/); ctx.local.setItem=previous;
});
test('guest focus retry remains on the same page',async t=>{
  let reloads=0; const ctx=setup(t,{reload:()=>reloads++}); ctx.setIdentity({user:null,activeProfileId:null}); await ctx.cloud.start(); await ctx.cloud.retry(); assert.equal(reloads,0);
});

test('JSONB object key order does not create changes or false conflict',async t=>{
  const ctx=setup(t); ctx.setRemote({revision:1,schemaVersion:1,payload:{z:1,a:{y:2,b:3}}}); await ctx.cloud.start();
  ctx.cloud.setPayload({a:{b:3,y:2},z:1}); assert.equal(ctx.cloud.read().dirty,false);
  ctx.cloud.setPayload({a:{b:3,y:2},z:4}); ctx.setRemote({revision:2,schemaVersion:1,payload:{z:4,a:{y:2,b:3}}}); await ctx.cloud.retry();
  assert.equal(ctx.cloud.conflict,null); assert.equal(ctx.cloud.read().dirty,false);
});
test('account without child remains available without a focus reload loop',async t=>{
  let reloads=0;const ctx=setup(t,{reload:()=>reloads++});ctx.setIdentity({user:{id:'user-1'},activeProfileId:null});
  await ctx.cloud.start();await ctx.cloud.retry();assert.equal(reloads,0);assert.match(ctx.cloud.status,/选择孩子/);
});

test('parent grant follows the server session and is revoked by session refresh',async t=>{
  const ctx=setup(t);ctx.setIdentity({user:{id:'user-1'},activeProfileId:'child-1',parentReady:true});await ctx.cloud.start();
  assert.equal(ctx.cloud.parentReady,true);assert.equal(ctx.cloud.sessionUser.id,'user-1');
  ctx.setIdentity({user:{id:'user-1'},activeProfileId:'child-1',parentReady:false});await ctx.cloud.retry();assert.equal(ctx.cloud.parentReady,false);
});
