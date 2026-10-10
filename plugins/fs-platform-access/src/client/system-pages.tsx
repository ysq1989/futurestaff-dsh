import { createElement, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'

export interface SystemPage { id:string;title:string;component:ComponentType;close?:()=>Promise<void> }
type State={mode:'sessions'|'systems';tabs:readonly SystemPage[];active:string|null;owner:string}
/** UI navigation only. Backend authorization remains inside each module. */
export class SystemPages {
  private state:State={mode:'sessions',tabs:[],active:null,owner:''}
  private pages=new Map<string,SystemPage>()
  private listeners=new Set<()=>void>()
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn)}}
  getSnapshot=()=>this.state
  private update(patch:Partial<State>){this.state={...this.state,...patch};for(const fn of this.listeners)fn()}
  register(page:SystemPage){
    if(this.pages.has(page.id))throw Error('SYSTEM_PAGE_ALREADY_REGISTERED')
    this.pages.set(page.id,page)
    return()=>{this.pages.delete(page.id);const tabs=this.state.tabs.filter(item=>item.id!==page.id);this.update({tabs,active:tabs.some(item=>item.id===this.state.active)?this.state.active:tabs.at(-1)?.id??null})}
  }
  bindOwner(owner:string){if(owner!==this.state.owner)this.update({owner,mode:'sessions',tabs:[],active:null})}
  select(mode:State['mode']){if(mode!==this.state.mode)this.update({mode})}
  open(id:string){
    const page=this.pages.get(id)
    if(!page||!this.state.owner)throw Error('SYSTEM_PAGE_UNAVAILABLE')
    this.update({mode:'systems',active:id,tabs:this.state.tabs.some(item=>item.id===id)?this.state.tabs:[...this.state.tabs,page]})
  }
  async close(id:string){
    const owner=this.state.owner,page=this.state.tabs.find(item=>item.id===id)
    if(!page)return
    await page.close?.()
    if(this.state.owner!==owner)return
    const tabs=this.state.tabs.filter(item=>item.id!==id)
    this.update({tabs,active:id===this.state.active?tabs.at(-1)?.id??null:this.state.active})
  }
}
const css=`.fs-system-main{position:relative;width:100%;height:100%;min-height:0;display:flex;flex-direction:column;background:var(--bg-primary);color:var(--text-primary)}.fs-system-main[hidden],.fs-system-body[hidden],.fs-chat-page[hidden]{display:none}.fs-system-strip{display:flex;gap:6px;align-items:center;padding:8px 12px;background:var(--bg-secondary);border-bottom:1px solid var(--border-default);overflow-x:auto;flex-shrink:0}.fs-system-tab{display:flex;border:1px solid var(--border-default);border-radius:9px;background:var(--bg-primary);flex-shrink:0}.fs-system-tab[data-selected=true]{border-color:var(--accent-primary);color:var(--accent-primary)}.fs-system-tab button{color:inherit;background:transparent;border:0;padding:8px 12px;cursor:pointer;font:inherit}.fs-system-tab button:focus-visible{outline:2px solid var(--accent-primary);outline-offset:-2px}.fs-system-content{flex:1;min-height:0;overflow:hidden}.fs-system-body{height:100%;min-height:0;overflow:auto}.fs-chat-page{height:100%;min-height:0}.fs-system-empty{display:grid;place-items:center;height:100%;color:var(--text-secondary)}`
export function SystemMain({pages,chat}:{pages:SystemPages;chat:ReactNode}){
  const state=useSyncExternalStore(pages.subscribe,pages.getSnapshot,pages.getSnapshot)
  return <><style>{css}</style><div className="fs-chat-page" hidden={state.mode!=='sessions'}>{chat}</div><section className="fs-system-main" hidden={state.mode!=='systems'} aria-label="系统页面">
    <div className="fs-system-strip" role="tablist" aria-label="已打开的系统">{state.tabs.map(page=><div className="fs-system-tab" key={page.id} data-selected={state.active===page.id}>
      <button role="tab" aria-selected={state.active===page.id} tabIndex={state.active===page.id?0:-1} aria-controls={`fs-system-${page.id}`} onClick={()=>pages.open(page.id)}>{page.title}</button>
      <button aria-label={`关闭${page.title}`} onClick={()=>{void pages.close(page.id).catch(()=>{})}}>×</button></div>)}</div>
    <div className="fs-system-content">{state.tabs.map(page=><div className="fs-system-body" role="tabpanel" id={`fs-system-${page.id}`} key={`${state.owner}:${page.id}`} hidden={state.active!==page.id}>{createElement(page.component)}</div>)}{!state.tabs.length&&<div className="fs-system-empty">选择左侧系统打开页面</div>}</div>
  </section></>
}
