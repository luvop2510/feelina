begin;
alter table public.profiles add column username text;
alter table public.profiles add column provisioned_at timestamptz;
alter table public.profiles add column partner_type text not null default 'retailer' check(partner_type in ('staff','retailer','distributor','investor','other'));
alter table public.profiles add column must_change_password boolean not null default false;
alter table public.profiles add constraint username_format check(username is null or username ~ '^[a-z0-9_.-]{3,40}$');
create unique index profiles_username_unique on public.profiles(username) where username is not null;
update public.profiles set partner_type='staff' where role<>'retailer';

-- Only the identity's own profile is readable before replacing an issued password.
create or replace function private.actor_role() returns text language sql stable security definer set search_path='' as $$
 select role from public.profiles where id=auth.uid() and status='active' and not must_change_password
$$;
create or replace function private.actor_customer() returns uuid language sql stable security definer set search_path='' as $$
 select customer_id from public.profiles where id=auth.uid() and status='active' and role='retailer' and not must_change_password
$$;

-- app metadata is set by the trusted Auth Admin API, never by self-service signup.
create or replace function private.on_signup() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.profiles(id,email,full_name,must_change_password)
 values(new.id,coalesce(new.email,''),left(coalesce(new.raw_user_meta_data->>'full_name',''),160),
 coalesce((new.raw_app_meta_data->>'feelina_password_issued')::boolean,false));
 return new;
end $$;
-- Only the server may acknowledge a successful authenticated Auth password update.
create function public.complete_initial_password_change(p_user_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 update public.profiles set must_change_password=false where id=p_user_id and must_change_password;
 if found then
  insert into public.audit_logs(actor_id,action,entity_id,details) values(p_user_id,'account.initial_password_replaced',p_user_id,'{}');
 end if;
end $$;
revoke all on function public.complete_initial_password_change(uuid) from public,anon,authenticated;
grant execute on function public.complete_initial_password_change(uuid) to service_role;

create function public.manage_team_user(p_user_id uuid,p_username text,p_partner_type text,p_full_name text,p_role text,p_status text,p_customer_id uuid default null,p_only_if_unconfigured boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare uname text := nullif(lower(btrim(p_username)),'');
begin
 perform private.require_role(array['owner','admin']);
 perform id from public.profiles where role='owner' and status='active' order by id for update;
 perform id from public.profiles where id=p_user_id for update;
 if p_only_if_unconfigured and exists(select 1 from public.profiles where id=p_user_id and provisioned_at is not null) then return; end if;
 if uname is not null and uname !~ '^[a-z0-9_.-]{3,40}$' then raise exception 'Username must contain 3–40 letters, numbers, dots, underscores or hyphens'; end if;
 if p_full_name is null or length(btrim(p_full_name)) not between 1 and 160 then raise exception 'Provide a name up to 160 characters'; end if;
 if p_partner_type is null or p_partner_type not in ('staff','retailer','distributor','investor','other') then raise exception 'Choose a valid partner category'; end if;
 if p_role is null or p_role not in ('owner','admin','sales','inventory','accounts','fulfilment','retailer') or p_status is null or p_status not in ('pending','active','suspended','deactivated') then raise exception 'Choose a valid role and account status'; end if;
 -- Existing authorization, owner locking, customer-link and last-owner checks apply atomically.
 perform public.update_profile(p_user_id,p_role,p_status,p_customer_id);
 update public.profiles set username=uname,partner_type=p_partner_type,full_name=btrim(p_full_name),provisioned_at=coalesce(provisioned_at,now()) where id=p_user_id;
 perform private.audit('account.directory_updated',p_user_id,jsonb_build_object('username',uname,'partner_type',p_partner_type));
end $$;
revoke all on function public.manage_team_user(uuid,text,text,text,text,text,uuid,boolean) from public,anon;
grant execute on function public.manage_team_user(uuid,text,text,text,text,text,uuid,boolean) to authenticated;
commit;
