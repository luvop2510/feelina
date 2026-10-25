begin;

-- Idempotency records are private application machinery, not customer data.
create table private.stock_requests (
 request_id uuid primary key,
 actor_id uuid not null references public.profiles(id),
 operation text not null,
 payload jsonb not null,
 result uuid,
 created_at timestamptz not null default now()
);
revoke all on private.stock_requests from public,anon,authenticated;
alter table private.stock_requests enable row level security;

-- Keep the previously tested transaction bodies; only the guarded entrypoints remain public.
alter function public.adjust_stock(uuid,integer,text) set schema private;
alter function public.dispatch_order(uuid,jsonb,text) set schema private;
alter function public.record_return(uuid,jsonb,text) set schema private;
revoke all on function private.adjust_stock(uuid,integer,text),private.dispatch_order(uuid,jsonb,text),private.record_return(uuid,jsonb,text) from public,anon,authenticated;

create function private.apply_stock_request(p_request_id uuid,p_operation text,p_payload jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare prior private.stock_requests; result_id uuid; begin
 if p_operation='dispatch' then
  perform private.require_role(array['owner','admin','fulfilment']);
 elsif p_operation in ('return','adjustment') then
  perform private.require_role(array['owner','admin','inventory']);
 else raise exception 'Unknown inventory operation';
 end if;
 if p_request_id is null then raise exception 'A request id is required for safe inventory retries'; end if;
 perform pg_advisory_xact_lock(hashtextextended('stock-request:'||p_request_id::text,0));
 select * into prior from private.stock_requests where request_id=p_request_id;
 if found then
  if prior.actor_id is distinct from auth.uid() or prior.operation<>p_operation or prior.payload<>p_payload then
   raise exception 'Inventory request id was already used with different details';
  end if;
  return prior.result;
 end if;
 if p_operation='dispatch' then
  perform private.dispatch_order((p_payload->>'order_id')::uuid,p_payload->'items',p_payload->>'details');
 elsif p_operation='return' then
  result_id:=private.record_return((p_payload->>'order_id')::uuid,p_payload->'items',p_payload->>'note');
 else
  perform private.adjust_stock((p_payload->>'variant_id')::uuid,(p_payload->>'quantity')::integer,p_payload->>'note');
 end if;
 insert into private.stock_requests(request_id,actor_id,operation,payload,result)
 values(p_request_id,auth.uid(),p_operation,p_payload,result_id);
 return result_id;
end $$;
revoke all on function private.apply_stock_request(uuid,text,jsonb) from public,anon,authenticated;

create function public.adjust_stock(p_variant_id uuid,p_quantity integer,p_note text,p_request_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.apply_stock_request(p_request_id,'adjustment',jsonb_build_object('variant_id',p_variant_id,'quantity',p_quantity,'note',p_note));
end $$;
create function public.dispatch_order(p_order_id uuid,p_items jsonb,p_details text default '',p_request_id uuid default null)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform private.apply_stock_request(p_request_id,'dispatch',jsonb_build_object('order_id',p_order_id,'items',p_items,'details',coalesce(p_details,'')));
end $$;
create function public.record_return(p_order_id uuid,p_items jsonb,p_note text,p_request_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 return private.apply_stock_request(p_request_id,'return',jsonb_build_object('order_id',p_order_id,'items',p_items,'note',p_note));
end $$;
revoke all on function public.adjust_stock(uuid,integer,text,uuid),public.dispatch_order(uuid,jsonb,text,uuid),public.record_return(uuid,jsonb,text,uuid) from public,anon;
grant execute on function public.adjust_stock(uuid,integer,text,uuid),public.dispatch_order(uuid,jsonb,text,uuid),public.record_return(uuid,jsonb,text,uuid) to authenticated;

alter table public.customers add column supply_state_code text not null default '' check(supply_state_code='' or (supply_state_code ~ '^[0-9]{2}$' and supply_state_code<>'00'));
alter table public.orders add column place_of_supply_state text not null default '' check(place_of_supply_state='' or (place_of_supply_state ~ '^[0-9]{2}$' and place_of_supply_state<>'00'));
create function private.check_order_money_range() returns trigger language plpgsql set search_path='' as $$
begin
 if new.subtotal_paise>1000000000000 or new.total_paise>1000000000000 then
  raise exception 'Order subtotal and total cannot exceed 1000000000000 paise; split this order';
 end if;
 return new;
end $$;
revoke all on function private.check_order_money_range() from public,anon,authenticated;
create trigger order_money_range before insert or update of subtotal_paise,total_paise on public.orders for each row execute function private.check_order_money_range();
alter table public.orders add constraint order_money_supported_range check(subtotal_paise<=1000000000000 and total_paise<=1000000000000);

alter function public.save_customer(jsonb) set schema private;
revoke all on function private.save_customer(jsonb) from public,anon,authenticated;
create function public.save_customer(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid; supply text; begin
 perform private.require_role(array['owner','admin','sales']);
 supply:=coalesce(payload->>'supply_state_code','');
 if supply<>'' and (supply !~ '^[0-9]{2}$' or supply='00') then raise exception 'Supply state must be a two-digit state code'; end if;
 cid:=private.save_customer(payload);
 if payload ? 'supply_state_code' then update public.customers set supply_state_code=supply where id=cid; end if;
 return cid;
end $$;
revoke all on function public.save_customer(jsonb) from public,anon;
grant execute on function public.save_customer(jsonb) to authenticated;

-- Due dates must use the order's date, including when preparing a future-dated draft.
alter table public.orders add constraint order_due_date_valid check(due_date is null or due_date>=order_date) not valid;
alter function public.save_order(jsonb) set schema private;
revoke all on function private.save_order(jsonb) from public,anon,authenticated;
create function public.save_order(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare placed date; due date; days integer; supply text; assigned_state text; cfg public.settings; oid uuid; begin
 perform private.require_role(array['owner','admin','sales','retailer']);
 select supply_state_code,credit_days into assigned_state,days from public.customers where id=(payload->>'customer_id')::uuid;
 supply:=coalesce(nullif(payload->>'place_of_supply_state',''),assigned_state,'');
 if private.actor_role()='retailer' and supply is distinct from assigned_state then raise exception 'Retailers must use their approved customer supply state' using errcode='42501'; end if;
 if supply<>'' and (supply !~ '^[0-9]{2}$' or supply='00') then raise exception 'Supply state must be a two-digit state code'; end if;
 select * into cfg from public.settings where id=1;
 if cfg.tax_mode<>'none' and supply='' then raise exception 'Set the customer supply state before calculating GST'; end if;
 placed:=coalesce(nullif(payload->>'order_date','')::date,current_date);
 due:=nullif(payload->>'due_date','')::date;
 if due is null then
  select credit_days into days from public.customers where id=(payload->>'customer_id')::uuid;
  due:=placed+coalesce(days,0);
 end if;
 if due<placed then raise exception 'Payment due date cannot precede the order date'; end if;
 oid:=private.save_order(payload||jsonb_build_object('order_date',placed,'due_date',due));
 update public.orders set place_of_supply_state=supply,
  settings_snapshot=jsonb_set(settings_snapshot,'{tax_mode}',to_jsonb(case when cfg.tax_mode='none' then 'none' when supply=left(cfg.gstin,2) then 'cgst_sgst' else 'igst' end))
  where id=oid;
 return oid;
end $$;
revoke all on function public.save_order(jsonb) from public,anon;
grant execute on function public.save_order(jsonb) to authenticated;
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
 select jsonb_agg(to_jsonb(l) order by l.id) into lines from public.order_lines l where order_id=o.id;
 insert into public.invoices(order_id,snapshot) values(o.id,jsonb_build_object('order',to_jsonb(o),'lines',lines,'issuer',o.settings_snapshot,'issued_by',auth.uid(),'issued_at',now())) returning id into iid;
 perform private.audit('invoice.issued',iid,jsonb_build_object('order_id',o.id)); return iid;
end $$;


-- Index foreign keys used by joins, policy predicates and operational audit queries.
create index customers_price_list_idx on public.customers(price_list_id);
create index profiles_customer_idx on public.profiles(customer_id);
create index variants_product_idx on public.variants(product_id);
create index price_list_items_product_idx on public.price_list_items(product_id);
create index orders_created_by_idx on public.orders(created_by);
create index orders_price_list_idx on public.orders(price_list_id);
create index order_lines_product_idx on public.order_lines(product_id);
create index payments_created_by_idx on public.payments(created_by);
create index stock_movements_order_idx on public.stock_movements(order_id);
create index stock_movements_created_by_idx on public.stock_movements(created_by);
create index audit_logs_actor_idx on public.audit_logs(actor_id);
create index fulfilments_variant_idx on public.order_fulfilments(variant_id);
create index fulfilments_created_by_idx on public.order_fulfilments(created_by);
create index returns_order_idx on public.returns(order_id);
create index returns_created_by_idx on public.returns(created_by);
create index return_items_variant_idx on public.return_items(variant_id);
create index internal_notes_order_idx on public.internal_order_notes(order_id);
create index internal_notes_created_by_idx on public.internal_order_notes(created_by);
create index stock_requests_actor_idx on private.stock_requests(actor_id);
alter policy profiles_read on public.profiles using(id=(select auth.uid()) or private.actor_role() in ('owner','admin'));
commit;
