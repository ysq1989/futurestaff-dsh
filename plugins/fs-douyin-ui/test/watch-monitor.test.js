import test from 'node:test'
import assert from 'node:assert/strict'
import { WatchMonitor } from '../lib/watch-monitor.js'

const owner = 'a'.repeat(64)
const watch = { kind: 'work', id: '123456789', url: 'https://www.douyin.com/video/123456789', name: '测试作品', enabled: true, intervalSeconds: 600, nextAt: 0 }
function fixture(collector) {
  let writes = 0, completed = 0, analyses = 0
  const logs = [], controller = new AbortController()
  const workspace = {
    snapshot: () => ({ modelId: 'fixture-model', watches: [watch] }), dueWatches: () => completed ? [] : [watch],
    recordScan: async () => { writes++ }, completeWatchScan: async () => { completed++ },
    pendingComments: () => [{ key: 'fixture-comment' }], analyzeOne: async () => { analyses++ },
  }
  return { monitor: new WatchMonitor(owner, workspace, controller.signal, collector, async phase => { logs.push(phase) }),
    controller, logs, results: () => ({ writes, completed, analyses }) }
}
test('uncalibrated collector refuses startup rather than falsely reporting running', () => {
  const f = fixture(undefined)
  assert.throws(() => f.monitor.start(), /COLLECTOR_NOT_READY/)
  assert.equal(f.monitor.status().phase, 'idle')
})
test('real collector results are source-bound, recorded, analyzed and scheduled', async () => {
  const f = fixture({ ready: () => true, scan: async (actor, item) => {
    assert.equal(actor, owner); assert.equal(item.url, watch.url)
    return { sourceUrl: watch.url, works: [{ url: watch.url, name: watch.name, comments: [] }] }
  } })
  f.monitor.start(); await f.monitor.tick()
  assert.deepEqual(f.results(), { writes: 1, completed: 1, analyses: 1 })
  assert.deepEqual(f.logs, ['started', 'completed'])
})
test('mismatched source stops the task and creates no evidence or scheduled completion', async () => {
  const f = fixture({ ready: () => true, scan: async () => ({ sourceUrl: 'https://evil.invalid', works: [] }) })
  f.monitor.start(); await f.monitor.tick()
  assert.equal(f.monitor.status().phase, 'blocked')
  assert.deepEqual(f.results(), { writes: 0, completed: 0, analyses: 0 })
  assert.deepEqual(f.logs, ['started', 'failed'])
})
test('pause revokes an outstanding scan before it can write', async () => {
  let finish
  const f = fixture({ ready: () => true, scan: () => new Promise(resolve => { finish = resolve }) })
  f.monitor.start(); const pending = f.monitor.tick(); await Promise.resolve(); await Promise.resolve()
  f.monitor.stop(); finish({ sourceUrl: watch.url, works: [{ url: watch.url, name: watch.name, comments: [] }] }); await pending
  assert.equal(f.monitor.status().phase, 'paused')
  assert.equal(f.results().writes, 0)
})

test('read failures expose only a fixed diagnostic code and a refreshed login never resumes collection', async () => {
  const f=fixture({ready:()=>true,scan:async()=>{throw Error('SCAN_DATA_UNAVAILABLE')}})
  f.monitor.start();await f.monitor.tick()
  assert.equal(f.monitor.status().errorCode,'SCAN_DATA_UNAVAILABLE')
  f.controller.abort();f.monitor.rebind(new AbortController().signal)
  assert.equal(f.monitor.status().phase,'paused')
  f.monitor.start();assert.equal(f.monitor.status().phase,'running')
})

test('a scheduler turn reads one oldest due source and bounds model work', async () => {
  const selected=[], analyzed=[]
  const first={...watch,nextAt:20},oldest={...watch,id:'234567890',url:'https://www.douyin.com/video/234567890',nextAt:10}
  const workspace={snapshot:()=>({modelId:'fixture',watches:[first,oldest]}),dueWatches:()=>[first,oldest],
    recordScan:async()=>{},completeWatchScan:async()=>{},pendingComments:()=>Array.from({length:50},(_,key)=>({key:String(key)})),
    analyzeOne:async key=>{analyzed.push(key)}}
  const monitor=new WatchMonitor(owner,workspace,new AbortController().signal,{ready:()=>true,scan:async(_owner,item)=>{
    selected.push(item.id);return {sourceUrl:item.url,works:[{url:item.url,name:'作品',comments:[]}]}
  }},async()=>{})
  monitor.start();await monitor.tick()
  assert.deepEqual(selected,[oldest.id]);assert.equal(analyzed.length,5)
})

test('pending comments keep being analyzed between scheduled browser scans',async()=>{
  const f=fixture({ready:()=>true,scan:async()=>({sourceUrl:watch.url,works:[{url:watch.url,name:'作品',comments:[]}]})})
  f.monitor.start();await f.monitor.tick();await f.monitor.tick()
  assert.equal(f.results().writes,1);assert.equal(f.results().analyses,2)
})
