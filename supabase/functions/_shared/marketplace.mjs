// All money is stored in JMD minor units (cents). No browser-supplied totals are trusted.
export const AREAS=['Port Antonio','Boundbrook','Anchovy','Drapers','San San'];
export const CATEGORIES=['Restaurants','Groceries','Bakery','Health & beauty','Shopping'];
export class ApiError extends Error { constructor(message,status=400){super(message);this.status=status} }
const fail=(m,s=400)=>{throw new ApiError(m,s)};
const id=()=>crypto.randomUUID();
const now=()=>new Date().toISOString();
const str=(v,label,min=1,max=200)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail(`Enter a valid ${label}.`);return v.trim()};
const phone=v=>{let p=str(v,'phone number',7,20);if(!/^[+\d ()-]+$/.test(p))fail('Enter a valid phone number.');return p};
const num=(v,min,max)=>{if(!Number.isSafeInteger(v)||v<min||v>max)fail('Invalid numeric value.');return v};
const area=v=>AREAS.includes(v)?v:fail('Choose a supported Portland delivery community.');
const image=v=>{if(!v)return '';try{let u=new URL(v);if(u.protocol!=='https:')fail('Image must use HTTPS.');return u.href.slice(0,1000)}catch{fail('Enter a valid HTTPS image URL.')}};
export async function handleApi({request,path,db,user,adminSetupHash}){
 const q=(s,...b)=>db.prepare(s).bind(...b);const all=async(s,...b)=>(await q(s,...b).all()).results;const one=(s,...b)=>q(s,...b).first();
 const method=request.method;let data={};if(method==='POST'){const length=Number(request.headers.get('content-length')||0);if(length>24000)fail('Request too large.',413);let raw=await request.text();if(raw.length>24000)fail('Request too large.',413);try{data=JSON.parse(raw)}catch{fail('Invalid request.')}if(!data||typeof data!=='object'||Array.isArray(data))fail('Invalid request.');}
 const uid=user?.userId;
 let profile=uid?await one('SELECT * FROM profiles WHERE id=?',uid):null;
 const auth=()=>{if(!uid)fail('Sign in to continue.',401)};
 const registered=()=>{auth();if(!profile)fail('Complete your account first.',403)};
 const role=r=>{registered();if(profile.role!==r)fail('You do not have access to this action.',403)};
 const approved=r=>{role(r);if(!profile.approved)fail('Your partner application is awaiting approval.',403)};
 const audit=(oid,text)=>q('INSERT INTO events (id,order_id,actor,text,created) VALUES (?,?,?,?,?)',id(),oid,uid,text,now());
 const notice=(recipient,oid,text)=>q('INSERT INTO notifications (id,recipient,order_id,text,seen,created) VALUES (?,?,?,?,0,?)',id(),recipient,oid,text,now());
 const log=async(o,text)=>{let rec=[o.customer,o.merchant,o.courier].filter(Boolean);await db.batch([audit(o.id,text),...[...new Set(rec)].map(r=>notice(r,o.id,text))])};
 const settings=async()=>{let r=await one("SELECT value FROM settings WHERE key='pricing'");return r?JSON.parse(r.value):{fees:{'Port Antonio':25000,Boundbrook:30000,Anchovy:35000,Drapers:45000,'San San':50000},serviceBps:500,ordering:true}};
 const getOrder=async oid=>{let o=await one('SELECT * FROM orders WHERE id=?',oid);if(!o)fail('Order not found.',404);return o};
 const owns=o=>profile?.role==='admin'||o.customer===uid||o.merchant===uid||o.courier===uid;
 if(method==='GET'&&path==='catalog'){
  let list=await all('SELECT s.* FROM stores s JOIN profiles p ON p.id=s.owner WHERE p.approved=1');
  let products=await all('SELECT p.* FROM products p JOIN stores s ON s.id=p.store JOIN profiles a ON a.id=s.owner WHERE a.approved=1 AND p.available=1');
  return {stores:list.map(s=>({...s,menu:products.filter(p=>p.store===s.id)})),areas:AREAS,categories:CATEGORIES,pricing:await settings()};
 }
 if(method==='GET'&&path==='me')return {user:user?{name:user.displayName,email:user.email}:null,profile,notifications:uid?await all('SELECT * FROM notifications WHERE recipient=? ORDER BY created DESC LIMIT 50',uid):[]};
 if(method==='POST'&&path==='register'){
  auth();if(profile)fail('Your account is already registered.',409);
  if(!['customer','merchant','courier'].includes(data.role))fail('Choose a valid account type.');
  let name=str(data.name,'name',2,80),tel=phone(data.phone),created=now(),statements=[q('INSERT INTO profiles (id,email,name,phone,role,approved,created) VALUES (?,?,?,?,?,?,?)',uid,user.email,name,tel,data.role,data.role==='customer'?1:0,created)];
  if(data.role==='merchant'){let name=str(data.business,'business name',2,100);if(!CATEGORIES.includes(data.category))fail('Choose a business category.');statements.push(q('INSERT INTO stores (id,owner,name,category,description,address,area,image,open,prep,created) VALUES (?,?,?,?,?,?,?,?,0,25,?)',id(),uid,name,data.category,'',str(data.address,'pickup address',5,250),area(data.area),'',created))}
  if(data.role==='courier')statements.push(q('INSERT INTO companies (id,name,areas) VALUES (?,?,?)',uid,str(data.business,'company name',2,100),JSON.stringify([area(data.area)])));
  await db.batch(statements);return {ok:true};
 }
 if(method==='POST'&&path==='activate-admin'){
  registered();if(!adminSetupHash)fail('Owner activation is not configured.',503);
  let digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(data.code||''))))).map(b=>b.toString(16).padStart(2,'0')).join('');
  // The one-time marker and role update share one atomic D1 batch. Failed duplicate markers roll everything back.
  if(digest!==adminSetupHash)fail('Invalid owner activation code.',403);
  if(await one("SELECT key FROM settings WHERE key='owner_activated'"))fail('Owner access has already been activated.',409);
  await db.batch([q("INSERT INTO settings (key,value) VALUES ('owner_activated',?)",uid),q("UPDATE profiles SET role='admin',approved=1 WHERE id=?",uid)]);return {ok:true};
 }
 if(method==='GET'&&path==='support'){
  registered();return {tickets:profile.role==='admin'?await all('SELECT t.*,p.name,p.email FROM support_tickets t JOIN profiles p ON p.id=t.user_id ORDER BY t.created DESC LIMIT 100'):await all('SELECT * FROM support_tickets WHERE user_id=? ORDER BY created DESC LIMIT 30',uid)};
 }
 if(method==='POST'&&path==='support'){
  registered();if((await one('SELECT COUNT(*) AS n FROM support_tickets WHERE user_id=? AND created>?',uid,new Date(Date.now()-3600000).toISOString())).n>=5)fail('Please wait before opening another support request.',429);
  let ticket=id();await q('INSERT INTO support_tickets (id,user_id,subject,message,status,reply,created) VALUES (?,?,?,?,?,?,?)',ticket,uid,str(data.subject,'subject',5,120),str(data.message,'message',10,2000),'Open','',now()).run();return {ok:true};
 }
 if(method==='POST'&&path==='support-reply'){
  role('admin');let t=await one('SELECT * FROM support_tickets WHERE id=?',String(data.id));if(!t)fail('Support request not found.',404);await db.batch([q("UPDATE support_tickets SET reply=?,status='Resolved' WHERE id=?",str(data.reply,'reply',5,2000),t.id),notice(t.user_id,'','The administrator has replied to your support request. Open Help to read it.')]);return {ok:true};
 }
 if(method==='POST'&&path==='profile'){
  registered();await q('UPDATE profiles SET name=?,phone=? WHERE id=?',str(data.name,'name',2,80),phone(data.phone),uid).run();return {ok:true};
 }
 if(method==='POST'&&path==='read-notifications'){registered();await q('UPDATE notifications SET seen=1 WHERE recipient=?',uid).run();return {ok:true}}
 if(method==='GET'&&path==='workspace'){
  registered();let result={};
  if(profile.role==='merchant'){result.store=await one('SELECT * FROM stores WHERE owner=?',uid);result.products=result.store?await all('SELECT * FROM products WHERE store=?',result.store.id):[]}
  if(profile.role==='courier'){result.company=await one('SELECT * FROM companies WHERE id=?',uid);result.drivers=await all('SELECT * FROM drivers WHERE company=?',uid)}
  if(profile.role==='admin'){result.partners=await all("SELECT p.*,s.name AS business,s.id AS store_id,c.name AS company FROM profiles p LEFT JOIN stores s ON s.owner=p.id LEFT JOIN companies c ON c.id=p.id WHERE p.role IN ('merchant','courier') ORDER BY p.created DESC");result.pricing=await settings()}
  return result;
 }
 if(method==='POST'&&path==='store'){
  role('merchant');if(!CATEGORIES.includes(data.category))fail('Invalid category.');
  await q('UPDATE stores SET name=?,category=?,description=?,address=?,area=?,image=?,open=?,prep=? WHERE owner=?',str(data.name,'business name',2,100),data.category,str(data.description,'description',0,400),str(data.address,'pickup address',5,250),area(data.area),image(data.image),data.open?1:0,num(data.prep,5,180),uid).run();return {ok:true};
 }
 if(method==='POST'&&path==='product'){
  role('merchant');let s=await one('SELECT id FROM stores WHERE owner=?',uid);if(!s)fail('Business not found.',404);
  if(data.id){let exists=await one('SELECT id FROM products WHERE id=? AND store=?',data.id,s.id);if(!exists)fail('Product not found.',404);await q('UPDATE products SET name=?,description=?,price=?,available=? WHERE id=? AND store=?',str(data.name,'item name',2,100),str(data.description,'description',0,250),num(data.price,100,10000000),data.available?1:0,data.id,s.id).run()}
  else {if((await one('SELECT COUNT(*) AS n FROM products WHERE store=?',s.id)).n>=200)fail('Maximum 200 items per business.');await q('INSERT INTO products (id,store,name,description,price,available) VALUES (?,?,?,?,?,?)',id(),s.id,str(data.name,'item name',2,100),str(data.description,'description',0,250),num(data.price,100,10000000),data.available?1:0).run()}
  return {ok:true};
 }
 if(method==='POST'&&path==='company'){
  role('courier');if(!Array.isArray(data.areas)||!data.areas.length||data.areas.some(a=>!AREAS.includes(a)))fail('Choose delivery communities.');
  await q('UPDATE companies SET name=?,areas=? WHERE id=?',str(data.name,'company name',2,100),JSON.stringify([...new Set(data.areas)]),uid).run();return {ok:true};
 }
 if(method==='POST'&&path==='driver'){
  role('courier');if(data.id){let exists=await one('SELECT id FROM drivers WHERE id=? AND company=?',data.id,uid);if(!exists)fail('Driver not found.',404);await q('UPDATE drivers SET name=?,phone=?,active=? WHERE id=? AND company=?',str(data.name,'driver name',2,80),phone(data.phone),data.active?1:0,data.id,uid).run()}
  else{if((await one('SELECT COUNT(*) AS n FROM drivers WHERE company=?',uid)).n>=100)fail('Maximum 100 drivers.');await q('INSERT INTO drivers (id,company,name,phone,active) VALUES (?,?,?,?,1)',id(),uid,str(data.name,'driver name',2,80),phone(data.phone)).run()}
  return {ok:true};
 }
 if(method==='POST'&&path==='approve'){
  role('admin');if(typeof data.approved!=='boolean')fail('Invalid approval.');let p=await one("SELECT * FROM profiles WHERE id=? AND role IN ('merchant','courier')",data.id);if(!p)fail('Partner not found.',404);
  await db.batch([q('UPDATE profiles SET approved=? WHERE id=?',data.approved?1:0,p.id),notice(p.id,'',data.approved?'Your partner account is approved.':'Your partner account has been suspended.')]);return {ok:true};
 }
 if(method==='POST'&&path==='pricing'){
  role('admin');let fees={};for(let a of AREAS)fees[a]=num(data.fees?.[a],0,200000);let value={fees,serviceBps:num(data.serviceBps,0,2500),ordering:!!data.ordering};await q("INSERT INTO settings (key,value) VALUES ('pricing',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",JSON.stringify(value)).run();return {ok:true};
 }
 if(method==='POST'&&path==='orders'){
  registered();let existing=await one('SELECT * FROM orders WHERE request_key=? AND customer=?',String(data.requestKey),uid);if(existing)return {id:existing.id};
  if(!Array.isArray(data.items)||!data.items.length||data.items.length>50)fail('Your basket is empty or too large.');
  const pricing=await settings();if(!pricing.ordering)fail('Ordering is temporarily paused.');
  let s=await one('SELECT s.*,p.approved FROM stores s JOIN profiles p ON p.id=s.owner WHERE s.id=?',String(data.store));if(!s||!s.approved||!s.open)fail('This business is not accepting orders.');
  let requestKey=str(data.requestKey,'order reference',16,100);if(!/^[\w-]+$/.test(requestKey))fail('Invalid order reference.');
  // Read product records on the server and snapshot the names/prices. Enforce one merchant per order.
  let items=[],seen=new Set(),subtotal=0;
  for(let line of data.items){if(seen.has(line.id))fail('Duplicate basket item.');seen.add(line.id);let p=await one('SELECT * FROM products WHERE id=? AND store=? AND available=1',String(line.id),s.id);if(!p)fail('An item is no longer available. Please refresh your basket.');let qty=num(line.qty,1,25);subtotal+=p.price*qty;items.push({id:p.id,name:p.name,price:p.price,qty})}
  if(subtotal>50000000)fail('Order exceeds the supported total.');
  let deliveryArea=area(data.area),delivery=pricing.fees[deliveryArea],service=Math.round(subtotal*pricing.serviceBps/10000);let total=subtotal+delivery+service;if(data.expectedTotal!==total)fail('Prices or fees changed. Review your basket and checkout again.',409);
  const o={id:'PO-'+id(),customer:uid,merchant:s.owner,store:s.id,name:str(data.name,'recipient name',2,80),phone:phone(data.phone),area:deliveryArea,address:str(data.address,'delivery address and landmark',5,250),notes:str(data.notes||'','delivery notes',0,250),items:JSON.stringify(items),subtotal,delivery,service,total,status:'Awaiting business',pin:String(crypto.getRandomValues(new Uint32Array(1))[0]%9000+1000),created:now(),requestKey};
  // Rate limiting uses persisted per-account orders, not device memory.
  if((await one("SELECT COUNT(*) AS n FROM orders WHERE customer=? AND created>?",uid,new Date(Date.now()-600000).toISOString())).n>=10)fail('Please wait before placing another order.',429);
  await db.batch([q('INSERT INTO orders (id,customer,store,merchant,name,phone,area,address,notes,items,subtotal,delivery,service,total,status,pin,created,updated,request_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',o.id,uid,s.id,s.owner,o.name,o.phone,o.area,o.address,o.notes,o.items,subtotal,delivery,service,total,o.status,o.pin,o.created,o.created,requestKey),audit(o.id,'Order placed · cash on delivery'),notice(uid,o.id,'Your order has been placed.'),notice(s.owner,o.id,'New order received. Accept or decline it.')]);return {id:o.id};
 }
 if(method==='GET'&&path==='orders'){
  registered();const joined="SELECT o.*,s.name AS business,s.address AS pickup,s.area AS pickupArea,mp.phone AS merchantPhone,c.name AS company,d.name AS driverName,d.phone AS driverPhone FROM orders o LEFT JOIN stores s ON s.id=o.store LEFT JOIN profiles mp ON mp.id=o.merchant LEFT JOIN companies c ON c.id=o.courier LEFT JOIN drivers d ON d.id=o.driver";
  let list=profile.role==='admin'?await all(joined+' ORDER BY o.created DESC LIMIT 200'):await all(joined+' WHERE o.customer=? OR o.merchant=? OR o.courier=? ORDER BY o.created DESC LIMIT 200',uid,uid,uid);
  let dispatch=[];if(profile.role==='courier'&&profile.approved){let company=await one('SELECT * FROM companies WHERE id=?',uid);let areas=JSON.parse(company?.areas||'[]');let available=await all("SELECT o.id,o.store,o.area,o.delivery,o.status,o.created,s.name AS business,s.area AS pickup_area,s.prep FROM orders o JOIN stores s ON s.id=o.store JOIN profiles p ON p.id=o.merchant WHERE o.status IN ('Preparing','Ready for pickup') AND o.courier IS NULL AND p.approved=1 ORDER BY o.created ASC LIMIT 100");dispatch=available.filter(o=>areas.includes(o.area)&&areas.includes(o.pickup_area))}
  let activity=[];for(let offset=0;offset<list.length;offset+=50){let ids=list.slice(offset,offset+50).map(o=>o.id);activity.push(...await all('SELECT order_id,text,created FROM events WHERE order_id IN ('+ids.map(()=>'?').join(',')+') ORDER BY created',...ids))}
  let output=list.map(o=>{const {pin,pin_attempts,request_key,...rest}=o;return {...rest,items:JSON.parse(o.items),...(o.customer===uid?{pin}:{}),events:activity.filter(e=>e.order_id===o.id).map(({text,created})=>({text,created}))}});
  return {orders:output,dispatch};
 }
 if(method==='POST'&&path==='order-action'){
  registered();let o=await getOrder(String(data.id)),action=data.action,stamp=now(),result;
  if(action==='accept'){
   approved('merchant');if(o.merchant!==uid)fail('You cannot manage this order.',403);let prep=num(data.prep,5,180);
   result=await q("UPDATE orders SET status='Preparing',updated=? WHERE id=? AND merchant=? AND status='Awaiting business'",stamp,o.id,uid).run();
   if(result.meta.changes){await q('UPDATE stores SET prep=? WHERE id=?',prep,o.store).run();await log(o,`Business accepted · preparing in ${prep} minutes`)}
  }else if(action==='ready'){
   approved('merchant');if(o.merchant!==uid)fail('You cannot manage this order.',403);result=await q("UPDATE orders SET status='Ready for pickup',updated=? WHERE id=? AND merchant=? AND status='Preparing'",stamp,o.id,uid).run();if(result.meta.changes)await log(o,'Order ready for pickup');
  }else if(action==='claim'){
   approved('courier');let merchant=await one('SELECT approved FROM profiles WHERE id=?',o.merchant);if(!merchant?.approved)fail('The business is currently suspended.',409);let c=await one('SELECT * FROM companies WHERE id=?',uid),d=await one('SELECT * FROM drivers WHERE id=? AND company=? AND active=1',String(data.driver),uid),s=await one('SELECT area FROM stores WHERE id=?',o.store),a=JSON.parse(c.areas);
   if(!a.includes(o.area)||!a.includes(s.area))fail('Pickup and delivery must be within your service areas.');if(!d)fail('Choose an active driver.');
   result=await q("UPDATE orders SET courier=?,driver=?,updated=? WHERE id=? AND courier IS NULL AND status IN ('Preparing','Ready for pickup')",uid,d.id,stamp,o.id).run();if(result.meta.changes)await log({...o,courier:uid},'Courier assigned · '+c.name);
  }else if(action==='pickup'){
   approved('courier');if(o.courier!==uid)fail('Delivery is assigned to a different courier.',403);result=await q("UPDATE orders SET status='Out for delivery',updated=? WHERE id=? AND courier=? AND status='Ready for pickup'",stamp,o.id,uid).run();if(result.meta.changes)await log(o,'Driver collected the order');
  }else if(action==='deliver'){
   approved('courier');if(o.courier!==uid)fail('Delivery is assigned to a different courier.',403);if(o.status!=='Out for delivery')fail('Collect the order first.',409);if(data.cashCollected!==true)fail('Confirm cash collection and handover first.');
   if(o.pin_attempts>=8)fail('Too many incorrect PIN attempts. Contact the administrator.',429);
   if(String(data.pin)!==o.pin){await q("UPDATE orders SET pin_attempts=pin_attempts+1 WHERE id=? AND status='Out for delivery'",o.id).run();fail('Incorrect delivery PIN. Ask the customer to check their order.')}
   result=await q("UPDATE orders SET status='Delivered',updated=? WHERE id=? AND courier=? AND status='Out for delivery' AND pin_attempts<8",stamp,o.id,uid).run();if(result.meta.changes)await log(o,'Delivery confirmed with customer PIN · cash collected');
  }else if(action==='cancel'){
   if(!owns(o))fail('You cannot cancel this order.',403);
   if(profile.role!=='admin'&&o.status!=='Awaiting business')fail('Contact support to cancel an accepted order.',409);
   if(profile.role!=='admin'&&o.customer!==uid&&o.merchant!==uid)fail('You cannot cancel this order.',403);
   let reason=str(data.reason,'cancellation reason',5,250);result=await q("UPDATE orders SET status='Cancelled',reason=?,updated=? WHERE id=? AND status NOT IN ('Delivered','Cancelled')"+(profile.role==='admin'?'':" AND status='Awaiting business'"),reason,stamp,o.id).run();if(result.meta.changes)await log(o,'Order cancelled · '+reason);
  }else fail('Unknown order action.');
  if(!result?.meta.changes)fail('This order changed. Refresh to see its current status.',409);
  return {ok:true};
 }
 fail('Not found.',404);
}
export async function apiResponse(context){
 try{
  // Reject cross-origin writes; identities are supplied only by trusted hosting dispatch.
  if(context.request.method==='POST'){
   let origin=context.request.headers.get('origin');if(!origin||origin!==new URL(context.request.url).origin)fail('Invalid request origin.',403);
   if(!(context.request.headers.get('content-type')||'').startsWith('application/json'))fail('JSON requests required.',415);
  }
  return Response.json(await handleApi(context),{headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 }catch(e){let status=e instanceof ApiError?e.status:500;if(status===500)console.error('Porty API error',e);return Response.json({error:status===500?'We could not complete that request. Please try again.':e.message},{status,headers:{'Cache-Control':'no-store'}})}
}
