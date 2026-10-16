// Operational catch-up using the normal authenticated route, not a test or
// replacement simulator. Local Next runtime, existing production credentials.
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {config} from 'dotenv';
import {mkdirSync,createWriteStream} from 'node:fs';
import path from 'node:path';
if(process.argv[2]!=='--apply-normal-settlement')throw new Error('Explicit catch-up mode required');
config({path:'../cycling-manager/.env.local',quiet:true});
if(!process.env.SUPABASE_SECRET_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('ikagfuchasnsakpouosg'))throw new Error('Expected production configuration unavailable');
const secret=randomBytes(32).toString('hex');
const port=3328;
mkdirSync('artifacts/.tmp-cn-recovery',{recursive:true});
const log=createWriteStream('artifacts/.tmp-cn-recovery/local-next.log',{flags:'a'});
const server=spawn(process.execPath,[path.resolve('node_modules/next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port',String(port)],{
  env:{...process.env,CRON_SECRET:secret,NEXT_TELEMETRY_DISABLED:'1'},windowsHide:true,stdio:['ignore','pipe','pipe'],
});
server.stdout.pipe(log);server.stderr.pipe(log);
let closed=false;server.on('exit',()=>{closed=true;});
const endpoint=`http://127.0.0.1:${port}/api/cron/national-championship-settlements/time-trial-recovery`;
try {
  // Readiness does not call any gameplay route.
  for(let attempt=0;attempt<60;attempt++) {
    if(closed)throw new Error('Local recovery runtime exited; inspect local-next.log');
    try{const response=await fetch(`http://127.0.0.1:${port}/robots.txt`,{signal:AbortSignal.timeout(3000)});if(response.ok)break;}catch{}
    if(attempt===59)throw new Error('Recovery runtime did not start');
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  for(let batch=1;batch<=30;batch++) {
    const response=await fetch(endpoint,{headers:{authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(290000)});
    const raw=await response.text();let result;try{result=JSON.parse(raw);}catch{throw new Error(`Recovery HTTP ${response.status}; inspect local-next.log`);}
    console.log(JSON.stringify({batch,httpStatus:response.status,...result}));
    if(!response.ok || result.failedEditions>0)throw new Error('Settlement reported a failure; stop and inspect before retrying');
    if(result.deferredEditions===0 || result.skipped)break;
    if(!result.targetedEditions)throw new Error('No claim acquired; do not hammer an ongoing worker');
    if(batch===30)throw new Error('Batch bound reached');
  }
}finally{server.kill();log.end();}
