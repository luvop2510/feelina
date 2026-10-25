begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.price_lists (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 120)
);
create table public.customers (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 160),
 shop_name text not null default '', email text not null default '', phone text not null default '',
 billing_address text not null default '', shipping_address text not null default '', gstin text not null default '',
 price_list_id uuid references public.price_lists(id), credit_days integer not null default 0 check(credit_days between 0 and 365),
 created_at timestamptz not null default now()
);
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade, email text not null default '', full_name text not null default '',
 role text not null default 'retailer' check(role in ('owner','admin','sales','inventory','accounts','fulfilment','retailer')),
 status text not null default 'pending' check(status in ('pending','active','suspended','deactivated')),
 customer_id uuid references public.customers(id), created_at timestamptz not null default now()
);
create table public.products (
 id uuid primary key default gen_random_uuid(), sku text not null unique check(length(sku) between 1 and 80),
 name text not null check(length(name) between 1 and 160), category text not null default '', image_url text not null default '',
 mrp_paise bigint not null check(mrp_paise between 0 and 1000000000),
 retail_paise bigint not null check(retail_paise between 0 and 1000000000),
 wholesale_paise bigint not null check(wholesale_paise between 0 and 1000000000), active boolean not null default true,
 created_at timestamptz not null default now()
);
create table public.variants (
 id uuid primary key default gen_random_uuid(), product_id uuid not null references public.products(id),
 colour text not null check(length(colour) between 1 and 80), size text not null check(size in ('30','32','34','36','38','40','42','44')),
 stock integer not null default 0 check(stock between 0 and 100000000), reserved integer not null default 0 check(reserved>=0 and reserved<=stock),
 unique(product_id,colour,size)
);
create table public.price_list_items (
 price_list_id uuid not null references public.price_lists(id) on delete cascade, product_id uuid not null references public.products(id),
 rate_paise bigint not null check(rate_paise between 0 and 1000000000), primary key(price_list_id,product_id)
);
create table public.settings (
 id integer primary key default 1 check(id=1), company_name text not null default '', business_address text not null default '',
 gstin text not null default '', company_verified boolean not null default false, tax_verified boolean not null default false,
 tax_mode text not null default 'none' check(tax_mode in ('none','igst','cgst_sgst')),
 tax_rate_bps integer not null default 0 check(tax_rate_bps between 0 and 10000),
 size_labels jsonb not null default '{"30":"30 / S","32":"32 / M","34":"34 / L","36":"36 / XL","38":"38","40":"40","42":"42","44":"44"}',
 payment_terms text not null default '', bank_details text not null default '', updated_at timestamptz not null default now()
);
insert into public.settings(id) values(1);
create sequence public.order_number_seq;
create sequence public.invoice_number_seq;
create table public.orders (
 id uuid primary key default gen_random_uuid(), number text not null unique default ('FL-'||lpad(nextval('public.order_number_seq')::text,6,'0')),
 customer_id uuid not null references public.customers(id), created_by uuid not null references public.profiles(id),
 order_type text not null check(order_type in ('retail','wholesale')), status text not null default 'draft'
 check(status in ('draft','submitted','confirmed','processing','packed','dispatched','delivered','cancelled')),
 order_date date not null default current_date, due_date date, transporter text not null default '', lr_number text not null default '',
 lr_date date, dispatch_details text not null default '', notes text not null default '',
 subtotal_paise bigint not null default 0 check(subtotal_paise>=0), discount_paise bigint not null default 0 check(discount_paise>=0),
 tax_paise bigint not null default 0 check(tax_paise>=0), total_paise bigint not null default 0 check(total_paise>=0),
 paid_paise bigint not null default 0 check(paid_paise>=0), credit_paise bigint not null default 0 check(credit_paise>=0),
 customer_snapshot jsonb not null default '{}', settings_snapshot jsonb not null default '{}',
 price_list_id uuid references public.price_lists(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index orders_customer_idx on public.orders(customer_id,created_at desc);
create table public.order_lines (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 product_id uuid not null references public.products(id), product_name text not null, sku text not null, colour text not null,
 quantities jsonb not null, mrp_paise bigint not null, rate_paise bigint not null,
 quantity integer not null check(quantity between 1 and 800000), amount_paise bigint not null,
 unique(order_id,product_id,colour)
);
create index order_lines_order_idx on public.order_lines(order_id);
create table public.payments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), amount_paise bigint not null check(amount_paise>0),
 request_id uuid not null unique, method text not null check(method in ('cash','upi','bank_transfer','other')), reference text not null default '',
 paid_at date not null default current_date, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index payments_order_idx on public.payments(order_id);
create table public.stock_movements (
 id uuid primary key default gen_random_uuid(), variant_id uuid not null references public.variants(id), order_id uuid references public.orders(id),
 quantity integer not null, kind text not null check(kind in ('opening','adjustment','reserve','release','dispatch','return')),
 note text not null default '', created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create index movements_variant_idx on public.stock_movements(variant_id,created_at desc);
create table public.audit_logs (
 id uuid primary key default gen_random_uuid(), actor_id uuid references public.profiles(id), action text not null,
 entity_id uuid, details jsonb not null default '{}', created_at timestamptz not null default now()
);
create table public.invoices (
 id uuid primary key default gen_random_uuid(), number text not null unique default ('INV-'||lpad(nextval('public.invoice_number_seq')::text,6,'0')),
 order_id uuid not null unique references public.orders(id), snapshot jsonb not null, created_at timestamptz not null default now()
);
create table public.order_fulfilments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), variant_id uuid not null references public.variants(id),
 quantity integer not null check(quantity>0), details text not null default '', created_by uuid not null references public.profiles(id),
 created_at timestamptz not null default now()
);
create index fulfilments_order_idx on public.order_fulfilments(order_id,variant_id);
create table public.returns (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), note text not null,
 credit_paise bigint not null default 0, created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
