import {createClient} from '@supabase/supabase-js';
const url=import.meta.env.VITE_SUPABASE_URL;
const key=import.meta.env.VITE_SUPABASE_ANON_KEY;
if(!url||!key){document.getElementById('app').innerHTML='<div class="empty"><b>Connect the database to get started.</b>Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY, apply the migration and deploy the marketplace function.</div>';throw new Error('Missing public Supabase configuration')}
const supabase=createClient(url,key);
window.PortyBolt={supabase,async api(path,body){const {data:{session}}=await supabase.auth.getSession();const headers={'apikey':key,'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{})};const r=await fetch(url+'/functions/v1/marketplace/'+path,{headers,...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)})});let data;try{data=await r.json()}catch{throw Error('The service could not be reached. Please try again.')}if(!r.ok)throw Error(data.error||'Request failed.');return data}};
let recovery=false;
supabase.auth.onAuthStateChange((event)=>{if(event==='PASSWORD_RECOVERY'){recovery=true;history.replaceState(null,'','#reset-password');window.setRecoveryPage?.();window.renderBoltReset?.()}else if(event==='SIGNED_OUT'){location.href='/'} });
async function loadScript(src){await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=src;script.onload=resolve;script.onerror=reject;document.body.append(script)})}
await loadScript('/auth-ui.js');
await loadScript('/app.js');
if(recovery){window.setRecoveryPage?.();window.renderBoltReset?.()}
