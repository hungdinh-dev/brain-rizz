-- CR-019: trang quản trị (docs/01-product/admin-console.md mục 4.3).
--
-- Ai ghi gì:
--   - Quản trị viên (phiên Google có dòng trong `admins`): mọi đọc/ghi đi qua RPC `admin_*`
--     (`security definer`, đầu hàm kiểm `public.is_admin()`, sai thì lỗi `forbidden` / 42501).
--   - Client (mọi phiên, kể cả khách ẩn danh): chỉ `log_login` (ghi sự kiện đăng nhập của chính mình)
--     và `is_admin` (mình có phải quản trị viên không).
--   - Game server (khoá secret, bỏ qua RLS): đọc `party_settings` (dòng id 1) và `admins`; ghi thêm cột
--     `match_results.settings_version` (phiên bản cấu hình điểm của trận).
-- Bốn bảng mới bật RLS và KHÔNG có policy nào: client không đọc/ghi thẳng được, chỉ qua RPC.
-- Email (auth.users) chỉ lộ trong RPC `admin_*`. Không ghi IP; `device` chỉ là "trình duyệt · hệ điều hành".
-- "Một trận" = nhóm `match_results` theo `(room_code, created_at)`: server ghi cả trận trong một lệnh
-- insert nên mọi dòng của trận có cùng `created_at`. Ngày tính theo giờ Việt Nam (Asia/Ho_Chi_Minh).
--
-- Thứ tự triển khai: chạy file này TRƯỚC khi deploy game server mới (server mới luôn ghi
-- `settings_version`; server cũ không ghi thì cột nhận mặc định 0, nên chạy sớm không hại gì).
-- Chạy như các file trước: SQL Editor (dán cả file) hoặc `supabase db push`.
-- Admin đầu tiên thêm bằng một câu SQL: xem docs/03-guides/supabase-setup.md mục 8.

-- =====================================================================================
-- Bảng
-- =====================================================================================

-- Quản trị viên. Chỉ tài khoản Google (không ẩn danh, có email); thêm/xoá qua RPC hoặc SQL Editor.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  note text check (note is null or char_length(note) <= 200),
  added_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Cấu hình điểm + game bị tắt cho trận party. Đúng một dòng (id = 1). `scoring` là ScoringConfig
