-- 麻雀观影护照 · 典藏票根收藏玩法 V1（2026-11-22）
-- 在 backend/tickets-issue-v1.sql 之上执行（先执行那个文件）。可重复执行。
--   1. 场次限定：tk_issue 可带场次编号 h，同一场次另发「本场第几张」（sno）。每张票根只绑定第一次领号时的场次。
--   2. 封版编号：tk_edition 返回某部影片在封版时间之前一共发出多少张（封版时间由客户端按排片推算，见 shared/tickets.js 的 editionClose）。
--      封版时间还没到的一律不返回，避免把还在增长的数字冻结进票根。
--   3. 验真：tk_verify 按典藏编号查发行记录（影片、序号、场次、发行时间），不含任何个人信息。
-- 仍然只保存「典藏编号 → 影片 → 序号 → 场次 → 时间」，不保存同步码、微信身份或任何个人档案内容。
begin;
alter table sparrow_issue.issued add column if not exists show text;
alter table sparrow_issue.issued add column if not exists sno integer;
create table if not exists sparrow_issue.show_counters(
  film text not null,
  show text not null,
  last integer not null default 0,
  primary key (film, show)
);
create unique index if not exists issued_show_no on sparrow_issue.issued(film, show, sno) where show is not null;
alter table sparrow_issue.show_counters enable row level security;
revoke all on all tables in schema sparrow_issue from public, anon, authenticated;

-- 发号：items = [{s:典藏编号, f:影片id, h?:场次编号}]，一次最多 50 张；返回 [{s, no, h, sno}]。
-- h 只在这张票根还没绑定场次时生效；已经绑定的返回原来的场次和本场序号。
create or replace function public.tk_issue(items jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare it jsonb; s text; f text; h text; n integer; hs text; hn integer; rf text; out jsonb := '[]'::jsonb;
begin
  if items is null or jsonb_typeof(items) <> 'array' then return out; end if;
  for it in select value from jsonb_array_elements(items) limit 50 loop
    if jsonb_typeof(it) <> 'object' then continue; end if;
    s := it->>'s'; f := it->>'f'; h := it->>'h';
    if s is null or s !~ '^[A-HJ-NP-Z2-9]{15}$' or f is null or f !~ '^[A-Za-z0-9_-]{1,80}$'
       or not sparrow_issue.check_ok(s) then continue; end if;
    if h is not null and h !~ '^[A-Za-z0-9_:/.-]{1,120}$' then h := null; end if;
    n := null; hs := null; hn := null;
    select i.no into n from sparrow_issue.issued i where i.serial = s;
    if n is null then
      insert into sparrow_issue.counters as k (film, last) values (f, 1)
        on conflict (film) do update set last = k.last + 1 returning last into n;
      insert into sparrow_issue.issued (serial, film, no) values (s, f, n) on conflict (serial) do nothing;
      -- 两台设备同时来领同一张：后到的那个号作废，返回先到的号
      if not found then select i.no into n from sparrow_issue.issued i where i.serial = s; end if;
    end if;
    select i.show, i.sno, i.film into hs, hn, rf from sparrow_issue.issued i where i.serial = s for update;
    if hs is null and h is not null then
      insert into sparrow_issue.show_counters as k (film, show, last) values (rf, h, 1)
        on conflict (film, show) do update set last = k.last + 1 returning last into hn;
      update sparrow_issue.issued set show = h, sno = hn where serial = s and show is null;
      if found then hs := h;
      else select i.show, i.sno into hs, hn from sparrow_issue.issued i where i.serial = s; end if;
    end if;
    out := out || jsonb_build_array(jsonb_build_object('s', s, 'no', n, 'h', hs, 'sno', hn));
  end loop;
  return out;
end $$;
revoke all on function public.tk_issue(jsonb) from public;
grant execute on function public.tk_issue(jsonb) to anon, authenticated;

-- 封版总数：items = [{f:影片id, c:封版时间 ISO}]，一次最多 100 部；只返回封版时间已过的 [{f, c, total}]。
create or replace function public.tk_edition(items jsonb)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare it jsonb; f text; c timestamptz; t integer; out jsonb := '[]'::jsonb;
begin
  if items is null or jsonb_typeof(items) <> 'array' then return out; end if;
  for it in select value from jsonb_array_elements(items) limit 100 loop
    if jsonb_typeof(it) <> 'object' then continue; end if;
    f := it->>'f';
    if f is null or f !~ '^[A-Za-z0-9_-]{1,80}$' then continue; end if;
    begin c := (it->>'c')::timestamptz; exception when others then continue; end;
    if c is null or c > now() then continue; end if;
    select count(*) into t from sparrow_issue.issued i where i.film = f and i.at <= c;
    out := out || jsonb_build_array(jsonb_build_object('f', f, 'c', it->>'c', 'total', t));
  end loop;
  return out;
end $$;
revoke all on function public.tk_edition(jsonb) from public;
grant execute on function public.tk_edition(jsonb) to anon, authenticated;

-- 验真：返回 {s, f, no, h, sno, at}，查不到返回 null
create or replace function public.tk_verify(s text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare r record;
begin
  if s is null or s !~ '^[A-HJ-NP-Z2-9]{15}$' or not sparrow_issue.check_ok(s) then return null; end if;
  select i.serial, i.film, i.no, i.show, i.sno, i.at into r from sparrow_issue.issued i where i.serial = s;
  if not found then return null; end if;
  return jsonb_build_object('s', r.serial, 'f', r.film, 'no', r.no, 'h', r.show, 'sno', r.sno, 'at', r.at);
end $$;
revoke all on function public.tk_verify(text) from public;
grant execute on function public.tk_verify(text) to anon, authenticated;
commit;
