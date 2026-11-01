import postgres from 'npm:postgres@3.4.7';
import { apiResponse } from '../_shared/marketplace.mjs';
const databaseUrl=Deno.env.get('DATABASE_URL');
if(!databaseUrl)throw new Error('DATABASE_URL is required: use the Supabase transaction pooler connection string.');
const sql=postgres(databaseUrl,{prepare:false,max:3,idle_timeout:20,connect_timeout:15,ssl:'require'});
const placeholders=(s:string)=>{let n=0;return s.replace(/\?/g,()=>'$'+(++n))};
function adapter(connection:any){return {prepare(statement:string){return {bind(...args:unknown[]){return {_sql:statement,_args:args,async first(){return (await connection.unsafe(placeholders(statement),args))[0]||null},async all(){return {results:Array.from(await connection.unsafe(placeholders(statement),args))}},async run(){const result=await connection.unsafe(placeholders(statement),args);return {meta:{changes:result.count}}}}}}},async batch(stmts:any[]){return connection.begin(async(tx:any)=>{const results=[];for(const stmt of stmts){const result=await tx.unsafe(placeholders(stmt._sql),stmt._args);results.push({meta:{changes:result.count}})}return results})}}}
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('origin')||'';
 const allowed=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(x=>x.trim()).filter(Boolean);
 const headers={'Access-Control-Allow-Origin':allowed.includes(origin)?origin:'null','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 if(!origin||!allowed.includes(origin))return new Response('Origin not allowed',{status:403,headers});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 try{
  let user=null;
  const auth=request.headers.get('authorization');
  if(auth){const result=await fetch(Deno.env.get('SUPABASE_URL')+'/auth/v1/user',{headers:{Authorization:auth,apikey:Deno.env.get('SUPABASE_ANON_KEY')||''}});if(result.ok){let u=await result.json();if(u.id&&u.email&&u.email_confirmed_at)user={userId:u.id,email:u.email,displayName:u.user_metadata?.full_name||u.email}}}
  let pathname=new URL(request.url).pathname,path=pathname.split('/marketplace/')[1]||'';
  if(!/^[a-z-]+$/.test(path))return Response.json({error:'Not found.'},{status:404,headers});
  // Normalize the internal API request to the validated frontend origin for the shared CSRF guard.
  let normalized=new Request(origin+'/api/'+path,{method:request.method,headers:{origin,'Content-Type':'application/json'},...(request.method==='POST'?{body:await request.text()}:{} )});
  const response=await apiResponse({request:normalized,path,db:adapter(sql),user,adminSetupHash:Deno.env.get('ADMIN_SETUP_HASH')});
  return new Response(response.body,{status:response.status,headers:{...Object.fromEntries(response.headers),...headers}});
 }catch(error){console.error('Marketplace edge failure',error);return Response.json({error:'Service temporarily unavailable. Please try again.'},{status:503,headers})}
});
