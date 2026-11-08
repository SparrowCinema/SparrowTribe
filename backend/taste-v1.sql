-- Run once in the existing Supabase project's SQL editor. No private passport
-- table is altered. Clients receive aggregates only; ballots and access keys
-- cannot be read through the Data API. Re-running is safe.
begin;
create schema if not exists sparrow_taste;
revoke all on schema sparrow_taste from public, anon, authenticated;
create table if not exists sparrow_taste.settings(id boolean primary key default true check(id), salt text not null);
insert into sparrow_taste.settings values(true,gen_random_uuid()::text||gen_random_uuid()::text) on conflict do nothing;
create table if not exists sparrow_taste.films(id text primary key);
create table if not exists sparrow_taste.ballots(
 voter text not null, film text not null references sparrow_taste.films(id),
 fun smallint check(fun between 0 and 5), bore smallint check(bore between 0 and 5),
 revision bigint not null check(revision>=0), updated_at timestamptz not null default now(),
 primary key(voter,film)
);
create index if not exists ballots_film on sparrow_taste.ballots(film);
create table if not exists sparrow_taste.limits(bucket text primary key, started timestamptz not null, n integer not null);
alter table sparrow_taste.settings enable row level security;
alter table sparrow_taste.films enable row level security;
alter table sparrow_taste.ballots enable row level security;
alter table sparrow_taste.limits enable row level security;
revoke all on all tables in schema sparrow_taste from public,anon,authenticated;

create or replace function public.st_taste_read(films text[] default null)
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('version',1,'minimum',3,'films',coalesce(jsonb_agg(s order by s->>'id'),'[]'::jsonb)) from (
  select jsonb_build_object('id',f.id,'funN',count(b.fun),'funAvg',case when count(b.fun)>=3 then round(avg(b.fun),2) end,
   'boreN',count(b.bore),'boreAvg',case when count(b.bore)>=3 then round(avg(b.bore),2) end,
   'pairN',count(*) filter(where b.fun is not null and b.bore is not null),
   'pairFun',case when count(*) filter(where b.fun is not null and b.bore is not null)>=3 then round(avg(b.fun) filter(where b.bore is not null),2) end,
   'pairBore',case when count(*) filter(where b.fun is not null and b.bore is not null)>=3 then round(avg(b.bore) filter(where b.fun is not null),2) end) s
  from (select id from sparrow_taste.films where $1 is null or id=any($1) order by id limit 500) f
  left join sparrow_taste.ballots b on b.film=f.id group by f.id
 ) x;
$$;

create or replace function public.st_taste_vote(code text,film text,fun integer,bore integer,revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare salt text; v_voter text; source text; profile jsonb; ballot jsonb; old_revision bigint; k text; n integer; tick timestamptz:=clock_timestamp();
begin
 if code is null or code !~ '^SP-([A-Z2-9]{4}-){5}[A-Z2-9]{4}$' or film is null or film !~ '^[A-Za-z0-9_-]{1,80}$'
   or revision is null or revision<0 or revision>9007199254740991 or fun not between 0 and 5 or bore not between 0 and 5 then
  raise exception 'Invalid taste vote' using errcode='22023';
 end if;
 if not exists(select 1 from sparrow_taste.films f where f.id=film) then raise exception 'Unknown film' using errcode='22023';end if;
 select s.salt into salt from sparrow_taste.settings s where id=true;
 v_voter:=encode(sha256(convert_to(salt||code,'UTF8')),'hex');
 source:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-forwarded-for';
 source:=encode(sha256(convert_to(salt||coalesce(split_part(source,',',1),'direct'),'UTF8')),'hex');
 -- Transaction locks make rate limits and replacement votes race-safe.
 perform pg_advisory_xact_lock(hashtextextended(v_voter,0));
 select b.revision into old_revision from sparrow_taste.ballots b where b.voter=v_voter and b.film=st_taste_vote.film;
 if old_revision>revision then return jsonb_build_object('ok',false,'reason','stale');end if;
 if old_revision=revision then
  if exists(select 1 from sparrow_taste.ballots b where b.voter=v_voter and b.film=st_taste_vote.film and b.fun is not distinct from st_taste_vote.fun and b.bore is not distinct from st_taste_vote.bore) then
   return jsonb_build_object('ok',true,'summary',(public.st_taste_read(array[film])->'films')->0);
  end if;
  return jsonb_build_object('ok',false,'reason','stale');
 end if;
 -- Salted source + profile quotas mitigate casual abuse; no raw IP is stored.
 foreach k in array array['v:'||v_voter||':'||date_trunc('minute',tick)::text,'ip:'||source||':'||date_trunc('minute',tick)::text,'day:'||v_voter||':'||date_trunc('day',tick)::text] loop
  insert into sparrow_taste.limits as l values(k,tick,1) on conflict(bucket) do update set n=l.n+1 returning l.n into n;
  if n>(case when k like 'ip:%' then 300 when k like 'day:%' then 180 else 20 end) then
   return jsonb_build_object('ok',false,'reason','rate_limited');
  end if;
 end loop;
 -- A bearer sync code must own a real passport; unknown codes do not create
 -- voters. Only proof of a watched record is checked, never returned or stored.
 profile:=public.mg_pull(code)::jsonb;
 if profile->'data' is null or profile->'data'='null'::jsonb then raise exception 'Connect a passport first' using errcode='42501';end if;
 ballot:=profile#>array['data','watched',film];
 if (fun is not null or bore is not null) and (ballot is null or ballot->>'d' is null or ballot->>'del'='1') then
  raise exception 'Mark film watched and sync first' using errcode='42501';
 end if;
 -- Null/null is a withdrawal. Retain only a version tombstone for idempotency.
 insert into sparrow_taste.ballots as b values(v_voter,film,fun,bore,revision,tick)
 on conflict on constraint ballots_pkey do update set fun=excluded.fun,bore=excluded.bore,revision=excluded.revision,updated_at=excluded.updated_at;
 delete from sparrow_taste.limits l where l.started<tick-interval '2 days';
 return jsonb_build_object('ok',true,'summary',(public.st_taste_read(array[film])->'films')->0);
end;
$$;
revoke all on function public.st_taste_read(text[]) from public,anon,authenticated;
revoke all on function public.st_taste_vote(text,text,integer,integer,bigint) from public,anon,authenticated;
grant execute on function public.st_taste_read(text[]), public.st_taste_vote(text,text,integer,integer,bigint) to anon,authenticated;
commit;
