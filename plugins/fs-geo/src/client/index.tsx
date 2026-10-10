import type {Context} from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type {} from '@futurestaff/fs-platform-access/client';
import {useEffect,useRef,useSyncExternalStore} from 'react';

export const inject=['platformClientSession','platformSystemPages','slots'];
const pageId='geo';
export function apply(ctx:Context){
 function Launcher({wide}:{wide:boolean}){
  return <button type="button" aria-label="打开 GEO 系统" title="GEO 品牌可见性与内容运营" onClick={()=>ctx.platformSystemPages.open(pageId)} style={{width:'100%',padding:'8px 10px'}}> {wide?'GEO 品牌运营':'GEO'} </button>;
 }
 function Page(){
  const controller=ctx.platformClientSession;
  const session=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const frame=useRef<HTMLIFrameElement>(null);
  useEffect(()=>{
   const message=(event:MessageEvent)=>{
    if(event.source!==frame.current?.contentWindow||event.origin!==window.location.origin)return;
    if(event.data?.type==='futurestaff-geo-close')void ctx.platformSystemPages.close(pageId);
    if(event.data?.type==='futurestaff-geo-open-link'&&typeof event.data.url==='string'){
     try{const url=new URL(event.data.url);if(['https:','http:'].includes(url.protocol)&&!url.username&&!url.password)window.open(url.href,'_blank','noopener,noreferrer')}catch{/* invalid external link */}
    }
   };
   window.addEventListener('message',message);return()=>window.removeEventListener('message',message);
  },[]);
  if(session.phase!=='ready'||!session.applications.some(app=>app.appId==='geo'&&app.tenantId===session.activeTenantId))return <section style={{padding:24}}><h1>GEO 品牌运营</h1><p role="status">请在 FutureStaff 主窗口完成登录，并核对当前主体的 GEO 应用授权。</p></section>;
  return <iframe ref={frame} key={`${session.activeTenantId}:${session.user?.userId}`} title="GEO 品牌运营工作区" src="/_futurestaff/geo/" sandbox="allow-scripts allow-same-origin allow-downloads" style={{display:'block',width:'100%',height:'100%',border:0}}/>;
 }
 ctx.effect(()=>ctx.platformSystemPages.register({id:pageId,title:'GEO 品牌运营',component:Page}),'futurestaff-geo: peer system page');
 ctx.slots.inject('sidebar.footer.action',()=>ctx.slots.register({name:'sidebar.footer.action',id:'futurestaff-geo-launcher',order:-14},Launcher));
}
