import { scanErrorCodes,type ScanErrorCode } from './watch-monitor.js'
type Stage='KEYWORDS'|'SEARCH'|'SELECTION'
/** Fixed diagnostics only: never persist model text, paths or provider messages. */
export async function diagnosed<T>(stage:Stage,signal:AbortSignal,run:()=>Promise<T>):Promise<T>{
  try{return await run()}catch(error){
    if(signal.aborted)throw Error('ACQUISITION_TIMEOUT')
    const value=error as {message?:unknown;code?:unknown;name?:unknown}
    const provider:Record<string,ScanErrorCode>={FUTURESTAFF_AUTH:'MODEL_LOGIN_REQUIRED',FUTURESTAFF_TENANT:'MODEL_LOGIN_REQUIRED',FUTURESTAFF_MODEL_ACCESS:'MODEL_NOT_AUTHORIZED',FUTURESTAFF_PROVIDER:'MODEL_PROVIDER_UNAVAILABLE',FUTURESTAFF_CHAT:'MODEL_SERVICE_UNAVAILABLE',FUTURESTAFF_CHAT_LIMIT:'MODEL_RATE_LIMIT',FUTURESTAFF_STORAGE:'MODEL_STORAGE_UNAVAILABLE',FUTURESTAFF_SESSION:'MODEL_SESSION_INVALID'}
    if(typeof value?.code==='string'&&provider[value.code])throw Error(provider[value.code])
    if(typeof value?.message==='string'&&scanErrorCodes.includes(value.message as ScanErrorCode))throw Error(value.message)
    if(value?.name==='ZodError')throw Error(stage==='SEARCH'?'SCAN_SCHEMA_CHANGED':`${stage}_RESPONSE_INVALID`)
    throw Error(`${stage}_FAILED`)
  }
}
