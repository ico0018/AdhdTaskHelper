/* Standalone sync engine; stores learning data, never authentication tokens. */
(function(root) {
  'use strict';
  const canonical = value => JSON.stringify(normalize(value));
  function normalize(value) {
    if(Array.isArray(value)) return value.map(normalize);
    if(value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key,normalize(value[key])]));
    return value;
  }
  class CloudSyncAdapter {
    constructor(options) {
      this.options=options; this.local=options.storage; this.identity=null; this.profiles=[];
      this.status='游客 · 本机模式'; this.conflict=null; this.listeners=new Set();
      this.busy=false; this.verified=false; this.parentReady=false; this.sessionUser=null; this.key=null; this.identityKey=`xbb:last-identity:${options.tool}`;
    }
    subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
    notify(status) { if(status) this.status=status; this.listeners.forEach(fn=>fn()); }
    async request(path, method='GET', body) {
      const response=await (this.options.fetch||root.fetch)(`${this.options.apiBase}${path}`, {
        method, credentials:'include', cache:'no-store', signal:AbortSignal.timeout(10000),
        headers:body?{'Content-Type':'application/json'}:{}, ...(body?{body:JSON.stringify(body)}:{})
      });
      if(!response.ok) { const error=new Error(`请求失败 (${response.status})`); error.status=response.status; throw error; }
      return response.json();
    }
    read() {
      const raw=this.key&&this.local.getItem(this.key);
      if(!raw) return {revision:0,schemaVersion:1,payload:null,dirty:false,generation:0};
      const data=JSON.parse(raw);
      if(!Number.isInteger(data.revision)||data.revision<0||!Number.isInteger(data.generation)) throw new Error('缓存损坏，原始记录已保留，请导出后检查。');
      return data;
    }
    persist(data) { this.local.setItem(this.key,JSON.stringify(data)); }
    get payload() { return this.identity?this.read().payload:this.options.guest(); }
    setPayload(payload) {
      if(!this.identity) { this.options.saveGuest(payload); return; }
      const previous=this.read();
      if(canonical(previous.payload)===canonical(payload)) return;
      try { this.persist({...previous,payload,dirty:true,generation:previous.generation+1}); }
      catch(error) { this.notify('本机保存失败，尚未同步：请检查存储空间并导出备份'); throw error; }
      this.notify(this.conflict?'同步冲突：本机修改已保留':'本机已保存，等待云同步');
      clearTimeout(this.timer); this.timer=setTimeout(()=>this.flush(),700);
    }
    async start() {
      let session;
      try { session=await this.request('/api/v1/session'); this.verified=true; }
      catch(error) {
        if(error.status===401||error.status===403) session={user:null};
        else { session=JSON.parse(this.local.getItem(this.identityKey)||'null'); this.notify('离线模式：修改保存在本机，联网后重试'); }
      }
      this.sessionUser=session?.user || null; this.parentReady=this.verified && session?.parentReady===true;
      if(session?.user&&session.activeProfileId) {
        this.identity={user:session.user,activeProfileId:session.activeProfileId};
        this.key=`xbb:state:v1:${this.options.tool}:${encodeURIComponent(session.user.id)}:${encodeURIComponent(session.activeProfileId)}`;
        this.local.setItem(this.identityKey,JSON.stringify(this.identity));
        if(this.verified) try {
          const response=await this.request('/api/v1/profiles'); this.profiles=Array.isArray(response)?response:response.profiles||[];
          await this.pull();
        } catch(error) { this.notify(`云端暂时不可用：${error.message}；本机修改已保留`); }
      } else { this.local.removeItem(this.identityKey); this.notify(session?.user?'请在账号中心创建或选择孩子':'游客 · 本机模式'); }
      this.notify();
    }
    statePath() { return `/api/v1/profiles/${encodeURIComponent(this.identity.activeProfileId)}/state/${this.options.tool}`; }
    validate(payload) { if(payload!==null&&this.options.validate) this.options.validate(payload); }
    async pull() {
      const remote=await this.request(this.statePath());
      if(remote.schemaVersion!==1||!Number.isInteger(remote.revision)) throw new Error('云端数据版本暂不支持');
      this.validate(remote.payload); const local=this.read();
      if(local.conflict) { this.conflict=remote; this.persist({...local,conflict:true}); this.notify('同步冲突：请导出并选择保留哪份记录'); return; }
      this.conflict=null;
      if(local.dirty&&remote.revision!==local.revision) {
        if(canonical(remote.payload)===canonical(local.payload)) this.persist({...local,revision:remote.revision,dirty:false});
        else { this.conflict=remote; this.persist({...local,conflict:true}); this.notify('同步冲突：请导出并选择保留哪份记录'); return; }
      } else if(!local.dirty) this.persist({...local,...remote,dirty:false});
      this.notify(this.read().dirty?'本机已保存，等待云同步':'云同步已完成'); await this.flush();
    }
    async flush() {
      if(!this.identity||!this.verified||this.busy||this.conflict||!this.read().dirty) return;
      this.busy=true; const submitted=this.read();
      try {
        const saved=await this.request(this.statePath(),'PUT',{revision:submitted.revision,schemaVersion:1,payload:submitted.payload});
        const latest=this.read(); this.persist({...latest,revision:saved.revision,dirty:latest.generation!==submitted.generation});
        this.notify(this.read().dirty?'本机已保存，等待云同步':'云同步已完成');
      } catch(error) {
        if(error.status===409) {
          try { this.conflict=await this.request(this.statePath()); this.validate(this.conflict.payload); }
          catch { this.conflict={unavailable:true}; }
          this.persist({...this.read(),conflict:true}); this.notify('同步冲突：本机修改已保留，请导出并选择');
        } else {
          if(error.status===401||error.status===403) this.verified=false;
          this.notify(`云同步失败 (${error.status||'离线'})：本机修改已保留，点击重试`);
        }
      } finally { this.busy=false; }
      if(!this.conflict&&this.verified&&this.read().dirty) { clearTimeout(this.timer); this.timer=setTimeout(()=>this.flush(),15000); }
    }
    async retry() {
      const session=await this.request('/api/v1/session');
      this.sessionUser=session.user || null; this.parentReady=session.parentReady===true; this.notify();
      if(!this.identity && !session.activeProfileId) { this.notify(session.user?'请在账号中心创建或选择孩子':'游客 · 本机模式'); return; }
      if(session.user?.id!==this.identity?.user.id||session.activeProfileId!==this.identity?.activeProfileId) {
        this.verified=false; this.notify('账号或孩子已切换，请重新打开工具；本机记录已保留'); this.options.reload?.(); return;
      }
      const before=canonical(this.payload); this.verified=true; await this.pull();
      if(before!==canonical(this.payload)) this.options.changed?.();
    }
    async migrateGuest() {
      if(!this.identity||!this.verified) throw new Error('请先连接账号并选择孩子');
      const guest=this.options.guest();
      if(!guest||(this.options.empty&&this.options.empty(guest))) throw new Error('当前设备没有可导入的游客记录');
      this.validate(guest); const local=this.read();
      if(local.payload&&!(this.options.empty&&this.options.empty(local.payload))) {
        this.conflict={revision:local.revision,schemaVersion:1,payload:local.payload};
        this.local.setItem(`${this.key}:recovery:${Date.now()}`,JSON.stringify(local));
        this.persist({...local,payload:guest,dirty:true,conflict:true,generation:local.generation+1});
        this.notify('游客与孩子均有记录：请先导出两份数据，再选择');
      } else this.setPayload(guest);
      this.options.changed?.();
    }
    async resolve(choice) {
      if(!this.conflict||this.conflict.unavailable) throw new Error('请联网重试，以获取冲突记录');
      const local=this.read();
      this.local.setItem(`${this.key}:recovery:${Date.now()}`,JSON.stringify({local,remote:this.conflict}));
      this.persist(choice==='local'?{...local,revision:this.conflict.revision,dirty:true,conflict:false}:{...local,...this.conflict,dirty:false,conflict:false});
      this.conflict=null; await this.flush(); this.options.changed?.(); this.notify();
    }
    exportData() {
      let local,guest;
      try { local=this.key?this.read():this.payload; } catch { local={raw:this.local.getItem(this.key),error:'原始缓存无法解析'}; }
      try { guest=this.options.guest(); } catch { guest={raw:this.options.rawGuest?.(),error:'原始游客数据无法解析'}; }
      const recoveryCopies={};
      for(let i=0; i<this.local.length; i++) {
        const key=this.local.key(i); if(this.key && key?.startsWith(`${this.key}:recovery:`)) recoveryCopies[key]=this.local.getItem(key);
      }
      return JSON.stringify({identity:this.identity,local,remote:this.conflict,guest,recoveryCopies},null,2);
    }
    async switchProfile(profileId) { await this.request('/api/v1/active-profile','POST',{profileId}); this.options.reload?.(); }
  }
  root.XbbCloudSyncAdapter=CloudSyncAdapter;
  if(typeof module==='object'&&module.exports) module.exports={CloudSyncAdapter};
})(typeof window==='object'?window:globalThis);
