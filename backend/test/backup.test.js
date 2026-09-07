const test=require('node:test');
const assert=require('node:assert/strict');
test('herramientas de respaldo reciben destino explícito sin URI en argumentos',()=>{
  const previous=process.env.DATABASE_URL;
  process.env.DATABASE_URL='postgresql://qa_user:qa%40password@127.0.0.1:55432/qa_backup?sslmode=disable';
  try {
    const env=require('../src/services/backup').pgEnvironment();
    assert.equal(env.PGHOST,'127.0.0.1');assert.equal(env.PGPORT,'55432');assert.equal(env.PGDATABASE,'qa_backup');
    assert.equal(env.PGUSER,'qa_user');assert.equal(env.PGPASSWORD,'qa@password');assert.equal(env.PGSSLMODE,'disable');assert.equal(env.PGCONNECT_TIMEOUT,'10');
  }finally{if(previous===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=previous;}
});
