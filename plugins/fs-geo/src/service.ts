import { AsyncLocalStorage } from 'node:async_hooks';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { z } from 'zod';
import { makeApp } from '../source/apps/api/app.js';
import { Repository, type Database, type Queryable } from '../source/packages/storage/repository.js';
import { migrate } from '../source/packages/storage/migrations.js';
import { GeoError } from '../source/packages/core/errors.js';
import type { Identity } from '../source/packages/platform/identity.js';

export interface GeoActor extends Identity {
  namespace: string;
  signal: AbortSignal;
}
export interface GeoInference {
  models(): Promise<readonly { modelId: string; displayName: string }[]>;
  generateText(input: {modelId: string; system: string; text: string; signal?: AbortSignal}): Promise<{text: string; modelId: string; tenantId: string; userId: string}>;
}
const actorSchema=z.object({tenantId:z.uuid(),userId:z.uuid(),namespace:z.enum(['https://dev.fsstory.net','https://platform.fsstory.net']),displayName:z.string().max(256),tenantName:z.string().max(256),permissions:z.array(z.string()).max(100)});
export function geoOwnerDirectory(root: string, actor: GeoActor) {
  if(!path.isAbsolute(root)) throw Error('GEO_LOCAL_PATH_REQUIRED');
  const owner=actorSchema.parse(actor);
  return path.join(root,createHash('sha256').update(JSON.stringify([owner.namespace,owner.tenantId,owner.userId])).digest('hex'));
}
type LocalRuntime={app:Awaited<ReturnType<typeof makeApp>>;db:PGlite;actors:AsyncLocalStorage<GeoActor>;requests:Map<string,GeoActor>;revoke?:()=>void};

