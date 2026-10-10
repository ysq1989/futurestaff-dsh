import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { GeoDesktopService, geoOwnerDirectory } from '../lib/service.js';

const tenant='00000000-0000-4000-8000-000000000001', user='00000000-0000-4000-8000-000000000003';
const actor=(permissions=['geo.admin'])=>({tenantId:tenant,userId:user,namespace:'https://platform.fsstory.net',displayName:'Fixture',tenantName:'Fixture tenant',permissions,signal:new AbortController().signal});
const disabledModels={models:async()=>[],generateText:async()=>{throw Error('NO_REAL_INFERENCE')}};
test('GEO local business persists, rejects read-only/forged scopes and closes without touching other workspaces',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'fs-geo-fixture-')); let current=actor();
 let service=new GeoDesktopService({root,authorize:async()=>current,inference:disabledModels});
 try {
  const dispatch=(method,url,body)=>service.dispatch({method,url,...(body?{body}: {})});
  const brand=await dispatch('POST','/api/geo/v1/brand',{version:0,brand:'Fixture brand',aliases:[],domains:[],competitors:[],business:'Fixture services',audience:'Fixture audience',facts:'',tone:'专业'});
  assert.equal(brand.statusCode,200,brand.body);
  const created=await dispatch('POST','/api/geo/v1/projects',{name:'Local campaign'}); assert.equal(created.statusCode,201,created.body);
  const id=JSON.parse(created.body).data.id;
  current=actor(['geo.read']); assert.equal((await dispatch('POST','/api/geo/v1/projects',{name:'Denied'})).statusCode,403);
  current=actor(); assert.equal((await dispatch('POST','/api/geo/v1/projects',{name:'Denied',tenantId:'forged'})).statusCode,422);
  await service.close(); service=new GeoDesktopService({root,authorize:async()=>current,inference:disabledModels});
  const projects=await service.dispatch({method:'GET',url:'/api/geo/v1/projects'}); assert.equal(JSON.parse(projects.body).data[0].id,id);
  current={...actor(),tenantId:'00000000-0000-4000-8000-000000000002'};
  assert.equal(JSON.parse((await service.dispatch({method:'GET',url:'/api/geo/v1/projects'})).body).data.length,0);
  assert.equal((await service.dispatch({method:'GET',url:`/api/geo/v1/projects/${id}`})).statusCode,404);
  current=actor([]); await assert.rejects(service.dispatch({method:'GET',url:'/api/geo/v1/projects'}),/GEO_PERMISSION_REQUIRED/);
 } finally {await service.close();await rm(root,{recursive:true,force:true})}
});
test('GEO owner paths include environment, member and tenant and reject client path claims',()=>{
 const root=path.resolve(tmpdir(),'fs-geo-paths');
 assert.notEqual(geoOwnerDirectory(root,actor()),geoOwnerDirectory(root,{...actor(),userId:'00000000-0000-4000-8000-000000000004'}));
 assert.notEqual(geoOwnerDirectory(root,actor()),geoOwnerDirectory(root,{...actor(),namespace:'https://dev.fsstory.net'}));
 assert.throws(()=>geoOwnerDirectory(root,{...actor(),tenantId:'../escape'}));
});

test('DSH identity revocation retires the local database and denies retained requests',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'fs-geo-revoke-'));const controller=new AbortController();
 const current={...actor(),signal:controller.signal};
 const service=new GeoDesktopService({root,authorize:async()=>current,inference:disabledModels});
 try{
  await service.dispatch({method:'GET',url:'/api/geo/v1/projects'});assert.equal(service.activeDatabases,1);
  controller.abort();assert.equal(service.activeDatabases,0);
  await assert.rejects(service.dispatch({method:'GET',url:'/api/geo/v1/projects'}));
 }finally{await service.close();await rm(root,{recursive:true,force:true})}
});