create table public.return_items (
 id uuid primary key default gen_random_uuid(), return_id uuid not null references public.returns(id), variant_id uuid not null references public.variants(id),
 quantity integer not null check(quantity>0), credit_paise bigint not null, unique(return_id,variant_id)
);

create function private.actor_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid() and status='active'
$$;
create function private.actor_customer() returns uuid language sql stable security definer set search_path='' as $$
 select customer_id from public.profiles where id=auth.uid() and status='active' and role='retailer'
$$;
create function private.require_role(allowed text[]) returns text language plpgsql stable security definer set search_path='' as $$
declare r text := private.actor_role(); begin
 if r is null or not (r=any(allowed)) then raise exception 'You do not have permission for this action' using errcode='42501'; end if;
 return r;
end $$;
create function private.can_read_order(oid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.orders o where o.id=oid and
 (private.actor_role() in ('owner','admin','sales','accounts','fulfilment') or o.customer_id=private.actor_customer()))
$$;
create function private.audit(action text,entity uuid,details jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.audit_logs(actor_id,action,entity_id,details) values(auth.uid(),action,entity,details)
$$;
create function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,full_name) values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),160));
 return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.on_signup();

-- Read policies are explicit. No authenticated direct writes are granted.
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or private.actor_role() in ('owner','admin'));
alter table public.customers enable row level security;
create policy customers_read on public.customers for select to authenticated using(private.actor_role() in ('owner','admin','sales','accounts','fulfilment') or id=private.actor_customer());
alter table public.products enable row level security;
create policy products_read on public.products for select to authenticated using(private.actor_role() is not null and (active or private.actor_role()<>'retailer'));
alter table public.variants enable row level security;
create policy variants_read on public.variants for select to authenticated using(private.actor_role() is not null and exists(select 1 from public.products p where p.id=product_id and (p.active or private.actor_role()<>'retailer')));
alter table public.price_lists enable row level security;
create policy lists_read on public.price_lists for select to authenticated using(private.actor_role() in ('owner','admin','sales','accounts') or id in(select price_list_id from public.customers where id=private.actor_customer()));
alter table public.price_list_items enable row level security;
create policy list_items_read on public.price_list_items for select to authenticated using(private.actor_role() in ('owner','admin','sales','accounts') or price_list_id in(select price_list_id from public.customers where id=private.actor_customer()));
alter table public.settings enable row level security;
create policy settings_read on public.settings for select to authenticated using(private.actor_role() is not null);
alter table public.orders enable row level security;
create policy orders_read on public.orders for select to authenticated using(private.can_read_order(id));
alter table public.order_lines enable row level security;
create policy lines_read on public.order_lines for select to authenticated using(private.can_read_order(order_id));
alter table public.payments enable row level security;
create policy payments_read on public.payments for select to authenticated using(private.actor_role() in ('owner','admin','accounts') or (private.actor_role()='retailer' and private.can_read_order(order_id)));
alter table public.stock_movements enable row level security;
create policy stock_read on public.stock_movements for select to authenticated using(private.actor_role() in ('owner','admin','inventory','fulfilment'));
alter table public.audit_logs enable row level security;
create policy audit_read on public.audit_logs for select to authenticated using(private.actor_role() in ('owner','admin'));
alter table public.invoices enable row level security;
create policy invoices_read on public.invoices for select to authenticated using(private.can_read_order(order_id));
alter table public.order_fulfilments enable row level security;
create policy fulfilments_read on public.order_fulfilments for select to authenticated using(private.can_read_order(order_id) or private.actor_role()='inventory');
alter table public.returns enable row level security;
create policy returns_read on public.returns for select to authenticated using(private.can_read_order(order_id));
alter table public.return_items enable row level security;
create policy return_items_read on public.return_items for select to authenticated using(exists(select 1 from public.returns r where r.id=return_id and private.can_read_order(r.order_id)));

