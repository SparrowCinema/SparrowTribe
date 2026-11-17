-- 麻雀观影护照 · 使用统计 V1（2026-11-16）
-- 匿名、按天汇总：不记录 IP、搜索词或任何个人档案内容。
-- 访客标识由客户端每天重新随机生成，只用来数当天有多少台设备，跨天无法关联。
-- 原始事件不落库，只按「日期 × 平台 × 事件 × 键」累加次数。可重复执行。
begin;
create schema if not exists sparrow_stats;
revoke all on schema sparrow_stats from public, anon, authenticated;

create table if not exists sparrow_stats.daily(
  day date not null, platform text not null, ev text not null, key text not null default '',
  n integer not null default 0,
  primary key(day, platform, ev, key)
);
create table if not exists sparrow_stats.visitors(
  day date not null, platform text not null, vid text not null,
  primary key(day, platform, vid)
);
alter table sparrow_stats.daily enable row level security;
alter table sparrow_stats.visitors enable row level security;
revoke all on all tables in schema sparrow_stats from public, anon, authenticated;

-- 上报：p = 'web' | 'mini'；vid = 当天的随机标识；evs = [{e:事件, k:键}]，一次最多 60 条
create or replace function public.ss_hit(p text, vid text, evs jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  d date := (now() at time zone 'Asia/Shanghai')::date;
  e jsonb; ev text; k text; c integer := 0;
begin
  if p is null or p not in ('web', 'mini') or vid is null or vid !~ '^[a-z0-9]{8,32}$'
     or evs is null or jsonb_typeof(evs) <> 'array' then
    return 0;
  end if;
  insert into sparrow_stats.visitors values (d, p, vid) on conflict do nothing;
  for e in select value from jsonb_array_elements(evs) limit 60 loop
    if jsonb_typeof(e) <> 'object' then continue; end if;
    ev := e->>'e';
    k := coalesce(left(e->>'k', 80), '');
    if ev is null or ev !~ '^(pv|film|prog|plan_add|plan_remove|want|watched|share|export|remind|sync_link|search)$' then continue; end if;
    if k !~ '^[A-Za-z0-9_:.\-]{0,80}$' then k := ''; end if;
    insert into sparrow_stats.daily values (d, p, ev, k, 1)
      on conflict (day, platform, ev, key) do update set n = sparrow_stats.daily.n + 1;
    c := c + 1;
  end loop;
  return c;
end $$;
revoke all on function public.ss_hit(text, text, jsonb) from public;
grant execute on function public.ss_hit(text, text, jsonb) to anon, authenticated;

-- 汇总：最近 days 天（1–180）的每日访客数、每日事件次数、各事件前 20 个键。只返回汇总数字。
create or replace function public.ss_summary(days integer default 30)
returns jsonb language sql stable security definer set search_path = '' as $$
  with since as (
    select (now() at time zone 'Asia/Shanghai')::date - greatest(1, least(coalesce(days, 30), 180)) + 1 as d
  )
  select jsonb_build_object(
    'since', (select d from since),
    'visitors', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'platform', platform, 'n', n) order by day, platform), '[]'::jsonb)
                 from (select day, platform, count(*)::int as n from sparrow_stats.visitors
                       where day >= (select d from since) group by day, platform) v),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('day', day, 'platform', platform, 'ev', ev, 'n', n) order by day, platform, ev), '[]'::jsonb)
               from (select day, platform, ev, sum(n)::int as n from sparrow_stats.daily
                     where day >= (select d from since) group by day, platform, ev) x),
    'top', (select coalesce(jsonb_agg(jsonb_build_object('ev', ev, 'key', key, 'n', n) order by ev, n desc), '[]'::jsonb)
            from (select ev, key, n, row_number() over (partition by ev order by n desc, key) as rk
                  from (select ev, key, sum(n)::int as n from sparrow_stats.daily
                        where day >= (select d from since) and key <> '' group by ev, key) a) b
            where rk <= 20)
  )
$$;
revoke all on function public.ss_summary(integer) from public;
grant execute on function public.ss_summary(integer) to anon, authenticated;
commit;
