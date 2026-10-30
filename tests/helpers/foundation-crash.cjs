// IPC-only crash fixture: no database, compiler, scripts or external side effects.
const {createFoundationWorker}=require('../../apps/worker/dist/foundation.js');
process.env.NODE_ENV='test';
const service=createFoundationWorker(process.env.REDIS_URL,{prefix:process.argv[2],testHooks:{lockDuration:500,stalledInterval:500,beforeProbe:async()=>{process.send('claimed');await new Promise(()=>{});}}});
service.ready().then(()=>process.send('ready'),()=>process.exit(1));
