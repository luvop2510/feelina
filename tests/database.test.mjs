import {test,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const db=new PGlite();
const ids=Object.fromEntries(['owner','admin','sales','retailer','other','pending','inventory','accounts','fulfilment'].map(k=>[k,randomUUID()]));
const rpc=async(name,args=[])=>{const res=await db.query(`select public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) value`,args.map(x=>typeof x==='object'&&x!==null?JSON.stringify(x):x));return res.rows[0].value};
const as=async(role)=>{await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[role]]);await db.exec('set role authenticated');};
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
// Storage service tables are emulated only to exercise database policies. MIME/size
// enforcement by the hosted Storage API is verified separately against the cloud.
await db.exec(`create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text);
alter table storage.objects enable row level security;
grant usage on schema storage to anon,authenticated;
grant select,insert,update,delete on storage.objects to anon,authenticated;`);
for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort()) await db.exec(await readFile('supabase/migrations/'+file,'utf8'));
for(const [r,id] of Object.entries(ids)){await db.query('insert into auth.users(id,email) values ($1,$2)',[id,r+'@example.invalid']);if(!['pending','retailer','other'].includes(r))await db.query("update public.profiles set role=$1,status='active' where id=$2",[r,id]);}
await as('owner');
const customer=await rpc('save_customer',[{name:'Test Retailer',shop_name:'Test Shop',billing_address:'Test address',supply_state_code:'27'}]);const otherCustomer=await rpc('save_customer',[{name:'Other Retailer',shop_name:'Other Shop',supply_state_code:'27'}]);
await rpc('update_profile',[ids.retailer,'retailer','active',customer]);await rpc('update_profile',[ids.other,'retailer','active',otherCustomer]);
const product=await rpc('save_product',[{sku:'TEST-001',name:'Test Essential',mrp_paise:30000,retail_paise:25000,wholesale_paise:20000,variants:[{colour:'Rose',size:'30',stock:10},{colour:'Rose',size:'32',stock:5}]}]);
const payload=(n=2)=>({id:randomUUID(),customer_id:customer,order_type:'wholesale',lines:[{product_id:product,colour:'Rose',quantities:{30:n}}],rate_paise:1,total_paise:1});
let order;
beforeEach(async()=>as('owner'));
test('pending and anonymous cannot read business data or elevate themselves',async()=>{await as('pending');assert.equal((await db.query('select * from public.products')).rows.length,0);await assert.rejects(rpc('save_customer',[{name:'No'}]),/permission/);await assert.rejects(db.exec("update public.profiles set role='owner'"),/permission/);await db.exec('reset role;set role anon');await assert.rejects(db.query('select * from public.orders'),/permission/);await as('owner');});
test('prices and totals are recomputed; invalid quantities and unauthorised discounts rejected',async()=>{order=await rpc('save_order',[payload()]);const o=(await db.query('select * from public.orders where id=$1',[order])).rows[0];assert.equal(Number(o.total_paise),40000);await assert.rejects(rpc('save_order',[payload(-1)]),/whole numbers/);await as('sales');await assert.rejects(rpc('save_order',[{...payload(),discount_paise:1}]),/discount/);await as('owner');});
test('retailer sees only own orders and cannot choose another customer or role',async()=>{await as('other');assert.equal((await db.query('select * from public.orders')).rows.length,0);await assert.rejects(rpc('save_order',[payload()]),/own wholesale/);await assert.rejects(rpc('update_profile',[ids.other,'owner','active',null]),/permission/);await as('retailer');assert.equal((await db.query('select * from public.orders')).rows.length,1);await as('owner');});
test('unverified business cannot confirm or invoice; sequential numbers are unique',async()=>{await rpc('transition_order',[order,'submitted']);await assert.rejects(rpc('transition_order',[order,'confirmed']),/Verify business/);await assert.rejects(rpc('issue_invoice',[order]),/Confirm/);await rpc('transition_order',[order,'cancelled']);const second=await rpc('save_order',[payload()]);assert.notEqual((await db.query('select number from public.orders where id=$1',[order])).rows[0].number,(await db.query('select number from public.orders where id=$1',[second])).rows[0].number);});
test('verified settings, assigned prices, stock reservation and overselling guards',async()=>{await rpc('save_settings',[{company_name:'Synthetic Test Company',business_address:'Test only, never production',gstin:'24ABCDE1234F1Z5',company_verified:true,tax_verified:true,tax_mode:'igst',tax_rate_bps:500}]);const list=await rpc('save_price_list',[{name:'Test agreement',items:[{product_id:product,rate_paise:15000}]}]);await rpc('save_customer',[{id:customer,name:'Test Retailer',shop_name:'Test Shop',price_list_id:list}]);order=await rpc('save_order',[payload(8)]);assert.equal(Number((await db.query('select total_paise from public.orders where id=$1',[order])).rows[0].total_paise),126000);await rpc('transition_order',[order,'submitted']);await rpc('transition_order',[order,'confirmed']);await rpc('transition_order',[order,'confirmed']);const v=(await db.query("select * from public.variants where size='30'")).rows[0];assert.equal(v.reserved,8);const competing=await rpc('save_order',[payload(3)]);await rpc('transition_order',[competing,'submitted']);await assert.rejects(rpc('transition_order',[competing,'confirmed']),/Insufficient stock/);await assert.rejects(rpc('adjust_stock',[v.id,-3,'test count',randomUUID()]),/reserved/);});
test('payments are idempotent, positive, bounded and cannot be written by retailers',async()=>{const request=randomUUID();const args=[order,20000,'upi','test-reference','2026-10-01',request];const p=await rpc('record_payment',args);assert.equal(await rpc('record_payment',args),p);await assert.rejects(rpc('record_payment',[order,1,'cash','','2026-10-01',request]),/different details/);await assert.rejects(rpc('record_payment',[order,999999,'cash','','2026-10-01',randomUUID()]),/outstanding/);await as('retailer');await assert.rejects(rpc('record_payment',args),/permission/);await as('owner');});
test('partial dispatch, immutable invoice, returns and full-return credit are consistent',async()=>{const invoice=await rpc('issue_invoice',[order]);assert.equal(await rpc('issue_invoice',[order]),invoice);await rpc('transition_order',[order,'processing']);await rpc('transition_order',[order,'packed']);const v=(await db.query("select * from public.variants where size='30'")).rows[0];await rpc('dispatch_order',[order,[{variant_id:v.id,quantity:3}],'shipment A',randomUUID()]);assert.equal((await db.query('select status from public.orders where id=$1',[order])).rows[0].status,'packed');await assert.rejects(rpc('transition_order',[order,'cancelled']),/Reconcile|Partly/);await rpc('dispatch_order',[order,[{variant_id:v.id,quantity:5}],'shipment B',randomUUID()]);for(let i=0;i<8;i++)await rpc('record_return',[order,[{variant_id:v.id,quantity:1}],'quality return',randomUUID()]);const o=(await db.query('select * from public.orders where id=$1',[order])).rows[0];assert.equal(Number(o.credit_paise),Number(o.total_paise));await assert.rejects(rpc('record_return',[order,[{variant_id:v.id,quantity:1}],'over return',randomUUID()]),/exceeds/);assert.equal((await db.query('select stock from public.variants where id=$1',[v.id])).rows[0].stock,10);});
test('last owner is protected and internal notes remain staff-only',async()=>{await assert.rejects(rpc('update_profile',[ids.owner,'owner','suspended',null]),/last active owner/);await rpc('add_internal_note',[order,'Private account review']);await as('retailer');assert.equal((await db.query('select * from public.internal_order_notes')).rows.length,0);await as('owner');});
test('stock operations require stable ids and retries cannot double-post',async()=>{
 const vid=(await db.query("select id from public.variants where product_id=$1 and size='32'",[product])).rows[0].id;
 await assert.rejects(rpc('adjust_stock',[vid,2,'count correction']),/request id/);
 const request=randomUUID(); const args=[vid,2,'count correction',request];
 await rpc('adjust_stock',args);await rpc('adjust_stock',args);
 assert.equal((await db.query('select stock from public.variants where id=$1',[vid])).rows[0].stock,7);
 await assert.rejects(rpc('adjust_stock',[vid,3,'count correction',request]),/different details/);
 await assert.rejects(db.query('select private.adjust_stock($1,2,$2)',[vid,'bypass']),/permission/);
 await assert.rejects(db.query('select * from private.stock_requests'),/permission/);
});
test('status revocation applies immediately even to previously successful retries',async()=>{
 const vid=(await db.query("select id from public.variants where product_id=$1 and size='32'",[product])).rows[0].id;
 const req=randomUUID();await as('inventory');await rpc('adjust_stock',[vid,1,'inventory count',req]);
 await as('owner');await rpc('update_profile',[ids.inventory,'inventory','suspended',null]);
 await as('inventory');assert.equal((await db.query('select * from public.products')).rows.length,0);
 await assert.rejects(rpc('adjust_stock',[vid,1,'inventory count',req]),/permission/);
 await as('owner');await rpc('update_profile',[ids.inventory,'inventory','active',null]);
});
test('staff permissions separate sales, inventory, accounts and administration',async()=>{
 const vid=(await db.query("select id from public.variants where product_id=$1 and size='32'",[product])).rows[0].id;
 for(const role of ['sales','accounts','fulfilment']){await as(role);await assert.rejects(rpc('adjust_stock',[vid,1,'not authorised',randomUUID()]),/permission/);}
 for(const role of ['inventory','sales','fulfilment']){await as(role);await assert.rejects(rpc('record_payment',[order,1,'cash','','2026-10-01',randomUUID()]),/permission/);}
 await as('admin');await assert.rejects(rpc('update_profile',[ids.admin,'owner','active',null]),/Only an owner/);
 await assert.rejects(rpc('update_profile',[ids.owner,'sales','active',null]),/Only an owner/);
 await as('fulfilment');await assert.rejects(rpc('save_order',[payload()]),/permission/);
 await as('owner');
});
test('simultaneously queued saves reuse one order id and enforce customer ownership',async()=>{
 const draft=payload(1);const results=await Promise.all([rpc('save_order',[draft]),rpc('save_order',[draft])]);
 assert.equal(results[0],results[1]);
 assert.equal((await db.query('select count(*)::int n from public.orders where id=$1',[draft.id])).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from public.order_lines where order_id=$1',[draft.id])).rows[0].n,1);
 await as('other');await assert.rejects(rpc('save_order',[{...draft,customer_id:otherCustomer}]),/Only eligible drafts/);await as('owner');
});
test('customer supply state derives GST mode and due dates and total bounds are validated',async()=>{
 const intra=await rpc('save_order',[{...payload(1),place_of_supply_state:'24',order_date:'2027-01-01'}]);
 const same=(await db.query('select * from public.orders where id=$1',[intra])).rows[0];
 assert.equal(same.settings_snapshot.tax_mode,'cgst_sgst');assert.equal(new Date(same.due_date).toISOString().slice(0,10),'2027-01-01');
 const inter=await rpc('save_order',[payload(1)]);assert.equal((await db.query('select settings_snapshot from public.orders where id=$1',[inter])).rows[0].settings_snapshot.tax_mode,'igst');
 await assert.rejects(rpc('save_order',[{...payload(),order_date:'2026-10-25',due_date:'2026-10-24'}]),/cannot precede/);
 await assert.rejects(rpc('save_order',[{...payload(),place_of_supply_state:'00'}]),/two-digit/);
 await as('retailer');await assert.rejects(rpc('save_order',[{...payload(),place_of_supply_state:'24'}]),/approved customer supply state/);await as('owner');
 const huge=await rpc('save_product',[{sku:'LIMIT',name:'Limit fixture',mrp_paise:1000000000,retail_paise:1000000000,wholesale_paise:1000000000,variants:[{colour:'Test',size:'30',stock:10000}]}]);
 await assert.rejects(rpc('save_order',[{...payload(),lines:[{product_id:huge,colour:'Test',quantities:{30:10000}}]}]),/1000000000000 paise/);
});
test('saved rates and invoice issuer remain immutable when catalogue or settings change',async()=>{
 const p=await rpc('save_product',[{sku:'SNAPSHOT',name:'Snapshot fixture',mrp_paise:10000,retail_paise:9000,wholesale_paise:8000,variants:[{colour:'Test',size:'30',stock:5}]}]);
 const o=await rpc('save_order',[{...payload(),lines:[{product_id:p,colour:'Test',quantities:{30:2}}]}]);
 await rpc('save_product',[{id:p,sku:'SNAPSHOT',name:'Renamed fixture',mrp_paise:20000,retail_paise:19000,wholesale_paise:18000}]);
 await rpc('transition_order',[o,'submitted']);await rpc('transition_order',[o,'confirmed']);
 await rpc('save_settings',[{company_name:'Changed Synthetic Test Company',gstin:'27ABCDE1234F1Z5'}]);
 await assert.rejects(rpc('issue_invoice',[o]),/configuration changed/);
 await rpc('save_settings',[{company_name:'Synthetic Test Company',gstin:'24ABCDE1234F1Z5'}]);
 const invoice=await rpc('issue_invoice',[o]);
 const snapshot=(await db.query('select snapshot from public.invoices where id=$1',[invoice])).rows[0].snapshot;
 assert.equal(Number(snapshot.lines[0].rate_paise),8000);assert.equal(snapshot.lines[0].product_name,'Snapshot fixture');
 assert.equal(snapshot.issuer.company_name,'Synthetic Test Company');assert.equal(snapshot.issuer.gstin,'24ABCDE1234F1Z5');
 await rpc('save_settings',[{company_name:'Synthetic Test Company',gstin:'24ABCDE1234F1Z5'}]);
});
test('split returns cumulatively allocate rounding and shipment/return retries are idempotent',async()=>{
 const p=await rpc('save_product',[{sku:'ROUNDING',name:'Rounding fixture',mrp_paise:1,retail_paise:1,wholesale_paise:1,variants:[{colour:'Test',size:'30',stock:3}]}]);
 const o=await rpc('save_order',[{...payload(),discount_paise:2,lines:[{product_id:p,colour:'Test',quantities:{30:3}}]}]);
 for(const status of ['submitted','confirmed','processing','packed']) await rpc('transition_order',[o,status]);
 const vid=(await db.query('select id from public.variants where product_id=$1',[p])).rows[0].id;
 const dispatch=[o,[{variant_id:vid,quantity:3}],'test shipment',randomUUID()];
 await rpc('dispatch_order',dispatch);await rpc('dispatch_order',dispatch);
 assert.equal((await db.query('select count(*)::int n from public.order_fulfilments where order_id=$1',[o])).rows[0].n,1);
 const credits=[];
 for(let i=0;i<3;i++){
  const args=[o,[{variant_id:vid,quantity:1}],'test rounding return',randomUUID()];
  const returned=await rpc('record_return',args);assert.equal(await rpc('record_return',args),returned);
  credits.push(Number((await db.query('select credit_paise from public.returns where id=$1',[returned])).rows[0].credit_paise));
 }
 assert.deepEqual(credits,[0,1,0]);
 assert.equal(Number((await db.query('select credit_paise from public.orders where id=$1',[o])).rows[0].credit_paise),1);
 assert.equal((await db.query('select stock from public.variants where id=$1',[vid])).rows[0].stock,3);
});


test('public product photography is readable but only active administrators can modify it',async()=>{
 const photo=randomUUID();await db.query('insert into storage.objects(id,bucket_id,name) values($1,$2,$3)',[photo,'product-images','test.webp']);
 await as('sales');await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['product-images','blocked.webp']),/row-level security/);
 assert.equal((await db.query('update storage.objects set name=$1 where id=$2 returning id',['blocked.webp',photo])).rows.length,0);
 await db.exec('reset role;set role anon');assert.equal((await db.query('select * from storage.objects where id=$1',[photo])).rows.length,1);
 await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['product-images','anonymous.webp']),/row-level security/);
 await as('owner');await db.query('delete from storage.objects where id=$1',[photo]);
});

