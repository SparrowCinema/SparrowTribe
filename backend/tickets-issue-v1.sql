-- 麻雀观影护照 · 典藏票根发行序号 V1（2026-11-22）
-- 每张典藏票根有两串号：
--   典藏编号（客户端自己算，15 位，见 shared/tickets.js 的 serialOf）＝这张票根是谁；
--   发行序号（这里统一发，按影片从 1 开始）＝「本片第几张典藏」。
-- 只保存「典藏编号 → 影片 → 序号 → 发号时间」，不保存同步码、微信身份或任何个人档案内容。
-- 同一个典藏编号重复来领，永远返回同一个号；票根移出后号作废，不回收。可重复执行。
begin;
create schema if not exists sparrow_issue;
revoke all on schema sparrow_issue from public, anon, authenticated;
create table if not exists sparrow_issue.counters(
  film text primary key,
  last integer not null default 0
);
create table if not exists sparrow_issue.issued(
  serial text primary key,
  film text not null,
  no integer not null,
  at timestamptz not null default now()
);
create unique index if not exists issued_film_no on sparrow_issue.issued(film, no);
alter table sparrow_issue.counters enable row level security;
alter table sparrow_issue.issued enable row level security;
revoke all on all tables in schema sparrow_issue from public, anon, authenticated;

-- 校验位：前 14 位按位置加权（1–14）求和 mod 31，与 shared/tickets.js 的 serialCheck 一致
create or replace function sparrow_issue.check_ok(s text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare abc text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; t integer := 0; i integer;
begin
  for i in 1..14 loop t := t + (strpos(abc, substr(s, i, 1)) - 1) * i; end loop;
  return substr(abc, (t % 31) + 1, 1) = substr(s, 15, 1);
end $$;
revoke all on function sparrow_issue.check_ok(text) from public, anon, authenticated;

-- 发号：items = [{s:典藏编号, f:影片id}]，一次最多 50 张；返回 [{s, no}]。格式或校验位不对的直接跳过。
create or replace function public.tk_issue(items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare it jsonb; s text; f text; n integer; c integer := 0; out jsonb := '[]'::jsonb;
begin
  if items is null or jsonb_typeof(items) <> 'array' then return out; end if;
  for it in select value from jsonb_array_elements(items) limit 50 loop
    if jsonb_typeof(it) <> 'object' then continue; end if;
    s := it->>'s'; f := it->>'f';
    if s is null or s !~ '^[A-HJ-NP-Z2-9]{15}$' or f is null or f !~ '^[A-Za-z0-9_-]{1,80}$'
       or not sparrow_issue.check_ok(s) then continue; end if;
    select i.no into n from sparrow_issue.issued i where i.serial = s;
    if n is null then
      insert into sparrow_issue.counters as k (film, last) values (f, 1)
        on conflict (film) do update set last = k.last + 1 returning last into n;
      insert into sparrow_issue.issued (serial, film, no) values (s, f, n) on conflict (serial) do nothing;
      -- 两台设备同时来领同一张：后到的那个号作废，返回先到的号
      if not found then select i.no into n from sparrow_issue.issued i where i.serial = s; end if;
    end if;
    out := out || jsonb_build_array(jsonb_build_object('s', s, 'no', n));
    c := c + 1;
  end loop;
  return out;
end $$;
revoke all on function public.tk_issue(jsonb) from public;
grant execute on function public.tk_issue(jsonb) to anon, authenticated;
commit;
