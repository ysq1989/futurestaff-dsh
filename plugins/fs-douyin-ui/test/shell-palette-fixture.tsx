import { createElement, type ComponentType } from 'react'
import { apply as applyDouyin } from '../src/client/index.js'
import { apply as applyProductHub } from '../../fs-product-hub-ui/src/client/index.js'
import { SystemPages } from '../../fs-platform-access/lib/client/system-pages.js'

// Exercise the real launcher components without a slot data attribute: upstream
// renders these inside a CSS-module footer, which was missed by the first skin.
export function ShellPaletteFixture() {
  const launchers: ComponentType<{ wide: boolean }>[] = []
  const context = { platformSystemPages:new SystemPages(),slots: {
    inject: (_name: string, callback: () => unknown) => callback(),
    register: (options: { name: string }, component: ComponentType<{ wide: boolean }>) => {
      if (options.name === 'sidebar.footer.action') launchers.push(component)
      return () => {}
    },
  } }
  applyProductHub(context as never)
  applyDouyin(context as never)
  return <div style={{ display:'grid', gridTemplateColumns:'248px 1fr',height:'100vh',fontFamily:'var(--font-family)' }}>
    <aside className="dshDesktopSidebarSurface" style={{display:'flex',flexDirection:'column',padding:16}}>
      <strong style={{padding:'12px 8px'}}>FutureStaff Agent</strong>
      <div style={{padding:'24px 8px',color:'var(--text-secondary)',fontSize:13}}>工作区</div>
      <p style={{padding:'0 8px',color:'var(--text-tertiary)',fontSize:13}}>暂无会话</p>
      <div style={{marginTop:'auto',display:'grid',gap:6}}>{launchers.map((component,index)=>createElement(component,{key:index,wide:true}))}</div>
    </aside>
    <main className="dshDesktopConversationSurface" style={{display:'grid',placeItems:'center'}}>
      <div style={{width:'min(680px,80%)'}}><h1 style={{fontSize:26,textAlign:'center',fontWeight:600}}>探索未至之境</h1>
        <div style={{padding:'16px 0',color:'var(--text-secondary)',fontSize:13}}>选择工作区</div>
        <div style={{padding:20,height:112,border:'1px solid var(--border-default)',borderRadius:16,background:'var(--bg-tertiary)',color:'var(--text-secondary)',fontSize:14}}>选择一个工作区开始</div>
      </div>
    </main>
  </div>
}
