import type { Context } from '@deepseek-ai/cordis';
import type {} from '@futurestaff/fs-platform-access';
type PlatformDevLoginService = Context['platformDevLogin'];
import type { GeoActor } from './service.js';

/** Consume the permission projection of the exact GEO application request; never expose its token. */
export async function authorizeGeo(login:PlatformDevLoginService):Promise<GeoActor>{
  const owner=await login.authorizeLocal();
  const snapshot=await login.snapshot();
  if(snapshot.phase!=='ready'||snapshot.activeTenantId!==owner.tenantId||snapshot.user?.userId!==owner.userId
    ||!snapshot.applications.some(app=>app.appId==='geo'&&app.tenantId===owner.tenantId))throw Error('GEO_PERMISSION_REQUIRED');
  let grant;
  try { grant=await login.issueApplicationToken('geo'); }
  catch(error) {
    const code=(error as {code?:string}).code;
    if(['AUTHENTICATION_REQUIRED','APPLICATION_ACCESS_DENIED','TENANT_ACCESS_DENIED','TOKEN_EXPIRED'].includes(code??''))throw Error('GEO_PERMISSION_REQUIRED');
    throw Error('GEO_AUTH_UNAVAILABLE');
  }
  owner.signal.throwIfAborted();
  if(grant.tenantId!==owner.tenantId||!grant.permissions.some(p=>['geo.read','geo.operator','geo.admin'].includes(p))
    ||grant.permissions.some(p=>!p.startsWith('geo.')))throw Error('GEO_PERMISSION_REQUIRED');
  const after=await login.authorizeLocal();
  if(after.tenantId!==owner.tenantId||after.userId!==owner.userId||after.namespace!==owner.namespace)throw Error('GEO_IDENTITY_CHANGED');
  return {tenantId:owner.tenantId,userId:owner.userId,namespace:owner.namespace??'',displayName:snapshot.user.displayName,tenantName:snapshot.tenants.find(t=>t.tenantId===owner.tenantId)?.displayName??owner.tenantId,permissions:[...grant.permissions],signal:owner.signal};
}
