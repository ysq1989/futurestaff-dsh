/** Executes only in the owned Douyin tab. No caller-provided selectors/code. */
export function openPrivateConversation(recipient:string){
  if(location.origin!=='https://www.douyin.com'||location.pathname!==`/user/${recipient}`||document.readyState!=='complete')return false
  const visible=(el:Element)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'}
  const profiles=[...document.querySelectorAll('[data-e2e="user-info"]')].filter(visible)
  if(profiles.length!==1)return false
  const buttons=[...profiles[0]!.querySelectorAll('button,[role="button"],a')].filter(el=>visible(el)&&el.textContent?.trim()==='私信')
  if(buttons.length!==1)return false
  ;(buttons[0] as HTMLElement).click();return true
}
export function privateConversation(args:{recipient:string;operation:'check'|'focus'|'send'|'receipt';message?:string}){
  if(location.origin!=='https://www.douyin.com'||location.pathname!==`/user/${args.recipient}`)throw Error('SEND_RECIPIENT_UNVERIFIED')
  const visible=(el:Element)=>{const r=el.getBoundingClientRect();return r.width>0&&r.height>0&&getComputedStyle(el).visibility!=='hidden'}
  const panels=[...document.querySelectorAll('[data-e2e="chat-panel"],[role="dialog"]')].filter(el=>{
    if(!visible(el))return false
    const headers=[...el.querySelectorAll('[data-e2e="chat-header"],header')].filter(visible)
    if(headers.length!==1)return false
    const peers=[...headers[0]!.querySelectorAll('a[href]')].flatMap(a=>{
      try{const url=new URL(a.getAttribute('href')!,location.origin);return url.origin===location.origin&&/^\/user\//.test(url.pathname)&&!url.username&&!url.password?[url.pathname]:[]}catch{return []}
    })
    return peers.length===1&&peers[0]===`/user/${args.recipient}`
  })
  if(panels.length!==1)throw Error('SEND_RECIPIENT_UNVERIFIED')
  const panel=panels[0]!,editors=[...panel.querySelectorAll<HTMLElement>('[contenteditable="true"]')].filter(visible)
  const buttons=[...panel.querySelectorAll<HTMLButtonElement>('button,[role="button"]')].filter(el=>visible(el)&&el.textContent?.trim()==='发送'&&!el.disabled&&el.getAttribute('aria-disabled')!=='true')
  if(editors.length!==1||buttons.length!==1)throw Error('SEND_EDITOR_UNAVAILABLE')
  const receipts=[...panel.querySelectorAll('[data-message-id][data-direction="outgoing"]')].map(el=>({id:el.getAttribute('data-message-id')!,text:el.textContent?.trim()||''})).slice(-100)
  if(args.operation==='focus'){if(editors[0]!.innerText.trim())throw Error('SEND_EDITOR_NOT_EMPTY');editors[0]!.focus();if(document.activeElement!==editors[0])throw Error('SEND_EDITOR_UNAVAILABLE')}
  if(args.operation==='send'){if(!args.message||editors[0]!.innerText.trim()!==args.message)throw Error('SEND_EDITOR_UNAVAILABLE');buttons[0]!.click()}
  return {receipts}
}
