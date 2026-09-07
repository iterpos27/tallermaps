require('dotenv').config();
const { backup }=require('../src/services/backup');
const { pool }=require('../src/db');
backup().then(dir=>console.log(`Respaldo de base y fotografías: ${dir}`)).catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>pool.end());