test('local content review, frozen manual plans, exports and model idempotency retain GEO business truth',async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'fs-geo-workflow-'));let current=actor();let calls=0,unknown=false;
 const model='00000000-0000-4000-8000-000000000011';
 const inference={models:async()=>[{modelId:model,displayName:'Fixture authorized model'}],generateText:async input=>{
  calls++;if(unknown)throw Error('FIXTURE_TIMEOUT');
  const text=input.system.includes('JSON')?JSON.stringify({title:'Fixture draft',body:'Fixture facts only',summary:'Summary',sources:[]}):'Fixture brand is mentioned without verified citations.';
  return {text,modelId:input.modelId,tenantId:tenant,userId:user};
 }};
 const service=new GeoDesktopService({root,authorize:async()=>current,inference});
 const get=url=>service.dispatch({method:'GET',url});
 const post=(url,body,key)=>service.dispatch({method:'POST',url,body,...(key?{headers:{'idempotency-key':key}}:{})});
 const data=response=>JSON.parse(response.body).data;
 try{
  assert.equal((await post('/api/geo/v1/brand',{version:0,brand:'Fixture brand',business:'Business',facts:'Facts'})).statusCode,200);
  const project=data(await post('/api/geo/v1/projects',{name:'Fixture campaign'}));const base=`/api/geo/v1/projects/${project.id}`;
  const prompt=data(await post(base+'/prompts',{question:'Which brand provides this service?',branded:false}));
  const run=data(await post(base+'/runs',{promptId:prompt.id,model},'fixture-run-001'));assert.equal(run.state,'SUCCEEDED');
  await post(base+'/runs',{promptId:prompt.id,model},'fixture-run-001');assert.equal(calls,1);
  const evidence=data(await get(base+'/evidence'));assert.equal(evidence[0].citation_state,'UNKNOWN');assert.equal(evidence[0].search_state,'UNKNOWN');
  unknown=true;assert.equal(data(await post(base+'/runs',{promptId:prompt.id,model},'fixture-run-002')).state,'UNKNOWN');
  await post(base+'/runs',{promptId:prompt.id,model},'fixture-run-002');assert.equal(calls,2);unknown=false;
  assert.equal(data(await get('/api/geo/v1/ai-models'))[0].displayName,'Fixture authorized model');
  const topic=data(await post(base+'/topics',{title:'Fixture topic',promptId:prompt.id}));
  const article=data(await post(base+'/articles',{title:'Manual article',body:'Reviewed fixture body',topicId:topic.id,sources:[]}));
  const review=base+`/articles/${article.id}/review`;
  assert.equal(data(await post(review,{version:1,action:'SUBMIT'})).state,'IN_REVIEW');
  current=actor(['geo.operator']);assert.equal((await post(review,{version:1,action:'APPROVE'})).statusCode,403);current=actor();
  assert.equal(data(await post(review,{version:1,action:'APPROVE'})).state,'APPROVED');
  const account=data(await post(base+'/accounts',{platform:'toutiao',label:'Manual fixture account'}));
  const plan=data(await post(base+'/publication-plans',{articleId:article.id,version:1,accountId:account.id,scheduledAt:new Date(Date.now()+3600000).toISOString(),mode:'MANUAL'}));
  assert.equal((await post(base+'/publication-plans',{articleId:article.id,version:1,accountId:account.id,scheduledAt:new Date(Date.now()+3600000).toISOString(),mode:'AUTOMATIC'})).statusCode,409);
  const edited=data(await post(base+`/articles/${article.id}`,{version:1,title:'Changed draft',body:'New version',topicId:topic.id,sources:[]}));assert.equal(edited.version,2);assert.equal(edited.state,'DRAFT');
  assert.equal(data(await get(base+'/content')).plans[0].version,1);
  assert.equal((await post(base+'/publication-records',{planId:plan.id,url:'https://example.test/article',publishedAt:new Date().toISOString()})).statusCode,201);
  assert.match((await get(base+'/content/export')).headers['content-type'],/text\/csv/);
  const drafted=await post(base+'/ai-drafts',{title:'Fixture draft',model,brandVersion:1,sources:[]},'fixture-draft-001');
  assert.equal(drafted.statusCode,201,drafted.body);assert.equal(data(drafted).state,'SUCCEEDED',drafted.body);
  const before=calls;await post(base+'/ai-drafts',{title:'Fixture draft',model,brandVersion:1,sources:[]},'fixture-draft-001');assert.equal(calls,before);
  assert.equal(data(await get(base+'/content')).articles.find(a=>a.id===article.id).body,'New version');
 }finally{await service.close();await rm(root,{recursive:true,force:true})}
});