create function public.save_customer(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare cid uuid := coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); begin
 perform private.require_role(array['owner','admin','sales']);
 if length(btrim(coalesce(payload->>'name','')))=0 then raise exception 'Customer name is required'; end if;
 if coalesce(payload->>'gstin','')<>'' and not upper(payload->>'gstin') ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then raise exception 'GSTIN format is invalid'; end if;
 if private.actor_role()='sales' and (payload ? 'price_list_id' or payload ? 'credit_days') then
   raise exception 'Only administrators can assign price lists and credit terms' using errcode='42501';
 end if;
 insert into public.customers(id,name,shop_name,email,phone,billing_address,shipping_address,gstin,price_list_id,credit_days)
 values(cid,btrim(payload->>'name'),coalesce(payload->>'shop_name',''),coalesce(payload->>'email',''),coalesce(payload->>'phone',''),coalesce(payload->>'billing_address',''),coalesce(payload->>'shipping_address',''),upper(coalesce(payload->>'gstin','')),nullif(payload->>'price_list_id','')::uuid,coalesce((payload->>'credit_days')::integer,0))
 on conflict(id) do update set name=excluded.name,shop_name=excluded.shop_name,email=excluded.email,phone=excluded.phone,billing_address=excluded.billing_address,shipping_address=excluded.shipping_address,gstin=excluded.gstin,
 price_list_id=case when private.actor_role() in ('owner','admin') then excluded.price_list_id else public.customers.price_list_id end,
 credit_days=case when private.actor_role() in ('owner','admin') then excluded.credit_days else public.customers.credit_days end;
 perform private.audit('customer.saved',cid); return cid;
end $$;
create function public.save_product(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); item jsonb; vid uuid; qty integer; begin
 perform private.require_role(array['owner','admin']);
 if coalesce(payload->>'image_url','')<>'' and not (payload->>'image_url') ~ '^https://' then raise exception 'Product images must use HTTPS'; end if;
 insert into public.products(id,sku,name,category,image_url,mrp_paise,retail_paise,wholesale_paise,active)
 values(pid,btrim(payload->>'sku'),btrim(payload->>'name'),coalesce(payload->>'category',''),coalesce(payload->>'image_url',''),(payload->>'mrp_paise')::bigint,(payload->>'retail_paise')::bigint,(payload->>'wholesale_paise')::bigint,coalesce((payload->>'active')::boolean,true))
 on conflict(id) do update set sku=excluded.sku,name=excluded.name,category=excluded.category,image_url=excluded.image_url,mrp_paise=excluded.mrp_paise,retail_paise=excluded.retail_paise,wholesale_paise=excluded.wholesale_paise,active=excluded.active;
 for item in select value from jsonb_array_elements(coalesce(payload->'variants','[]')) loop
  qty:=coalesce((item->>'stock')::integer,0); vid:=null;
  insert into public.variants(product_id,colour,size,stock) values(pid,btrim(item->>'colour'),item->>'size',qty)
  on conflict(product_id,colour,size) do nothing returning id into vid;
  if vid is not null and qty<>0 then insert into public.stock_movements(variant_id,quantity,kind,note,created_by) values(vid,qty,'opening','Opening stock',auth.uid()); end if;
 end loop;
 perform private.audit('product.saved',pid); return pid;
end $$;

create function public.save_price_list(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare lid uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); item jsonb; begin
 perform private.require_role(array['owner','admin']);
 insert into public.price_lists(id,name) values(lid,btrim(payload->>'name')) on conflict(id) do update set name=excluded.name;
 delete from public.price_list_items where price_list_id=lid;
 for item in select value from jsonb_array_elements(coalesce(payload->'items','[]')) loop
 insert into public.price_list_items(price_list_id,product_id,rate_paise) values(lid,(item->>'product_id')::uuid,(item->>'rate_paise')::bigint);
 end loop;
 perform private.audit('price_list.saved',lid); return lid;
end $$;

create function public.save_order(payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare oid uuid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid()); r text; cust public.customers; cfg public.settings; existing public.orders;
 prod public.products; item jsonb; q record; n integer; qty integer; rate bigint; subtotal bigint:=0; discount bigint:=coalesce((payload->>'discount_paise')::bigint,0); tax bigint; v_colour text;
