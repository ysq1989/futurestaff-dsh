import test from 'node:test'
import assert from 'node:assert/strict'
import { Acquisition } from '../lib/acquisition.js'
const policy={message:'已批准测试文案',send:true,maxMessagesPerDay:10,intervalSeconds:60,durationMinutes:60,discoveryIntervalMinutes:30}
function fixture(){let time=1000,valid=true,result='sent';const events=[]
  const controller=new AbortController()
  const hooks={valid:()=>valid,discover:async()=>events.push('discover'),monitor:async()=>events.push('monitor'),send:async()=>{events.push('send');return result},log:async(phase,code)=>events.push(code||phase)}
  const task=new Acquisition(controller.signal,hooks,()=>time)
  return {task,hooks,events,controller,advance:ms=>{time+=ms},invalidate:()=>{valid=false},unknown:()=>{result='unknown'}}
}
test('business discovery precedes monitoring and send; intervals avoid resending each tick',async()=>{
  const f=fixture();f.task.start(policy);await f.task.tick();await f.task.tick()
  assert.deepEqual(f.events.filter(e=>['discover','monitor','send'].includes(e)),['discover','monitor','send','monitor'])
  f.advance(60_000);await f.task.tick();assert.equal(f.events.filter(e=>e==='send').length,2)
  f.advance(30*60_000);await f.task.tick();assert.equal(f.events.filter(e=>e==='discover').length,2)
})
test('read-only approval never sends and expiry does not resume on a refreshed login',async()=>{
  const f=fixture();f.task.start({...policy,send:false});await f.task.tick();assert.ok(!f.events.includes('send'))
  f.advance(61*60_000);await f.task.tick();assert.equal(f.task.status().phase,'completed')
  f.task.rebind(new AbortController().signal);await f.task.tick();assert.equal(f.task.status().phase,'paused')
})
test('changed scope and unknown send outcomes stop the chain without retry',async()=>{
  const f=fixture();f.task.start(policy);f.unknown();await f.task.tick();await f.task.tick()
  assert.equal(f.task.status().errorCode,'SEND_RESULT_UNKNOWN');assert.equal(f.events.filter(e=>e==='send').length,1)
  const g=fixture();g.task.start(policy);g.invalidate();await g.task.tick();assert.equal(g.task.status().phase,'blocked');assert.ok(!g.events.includes('send'))
})
test('pause cancels an outstanding discovery before monitoring or private sends',async()=>{
  const f=fixture();let release
  f.hooks.discover=signal=>new Promise(resolve=>{release=()=>{assert.equal(signal.aborted,true);resolve()}})
  f.task.start(policy);const pending=f.task.tick();await Promise.resolve();await Promise.resolve();f.task.stop();release();await pending
  assert.equal(f.task.status().phase,'paused');assert.ok(!f.events.includes('monitor'));assert.ok(!f.events.includes('send'))
})
