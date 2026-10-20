import assert from 'node:assert/strict';
import path from 'node:path';
export const LOCAL_OWNER_EMAIL='hac54.owner.local@cargomesh.test';
export const LOCAL_OWNER_ORGANIZATION='c2300000-0000-4000-8000-000000000001';
export function assertOwnerProvisioningTarget({api,app,file,repository,authorized}){
 assert.equal(authorized,'1','Explicit local OWNER provisioning authorization required.');
 const apiUrl=new URL(api),appUrl=new URL(app);
 assert.equal(apiUrl.href,'http://127.0.0.1:61321/');
 assert.ok(['localhost','127.0.0.1'].includes(appUrl.hostname)&&appUrl.port==='3000'&&appUrl.protocol==='http:'&&!appUrl.username&&!appUrl.password&&appUrl.pathname==='/'&&!appUrl.search&&!appUrl.hash,'Only the local port-3000 app is allowed.');
 assert.ok(path.isAbsolute(file)&&path.extname(file)==='.txt','An explicit private absolute .txt credential path is required.');
 const relative=path.relative(path.resolve(repository),path.resolve(file));
 assert.ok(relative.startsWith('..'+path.sep)||path.isAbsolute(relative),'Credentials must remain outside the repository.');
 return {api:apiUrl,app:appUrl,file:path.resolve(file)};
}
