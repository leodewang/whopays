-- Applied to hosted Supabase with apply_migration; no client has table access.
create schema if not exists whopays_private;
revoke all on schema whopays_private from public, anon, authenticated;
grant usage on schema whopays_private to service_role;
create table whopays_private.groups (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 60),
 owner_hash text not null check (owner_hash ~ '^[a-f0-9]{64}$'),
 member_hash text not null check (member_hash ~ '^[a-f0-9]{64}$'),
 currency text not null default 'USD' check (currency = 'USD')
);
create table whopays_private.rounds (
 group_id uuid not null references whopays_private.groups(id),
 id uuid not null,
 dinner_id uuid not null,
 game text not null check(game in ('Croc Roulette','Reaction Duel','Card Draw','Finger Pick','PLO Showdown')),
 entries jsonb not null check(jsonb_typeof(entries)='array'),
 created_at timestamptz not null default now(),
 voided_at timestamptz,
 replaces uuid,
 unique(group_id,replaces),
 foreign key(group_id,replaces) references whopays_private.rounds(group_id,id),
 primary key(group_id,id)
);
create index rounds_group_dinner on whopays_private.rounds(group_id,dinner_id,created_at desc);
create index rounds_group_recent on whopays_private.rounds(group_id,created_at desc);
create table whopays_private.request_limits (
 group_id uuid primary key references whopays_private.groups(id),
 window_start timestamptz not null,
 count integer not null
);
alter table whopays_private.groups enable row level security;
alter table whopays_private.rounds enable row level security;
alter table whopays_private.request_limits enable row level security;
revoke all on all tables in schema whopays_private from public, anon, authenticated;
grant select, insert, update on all tables in schema whopays_private to service_role;