/** Fixed-owner databases; request-local authority never comes from the page body. */
export class GeoDesktopService {
  private runtimes=new Map<string,Promise<LocalRuntime>>();
  private disposed=false;
  private retiring=new Map<string,Promise<void>>();
  get activeDatabases(){return this.runtimes.size}
  constructor(private options:{root:string;authorize:()=>Promise<GeoActor>;inference:GeoInference}){}
  async dispatch(input:{method:string;url:string;body?:unknown;headers?:Record<string,string>}) {
    if(this.disposed) throw Error('GEO_WORKSPACE_CLOSED');
    if(!['GET','POST'].includes(input.method)||!/^\/api\/geo\/v1\/[a-zA-Z0-9/_-]+(?:\?[^#]*)?$/.test(input.url)) throw Error('GEO_ROUTE_REJECTED');
    const actor=await this.options.authorize(); actorSchema.parse(actor); actor.signal.throwIfAborted();
    if(!actor.permissions.some(p=>['geo.read','geo.operator','geo.admin'].includes(p))) throw Error('GEO_PERMISSION_REQUIRED');
    const directory=geoOwnerDirectory(this.options.root,actor);
    await this.retiring.get(directory);
    actor.signal.throwIfAborted();
    let pending=this.runtimes.get(directory);
    if(!pending) {
      pending=this.open(directory); this.runtimes.set(directory,pending);
      const opened=pending;
      const revoke=()=>{void this.retire(directory,opened).catch(()=>console.warn('GEO_LOCAL_CLOSE_FAILED'))};
      actor.signal.addEventListener('abort',revoke,{once:true});
      void opened.then(runtime=>{runtime.revoke=()=>actor.signal.removeEventListener('abort',revoke)},()=>actor.signal.removeEventListener('abort',revoke));
      void pending.catch(()=>{if(this.runtimes.get(directory)===pending)this.runtimes.delete(directory)});
    }
    const runtime=await pending; actor.signal.throwIfAborted();
    if(this.disposed) throw Error('GEO_WORKSPACE_CLOSED');
    const requestId=randomUUID();runtime.requests.set(requestId,actor);
    try {
    const result=await runtime.app.inject({
      method:input.method as 'GET'|'POST',url:input.url,
      headers:{cookie:`geo-desktop-request=${requestId}`,origin:'http://geo.localhost','content-type':'application/json',...(input.headers?.['idempotency-key']?{'idempotency-key':input.headers['idempotency-key']}: {})},
      ...(input.body===undefined?{}:{payload:JSON.stringify(input.body)}),
    });
    actor.signal.throwIfAborted(); return result;
    } finally {runtime.requests.delete(requestId)}
  }
  private async open(directory:string):Promise<LocalRuntime> {
    await mkdir(directory,{recursive:true,mode:0o700});
    const db=new PGlite(directory); const actors=new AsyncLocalStorage<GeoActor>(); const requests=new Map<string,GeoActor>();
    try {
      await db.waitReady; await migrate(db);
      const current=()=>{const actor=actors.getStore();if(!actor)throw new GeoError('UNAUTHENTICATED',401,'请在 DSH 完成登录');actor.signal.throwIfAborted();return actor};
      const database:Database={query:async<T>(sql:string,params?:unknown[])=>({rows:(await db.query(sql,params)).rows as T[]}),
        transaction:async<T>(fn:(q:Queryable)=>Promise<T>)=>db.transaction(async tx=>{
          current(); const result=await fn({query:async<R>(sql:string,params?:unknown[])=>({rows:(await tx.query(sql,params)).rows as R[]})});
          current(); return result;
        })};
      const inference=this.options.inference;
      const complete=async(model:string,system:string,text:string)=>{
        const owner=current();
        if(!owner.permissions.some(p=>['geo.operator','geo.admin'].includes(p))) throw new GeoError('FORBIDDEN',403,'当前账号只有只读权限');
        const result=await inference.generateText({modelId:model,system,text,signal:owner.signal});
        current();
        if(result.tenantId!==owner.tenantId||result.userId!==owner.userId||result.modelId!==model)throw new GeoError('AI_RESULT_UNKNOWN',409,'模型结果归属不匹配，请勿重复发起');
        return {model,choices:[{message:{content:result.text},finish_reason:'stop'}]};
      };
      const gateway={models:async()=>{current();return (await inference.models()).map(m=>m.modelId)},
        chat:async(_cookie:string,_id:string,model:string,question:string)=>complete(model,'按问题如实回答。不知道的信息说明不确定；不要编造网页来源或联网能力。',question),
        draft:async(_cookie:string,_id:string,model:string,messages:{role:'system'|'user';content:string}[])=>complete(model,messages.filter(m=>m.role==='system').map(m=>m.content).join('\n'),messages.filter(m=>m.role==='user').map(m=>m.content).join('\n'))};
      const identity={authenticate:async(cookie:string|undefined)=>{const actor=requests.get(cookie?.replace(/^geo-desktop-request=/,'')??'');if(!actor)throw new GeoError('UNAUTHENTICATED',401,'请在 DSH 完成登录');actor.signal.throwIfAborted();return actor},onlyCookie:()=>'',cookieName:()=>'',request:async()=>{throw new GeoError('DESKTOP_AUTH_MANAGED',403,'请在 DSH 管理登录')}};
      const app=await makeApp({repo:new Repository(database),identity,config:{platformUrl:'https://platform.fsstory.net',publicUrl:'http://geo.localhost',clientId:'futurestaff-geo-desktop',pkceSecret:''},gateway,writingGateway:gateway,writingEnabled:true,describeModels:async()=>Object.fromEntries((await inference.models()).map(m=>[m.modelId,m.displayName])),desktop:true,identityContext:(actor,next)=>actors.run(actor as GeoActor,next)});
      await app.ready(); return {app,db,actors,requests};
    } catch(error){await db.close();throw error}
  }
  private retire(directory:string,pending:Promise<LocalRuntime>){
    const existing=this.retiring.get(directory);if(existing)return existing;
    if(this.runtimes.get(directory)===pending)this.runtimes.delete(directory);
    const closing=pending.then(async runtime=>{runtime.revoke?.();await runtime.app.close();await runtime.db.close()},()=>{});
    this.retiring.set(directory,closing);
    void closing.finally(()=>{if(this.retiring.get(directory)===closing)this.retiring.delete(directory)}).catch(()=>{});
    return closing;
  }
  async close(){
    this.disposed=true;
    const pending=[...this.runtimes.values()];this.runtimes.clear();
    await Promise.allSettled([...this.retiring.values()]);
    for(const item of pending){try{const runtime=await item;runtime.revoke?.();await runtime.app.close();await runtime.db.close()}catch{/* failed opens close their own database */}}
  }
}