begin
 r:=private.require_role(array['owner','admin','sales','retailer']);
 if nullif(payload->>'id','') is null then raise exception 'A stable order id is required for safe retries'; end if;
 select * into cust from public.customers where id=(payload->>'customer_id')::uuid for share;
 if not found then raise exception 'Select an existing customer'; end if;
 if r='retailer' and (cust.id is distinct from private.actor_customer() or payload->>'order_type' is distinct from 'wholesale' or discount<>0) then raise exception 'Retailers can only place their own wholesale orders without discounts' using errcode='42501'; end if;
 if jsonb_typeof(payload->'lines') is distinct from 'array' or jsonb_array_length(payload->'lines') not between 1 and 100 then raise exception 'Add between 1 and 100 product rows'; end if;
 if discount<0 then raise exception 'Discount cannot be negative'; end if;
 select * into cfg from public.settings where id=1;
 if cfg.tax_mode<>'none' and not cfg.tax_verified then raise exception 'Tax settings must be verified before applying GST'; end if;
 perform pg_advisory_xact_lock(hashtextextended(oid::text,0));
 select * into existing from public.orders where id=oid for update;
 if r='sales' and discount<>coalesce(existing.discount_paise,0) then raise exception 'Only administrators can authorise discounts' using errcode='42501'; end if;

 if found and (existing.status<>'draft' or (r='retailer' and existing.customer_id is distinct from private.actor_customer())) then raise exception 'Only eligible drafts can be edited' using errcode='42501'; end if;
 if existing.id is not null and payload ? 'updated_at' and (payload->>'updated_at')::timestamptz<>existing.updated_at then raise exception 'This draft changed. Reload it before saving'; end if;
 insert into public.orders(id,customer_id,created_by,order_type,order_date,due_date,transporter,lr_number,lr_date,dispatch_details,notes,customer_snapshot,settings_snapshot,price_list_id)
 values(oid,cust.id,auth.uid(),payload->>'order_type',coalesce(nullif(payload->>'order_date','')::date,current_date),coalesce(nullif(payload->>'due_date','')::date,current_date+cust.credit_days),coalesce(payload->>'transporter',''),coalesce(payload->>'lr_number',''),nullif(payload->>'lr_date','')::date,coalesce(payload->>'dispatch_details',''),coalesce(payload->>'notes',''),to_jsonb(cust),to_jsonb(cfg),cust.price_list_id)
 on conflict(id) do update set customer_id=excluded.customer_id,order_type=excluded.order_type,order_date=excluded.order_date,due_date=excluded.due_date,transporter=excluded.transporter,lr_number=excluded.lr_number,lr_date=excluded.lr_date,dispatch_details=excluded.dispatch_details,notes=excluded.notes,customer_snapshot=excluded.customer_snapshot,settings_snapshot=excluded.settings_snapshot,price_list_id=excluded.price_list_id,updated_at=clock_timestamp();
 delete from public.order_lines where order_id=oid;
 for item in select value from jsonb_array_elements(payload->'lines') loop
  select * into prod from public.products where id=(item->>'product_id')::uuid and active for share;
  if not found then raise exception 'Selected product is inactive or unavailable'; end if;
  v_colour:=item->>'colour'; qty:=0;
  if jsonb_typeof(item->'quantities') is distinct from 'object' then raise exception 'Size quantities are required'; end if;
  for q in select key,value from jsonb_each_text(item->'quantities') loop
   if q.key not in ('30','32','34','36','38','40','42','44') or q.value is null or not q.value ~ '^[0-9]+$' then raise exception 'Quantities must be whole numbers for configured sizes'; end if;
   n:=q.value::integer;
   if n>100000 then raise exception 'A size quantity cannot exceed 100000'; end if;
   if n>0 and not exists(select 1 from public.variants where product_id=prod.id and variants.colour=v_colour and size=q.key) then raise exception 'This colour and size are not in the catalogue'; end if;
   qty:=qty+n;
  end loop;
  if qty=0 then raise exception 'Each product row needs at least one unit'; end if;
  select rate_paise into rate from public.price_list_items where price_list_id=cust.price_list_id and product_id=prod.id;
  rate:=coalesce(rate,case when payload->>'order_type'='wholesale' then prod.wholesale_paise else prod.retail_paise end);
  insert into public.order_lines(order_id,product_id,product_name,sku,colour,quantities,mrp_paise,rate_paise,quantity,amount_paise)
  values(oid,prod.id,prod.name,prod.sku,v_colour,item->'quantities',prod.mrp_paise,rate,qty,rate*qty);
  subtotal:=subtotal+rate*qty;
 end loop;
 if discount>subtotal then raise exception 'Discount exceeds order subtotal'; end if;
 tax:=case when cfg.tax_mode='none' then 0 else round((subtotal-discount)::numeric*cfg.tax_rate_bps/10000)::bigint end;
 update public.orders set subtotal_paise=subtotal,discount_paise=discount,tax_paise=tax,total_paise=subtotal-discount+tax where id=oid;
 perform private.audit('order.saved',oid,jsonb_build_object('total_paise',subtotal-discount+tax)); return oid;
end $$;

-- This function returns ordered variant requirements so callers lock rows consistently.
create function private.order_quantities(oid uuid) returns table(variant_id uuid,quantity integer) language sql stable security definer set search_path='' as $$
 select v.id,sum(q.value::integer)::integer from public.order_lines l
 cross join lateral jsonb_each_text(l.quantities) q join public.variants v on v.product_id=l.product_id and v.colour=l.colour and v.size=q.key
 where l.order_id=oid and q.value::integer>0 group by v.id order by v.id
$$;

