-- 麻雀观影护照 · 典藏票根现场认证 V1（2026-11-22）
-- 在 tickets-issue-v1.sql、tickets-collect-v1.sql 之上执行。可重复执行。
--   放映现场：主办方在网站隐藏页 #checkin-host 输入主办密钥、选场次，屏幕显示签到二维码（每分钟刷新）。
--   签到码 = 服务器密钥对「影片|场次|时间窗」的 HMAC，时间窗 2 分钟，前后各容忍一个窗口（约 4–6 分钟内有效）。
--   观众扫码后调用 tk_checkin：校验签到码 → 发号（同 tk_issue，含本场序号）→ 记下现场认证时间。
-- 只保存「典藏编号 → 影片 → 场次 → 签到时间」，不保存任何个人身份信息。主办密钥只存 SHA-256。
begin;
create extension if not exists pgcrypto with schema extensions;

create table if not exists sparrow_issue.secrets(
  name text primary key,
  value bytea not null
);
insert into sparrow_issue.secrets(name, value) values ('checkin', extensions.gen_random_bytes(32)) on conflict (name) do nothing;

-- 主办密钥：只存 SHA-256 的十六进制；新增 / 更换密钥：insert into sparrow_issue.hosts(label, key_hash) values ('名字', encode(extensions.digest('新密钥','sha256'),'hex'));
create table if not exists sparrow_issue.hosts(
  label text primary key,
  key_hash text not null unique,
  added timestamptz not null default now()
);

create table if not exists sparrow_issue.checkins(
  serial text primary key references sparrow_issue.issued(serial),
  film text not null,
  show text not null,
  at timestamptz not null default now()
);
create index if not exists checkins_show on sparrow_issue.checkins(film, show);
alter table sparrow_issue.secrets enable row level security;
alter table sparrow_issue.hosts enable row level security;
alter table sparrow_issue.checkins enable row level security;
revoke all on all tables in schema sparrow_issue from public, anon, authenticated;

-- 签到码：影片|场次|时间窗 的 HMAC-SHA256，取前 12 位十六进制
create or replace function sparrow_issue.checkin_token(f text, h text, w bigint)
returns text language sql stable security definer set search_path = '' as $$
  select left(encode(extensions.hmac(convert_to(f || '|' || h || '|' || w::text, 'UTF8'),
    (select s.value from sparrow_issue.secrets s where s.name = 'checkin'), 'sha256'), 'hex'), 12)
$$;
revoke all on function sparrow_issue.checkin_token(text, text, bigint) from public, anon, authenticated;

-- 主办方取当前签到码：{w, k, n:本场已签到人数, sec:本窗口剩余秒数}；密钥不对返回 null（并等 1 秒，防止暴力猜）
create or replace function public.tk_checkin_code(pin text, f text, h text)
returns jsonb language plpgsql security definer volatile set search_path = '' as $$
declare w bigint; n integer;
begin
  if pin is null or length(pin) < 8 or length(pin) > 80
     or not exists (select 1 from sparrow_issue.hosts x where x.key_hash = encode(extensions.digest(pin, 'sha256'), 'hex')) then
    perform pg_sleep(1); return null;
  end if;
  if f is null or f !~ '^[A-Za-z0-9_-]{1,80}$' or h is null or h !~ '^[A-Za-z0-9_:/.-]{1,120}$' then return null; end if;
  w := floor(extract(epoch from now()) / 120)::bigint;
  select count(*) into n from sparrow_issue.checkins c where c.film = f and c.show = h;
  return jsonb_build_object('w', w, 'k', sparrow_issue.checkin_token(f, h, w), 'n', n,
    'sec', 120 - (floor(extract(epoch from now()))::bigint % 120));
end $$;
revoke all on function public.tk_checkin_code(text, text, text) from public;
grant execute on function public.tk_checkin_code(text, text, text) to anon, authenticated;

-- 观众签到：item = {s:典藏编号, f:影片id, h:场次编号, w:时间窗, k:签到码}
-- 返回 {ok:true, no, h, sno, ci}（ci＝签到时间），或 {ok:false, reason:'expired'|'bad'}
create or replace function public.tk_checkin(item jsonb)
returns jsonb language plpgsql security definer volatile set search_path = '' as $$
declare s text; f text; h text; w bigint; k text; now_w bigint; r jsonb; ci timestamptz;
begin
  if item is null or jsonb_typeof(item) <> 'object' then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  s := item->>'s'; f := item->>'f'; h := item->>'h'; k := lower(item->>'k');
  begin w := (item->>'w')::bigint; exception when others then return jsonb_build_object('ok', false, 'reason', 'bad'); end;
  if s is null or s !~ '^[A-HJ-NP-Z2-9]{15}$' or not sparrow_issue.check_ok(s)
     or f is null or f !~ '^[A-Za-z0-9_-]{1,80}$' or h is null or h !~ '^[A-Za-z0-9_:/.-]{1,120}$'
     or k is null or k !~ '^[0-9a-f]{12}$' or w is null then
    return jsonb_build_object('ok', false, 'reason', 'bad');
  end if;
  if k <> sparrow_issue.checkin_token(f, h, w) then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  now_w := floor(extract(epoch from now()) / 120)::bigint;
  if w < now_w - 1 or w > now_w + 1 then return jsonb_build_object('ok', false, 'reason', 'expired'); end if;
  r := public.tk_issue(jsonb_build_array(jsonb_build_object('s', s, 'f', f, 'h', h))) -> 0;
  if r is null then return jsonb_build_object('ok', false, 'reason', 'bad'); end if;
  insert into sparrow_issue.checkins(serial, film, show) values (s, f, h) on conflict (serial) do nothing;
  select c.at into ci from sparrow_issue.checkins c where c.serial = s;
  return jsonb_build_object('ok', true, 'no', r->'no', 'h', r->'h', 'sno', r->'sno', 'ci', ci);
end $$;
revoke all on function public.tk_checkin(jsonb) from public;
grant execute on function public.tk_checkin(jsonb) to anon, authenticated;

-- 验真加上现场认证时间 ci
create or replace function public.tk_verify(s text)
returns jsonb language plpgsql security definer stable set search_path = '' as $$
declare r record; ci timestamptz;
begin
  if s is null or s !~ '^[A-HJ-NP-Z2-9]{15}$' or not sparrow_issue.check_ok(s) then return null; end if;
  select i.serial, i.film, i.no, i.show, i.sno, i.at into r from sparrow_issue.issued i where i.serial = s;
  if not found then return null; end if;
  select c.at into ci from sparrow_issue.checkins c where c.serial = s;
  return jsonb_build_object('s', r.serial, 'f', r.film, 'no', r.no, 'h', r.show, 'sno', r.sno, 'at', r.at, 'ci', ci);
end $$;
revoke all on function public.tk_verify(text) from public;
grant execute on function public.tk_verify(text) to anon, authenticated;
commit;
