begin;
-- Keep each submitted matrix in the order the user entered it.
alter table public.order_lines add column position integer not null default 1 check(position between 1 and 100);
alter table public.orders add column exchange_return_id uuid unique references public.returns(id);
alter table public.customers add constraint customer_text_bounds check(length(shop_name)<=160 and length(email)<=320 and length(phone)<=30 and length(billing_address)<=2000 and length(shipping_address)<=2000);
alter table public.orders add constraint order_text_bounds check(length(transporter)<=200 and length(lr_number)<=100 and length(dispatch_details)<=2000 and length(notes)<=5000);
alter table public.payments add constraint payment_reference_bounds check(length(reference)<=200);
alter table public.products add constraint product_text_bounds check(length(category)<=120 and length(image_url)<=2000);
create policy stock_request_deny on private.stock_requests for all to authenticated using(false) with check(false);

alter function public.save_order(jsonb) rename to save_order_with_supply;
alter function public.save_order_with_supply(jsonb) set schema private;
revoke all on function private.save_order_with_supply(jsonb) from public,anon,authenticated;
create function public.save_order(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid; begin
 perform private.require_role(array['owner','admin','sales','retailer']);
 if payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>131072 then raise exception 'Order form exceeds the supported data limit'; end if;
 oid:=private.save_order_with_supply(payload);
 update public.order_lines l set position=x.ordinality::integer from jsonb_array_elements(payload->'lines') with ordinality x(item,ordinality)
 where l.order_id=oid and l.product_id=(x.item->>'product_id')::uuid and l.colour=x.item->>'colour';
 return oid;
end $$;
revoke all on function public.save_order(jsonb) from public,anon;
grant execute on function public.save_order(jsonb) to authenticated;

create function public.update_dispatch_details(p_order_id uuid,p_details jsonb) returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; lr date; begin
 perform private.require_role(array['owner','admin','fulfilment']);
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status not in ('confirmed','processing','packed','dispatched') then raise exception 'Transport details can be updated from confirmation until delivery'; end if;
 if p_details is null or jsonb_typeof(p_details)<>'object' or octet_length(p_details::text)>8192 then raise exception 'Transport details are too long'; end if;
 lr:=nullif(p_details->>'lr_date','')::date;
 if lr<o.order_date then raise exception 'LR date cannot precede the order date'; end if;
 update public.orders set transporter=coalesce(p_details->>'transporter',''),lr_number=coalesce(p_details->>'lr_number',''),lr_date=lr,dispatch_details=coalesce(p_details->>'dispatch_details',''),updated_at=clock_timestamp() where id=o.id;
 perform private.audit('order.transport_updated',o.id,jsonb_build_object('previous',jsonb_build_object('transporter',o.transporter,'lr_number',o.lr_number,'lr_date',o.lr_date,'dispatch_details',o.dispatch_details),'details',p_details));
end $$;
revoke all on function public.update_dispatch_details(uuid,jsonb) from public,anon;
grant execute on function public.update_dispatch_details(uuid,jsonb) to authenticated;

create function public.create_exchange_order(p_return_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare r public.returns; source public.orders; existing uuid; lines jsonb; oid uuid; begin
 perform private.require_role(array['owner','admin','sales']);
 select * into r from public.returns where id=p_return_id for update;
 if not found then raise exception 'Select a recorded return before creating an exchange'; end if;
 select id into existing from public.orders where exchange_return_id=r.id;
 if found then return existing; end if;
 select * into source from public.orders where id=r.order_id;
 select jsonb_agg(jsonb_build_object('product_id',q.product_id,'colour',q.colour,'quantities',q.quantities)) into lines
 from (select v.product_id,v.colour,jsonb_object_agg(v.size,i.quantity) quantities from public.return_items i join public.variants v on v.id=i.variant_id where i.return_id=r.id group by v.product_id,v.colour) q;
 if lines is null then raise exception 'This return contains no exchangeable quantities'; end if;
 oid:=public.save_order(jsonb_build_object('id',gen_random_uuid(),'customer_id',source.customer_id,'order_type',source.order_type,'place_of_supply_state',source.place_of_supply_state,'lines',lines,'notes','Exchange replacement for '||source.number||'. Return reference: '||r.id::text));
 update public.orders set exchange_return_id=r.id where id=oid;
 perform private.audit('order.exchange_created',oid,jsonb_build_object('source_order_id',source.id,'return_id',r.id));
 return oid;
end $$;
revoke all on function public.create_exchange_order(uuid) from public,anon;
grant execute on function public.create_exchange_order(uuid) to authenticated;

-- Inventory staff can inspect order quantities to reconcile received returns; payments remain restricted.
create or replace function private.can_read_order(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.orders o where o.id=oid and
 (private.actor_role() in ('owner','admin','sales','accounts','fulfilment','inventory') or o.customer_id=private.actor_customer()))
$$;
create or replace function public.issue_invoice(p_order_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; cfg public.settings; iid uuid; lines jsonb; begin
 perform private.require_role(array['owner','admin','accounts']);
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status not in ('confirmed','processing','packed','dispatched','delivered') then raise exception 'Confirm the order before issuing a tax invoice'; end if;
 select id into iid from public.invoices where order_id=o.id;
 if found then return iid; end if;
 select * into cfg from public.settings where id=1;
 if not cfg.company_verified or not cfg.tax_verified or cfg.tax_mode='none' or not cfg.gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then raise exception 'Tax invoices are locked until company details and GST settings are verified'; end if;
 if (o.settings_snapshot->>'tax_verified')::boolean is not true or o.settings_snapshot->>'tax_mode'='none' then raise exception 'This order was created without verified tax settings and cannot become a tax invoice'; end if;
 if o.place_of_supply_state='' then raise exception 'A verified place of supply is required before invoicing'; end if;
 if cfg.company_name is distinct from o.settings_snapshot->>'company_name' or cfg.business_address is distinct from o.settings_snapshot->>'business_address' or cfg.gstin is distinct from o.settings_snapshot->>'gstin' or (case when o.place_of_supply_state=left(cfg.gstin,2) then 'cgst_sgst' else 'igst' end) is distinct from o.settings_snapshot->>'tax_mode' or cfg.tax_rate_bps is distinct from (o.settings_snapshot->>'tax_rate_bps')::integer then raise exception 'Tax configuration changed since this order. Accounts must reconcile it before invoicing'; end if;
 if o.credit_paise>0 then raise exception 'Returned orders require an accounts review before invoicing'; end if;
 select jsonb_agg(to_jsonb(l) order by l.position,l.id) into lines from public.order_lines l where order_id=o.id;
 insert into public.invoices(order_id,snapshot) values(o.id,jsonb_build_object('order',to_jsonb(o),'lines',lines,'issuer',o.settings_snapshot,'issued_by',auth.uid(),'issued_at',now())) returning id into iid;
 perform private.audit('invoice.issued',iid,jsonb_build_object('order_id',o.id)); return iid;
end $$;
commit;
