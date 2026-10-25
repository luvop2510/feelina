-- Run only on the dedicated Feelina project. Every fixture and change is rolled back.
begin;
select set_config('feelina.owner',gen_random_uuid()::text,true);
select set_config('feelina.retailer',gen_random_uuid()::text,true);
select set_config('feelina.order',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data) values
(current_setting('feelina.owner')::uuid,'feelina-rollback-owner@example.invalid','{}'),
(current_setting('feelina.retailer')::uuid,'feelina-rollback-retailer@example.invalid','{"role":"owner"}');
update public.profiles set role='owner',status='active' where id=current_setting('feelina.owner')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('feelina.owner'),true);
select set_config('feelina.customer',public.save_customer('{"name":"Rollback test retailer","shop_name":"Rollback fixture"}')::text,true);
select set_config('feelina.product',public.save_product('{"sku":"ROLLBACK-TEST-ONLY","name":"Rollback test product","mrp_paise":30000,"retail_paise":25000,"wholesale_paise":20000,"variants":[{"colour":"Rose","size":"30","stock":10}]}')::text,true);
select public.save_order(jsonb_build_object('id',current_setting('feelina.order'),'customer_id',current_setting('feelina.customer'),'order_type','wholesale','total_paise',1,'lines',jsonb_build_array(jsonb_build_object('product_id',current_setting('feelina.product'),'colour','Rose','quantities','{"30":2}'::jsonb))));
do $$ begin
 if (select total_paise from public.orders where id=current_setting('feelina.order')::uuid)<>40000 then raise exception 'Authoritative total test failed'; end if;
 begin update public.orders set total_paise=1;raise exception 'Direct mutation unexpectedly allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('feelina.retailer'),true);
do $$ begin
 if (select role from public.profiles where id=auth.uid())<>'retailer' then raise exception 'Signup metadata escalated role';end if;
 if exists(select 1 from public.orders) then raise exception 'Pending retailer read private orders'; end if;
 begin perform public.save_customer('{"name":"Forbidden"}');raise exception 'Pending write unexpectedly allowed';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',current_setting('feelina.owner'),true);
select public.update_profile(current_setting('feelina.retailer')::uuid,'retailer','active',current_setting('feelina.customer')::uuid);
select set_config('request.jwt.claim.sub',current_setting('feelina.retailer'),true);
do $$ begin
 if (select count(*) from public.orders)<>1 then raise exception 'Approved retailer cannot read own order';end if;
 begin perform public.update_profile(auth.uid(),'owner','active',null);raise exception 'Retailer escalation unexpectedly allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
select 'Cloud role boundaries, signup metadata, totals and direct-write guards passed; fixtures rolled back' as result;
rollback;
