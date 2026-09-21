const test = require('node:test');
const assert = require('node:assert/strict');
const { can, validatePermissions, requirePermission } = require('../src/services/permissions');
test('permisos seguros por rol y por usuario', () => {
  assert.equal(can({role:'VENDEDOR'},'map'),false);
  assert.equal(can({role:'VENDEDOR',permissions:{map:true}},'map'),true);
  assert.equal(can({role:'VENDEDOR',permissions:{register:false}},'register'),false);
  assert.equal(can({role:'MENSAJERO',permissions:{schedule:true}},'schedule'),false);
  assert.equal(can({role:'ADMIN'},'map'),true);
  for (const input of [{map:'false'},{delete:true},[],null]) assert.throws(()=>validatePermissions('VENDEDOR',input));
  assert.throws(()=>validatePermissions('MENSAJERO',{map:true}));
});
test('middleware impide accesos sin permiso', () => {
  let status, passed=false;
  requirePermission('map')({user:{role:'VENDEDOR'}},{status(code){status=code;return this;},json(){}},()=>{passed=true;});
  assert.equal(status,403);assert.equal(passed,false);
});