-- (packages/shared/src/party-config.ts); server luôn kiểm lại bằng `parsePartyConfig`, không tin DB.
-- version 0 + scoring rỗng = dùng mặc định trong code.
create table public.party_settings (
  id smallint primary key default 1 check (id = 1),
  version integer not null default 0 check (version >= 0),
  scoring jsonb not null default '{}'::jsonb check (jsonb_typeof(scoring) = 'object'),
  disabled_games text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

insert into public.party_settings (id, version, scoring, disabled_games)
values (1, 0, '{}', '{}');

-- Lịch sử mỗi lần lưu cấu hình (ghi cùng transaction với `party_settings`).
create table public.party_settings_history (
  id bigserial primary key,
  version integer not null check (version >= 1),
  scoring jsonb not null check (jsonb_typeof(scoring) = 'object'),
  disabled_games text[] not null default '{}',
  note text check (note is null or char_length(note) <= 200),
  changed_by uuid references auth.users (id) on delete set null,
  changed_at timestamptz not null default now()
);

-- Lịch sử đăng nhập (client ghi qua RPC `log_login`). Xoá tài khoản là xoá theo (cascade).
create table public.login_events (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  event text not null check (
    event in ('guest_created', 'google_sign_in', 'google_linked', 'session_resumed', 'sign_out')
  ),
  provider text not null check (provider in ('anonymous', 'google')),
  device text check (device is null or char_length(device) <= 120),
  created_at timestamptz not null default now()
);

-- Phiên bản cấu hình điểm (`party_settings.version`) mà trận đã dùng. 0 = mặc định trong code.
alter table public.match_results
  add column settings_version integer not null default 0
    check (settings_version >= 0);

comment on table public.admins is
  'Quản trị viên (CR-019). Chỉ đọc/ghi qua RPC admin_* hoặc SQL Editor.';
comment on table public.party_settings is
  'Cấu hình điểm + game bị tắt của trận party (CR-019), đúng một dòng id = 1.';
comment on table public.party_settings_history is
  'Lịch sử mỗi lần lưu party_settings (CR-019).';
comment on table public.login_events is
  'Sự kiện đăng nhập (CR-019): không ghi IP, device chỉ là trình duyệt · hệ điều hành.';
comment on column public.match_results.settings_version is
  'party_settings.version áp dụng cho trận (CR-019). 0 = công thức mặc định trong code.';

-- =====================================================================================
-- Index
-- =====================================================================================

create index login_events_created_idx on public.login_events (created_at desc);
create index login_events_user_created_idx on public.login_events (user_id, created_at desc);
create index party_settings_history_changed_idx on public.party_settings_history (changed_at desc);
-- Danh sách trận cho admin: nhóm theo (room_code, created_at), mới nhất trước.
create index match_results_created_room_idx on public.match_results (created_at desc, room_code desc);

-- =====================================================================================
-- RLS
-- =====================================================================================

-- Bật RLS, không tạo policy: client (anon/authenticated) không đọc/ghi thẳng được bảng nào.
-- Game server dùng khoá secret (bỏ qua RLS); trang admin đi qua RPC `security definer` bên dưới.
alter table public.admins enable row level security;
alter table public.party_settings enable row level security;
alter table public.party_settings_history enable row level security;
alter table public.login_events enable row level security;

-- Chặn thêm một lớp ở mức quyền bảng (Supabase mặc định cấp mọi quyền cho anon/authenticated).
revoke all on table public.admins from anon, authenticated;
revoke all on table public.party_settings from anon, authenticated;
revoke all on table public.party_settings_history from anon, authenticated;
revoke all on table public.login_events from anon, authenticated;
revoke all on sequence public.party_settings_history_id_seq from anon, authenticated;
revoke all on sequence public.login_events_id_seq from anon, authenticated;

-- =====================================================================================
-- Hàm nội bộ
-- =====================================================================================

-- Chuỗi tìm kiếm → mẫu ILIKE '%…%' (thoát \ % _, tối đa 100 ký tự). Rỗng/null → null (không lọc).
create or replace function public.ilike_pattern(p_query text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when nullif(btrim(p_query), '') is null then null
    else '%' || replace(replace(replace(left(btrim(p_query), 100), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  end;
$$;

revoke execute on function public.ilike_pattern(text) from public, anon, authenticated;

-- =====================================================================================
-- RPC cho mọi phiên (gọi bằng supabase.rpc)
-- =====================================================================================

-- Người gọi có trong `admins` không. Không có phiên → false.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admins a where a.user_id = (select auth.uid()));
$$;

-- Ghi một sự kiện đăng nhập cho người gọi. `provider` lấy từ claim `is_anonymous` của JWT.
-- `session_resumed` (mở lại app khi đã có phiên) bỏ qua nếu người này đã có sự kiện bất kỳ trong
-- 30 phút. Chống spam: đã có 20 sự kiện trong 1 phút thì bỏ qua (không báo lỗi).
create or replace function public.log_login(p_event text, p_device text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_provider text;
  v_device text;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;
  if p_event is null or p_event not in
     ('guest_created', 'google_sign_in', 'google_linked', 'session_resumed', 'sign_out') then
    raise exception 'p_event không hợp lệ' using errcode = '22023';
  end if;

  if p_event = 'session_resumed' and exists (
    select 1 from public.login_events e
    where e.user_id = v_uid and e.created_at > now() - interval '30 minutes'
  ) then
    return;
  end if;

  if (
    select count(*) from (
      select 1 from public.login_events e
      where e.user_id = v_uid and e.created_at > now() - interval '1 minute'
      limit 20
    ) recent
  ) >= 20 then
    return;
  end if;

  v_provider := case
    when coalesce(auth.jwt() ->> 'is_anonymous', 'false') = 'true' then 'anonymous'
    else 'google'
  end;
  -- Bỏ ký tự điều khiển, cắt còn 120 ký tự; rỗng → null.
  v_device := nullif(
    left(btrim(regexp_replace(coalesce(p_device, ''), '[[:cntrl:]]+', ' ', 'g')), 120),
    ''
  );

  insert into public.login_events (user_id, event, provider, device)
  values (v_uid, p_event, v_provider, v_device);
end;
$$;

-- "Xoá dữ liệu của tôi" (thay hàm ở 20261016000000_accounts.sql): xoá thêm `login_events` của mình,
-- rồi xoá tài khoản Auth như cũ (các bảng còn lại xoá theo cascade; `admins` cũng cascade, còn
-- `updated_by` / `changed_by` / `added_by` về null).
-- Quản trị viên DUY NHẤT không xoá được ('last-admin', P0001, không xoá gì): dòng `admins` mất theo
-- cascade thì không còn ai quản trị. Muốn xoá thì thêm admin khác trước.
create or replace function public.delete_my_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;
  if exists (select 1 from public.admins a where a.user_id = v_uid) then
    -- Khoá ghi bảng admins như admin_remove_admin: hai admin cuối cùng xoá cùng lúc thì người sau
    -- chờ, rồi kiểm lại (người trước đã xoá → người sau là admin duy nhất → bị chặn).
    lock table public.admins in share row exclusive mode;
    if exists (select 1 from public.admins a where a.user_id = v_uid)
       and (select count(*) from public.admins) <= 1 then
      raise exception 'last-admin' using errcode = 'P0001';
    end if;
  end if;
  delete from public.login_events where user_id = v_uid;
  delete from auth.users where id = v_uid;
end;
$$;

-- =====================================================================================
-- RPC cho quản trị viên. Mọi hàm mở đầu bằng kiểm `public.is_admin()`.
-- Lỗi trả về (supabase-js: error.message): 'forbidden' (42501), 'not-found' (P0002),
-- 'self' / 'last-admin' (P0001); tham số sai: 22023.
-- =====================================================================================

-- Số liệu tổng quan. `matches` = số trận (đếm theo (room_code, created_at)). `logins` = sự kiện đăng
-- nhập trừ `sign_out`. `active_users` = người có ít nhất một hoạt động trong ngày: sự kiện đăng nhập,
-- trận party, lượt Kiểm tra não, hoặc lần luyện tập gần nhất (practice_bests chỉ giữ updated_at).
-- `daily` gồm p_days ngày tới hôm nay (giờ Việt Nam), cũ trước; p_days kẹp 1–90.
create or replace function public.admin_overview(p_days int default 14)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_days int := least(greatest(coalesce(p_days, 14), 1), 90);
  v_today date := (now() at time zone 'Asia/Ho_Chi_Minh')::date;
  v_since timestamptz;
  v_totals jsonb;
  v_daily jsonb;
  v_today_row jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  v_since := (v_today - (v_days - 1))::timestamp at time zone 'Asia/Ho_Chi_Minh';

  select jsonb_build_object(
    'users', (select count(*) from auth.users),
    'google_users', (select count(*) from auth.users u where not u.is_anonymous),
    'guest_users', (select count(*) from auth.users u where u.is_anonymous),
    'admins', (select count(*) from public.admins),
    'matches', (
      select count(*) from (
        select 1 from public.match_results m group by m.room_code, m.created_at
      ) t
    ),
    'brain_tests', (select count(*) from public.brain_tests),
    'practice_records', (select count(*) from public.practice_bests)
  )
  into v_totals;

  with days as (
    select v_today - g as dt from generate_series(0, v_days - 1) as g
  ),
  login_daily as (
    select (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date as dt, count(*) as n
    from public.login_events e
    where e.created_at >= v_since and e.event <> 'sign_out'
    group by 1
  ),
  activity as (
    select (e.created_at at time zone 'Asia/Ho_Chi_Minh')::date as dt, e.user_id as uid
    from public.login_events e
    where e.created_at >= v_since
    union
    select (m.created_at at time zone 'Asia/Ho_Chi_Minh')::date, m.user_id
    from public.match_results m
    where m.created_at >= v_since
    union
    select (b.created_at at time zone 'Asia/Ho_Chi_Minh')::date, b.user_id
    from public.brain_tests b
    where b.created_at >= v_since
    union
    select (pb.updated_at at time zone 'Asia/Ho_Chi_Minh')::date, pb.user_id
    from public.practice_bests pb
    where pb.updated_at >= v_since
  ),
  active_daily as (
    -- `union` đã bỏ trùng (ngày, người).
    select a.dt, count(*) as n from activity a group by a.dt
  ),
  new_user_daily as (
    select (u.created_at at time zone 'Asia/Ho_Chi_Minh')::date as dt, count(*) as n
    from auth.users u
    where u.created_at >= v_since
    group by 1
  ),
  match_daily as (
    select (t.created_at at time zone 'Asia/Ho_Chi_Minh')::date as dt, count(*) as n
    from (
      select distinct m.room_code, m.created_at
      from public.match_results m
      where m.created_at >= v_since
    ) t
    group by 1
  ),
  brain_daily as (
    select (b.created_at at time zone 'Asia/Ho_Chi_Minh')::date as dt, count(*) as n
    from public.brain_tests b
    where b.created_at >= v_since
    group by 1
  ),
  daily as (
    select d.dt,
           coalesce(l.n, 0) as logins,
           coalesce(a.n, 0) as active_users,
           coalesce(nu.n, 0) as new_users,
           coalesce(md.n, 0) as matches,
           coalesce(bd.n, 0) as brain_tests
    from days d
    left join login_daily l on l.dt = d.dt
    left join active_daily a on a.dt = d.dt
    left join new_user_daily nu on nu.dt = d.dt
    left join match_daily md on md.dt = d.dt
    left join brain_daily bd on bd.dt = d.dt
  )
  select
    jsonb_agg(
      jsonb_build_object(
        'day', r.dt,
        'logins', r.logins,
        'active_users', r.active_users,
        'new_users', r.new_users,
        'matches', r.matches,
        'brain_tests', r.brain_tests
      )
      order by r.dt
    ),
    (
      select jsonb_build_object(
        'logins', t.logins,
        'active_users', t.active_users,
        'new_users', t.new_users,
        'matches', t.matches
      )
      from daily t
      where t.dt = v_today
    )
  into v_daily, v_today_row
  from daily r;

  return jsonb_build_object(
    'totals', v_totals,
    'today', coalesce(
      v_today_row,
      jsonb_build_object('logins', 0, 'active_users', 0, 'new_users', 0, 'matches', 0)
    ),
    'daily', coalesce(v_daily, '[]'::jsonb)
  );
end;
$$;

-- Lịch sử đăng nhập, mới nhất trước. Trang sau: p_before = created_at của dòng cuối trang trước.
-- p_event lọc một loại sự kiện; p_query lọc tên hiển thị hoặc email (ILIKE, không phân biệt hoa thường).
create or replace function public.admin_login_events(
  p_limit int default 50,
  p_before timestamptz default null,
  p_event text default null,
  p_query text default null
)
returns table (
  id bigint,
  user_id uuid,
  display_name text,
  avatar text,
  email text,
  provider text,
  event text,
  device text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_event text := nullif(btrim(p_event), '');
  v_pattern text := public.ilike_pattern(p_query);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_event is not null and v_event not in
     ('guest_created', 'google_sign_in', 'google_linked', 'session_resumed', 'sign_out') then
    raise exception 'p_event không hợp lệ' using errcode = '22023';
  end if;

  return query
  select e.id, e.user_id, p.display_name, p.avatar, u.email::text,
         e.provider, e.event, e.device, e.created_at
  from public.login_events e
  left join public.profiles p on p.id = e.user_id
  left join auth.users u on u.id = e.user_id
  where (p_before is null or e.created_at < p_before)
    and (v_event is null or e.event = v_event)
    and (v_pattern is null or p.display_name ilike v_pattern or u.email ilike v_pattern)
  order by e.created_at desc, e.id desc
  limit v_limit;
end;
$$;

-- Người chơi (mọi tài khoản Auth), mới tạo trước, phân trang bằng p_limit/p_offset.
-- p_provider: 'anonymous' | 'google' | null. total_count = tổng số dòng khớp bộ lọc (trước phân trang).
-- last_seen_at = hoạt động gần nhất (đăng nhập, trận, Kiểm tra não, luyện tập).
create or replace function public.admin_users(
  p_limit int default 50,
  p_offset int default 0,
  p_query text default null,
  p_provider text default null
)
returns table (
  user_id uuid,
  display_name text,
  avatar text,
  email text,
  provider text,
  is_admin boolean,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  last_seen_at timestamptz,
  matches int,
  brain_tests int,
  practice_records int,
  total_count int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_limit int := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset int := greatest(coalesce(p_offset, 0), 0);
  v_provider text := nullif(btrim(p_provider), '');
  v_pattern text := public.ilike_pattern(p_query);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_provider is not null and v_provider not in ('anonymous', 'google') then
    raise exception 'p_provider phải là anonymous hoặc google' using errcode = '22023';
  end if;

  return query
  with filtered as (
    select u.id as uid,
           u.email::text as email_text,
           u.created_at as joined_at,
           u.last_sign_in_at as signed_in_at,
           case when u.is_anonymous then 'anonymous' else 'google' end as provider_name,
           p.display_name as dname,
           p.avatar as avatar_id
    from auth.users u
    left join public.profiles p on p.id = u.id
    where (v_provider is null
           or (case when u.is_anonymous then 'anonymous' else 'google' end) = v_provider)
      and (v_pattern is null or p.display_name ilike v_pattern or u.email ilike v_pattern)
  ),
  page as (
    select f.*, count(*) over () as total
    from filtered f
    order by f.joined_at desc, f.uid
    limit v_limit offset v_offset
  )
  select pg.uid,
         pg.dname,
         pg.avatar_id,
         pg.email_text,
         pg.provider_name,
         exists (select 1 from public.admins a where a.user_id = pg.uid),
         pg.joined_at,
         pg.signed_in_at,
         greatest(
           (select max(e.created_at) from public.login_events e where e.user_id = pg.uid),
           (select max(m.created_at) from public.match_results m where m.user_id = pg.uid),
           (select max(b.created_at) from public.brain_tests b where b.user_id = pg.uid),
           (select max(pb.updated_at) from public.practice_bests pb where pb.user_id = pg.uid)
         ),
         (select count(*) from public.match_results m where m.user_id = pg.uid)::int,
         (select count(*) from public.brain_tests b where b.user_id = pg.uid)::int,
         (select count(*) from public.practice_bests pb where pb.user_id = pg.uid)::int,
         pg.total::int
  from page pg
  order by pg.joined_at desc, pg.uid;
end;
$$;

-- Trận party, mới nhất trước (created_at desc, room_code desc). Trang sau: con trỏ là cặp của trận
-- cuối trang trước, p_before = created_at, p_before_room = room_code (hai phòng xong cùng lúc không
-- bị mất trận giữa hai trang). p_before_room null = chỉ lọc created_at < p_before.
-- results = người đã đăng nhập trong trận (bot và khách không phiên không có dòng), theo hạng.
-- Chỉ có trận có ít nhất một người có token hợp lệ (server chỉ ghi match_results cho người đã xác thực).
create or replace function public.admin_matches(
  p_limit int default 30,
  p_before timestamptz default null,
  p_before_room text default null
)
returns table (
  room_code text,
  created_at timestamptz,
  rounds int,
  players int,
  bot_count int,
  games text[],
  settings_version int,
  results jsonb
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_limit int := least(greatest(coalesce(p_limit, 30), 1), 200);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  with match_keys as (
    select m.room_code as code, m.created_at as ended_at
    from public.match_results m
    where p_before is null
       or m.created_at < p_before
       or (m.created_at = p_before and m.room_code < p_before_room)
    group by m.room_code, m.created_at
    order by m.created_at desc, m.room_code desc
    limit v_limit
  )
  -- Mọi dòng của một trận có cùng rounds/players/bot_count/games/settings_version → lấy max.
  select k.code,
         k.ended_at,
         max(m.rounds)::int,
         max(m.players)::int,
         max(m.bot_count)::int,
         max(m.games),
         max(m.settings_version)::int,
         jsonb_agg(
           jsonb_build_object(
             'user_id', m.user_id,
             'display_name', p.display_name,
             'avatar', p.avatar,
             'placement', m.placement,
             'match_points', m.match_points,
             'total_score', m.total_score
           )
           order by m.placement, m.total_score desc, m.user_id
         )
  from match_keys k
  join public.match_results m on m.room_code = k.code and m.created_at = k.ended_at
  left join public.profiles p on p.id = m.user_id
  group by k.code, k.ended_at
  order by k.ended_at desc, k.code desc;
end;
$$;

-- Số liệu theo game trong p_days ngày gần nhất (giờ Việt Nam, kẹp 1–3650); p_days null = mọi lúc.
-- party_matches = số trận có chơi game; brain_* = lượt Kiểm tra não. practice_* luôn là luỹ kế mọi
-- lúc (practice_bests chỉ giữ kỷ lục + tổng lượt, không có lịch sử từng lượt). Chỉ trả game có dữ liệu.
create or replace function public.admin_game_stats(p_days int default 30)
returns table (
  game_id text,
  party_matches int,
  brain_plays int,
  brain_avg_score numeric,
  practice_players int,
  practice_plays int
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_since timestamptz := '-infinity'::timestamptz;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_days is not null then
    v_since := (
      (now() at time zone 'Asia/Ho_Chi_Minh')::date - (least(greatest(p_days, 1), 3650) - 1)
    )::timestamp at time zone 'Asia/Ho_Chi_Minh';
  end if;

  return query
  with party as (
    select t.gid, count(*)::int as n
    from (
      select distinct m.room_code, m.created_at, g.gid
      from public.match_results m
      cross join lateral unnest(m.games) as g (gid)
      where m.created_at >= v_since
    ) t
    group by t.gid
  ),
  brain as (
    select bg.game_id as gid, count(*)::int as n, round(avg(bg.score), 1) as avg_score
    from public.brain_test_games bg
    where bg.created_at >= v_since
    group by bg.game_id
  ),
  practice as (
    select pb.game_id as gid,
           count(distinct pb.user_id)::int as player_count,
           sum(pb.plays)::int as play_count
    from public.practice_bests pb
    group by pb.game_id
  ),
  ids as (
    select pa.gid from party pa
    union
    select br.gid from brain br
    union
    select pr.gid from practice pr
  )
  select ids.gid,
         coalesce(pa.n, 0),
         coalesce(br.n, 0),
         br.avg_score,
         coalesce(pr.player_count, 0),
         coalesce(pr.play_count, 0)
  from ids
  left join party pa on pa.gid = ids.gid
  left join brain br on br.gid = ids.gid
  left join practice pr on pr.gid = ids.gid
  order by ids.gid;
end;
$$;

-- Cấu hình điểm hiện tại. updated_by_name = tên hiển thị (không có thì email) của người lưu cuối.
create or replace function public.admin_get_party_settings()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'version', s.version,
    'scoring', s.scoring,
    'disabled_games', to_jsonb(s.disabled_games),
    'updated_at', s.updated_at,
    'updated_by_name', coalesce(p.display_name, u.email::text)
  )
  into v_result
  from public.party_settings s
  left join public.profiles p on p.id = s.updated_by
  left join auth.users u on u.id = s.updated_by
  where s.id = 1;

  -- Dòng id 1 bị xoá tay: trả như bản mặc định.
  return coalesce(v_result, jsonb_build_object(
    'version', 0,
    'scoring', '{}'::jsonb,
    'disabled_games', '[]'::jsonb,
    'updated_at', null::timestamptz,
    'updated_by_name', null::text
  ));
end;
$$;

-- Lưu cấu hình: version + 1, ghi lịch sử cùng transaction, trả version mới.
-- Chỉ kiểm thô (object, ≤ 16 KB, ≤ 64 id game dạng a-z0-9-, mỗi id ≤ 40 ký tự, note ≤ 200);
-- kiểm chi tiết ở web (ScoringConfigSchema) và server (parsePartyConfig).
create or replace function public.admin_update_party_settings(
  p_scoring jsonb,
  p_disabled_games text[],
  p_note text default null
)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_note text := nullif(btrim(p_note), '');
  v_disabled text[];
  v_version int;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_scoring is null or jsonb_typeof(p_scoring) <> 'object' then
    raise exception 'p_scoring phải là object JSON' using errcode = '22023';
  end if;
  if octet_length(p_scoring::text) > 16384 then
    raise exception 'p_scoring quá lớn' using errcode = '22023';
  end if;
  if coalesce(array_ndims(p_disabled_games), 1) <> 1
     or coalesce(cardinality(p_disabled_games), 0) > 64 then
    raise exception 'p_disabled_games tối đa 64 id' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_disabled_games, '{}'::text[])) as g (gid)
    where g.gid is null or g.gid !~ '^[a-z0-9-]{1,40}$'
  ) then
    raise exception 'p_disabled_games có id không hợp lệ' using errcode = '22023';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'p_note tối đa 200 ký tự' using errcode = '22023';
  end if;

  -- Bỏ trùng, sắp theo tên.
  v_disabled := array(
    select distinct g.gid
    from unnest(coalesce(p_disabled_games, '{}'::text[])) as g (gid)
    order by g.gid
  );

  -- UPDATE khoá dòng id 1 → hai admin lưu cùng lúc vẫn nhận hai version liên tiếp.
  update public.party_settings s
     set version = s.version + 1,
         scoring = p_scoring,
         disabled_games = v_disabled,
         updated_at = now(),
         updated_by = v_uid
   where s.id = 1
  returning s.version into v_version;

  if v_version is null then
    -- Dòng id 1 bị xoá tay: tạo lại.
    insert into public.party_settings (id, version, scoring, disabled_games, updated_at, updated_by)
    values (1, 1, p_scoring, v_disabled, now(), v_uid)
    returning version into v_version;
  end if;

  insert into public.party_settings_history (version, scoring, disabled_games, note, changed_by)
  values (v_version, p_scoring, v_disabled, v_note, v_uid);

  return v_version;
end;
$$;

-- Lịch sử thay đổi cấu hình, mới nhất trước (p_limit kẹp 1–200).
create or replace function public.admin_settings_history(p_limit int default 20)
returns table (
  id bigint,
  version int,
  scoring jsonb,
  disabled_games text[],
  note text,
  changed_by_name text,
  changed_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_limit int := least(greatest(coalesce(p_limit, 20), 1), 200);
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select h.id, h.version, h.scoring, h.disabled_games, h.note,
         coalesce(p.display_name, u.email::text), h.changed_at
  from public.party_settings_history h
  left join public.profiles p on p.id = h.changed_by
  left join auth.users u on u.id = h.changed_by
  order by h.id desc
  limit v_limit;
end;
$$;

-- Danh sách quản trị viên, thêm trước đứng trước.
create or replace function public.admin_list_admins()
returns table (
  user_id uuid,
  display_name text,
  email text,
  note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select a.user_id, p.display_name, u.email::text, a.note, a.created_at
  from public.admins a
  left join public.profiles p on p.id = a.user_id
  left join auth.users u on u.id = a.user_id
  order by a.created_at, a.user_id;
end;
$$;

-- Thêm quản trị viên theo email (không phân biệt hoa thường). Chỉ tài khoản không ẩn danh có email
-- (đã đăng nhập Google ít nhất một lần); không thấy → 'not-found'. Đã là admin → cập nhật ghi chú
-- nếu có. Trả user_id.
create or replace function public.admin_add_admin(p_email text, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_note text := nullif(btrim(p_note), '');
  v_target uuid;
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_note is not null and char_length(v_note) > 200 then
    raise exception 'p_note tối đa 200 ký tự' using errcode = '22023';
  end if;

  if v_email is not null and v_email <> '' then
    select u.id into v_target
    from auth.users u
    where lower(u.email) = v_email and not u.is_anonymous
    order by u.last_sign_in_at desc nulls last
    limit 1;
  end if;
  if v_target is null then
    raise exception 'not-found' using errcode = 'P0002';
  end if;

  insert into public.admins as a (user_id, note, added_by)
  values (v_target, v_note, auth.uid())
  on conflict (user_id) do update set note = coalesce(excluded.note, a.note);

  return v_target;
end;
$$;

-- Gỡ quản trị viên. Không tự gỡ mình ('self'), không gỡ admin cuối ('last-admin').
-- Người được gỡ vốn không phải admin → không làm gì.
create or replace function public.admin_remove_admin(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_user_id is null then
    raise exception 'p_user_id không hợp lệ' using errcode = '22023';
  end if;
  if p_user_id = v_uid then
    raise exception 'self' using errcode = 'P0001';
  end if;

  -- Khoá ghi bảng admins: hai admin gỡ nhau cùng lúc thì người sau chờ, rồi kiểm lại từ đầu.
  lock table public.admins in share row exclusive mode;
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.admins a where a.user_id = p_user_id) then
    return;
  end if;
  if (select count(*) from public.admins) <= 1 then
    raise exception 'last-admin' using errcode = 'P0001';
  end if;

  delete from public.admins a where a.user_id = p_user_id;
end;
$$;

-- =====================================================================================
-- Quyền gọi RPC: cần phiên (khách ẩn danh cũng là role authenticated); hàm admin_* tự kiểm
-- is_admin() bên trong. Supabase mặc định cấp EXECUTE cho anon nên phải revoke riêng.
-- =====================================================================================

revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.log_login(text, text) from public, anon;
revoke execute on function public.delete_my_data() from public, anon;
revoke execute on function public.admin_overview(int) from public, anon;
revoke execute on function public.admin_login_events(int, timestamptz, text, text) from public, anon;
revoke execute on function public.admin_users(int, int, text, text) from public, anon;
revoke execute on function public.admin_matches(int, timestamptz, text) from public, anon;
revoke execute on function public.admin_game_stats(int) from public, anon;
revoke execute on function public.admin_get_party_settings() from public, anon;
revoke execute on function public.admin_update_party_settings(jsonb, text[], text) from public, anon;
revoke execute on function public.admin_settings_history(int) from public, anon;
revoke execute on function public.admin_list_admins() from public, anon;
revoke execute on function public.admin_add_admin(text, text) from public, anon;
revoke execute on function public.admin_remove_admin(uuid) from public, anon;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.log_login(text, text) to authenticated;
grant execute on function public.delete_my_data() to authenticated;
grant execute on function public.admin_overview(int) to authenticated;
grant execute on function public.admin_login_events(int, timestamptz, text, text) to authenticated;
grant execute on function public.admin_users(int, int, text, text) to authenticated;
grant execute on function public.admin_matches(int, timestamptz, text) to authenticated;
grant execute on function public.admin_game_stats(int) to authenticated;
grant execute on function public.admin_get_party_settings() to authenticated;
grant execute on function public.admin_update_party_settings(jsonb, text[], text) to authenticated;
grant execute on function public.admin_settings_history(int) to authenticated;
grant execute on function public.admin_list_admins() to authenticated;
grant execute on function public.admin_add_admin(text, text) to authenticated;
grant execute on function public.admin_remove_admin(uuid) to authenticated;
