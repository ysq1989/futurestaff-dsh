import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {geoRequestAllowed,geoStaticFile} from '../lib/index.js';
test('GEO transport rejects cross-site, remote, missing marker and unsafe static paths',()=>{
 const request={socket:{remoteAddress:'127.0.0.1'},headers:{host:'127.0.0.1:12345',origin:'http://127.0.0.1:12345','x-futurestaff-geo':'1'}};
 assert.equal(geoRequestAllowed(request,true),true);
 assert.equal(geoRequestAllowed({...request,headers:{...request.headers,origin:'https://evil.test'}},true),false);
 assert.equal(geoRequestAllowed({...request,socket:{remoteAddress:'10.0.0.1'}},true),false);
 assert.equal(geoRequestAllowed({...request,headers:{host:request.headers.host}},true),false);
 for(const url of ['/_futurestaff/geo/%2e%2e/package.json','/_futurestaff/geo/assets/%2fsecret.js','/_futurestaff/geo/assets/a.js%00','/_futurestaff/geo/api/auth'])assert.throws(()=>geoStaticFile(url,path.resolve('fixture-assets')));
});
