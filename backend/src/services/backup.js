const fs = require('node:fs/promises');
const {createReadStream}=require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createHash,randomUUID } = require('node:crypto');
const db = require('../db');
const { uploadDir } = require('./storage');
const backupDir = path.resolve(process.env.BACKUP_DIR || path.join(path.dirname(uploadDir),'backups'));
let running=null;
let status={running:false,lastSuccess:null,lastError:null};
async function executable(name) {
  if(process.env[`${name.toUpperCase()}_PATH`]) return process.env[`${name.toUpperCase()}_PATH`];
  if(process.platform==='win32') {
    const root='C:/Program Files/PostgreSQL';
    const versions=await fs.readdir(root).catch(()=>[]);
    for(const version of versions.sort((a,b)=>Number(b)-Number(a))) {
      const candidate=path.join(root,version,'bin',`${name}.exe`);
      if(await fs.stat(candidate).catch(()=>null)) return candidate;
    }
  }
  return name;
}
const pgEnvironment = () => {
  const env={...process.env,PGHOST:process.env.PGHOST || 'localhost',PGUSER:process.env.PGUSER || 'postgres',PGDATABASE:process.env.PGDATABASE || 'tallervisitas_db',PGPASSWORD:process.env.PGPASSWORD || 'admin',PGCONNECT_TIMEOUT:'10'};
  if(process.env.DATABASE_URL) {
    const url=new URL(process.env.DATABASE_URL);
    Object.assign(env,{PGHOST:url.hostname,PGPORT:url.port || '5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1))});
    if(url.searchParams.has('sslmode')) env.PGSSLMODE=url.searchParams.get('sslmode');
    else if(process.env.DB_SSL==='true' || process.env.NODE_ENV==='production') env.PGSSLMODE='require';
  }
  return env;
};
async function run(command,args,env=pgEnvironment()) {
  const binary=await executable(command);
  return new Promise((resolve,reject)=>{
    const child=spawn(binary,['--no-password',...args],{env,shell:false,windowsHide:true,stdio:['ignore','ignore','pipe']});
    const timeout=setTimeout(()=>{child.kill();reject(new Error(`${command} excedió el tiempo máximo de ejecución.`));},120000);
    child.on('close',()=>clearTimeout(timeout));
    child.stderr.resume();
    child.on('error',()=>reject(new Error(`No se pudo ejecutar ${command}. Revise su instalación.`)));
    child.on('exit',code=>code===0?resolve():reject(new Error(`${command} terminó con código ${code}. Revise conexión y permisos.`)));
  });
}
async function hash(file) { const digest=createHash('sha256');for await(const chunk of createReadStream(file))digest.update(chunk);return digest.digest('hex'); }
async function inventory(dir,prefix='') {
  const result=[];
  for(const entry of await fs.readdir(dir,{withFileTypes:true})) {
    const relative=path.join(prefix,entry.name);
    if(entry.isDirectory()) result.push(...await inventory(path.join(dir,entry.name),relative));
    else if(entry.isFile()) result.push({path:relative.split(path.sep).join('/'),sha256:await hash(path.join(dir,entry.name))});
  }
  return result;
}
async function createBackup() {
  await fs.mkdir(backupDir,{recursive:true});
  const dir=path.join(backupDir,`backup-${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID().slice(0,8)}`);
  await fs.mkdir(dir);
  const client=await db.pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await client.query("SET LOCAL lock_timeout='15s'");
    await client.query('LOCK TABLE talleres, visitas IN SHARE MODE');
    const snapshot=(await client.query('SELECT pg_export_snapshot() AS snapshot')).rows[0].snapshot;
    const counts={};
    for(const table of ['users','talleres','visitas','programaciones_visita','compromisos','activity_logs']) counts[table]=Number((await client.query(`SELECT count(*) AS total FROM ${table}`)).rows[0].total);
    await fs.cp(uploadDir,path.join(dir,'uploads'),{recursive:true,errorOnExist:true,force:false});
    const photos=(await client.query("SELECT foto_url FROM visitas WHERE foto_url LIKE '/uploads/%'")).rows;
    for(const photo of photos) {
      if(!await fs.stat(path.join(dir,'uploads',path.basename(photo.foto_url))).catch(()=>null)) throw new Error('Falta una fotografía referenciada por la base. Revise el almacenamiento antes de respaldar.');
    }
    await run('pg_dump',['--format=custom','--no-owner','--no-privileges',`--snapshot=${snapshot}`,'--file',path.join(dir,'database.dump')]);
    await client.query('COMMIT');
    const manifest={version:1,createdAt:new Date().toISOString(),counts,files:await inventory(dir)};
    await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));
    await fs.writeFile(path.join(backupDir,'latest.json'),JSON.stringify({directory:path.basename(dir),createdAt:manifest.createdAt}));
    status={running:false,lastSuccess:manifest.createdAt,lastError:null};
    return dir;
  }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
}
function backup() {
  if(!running) {
    status.running=true;
    running=createBackup().catch(error=>{status={...status,running:false,lastError:error.message};throw error;}).finally(()=>{running=null;status.running=false;});
  }
  return running;
}
async function getStatus() {
  const latest=await fs.readFile(path.join(backupDir,'latest.json'),'utf8').then(JSON.parse).catch(()=>null);
  const verified=await fs.readFile(path.join(backupDir,'verified.json'),'utf8').then(JSON.parse).catch(()=>null);
  return {...status,lastSuccess:status.lastSuccess || latest?.createdAt || null,lastVerification:verified?.createdAt || null,enabled:process.env.BACKUP_ENABLED!=='false',intervalHours:Number(process.env.BACKUP_INTERVAL_HOURS)||24};
}
function startBackups() {
  if(process.env.BACKUP_ENABLED==='false') return;
  async function tick() {
    const state=await getStatus();
    if(!state.running && (!state.lastSuccess || Date.now()-Date.parse(state.lastSuccess)>=Math.max(1,state.intervalHours)*3600000)) await backup().catch(e=>console.error('Respaldo automático:',e.message));
  }
  setTimeout(tick,30000).unref();
  setInterval(tick,3600000).unref();
}
module.exports={backup,getStatus,startBackups,run,hash,inventory,pgEnvironment,backupDir};
