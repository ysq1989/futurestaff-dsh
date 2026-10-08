/// <reference path="../vite-env.d.ts" />
import { Info, RotateCw, Check } from 'lucide-react'
import { Button } from '../components/ui/button.tsx'
import logo from '../../../build/brand/website-logo.svg?raw'
import './update-dialog.css'

interface UpdateDialogState {
  readonly message: string
  readonly detail?: string
  readonly advisory?: string
  readonly updateVersion?: string
  readonly primaryId?: number
  readonly defaultId: number
  readonly cancelId: number
  readonly buttons: readonly string[]
  readonly locale?: 'zh' | 'en'
}

/** Focus and visual emphasis are separate: Enter still defaults to postponing. */
export function DesktopUpdateDialog({ state, respond }: {
  state: UpdateDialogState; respond: (index: number) => void
}): JSX.Element {
  const primary = state.primaryId ?? 0
  const order = state.buttons.map((label, index) => ({ label, index }))
    .sort((a, b) => Number(a.index === primary) - Number(b.index === primary))
  const english = state.locale === 'en'
  return <main className="dshNativeContent dshUpdateDialog" role="dialog" aria-labelledby="desktop-dialog-title" aria-describedby={state.advisory ? 'desktop-dialog-advisory' : undefined}>
    <header className="dshUpdateHeader">
      <span className="dshUpdateLogo" dangerouslySetInnerHTML={{ __html: logo }} />
      <div><p className="dshUpdateBrand">FutureStaff Agent</p><h1 id="desktop-dialog-title">{state.message}</h1></div>
    </header>
    <div className="dshUpdateVersion"><span>v{state.updateVersion}</span><span className="dshUpdateReady"><Check size={13} aria-hidden="true" />{english ? 'Ready to install' : '已下载，准备安装'}</span></div>
    {state.detail ? <section className="dshUpdateNotes"><h2>{english ? "What's new" : '本次更新'}</h2><p>{state.detail}</p></section> : null}
    {state.advisory ? <div className="dshUpdateAdvisory" id="desktop-dialog-advisory"><Info size={16} aria-hidden="true" /><p>{state.advisory}</p></div> : null}
    <footer className="dshUpdateActions">{order.map(({ label, index }) => <Button key={index} type="button" autoFocus={index === state.defaultId}
      variant={index === primary ? 'default' : 'outline'} className={index === primary ? 'dshUpdatePrimary' : 'dshUpdateLater'}
      onClick={() => { respond(index) }}>{index === primary ? <RotateCw size={15} aria-hidden="true" /> : null}{label}</Button>)}</footer>
  </main>
}