-- Only the authenticated server calls this SECURITY INVOKER RPC.
-- No SECURITY DEFINER, no public/anon/authenticated execution grant.
create function public.whopays_api(p_group uuid, p_hash text, p_action text, p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
 g whopays_private.groups%rowtype;
 r whopays_private.rounds%rowtype;
 owner boolean; n integer; e jsonb; cleaned jsonb := '[]';
 nm text; nk text; keys text[] := '{}'; outcome text; cents bigint;
 winners integer := 0; losers integer := 0; ties integer := 0;
 rid uuid; did uuid; result jsonb; board jsonb; recent jsonb;
begin
 select * into g from whopays_private.groups where id=p_group;
 if not found or p_hash is null or (p_hash<>g.owner_hash and p_hash<>g.member_hash) then
   raise exception using errcode='P0001',message='Access denied';
 end if;
 owner := p_hash=g.owner_hash;
 insert into whopays_private.request_limits values(p_group,date_trunc('minute',now()),1)
 on conflict(group_id) do update set
 count=case when whopays_private.request_limits.window_start=excluded.window_start then whopays_private.request_limits.count+1 else 1 end,
 window_start=excluded.window_start returning count into n;
 if n>120 then return jsonb_build_object('error','Too many requests. Try again in a minute.','status',429); end if;
 if p_action='record' then
   rid := (p_data->>'id')::uuid; did := (p_data->>'dinner_id')::uuid;
   if rid is null or did is null or p_data->>'game' is null or p_data->>'game' not in ('Croc Roulette','Reaction Duel','Card Draw','Finger Pick','PLO Showdown') then raise exception 'Invalid round'; end if;
   if jsonb_typeof(p_data->'entries') is distinct from 'array' then raise exception 'Invalid players'; end if;
   if jsonb_array_length(p_data->'entries') not between 2 and 8 then raise exception 'Need 2–8 players'; end if;
   for e in select value from jsonb_array_elements(p_data->'entries') loop
     if jsonb_typeof(e->'name') is distinct from 'string' then raise exception 'Invalid name'; end if;
     nm := trim(regexp_replace(normalize(e->>'name',NFC),'[[:space:]]+',' ','g')); nk := lower(nm);
     if length(nm) not between 1 and 40 or nm ~ '[[:cntrl:]]' then raise exception 'Names must be 1–40 characters'; end if;
     if nk=any(keys) then raise exception 'Use distinct player names'; end if;
     keys := array_append(keys,nk); outcome := e->>'outcome';
     if outcome is null or outcome not in ('win','loss','tie') then raise exception 'Invalid outcome'; end if;
     if jsonb_typeof(e->'cents') is distinct from 'number' or (e->>'cents') !~ '^[0-9]+$' then raise exception 'Invalid amount'; end if;
     cents := (e->>'cents')::bigint;
     if cents>100000000 or (outcome<>'loss' and cents<>0) then raise exception 'Invalid amount'; end if;
     winners := winners + (outcome='win')::int; losers := losers + (outcome='loss')::int; ties := ties + (outcome='tie')::int;
     cleaned := cleaned || jsonb_build_array(jsonb_build_object('name',nm,'key',nk,'outcome',outcome,'cents',cents));
   end loop;
   if p_data->>'game'<>'PLO Showdown' then
     if losers<>1 or winners<>array_length(keys,1)-1 then raise exception 'Dinner games need exactly one loser'; end if;
   elsif not ((winners>=1 and losers>=1 and ties=0) or ties=array_length(keys,1)) then raise exception 'Invalid poker outcome'; end if;
   if p_data->>'replaces' is not null then
     if not owner then raise exception 'Owner access required'; end if;
     if (p_data->>'replaces')::uuid=rid then raise exception 'Invalid replacement'; end if;
     perform 1 from whopays_private.rounds where group_id=p_group and id=(p_data->>'replaces')::uuid;
     if not found then raise exception 'Round not found'; end if;
   end if;
   insert into whopays_private.rounds(group_id,id,dinner_id,game,entries,replaces) values(p_group,rid,did,p_data->>'game',cleaned,(p_data->>'replaces')::uuid)
   on conflict(group_id,id) do nothing;
   select * into r from whopays_private.rounds where group_id=p_group and id=rid;
   if r.dinner_id<>did or r.game<>p_data->>'game' or r.entries<>cleaned or r.replaces is distinct from (p_data->>'replaces')::uuid then raise exception 'Round already saved with different details'; end if;
   if r.voided_at is not null then raise exception 'Round was voided'; end if;
   if r.replaces is not null then update whopays_private.rounds set voided_at=coalesce(voided_at,now()) where group_id=p_group and id=r.replaces; end if;
   return jsonb_build_object('saved',true);
 elsif p_action='void' then
   if not owner then raise exception 'Owner access required'; end if;
   update whopays_private.rounds set voided_at=coalesce(voided_at,now()) where group_id=p_group and id=(p_data->>'id')::uuid;
   if not found then raise exception 'Round not found'; end if;
   return jsonb_build_object('voided',true);
 elsif p_action='rotate' then
   if not owner then raise exception 'Owner access required'; end if;
   if p_data->>'member_hash' is null or (p_data->>'member_hash') !~ '^[a-f0-9]{64}$' then raise exception 'Invalid key'; end if;
   update whopays_private.groups set member_hash=p_data->>'member_hash' where id=p_group;
   return jsonb_build_object('rotated',true);
 elsif p_action<>'read' then raise exception 'Unknown action';
 end if;
 did := nullif(p_data->>'dinner_id','')::uuid;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.losses desc,x.cents desc,x.name),'[]') into board from (
   select elem.value->>'key' as key,min(elem.value->>'name') as name,
     count(*) filter(where elem.value->>'outcome'='win') as wins,
     count(*) filter(where elem.value->>'outcome'='loss') as losses,
     count(*) filter(where elem.value->>'outcome'='tie') as ties,
     sum((elem.value->>'cents')::bigint) as cents
   from whopays_private.rounds rr cross join lateral jsonb_array_elements(rr.entries) elem(value)
   where rr.group_id=p_group and rr.voided_at is null and (did is null or rr.dinner_id=did)
     and ((coalesce(p_data->>'mode','dinner')='plo' and rr.game='PLO Showdown') or (coalesce(p_data->>'mode','dinner')='dinner' and rr.game<>'PLO Showdown'))
   group by elem.value->>'key'
 ) x;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc),'[]') into recent from (
   select id,dinner_id,game,entries,created_at,voided_at from whopays_private.rounds
   where group_id=p_group and (did is null or dinner_id=did)
     and ((coalesce(p_data->>'mode','dinner')='plo' and game='PLO Showdown') or (coalesce(p_data->>'mode','dinner')='dinner' and game<>'PLO Showdown'))
   order by created_at desc limit 30
 ) x;
 return jsonb_build_object('name',g.name,'currency',g.currency,'owner',owner,'board',board,'recent',recent);
end $$;
revoke all on function public.whopays_api(uuid,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.whopays_api(uuid,text,text,jsonb) to service_role;