create function public.transition_order(p_order_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare r text; o public.orders; q record; v public.variants;
begin
 r:=private.require_role(array['owner','admin','sales','fulfilment','retailer']);
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order was not found'; end if;
 if r='retailer' and (o.customer_id is distinct from private.actor_customer() or p_status not in ('submitted','cancelled') or o.status not in ('draft','submitted')) then raise exception 'This order action requires staff approval' using errcode='42501'; end if;
 if r='sales' and p_status not in ('draft','submitted','confirmed','cancelled') then raise exception 'Fulfilment staff must advance this order' using errcode='42501'; end if;
 if r='fulfilment' and p_status not in ('processing','packed','dispatched','delivered') then raise exception 'This action requires sales or administration permission' using errcode='42501'; end if;
 if o.status=p_status then return; end if;
 if p_status='cancelled' then
  if o.status not in ('draft','submitted','confirmed','processing','packed') then raise exception 'Dispatched orders require a return'; end if;
  if o.paid_paise>0 then raise exception 'Reconcile or refund payments before cancellation'; end if;
  if exists(select 1 from public.order_fulfilments where order_id=o.id) then raise exception 'Partly dispatched orders require a return'; end if;
 elsif not ((o.status='submitted' and p_status='draft' and r in ('owner','admin','sales') and o.paid_paise=0) or (o.status='draft' and p_status='submitted') or (o.status='submitted' and p_status='confirmed') or (o.status='confirmed' and p_status='processing') or (o.status='processing' and p_status='packed') or (o.status='packed' and p_status='dispatched') or (o.status='dispatched' and p_status='delivered')) then
  raise exception 'Invalid order status transition from % to %',o.status,p_status;
 end if;
 if p_status='confirmed' and ((o.settings_snapshot->>'company_verified')::boolean is not true or (o.settings_snapshot->>'tax_verified')::boolean is not true) then raise exception 'Verify business and tax settings, then save this draft again before confirmation'; end if;
 if p_status='submitted' and not exists(select 1 from public.order_lines where order_id=o.id) then raise exception 'An order needs product quantities'; end if;
 if p_status='confirmed' or (p_status='cancelled' and o.status in ('confirmed','processing','packed')) or p_status='dispatched' then
  for q in select * from private.order_quantities(o.id) loop
   select * into v from public.variants where id=q.variant_id for update;
   if p_status='confirmed' then
    if v.stock-v.reserved<q.quantity then raise exception 'Insufficient stock for % size %',v.colour,v.size; end if;
    update public.variants set reserved=reserved+q.quantity where id=v.id;
    insert into public.stock_movements(variant_id,order_id,quantity,kind,created_by) values(v.id,o.id,q.quantity,'reserve',auth.uid());
   elsif p_status='cancelled' then
    update public.variants set reserved=reserved-q.quantity where id=v.id;
    insert into public.stock_movements(variant_id,order_id,quantity,kind,created_by) values(v.id,o.id,-q.quantity,'release',auth.uid());
   else
    q.quantity:=q.quantity-coalesce((select sum(quantity) from public.order_fulfilments where order_id=o.id and variant_id=v.id),0);
    if q.quantity>0 then
     update public.variants set reserved=reserved-q.quantity,stock=stock-q.quantity where id=v.id;
     insert into public.stock_movements(variant_id,order_id,quantity,kind,created_by) values(v.id,o.id,-q.quantity,'dispatch',auth.uid());
     insert into public.order_fulfilments(order_id,variant_id,quantity,details,created_by) values(o.id,v.id,q.quantity,o.dispatch_details,auth.uid());
    end if;
   end if;
  end loop;
 end if;
 update public.orders set status=p_status,updated_at=clock_timestamp() where id=o.id;
 perform private.audit('order.'||p_status,o.id,jsonb_build_object('previous_status',o.status));
end $$;

create function public.record_payment(p_order_id uuid,p_amount_paise bigint,p_method text,p_reference text default '',p_paid_at date default current_date,p_request_id uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; pid uuid; prior public.payments; begin
 perform private.require_role(array['owner','admin','accounts']);
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'Order was not found'; end if;
 if p_request_id is null then raise exception 'A payment request id is required for safe retries'; end if;
 select * into prior from public.payments where request_id=p_request_id;
 if found then
  if prior.order_id<>p_order_id or prior.amount_paise<>p_amount_paise or prior.method<>p_method or prior.reference<>coalesce(p_reference,'') or prior.paid_at<>p_paid_at then raise exception 'Payment request id was already used with different details'; end if;
  return prior.id;
 end if;
 if o.status in ('draft','cancelled') then raise exception 'Payments require a submitted, active order'; end if;
 if p_amount_paise is null or p_amount_paise<=0 or p_amount_paise>greatest(o.total_paise-o.credit_paise-o.paid_paise,0) then raise exception 'Payment must be positive and no larger than the outstanding amount'; end if;
 if p_paid_at is null or p_paid_at>current_date then raise exception 'Payment date cannot be in the future'; end if;
 insert into public.payments(order_id,amount_paise,method,reference,paid_at,created_by,request_id) values(o.id,p_amount_paise,p_method,coalesce(p_reference,''),p_paid_at,auth.uid(),p_request_id) returning id into pid;
 update public.orders set paid_paise=paid_paise+p_amount_paise,updated_at=clock_timestamp() where id=o.id;
 perform private.audit('payment.recorded',pid,jsonb_build_object('order_id',o.id,'amount_paise',p_amount_paise)); return pid;
end $$;

create function public.adjust_stock(p_variant_id uuid,p_quantity integer,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare v public.variants; begin
 perform private.require_role(array['owner','admin','inventory']);
 if p_quantity is null or p_quantity=0 or abs(p_quantity::bigint)>10000000 or length(btrim(coalesce(p_note,'')))<3 then raise exception 'Provide a nonzero adjustment and a reason'; end if;
 select * into v from public.variants where id=p_variant_id for update;
 if not found then raise exception 'Inventory variant was not found'; end if;
 if v.stock+p_quantity<v.reserved then raise exception 'Stock cannot fall below reserved units'; end if;
 update public.variants set stock=stock+p_quantity where id=v.id;
 insert into public.stock_movements(variant_id,quantity,kind,note,created_by) values(v.id,p_quantity,'adjustment',p_note,auth.uid());
 perform private.audit('stock.adjusted',v.id,jsonb_build_object('quantity',p_quantity,'note',p_note));
end $$;

create function public.update_profile(p_user_id uuid,p_role text,p_status text,p_customer_id uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare r text; target public.profiles; begin
 r:=private.require_role(array['owner','admin']);
 -- Lock owner rows before the target so concurrent demotions cannot remove every owner.
 perform id from public.profiles where role='owner' and status='active' order by id for update;
 select * into target from public.profiles where id=p_user_id for update;
 if not found then raise exception 'Account was not found'; end if;
 if r='admin' and (target.role in ('owner','admin') or p_role in ('owner','admin')) then raise exception 'Only an owner can manage administrator accounts' using errcode='42501'; end if;
 if target.role='owner' and target.status='active' and (p_role<>'owner' or p_status<>'active') and not exists(select 1 from public.profiles where role='owner' and status='active' and id<>target.id) then raise exception 'The last active owner cannot be removed'; end if;
 if p_role='retailer' and p_status='active' and p_customer_id is null then raise exception 'Assign a customer profile before approving a retailer'; end if;
 update public.profiles set role=p_role,status=p_status,customer_id=case when p_role='retailer' then p_customer_id else null end where id=target.id;
 perform private.audit('account.updated',target.id,jsonb_build_object('role',p_role,'status',p_status,'customer_id',p_customer_id));
end $$;

create function public.save_settings(payload jsonb) returns void language plpgsql security definer set search_path='' as $$
declare cfg public.settings; labels jsonb; k text; begin
 perform private.require_role(array['owner','admin']);
 select * into cfg from public.settings where id=1 for update;
 cfg.company_name:=coalesce(payload->>'company_name',cfg.company_name);
 cfg.business_address:=coalesce(payload->>'business_address',cfg.business_address);
 cfg.gstin:=upper(coalesce(payload->>'gstin',cfg.gstin));
 cfg.company_verified:=coalesce((payload->>'company_verified')::boolean,cfg.company_verified);
 cfg.tax_verified:=coalesce((payload->>'tax_verified')::boolean,cfg.tax_verified);
 cfg.tax_mode:=coalesce(payload->>'tax_mode',cfg.tax_mode);
 cfg.tax_rate_bps:=coalesce((payload->>'tax_rate_bps')::integer,cfg.tax_rate_bps);
 if cfg.company_verified and (length(btrim(cfg.company_name))<3 or length(btrim(cfg.business_address))<5) then raise exception 'Verified company name and business address are required'; end if;
 if cfg.tax_verified and (not cfg.company_verified or not cfg.gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$') then raise exception 'Verify company details and enter a valid GSTIN before verifying tax settings'; end if;
 if cfg.tax_mode='none' and cfg.tax_rate_bps<>0 then raise exception 'Tax rate must be zero when GST is not configured'; end if;
 if cfg.tax_mode<>'none' and (not cfg.tax_verified or cfg.tax_rate_bps<=0) then raise exception 'GST requires a verified positive tax rate'; end if;
 labels:=coalesce(payload->'size_labels',cfg.size_labels);
 if jsonb_typeof(labels)<>'object' or (select count(*) from jsonb_object_keys(labels))<>8 then raise exception 'Provide labels for all eight size columns'; end if;
 foreach k in array array['30','32','34','36','38','40','42','44'] loop
  if not labels ? k or length(btrim(labels->>k)) not between 1 and 24 then raise exception 'Each size label must contain 1 to 24 characters'; end if;
 end loop;
 update public.settings set company_name=cfg.company_name,business_address=cfg.business_address,gstin=cfg.gstin,company_verified=cfg.company_verified,tax_verified=cfg.tax_verified,tax_mode=cfg.tax_mode,tax_rate_bps=cfg.tax_rate_bps,size_labels=labels,payment_terms=coalesce(payload->>'payment_terms',cfg.payment_terms),bank_details=coalesce(payload->>'bank_details',cfg.bank_details),updated_at=clock_timestamp() where id=1;
 perform private.audit('settings.updated',null);
end $$;

create function public.issue_invoice(p_order_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; cfg public.settings; iid uuid; lines jsonb; begin
 perform private.require_role(array['owner','admin','accounts']);
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status not in ('confirmed','processing','packed','dispatched','delivered') then raise exception 'Confirm the order before issuing a tax invoice'; end if;
 select id into iid from public.invoices where order_id=o.id;
 if found then return iid; end if;
 select * into cfg from public.settings where id=1;
 if not cfg.company_verified or not cfg.tax_verified or cfg.tax_mode='none' or not cfg.gstin ~ '^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$' then raise exception 'Tax invoices are locked until company details and GST settings are verified'; end if;
 if (o.settings_snapshot->>'tax_verified')::boolean is not true or o.settings_snapshot->>'tax_mode'='none' then raise exception 'This order was created without verified tax settings and cannot become a tax invoice'; end if;
 if cfg.gstin is distinct from o.settings_snapshot->>'gstin' or cfg.tax_mode is distinct from o.settings_snapshot->>'tax_mode' or cfg.tax_rate_bps is distinct from (o.settings_snapshot->>'tax_rate_bps')::integer then raise exception 'Tax configuration changed since this order. Accounts must reconcile it before invoicing'; end if;
 if o.credit_paise>0 then raise exception 'Returned orders require an accounts review before invoicing'; end if;
 select jsonb_agg(to_jsonb(l) order by l.id) into lines from public.order_lines l where order_id=o.id;
 insert into public.invoices(order_id,snapshot) values(o.id,jsonb_build_object('order',to_jsonb(o),'lines',lines,'issuer',to_jsonb(cfg),'issued_by',auth.uid(),'issued_at',now())) returning id into iid;
 perform private.audit('invoice.issued',iid,jsonb_build_object('order_id',o.id)); return iid;
end $$;

create function public.dispatch_order(p_order_id uuid,p_items jsonb,p_details text default '') returns void language plpgsql security definer set search_path='' as $$
declare o public.orders; item record; v public.variants; ordered integer; fulfilled integer; remaining integer; begin
 perform private.require_role(array['owner','admin','fulfilment']);
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status<>'packed' then raise exception 'Only packed orders can be dispatched'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 800 then raise exception 'Select shipment quantities'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where not coalesce(x->>'quantity','') ~ '^[1-9][0-9]*$') then raise exception 'Shipment quantities must be positive whole numbers'; end if;
 for item in select (x->>'variant_id')::uuid vid,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) x group by (x->>'variant_id')::uuid order by (x->>'variant_id')::uuid loop
  select * into v from public.variants where id=item.vid for update;
  select quantity into ordered from private.order_quantities(o.id) where variant_id=item.vid;
  select coalesce(sum(quantity),0) into fulfilled from public.order_fulfilments where order_id=o.id and variant_id=item.vid;
  if ordered is null or item.qty>ordered-fulfilled then raise exception 'Shipment exceeds the remaining ordered quantity'; end if;
  update public.variants set stock=stock-item.qty,reserved=reserved-item.qty where id=v.id;
  insert into public.order_fulfilments(order_id,variant_id,quantity,details,created_by) values(o.id,v.id,item.qty,coalesce(p_details,''),auth.uid());
  insert into public.stock_movements(variant_id,order_id,quantity,kind,note,created_by) values(v.id,o.id,-item.qty,'dispatch',coalesce(p_details,''),auth.uid());
 end loop;
 select coalesce(sum(q.quantity-coalesce(f.qty,0)),0) into remaining from private.order_quantities(o.id) q left join (select variant_id,sum(quantity) qty from public.order_fulfilments where order_id=o.id group by variant_id) f using(variant_id);
 update public.orders set status=case when remaining=0 then 'dispatched' else 'packed' end,dispatch_details=coalesce(p_details,''),updated_at=clock_timestamp() where id=o.id;
 perform private.audit('order.shipment',o.id,jsonb_build_object('remaining_units',remaining,'items',p_items));
end $$;

create function public.record_return(p_order_id uuid,p_items jsonb,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare o public.orders; item record; v public.variants; delivered integer; previous integer; rate bigint; rid uuid; credit bigint:=0; item_credit bigint; base bigint; previous_base bigint; begin
 perform private.require_role(array['owner','admin','inventory']);
 select * into o from public.orders where id=p_order_id for update;
 if not found or o.status not in ('packed','dispatched','delivered') then raise exception 'Only dispatched items can be returned'; end if;
 if length(btrim(coalesce(p_note,'')))<3 then raise exception 'A return reason is required'; end if;
 if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 800 then raise exception 'Select returned quantities'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) x where not coalesce(x->>'quantity','') ~ '^[1-9][0-9]*$') then raise exception 'Return quantities must be positive whole numbers'; end if;
 insert into public.returns(order_id,note,created_by) values(o.id,p_note,auth.uid()) returning id into rid;
 for item in select (x->>'variant_id')::uuid vid,sum((x->>'quantity')::integer)::integer qty from jsonb_array_elements(p_items) x group by (x->>'variant_id')::uuid order by (x->>'variant_id')::uuid loop
  select * into v from public.variants where id=item.vid for update;
  select coalesce(sum(quantity),0) into delivered from public.order_fulfilments where order_id=o.id and variant_id=item.vid;
  select coalesce(sum(i.quantity),0) into previous from public.return_items i join public.returns r on r.id=i.return_id where r.order_id=o.id and i.variant_id=item.vid;
  if item.qty>delivered-previous then raise exception 'Return exceeds dispatched units not already returned'; end if;
  select rate_paise into rate from public.order_lines where order_id=o.id and product_id=v.product_id and colour=v.colour;
  base:=rate*item.qty;
  -- Credit includes the proportional order discount and tax, capped at the original order value.
  select coalesce(sum(i.quantity*l.rate_paise),0) into previous_base from public.return_items i join public.returns r on r.id=i.return_id join public.variants v2 on v2.id=i.variant_id join public.order_lines l on l.order_id=r.order_id and l.product_id=v2.product_id and l.colour=v2.colour where r.order_id=o.id;
  item_credit:=case when o.subtotal_paise=0 then 0 else round((previous_base+base)::numeric*o.total_paise/o.subtotal_paise)::bigint-o.credit_paise-credit end;
  item_credit:=least(item_credit,o.total_paise-o.credit_paise-credit);
  insert into public.return_items(return_id,variant_id,quantity,credit_paise) values(rid,v.id,item.qty,item_credit);
  update public.variants set stock=stock+item.qty where id=v.id;
  insert into public.stock_movements(variant_id,order_id,quantity,kind,note,created_by) values(v.id,o.id,item.qty,'return',p_note,auth.uid());
  credit:=credit+item_credit;
 end loop;
 update public.returns set credit_paise=credit where id=rid;
 update public.orders set credit_paise=credit_paise+credit,updated_at=clock_timestamp() where id=o.id;
 perform private.audit('order.returned',rid,jsonb_build_object('order_id',o.id,'credit_paise',credit)); return rid;
end $$;

create table public.internal_order_notes (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id), note text not null check(length(note) between 1 and 5000),
 created_by uuid not null references public.profiles(id), created_at timestamptz not null default now()
);
alter table public.internal_order_notes enable row level security;
create policy internal_notes_read on public.internal_order_notes for select to authenticated using(private.actor_role() in ('owner','admin','sales','accounts','fulfilment'));
create function public.add_internal_note(p_order_id uuid,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare nid uuid; begin
 perform private.require_role(array['owner','admin','sales','accounts','fulfilment']);
 insert into public.internal_order_notes(order_id,note,created_by) values(p_order_id,btrim(p_note),auth.uid()) returning id into nid;
 perform private.audit('order.note_added',p_order_id); return nid;
end $$;

revoke all on all tables in schema public from anon,authenticated;
grant select on public.profiles,public.customers,public.products,public.variants,public.price_lists,public.price_list_items,public.settings,public.orders,public.order_lines,public.payments,public.stock_movements,public.audit_logs,public.invoices,public.order_fulfilments,public.returns,public.return_items,public.internal_order_notes to authenticated;
revoke all on all sequences in schema public from anon,authenticated;
revoke execute on all functions in schema private from public,anon,authenticated;
grant execute on function private.actor_role(),private.actor_customer(),private.can_read_order(uuid) to authenticated;
revoke execute on function public.save_customer(jsonb),public.save_product(jsonb),public.save_price_list(jsonb),public.save_order(jsonb),public.transition_order(uuid,text),public.record_payment(uuid,bigint,text,text,date,uuid),public.adjust_stock(uuid,integer,text),public.update_profile(uuid,text,text,uuid),public.save_settings(jsonb),public.issue_invoice(uuid),public.dispatch_order(uuid,jsonb,text),public.record_return(uuid,jsonb,text),public.add_internal_note(uuid,text) from public,anon;
grant execute on function public.save_customer(jsonb),public.save_product(jsonb),public.save_price_list(jsonb),public.save_order(jsonb),public.transition_order(uuid,text),public.record_payment(uuid,bigint,text,text,date,uuid),public.adjust_stock(uuid,integer,text),public.update_profile(uuid,text,text,uuid),public.save_settings(jsonb),public.issue_invoice(uuid),public.dispatch_order(uuid,jsonb,text),public.record_return(uuid,jsonb,text),public.add_internal_note(uuid,text) to authenticated;
commit;
