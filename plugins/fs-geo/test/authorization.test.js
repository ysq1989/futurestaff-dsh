import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeGeo} from '../lib/authorization.js';
const tenant='00000000-0000-4000-8000-000000000001',user='00000000-0000-4000-8000-000000000003';
function login(){return {authorizeLocal:async()=>({tenantId:tenant,userId:user,namespace:'https://platform.fsstory.net',signal:new AbortController().signal}),snapshot:async()=>({phase:'ready',activeTenantId:tenant,user:{userId:user,displayName:'Fixture'},tenants:[],applications:[{appId:'geo',tenantId:tenant}]}),issueApplicationToken:async app=>{assert.equal(app,'geo');return {tenantId:tenant,permissions:['geo.operator'],accessToken:'MUST_NOT_LEAVE_HOST'}}}}
test('GEO consumes only server-validated GEO permissions and exposes no application credential',async()=>{
 const actor=await authorizeGeo(login());assert.deepEqual(actor.permissions,['geo.operator']);assert.equal(actor.userId,user);assert.equal('accessToken' in actor,false);
 for(const permissions of [[],['product_hub.read'],['geo.read','other.admin']])await assert.rejects(authorizeGeo({...login(),issueApplicationToken:async()=>({tenantId:tenant,permissions})}),/GEO_PERMISSION_REQUIRED/);
 await assert.rejects(authorizeGeo({...login(),snapshot:async()=>({phase:'ready',activeTenantId:tenant,user:{userId:user},applications:[]})}),/GEO_PERMISSION_REQUIRED/);
});
test('identity change during application authorization rejects the local operation',async()=>{
 let calls=0;const base=login();await assert.rejects(authorizeGeo({...base,authorizeLocal:async()=>({...await base.authorizeLocal(),userId:++calls===1?user:'00000000-0000-4000-8000-000000000004'})}),/GEO_IDENTITY_CHANGED/);
});