test('transport updates preserve prices and require authorised fulfilment access',async()=>{
 const before=(await db.query('select total_paise from public.orders where id=$1',[order])).rows[0].total_paise;
 await rpc('update_dispatch_details',[order,{transporter:'Test transport',lr_number:'QA-LR',dispatch_details:'Shipment reference'}]);
 const updated=(await db.query('select transporter,lr_number,total_paise from public.orders where id=$1',[order])).rows[0];assert.equal(updated.lr_number,'QA-LR');assert.equal(updated.total_paise,before);
 await assert.rejects(rpc('update_dispatch_details',[order,{lr_date:'2000-01-01'}]),/LR date/);
 await as('retailer');await assert.rejects(rpc('update_dispatch_details',[order,{}]),/permission/);
});
test('exchanges create one linked replacement draft from a recorded return',async()=>{
 const ret=(await db.query('select id from public.returns where order_id=$1 order by id limit 1',[order])).rows[0].id;
 const replacement=await rpc('create_exchange_order',[ret]);assert.equal(await rpc('create_exchange_order',[ret]),replacement);
 const o=(await db.query('select * from public.orders where id=$1',[replacement])).rows[0];assert.equal(o.status,'draft');assert.equal(o.exchange_return_id,ret);assert.equal(o.customer_id,customer);
 assert.equal((await db.query('select quantity from public.order_lines where order_id=$1',[replacement])).rows[0].quantity,1);
 await as('retailer');await assert.rejects(rpc('create_exchange_order',[ret]),/permission/);
});
test('matrix positions and server text limits survive save and reject oversized forms',async()=>{
 const second=await rpc('save_product',[{sku:'POSITION',name:'Position fixture',mrp_paise:100,retail_paise:100,wholesale_paise:100,variants:[{colour:'Blue',size:'30',stock:2}]}]);
 const o=await rpc('save_order',[{...payload(),lines:[{product_id:second,colour:'Blue',quantities:{30:1}},{product_id:product,colour:'Rose',quantities:{30:1}}]}]);
 const positions=(await db.query('select product_id,position from public.order_lines where order_id=$1 order by position',[o])).rows;assert.deepEqual(positions.map(x=>x.product_id),[second,product]);
 await assert.rejects(rpc('save_order',[{...payload(),notes:'x'.repeat(140000)}]),/data limit/);
 await assert.rejects(rpc('save_customer',[{name:'Bounds',billing_address:'x'.repeat(2001)}]),/customer_text_bounds/);
});

test('database backup reload preserves orders, payments and stock',async()=>{await db.exec('reset role');const before=await db.query('select count(*)::int n from public.orders');const backup=await db.dumpDataDir();const restored=new PGlite({loadDataDir:backup});assert.deepEqual((await restored.query('select count(*)::int n from public.orders')).rows,before.rows);assert.equal((await restored.query('select count(*)::int n from public.payments')).rows[0].n,1);assert.equal((await restored.query("select stock from public.variants where size='30'")).rows[0].stock,10);await restored.close();await db.close();});
