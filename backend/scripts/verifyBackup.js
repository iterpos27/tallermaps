require('dotenv').config();
const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const {Pool}=require('pg');
const db=require('../src/db');
const {run,hash,pgEnvironment,backupDir}=require('../src/services/backup');
async function verify() {
  const latest=await fs.readFile(path.join(backupDir,'latest.json'),'utf8').then(JSON.parse);
  if(!/^backup-[a-zA-Z0-9_-]+$/.test(latest.directory)) throw new Error('Referencia de respaldo inválida.');
  const dir=path.join(backupDir,latest.directory);
  const manifest=await fs.readFile(path.join(dir,'manifest.json'),'utf8').then(JSON.parse);
  manifest.files=manifest.files.map(file=>({...file,path:file.path.replaceAll('\\','/')}));
  for(const file of manifest.files) {
    if(path.isAbsolute(file.path) || file.path.split('/').some(part=>part==='..' || part==='')) throw new Error('Ruta de archivo inválida en el respaldo.');
    const target=path.resolve(dir,file.path);
    if(!target.startsWith(dir+path.sep) || await hash(target)!==file.sha256) throw new Error(`Archivo inválido o alterado: ${file.path}`);
  }
  const name=`restore_qa_${randomUUID().replaceAll('-','')}`;
  const restoredFiles=path.join(backupDir,name);
  let created=false;
  try {
    await db.query(`CREATE DATABASE ${name}`);created=true;
    const env=pgEnvironment();
    env.PGDATABASE=name;
    // Connection settings travel through the environment, never process arguments.
    await run('pg_restore',['--exit-on-error','--no-owner','--no-privileges','--dbname',name,path.join(dir,'database.dump')],env);
    await fs.cp(path.join(dir,'uploads'),restoredFiles,{recursive:true,errorOnExist:true,force:false});
    for(const file of manifest.files.filter(f=>f.path.startsWith('uploads/'))) {
      if(await hash(path.join(restoredFiles,file.path.slice('uploads/'.length)))!==file.sha256) throw new Error('La fotografía restaurada no coincide con su respaldo.');
    }
    const config={host:env.PGHOST,port:Number(env.PGPORT||5432),user:env.PGUSER,password:env.PGPASSWORD,database:name,ssl:db.pool.options.ssl};
    const restored=new Pool(config);
    try {
      for(const table of ['users','talleres','visitas','programaciones_visita','compromisos','activity_logs']) {
        const count=Number((await restored.query(`SELECT count(*) AS total FROM ${table}`)).rows[0].total);
        if(count!==manifest.counts[table]) throw new Error(`Conteo restaurado incorrecto: ${table}`);
      }
    }finally{await restored.end();}
    console.log(`Restauración verificada: 6 tablas y ${manifest.files.length} archivos íntegros.`);
    await fs.writeFile(path.join(backupDir,'verified.json'),JSON.stringify({createdAt:new Date().toISOString(),backup:latest.directory}));
  }finally{
    if(created && /^restore_qa_[a-f0-9]{32}$/.test(name)) await db.query(`DROP DATABASE ${name}`);
    if(restoredFiles.startsWith(backupDir+path.sep) && /^restore_qa_[a-f0-9]{32}$/.test(path.basename(restoredFiles))) await fs.rm(restoredFiles,{recursive:true,force:true});
  }
}
verify().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.pool.end());
