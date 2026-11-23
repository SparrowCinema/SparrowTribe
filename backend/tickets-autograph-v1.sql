-- 麻雀观影护照 · 典藏票根映后嘉宾签名 V1（2026-11-23）
-- 在 tickets-issue-v1.sql、tickets-collect-v1.sql、tickets-checkin-v1.sql 之上执行。可重复执行。
--   映后活动结束后，嘉宾在主办方的手机 / 平板上手写签名（网站隐藏页 #checkin-host 的「嘉宾签名」），
--   笔画以 0–1000 × 0–500 的整数坐标保存（tk_autograph_put，需要主办密钥）。
--   只有在这一场现场认证过的典藏票根才能取到签名（tk_autograph 按典藏编号查签到记录）。
-- 只保存嘉宾姓名、身份和签名笔画，不保存观众的任何个人信息。
begin;
create table if not exists sparrow_issue.autographs(
  film text not null,
  show text not null,
  idx smallint not null check (idx between 0 and 3),
  name text not null,
  role text not null default '',
  strokes jsonb not null,
  at timestamptz not null default now(),
  primary key (film, show, idx)
);
alter table sparrow_issue.autographs enable row level security;
revoke all on all tables in schema sparrow_issue from public, anon, authenticated;

-- 主办密钥校验（与 tk_checkin_code 相同）
create or replace function sparrow_issue.host_ok(pin text)
returns boolean language sql stable security definer set search_path = '' as $$
  select pin is not null and length(pin) between 8 and 80
    and exists (select 1 from sparrow_issue.hosts x where x.key_hash = encode(extensions.digest(pin, 'sha256'), 'hex'))
$$;
revoke all on function sparrow_issue.host_ok(text) from public, anon, authenticated;

-- 笔画格式：[[x,y,x,y,…], …]，最多 80 笔、共 4000 个点，坐标是 0–1000 / 0–500 的整数
create or replace function sparrow_issue.strokes_ok(st jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare s jsonb; v jsonb; n integer := 0; i integer := 0;
begin
  if st is null or jsonb_typeof(st) <> 'array' or jsonb_array_length(st) = 0 or jsonb_array_length(st) > 80 then return false; end if;
  for s in select value from jsonb_array_elements(st) loop
    if jsonb_typeof(s) <> 'array' or jsonb_array_length(s) < 2 or jsonb_array_length(s) % 2 <> 0 then return false; end if;
    i := 0;
    for v in select value from jsonb_array_elements(s) loop
      if jsonb_typeof(v) <> 'number' or (v::text)::numeric <> floor((v::text)::numeric) or (v::text)::numeric < 0
         or (v::text)::numeric > (case when i % 2 = 0 then 1000 else 500 end) then return false; end if;
      i := i + 1;
    end loop;
    n := n + jsonb_array_length(s) / 2;
    if n > 4000 then return false; end if;
  end loop;
  return true;
end $$;
revoke all on function sparrow_issue.strokes_ok(jsonb) from public, anon, authenticated;

-- 主办方：保存 / 删除一位嘉宾的签名（st 为 null 即删除），返回这一场现有的签名列表
-- 参数：pin 主办密钥、f 影片、h 场次、i 第几位嘉宾（0–3）、nm 姓名、rl 身份、st 笔画
create or replace function public.tk_autograph_put(pin text, f text, h text, i integer, nm text, rl text, st jsonb)
returns jsonb language plpgsql security definer volatile set search_path = '' as $$
begin
  if not sparrow_issue.host_ok(pin) then perform pg_sleep(1); return null; end if;
  if f is null or f !~ '^[A-Za-z0-9_-]{1,80}$' or h is null or h !~ '^[A-Za-z0-9_:/.-]{1,120}$' or i is null or i < 0 or i > 3 then return null; end if;
  if st is null then
    delete from sparrow_issue.autographs a where a.film = f and a.show = h and a.idx = i;
  else
    nm := btrim(coalesce(nm, '')); rl := btrim(coalesce(rl, ''));
    if length(nm) < 1 or length(nm) > 24 or length(rl) > 12 or not sparrow_issue.strokes_ok(st) then return null; end if;
    insert into sparrow_issue.autographs as a (film, show, idx, name, role, strokes) values (f, h, i, nm, rl, st)
      on conflict on constraint autographs_pkey do update set name = excluded.name, role = excluded.role, strokes = excluded.strokes, at = now();
  end if;
  return public.tk_autograph_list(pin, f, h);
end $$;

-- 主办方：这一场现有的签名（含笔画）
create or replace function public.tk_autograph_list(pin text, f text, h text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
begin
  if not sparrow_issue.host_ok(pin) then return null; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('i', a.idx, 'name', a.name, 'role', a.role, 'st', a.strokes) order by a.idx)
    from sparrow_issue.autographs a where a.film = f and a.show = h), '[]'::jsonb);
end $$;
revoke all on function public.tk_autograph_put(text, text, text, integer, text, text, jsonb) from public;
revoke all on function public.tk_autograph_list(text, text, text) from public;
grant execute on function public.tk_autograph_put(text, text, text, integer, text, text, jsonb) to anon, authenticated;
grant execute on function public.tk_autograph_list(text, text, text) to anon, authenticated;

-- 观众：items = [典藏编号, …]（最多 50 个）；只返回在场次现场认证过的 [{s, g:[{name, role, st}]}]（还没有签名时 g 为空数组）
create or replace function public.tk_autograph(items jsonb)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare it jsonb; s text; c record; out jsonb := '[]'::jsonb;
begin
  if items is null or jsonb_typeof(items) <> 'array' then return out; end if;
  for it in select value from jsonb_array_elements(items) limit 50 loop
    s := it #>> '{}';
    if s is null or s !~ '^[A-HJ-NP-Z2-9]{15}$' then continue; end if;
    select k.film, k.show into c from sparrow_issue.checkins k where k.serial = s;
    if not found then continue; end if;
    out := out || jsonb_build_array(jsonb_build_object('s', s, 'g',
      coalesce((select jsonb_agg(jsonb_build_object('name', a.name, 'role', a.role, 'st', a.strokes) order by a.idx)
        from sparrow_issue.autographs a where a.film = c.film and a.show = c.show), '[]'::jsonb)));
  end loop;
  return out;
end $$;
revoke all on function public.tk_autograph(jsonb) from public;
grant execute on function public.tk_autograph(jsonb) to anon, authenticated;
commit;
