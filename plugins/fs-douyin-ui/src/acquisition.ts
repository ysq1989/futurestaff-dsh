import { z } from 'zod'
import { scanErrorCodes,type ScanErrorCode } from './watch-monitor.js'
export const acquisitionPolicySchema=z.object({
  message:z.string().trim().min(1).max(500),send:z.boolean(),maxMessagesPerDay:z.number().int().min(1).max(50),
  intervalSeconds:z.number().int().min(30).max(600),durationMinutes:z.number().int().min(5).max(1440),
  discoveryIntervalMinutes:z.number().int().min(10).max(1440),
}).strict()
export type AcquisitionPolicy=z.infer<typeof acquisitionPolicySchema>
type Hooks={valid():boolean;discover(signal:AbortSignal):Promise<void>;monitor(signal:AbortSignal):Promise<void>;
  send(policy:AcquisitionPolicy,signal:AbortSignal):Promise<'sent'|'none'|'unknown'>;log(phase:'started'|'completed'|'failed',code?:ScanErrorCode):Promise<void>}
export class Acquisition {
  private phase:'idle'|'running'|'paused'|'blocked'|'completed'='idle'
  private controller:AbortController|undefined
  private policy:AcquisitionPolicy|undefined
  private expiresAt=0
  private nextDiscovery=0
  private nextSend=0
  private busy=false
  private errorCode:ScanErrorCode|undefined
  constructor(private signal:AbortSignal,private hooks:Hooks,private now=Date.now){}
  status(){return {phase:this.phase,expiresAt:this.expiresAt,nextDiscovery:this.nextDiscovery,nextSend:this.nextSend,policy:this.policy?structuredClone(this.policy):null,errorCode:this.errorCode}}
  start(input:unknown){
    this.signal.throwIfAborted();if(!this.hooks.valid())throw Error('ACQUISITION_CONTEXT_CHANGED')
    this.controller?.abort();this.policy=acquisitionPolicySchema.parse(input);this.controller=new AbortController()
    this.phase='running';this.errorCode=undefined;this.expiresAt=this.now()+this.policy.durationMinutes*60_000;this.nextDiscovery=0;this.nextSend=0
  }
  stop(){this.controller?.abort();this.controller=undefined;this.phase='paused'}
  async settle(){while(this.busy)await new Promise(resolve=>setTimeout(resolve,20))}
  rebind(signal:AbortSignal){this.stop();this.signal=signal}
  async tick(){
    if(this.busy||this.phase!=='running'||!this.controller||!this.policy)return
    if(this.now()>=this.expiresAt){this.stop();this.phase='completed';return}
    this.busy=true
    const controller=this.controller,policy=this.policy,signal=AbortSignal.any([controller.signal,this.signal,AbortSignal.timeout(Math.max(1,Math.min(120_000,this.expiresAt-this.now())))])
    try{
      if(!this.hooks.valid())throw Error('ACQUISITION_CONTEXT_CHANGED')
      if(this.now()>=this.nextDiscovery){await this.hooks.log('started');await this.hooks.discover(signal);signal.throwIfAborted();this.nextDiscovery=this.now()+policy.discoveryIntervalMinutes*60_000;await this.hooks.log('completed')}
      await this.hooks.monitor(signal);signal.throwIfAborted()
      if(policy.send&&this.now()>=this.nextSend){
        if(!this.hooks.valid())throw Error('ACQUISITION_CONTEXT_CHANGED')
        const result=await this.hooks.send(policy,signal)
        if(result==='unknown')throw Error('SEND_RESULT_UNKNOWN')
        signal.throwIfAborted()
        this.nextSend=this.now()+policy.intervalSeconds*1000
      }
    }catch(error){
      if(this.controller===controller&&!controller.signal.aborted&&!this.signal.aborted){
        const message=error instanceof Error?error.message:''
        if(this.now()>=this.expiresAt&&message!=='SEND_RESULT_UNKNOWN'){this.stop();this.phase='completed';return}
        this.errorCode=scanErrorCodes.includes(message as ScanErrorCode)?message as ScanErrorCode:'ACQUISITION_FAILED'
        this.phase='blocked';this.controller=undefined;await this.hooks.log('failed',this.errorCode)
      }
    }finally{this.busy=false}
  }
}
