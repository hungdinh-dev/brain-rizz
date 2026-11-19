-- CR-020: game yêu thích ở Luyện tập (docs/01-product/practice-favorites-howto-routes.md mục 3.1).
--
-- Ai ghi gì:
--   - Client (mọi phiên, kể cả khách ẩn danh): chỉ qua 3 RPC `practice_favorites_get`,
--     `practice_favorites_set`, `practice_favorites_merge`, luôn trên dòng của chính mình (auth.uid()).
--   - Game server không đọc/ghi bảng này.
-- Bảng bật RLS và KHÔNG có policy: client không đọc/ghi thẳng được, chỉ qua RPC `security definer`.
-- Trần 64 game mỗi người. DB chỉ kiểm dạng id (a-z0-9-, ≤ 40 ký tự), không kiểm id có thật:
-- web bỏ id không có trong GAME_IDS khi đọc.
-- "Xoá dữ liệu của tôi" xoá theo cascade (FK auth.users), không cần sửa `delete_my_data`.
--
-- Lỗi trả về (supabase-js: error.code / error.message): chưa có phiên → 28000; id sai dạng hoặc
-- p_favorite null → 22023; thêm game thứ 65 → 'limit' (P0001).
--
-- Thứ tự triển khai: chạy file này TRƯỚC khi deploy web mới (web cũ không gọi các RPC này; web mới
-- gặp DB chưa có hàm thì chỉ lưu yêu thích trên máy). Không cần deploy lại game server.
-- Chạy như các file trước: SQL Editor (dán cả file) hoặc `supabase db push`.

-- =====================================================================================
-- Bảng
-- =====================================================================================

-- Game yêu thích. Thứ tự hiển thị = created_at (thêm trước đứng trước), trùng thì theo game_id.
create table public.practice_favorites (
  user_id uuid not null references auth.users (id) on delete cascade,
  game_id text not null check (game_id ~ '^[a-z0-9-]{1,40}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

comment on table public.practice_favorites is
  'Game yêu thích ở Luyện tập (CR-020), tối đa 64 mỗi người. Chỉ đọc/ghi qua RPC practice_favorites_*.';

-- Không cần index thêm: PK (user_id, game_id) đã phục vụ lọc theo người và xoá theo cascade;
-- mỗi người tối đa 64 dòng nên sắp theo created_at không tốn.

-- =====================================================================================
-- RLS
-- =====================================================================================

-- Bật RLS, không tạo policy: anon/authenticated không đọc/ghi thẳng được.
alter table public.practice_favorites enable row level security;

-- Chặn thêm một lớp ở mức quyền bảng (Supabase mặc định cấp mọi quyền cho anon/authenticated).
revoke all on table public.practice_favorites from anon, authenticated;

-- =====================================================================================
-- RPC (gọi bằng supabase.rpc). Cần phiên: khách ẩn danh cũng là role authenticated.
-- Hàm ghi khoá theo người (advisory lock trong transaction, cùng một khoá cho set và merge): hai
-- thiết bị cùng thêm lúc gần trần thì máy sau chờ máy trước xong rồi mới đếm, nên không vượt 64.
-- =====================================================================================

-- Danh sách yêu thích của mình, thêm trước đứng trước. Chưa có gì → mảng rỗng (không phải null).
create or replace function public.practice_favorites_get()
returns text[]
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;

  return array(
    select f.game_id
    from public.practice_favorites f
    where f.user_id = v_uid
    order by f.created_at, f.game_id
  );
end;
$$;

-- Thêm (p_favorite = true) hoặc bỏ (false) một game.
-- Thêm game đã có → không làm gì (kể cả khi đang đủ 64). Thêm game mới khi đã có 64 → 'limit'.
-- Bỏ game không có → không làm gì.
create or replace function public.practice_favorites_set(p_game_id text, p_favorite boolean)
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
  if p_game_id is null or p_game_id !~ '^[a-z0-9-]{1,40}$' then
    raise exception 'p_game_id không hợp lệ' using errcode = '22023';
  end if;
  if p_favorite is null then
    raise exception 'p_favorite không hợp lệ' using errcode = '22023';
  end if;

  if not p_favorite then
    -- Bỏ chỉ làm số dòng giảm, không cần khoá.
    delete from public.practice_favorites f
    where f.user_id = v_uid and f.game_id = p_game_id;
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended('practice_favorites:' || v_uid::text, 0));

  if exists (
    select 1 from public.practice_favorites f
    where f.user_id = v_uid and f.game_id = p_game_id
  ) then
    return;
  end if;

  if (select count(*) from public.practice_favorites f where f.user_id = v_uid) >= 64 then
    raise exception 'limit' using errcode = 'P0001';
  end if;

  insert into public.practice_favorites (user_id, game_id)
  values (v_uid, p_game_id)
  on conflict (user_id, game_id) do nothing;
end;
$$;

-- Gộp (hợp) danh sách trên máy vào tài khoản, trả danh sách sau gộp (như practice_favorites_get).
-- Bỏ phần tử null, sai dạng, trùng (giữ lần xuất hiện đầu). Game đã có trên tài khoản giữ nguyên
-- vị trí; game mới thêm vào sau theo thứ tự trong mảng, tới khi đủ 64 thì bỏ phần còn lại (không
-- báo lỗi). Chỉ xét 256 phần tử đầu của mảng (web gửi tối đa số game hiện có).
-- Các dòng thêm trong một lần gộp có cùng now() → cộng thêm 1 µs theo thứ tự để giữ đúng thứ tự.
create or replace function public.practice_favorites_merge(p_game_ids text[])
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_room int;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '28000';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('practice_favorites:' || v_uid::text, 0));

  select 64 - count(*) into v_room
  from public.practice_favorites f
  where f.user_id = v_uid;

  if v_room > 0 and p_game_ids is not null then
    insert into public.practice_favorites (user_id, game_id, created_at)
    select v_uid, c.gid, now() + c.pos * interval '1 microsecond'
    from (
      select n.gid, row_number() over (order by n.first_ord) as pos
      from (
        select g.gid, min(g.ord) as first_ord
        from unnest(p_game_ids) with ordinality as g (gid, ord)
        where g.ord <= 256 and g.gid ~ '^[a-z0-9-]{1,40}$'
        group by g.gid
      ) n
      where not exists (
        select 1 from public.practice_favorites f
        where f.user_id = v_uid and f.game_id = n.gid
      )
    ) c
    where c.pos <= v_room
    on conflict (user_id, game_id) do nothing;
  end if;

  return array(
    select f.game_id
    from public.practice_favorites f
    where f.user_id = v_uid
    order by f.created_at, f.game_id
  );
end;
$$;

-- =====================================================================================
-- Quyền gọi RPC. Supabase mặc định cấp EXECUTE cho anon nên phải revoke riêng.
-- =====================================================================================

revoke execute on function public.practice_favorites_get() from public, anon;
revoke execute on function public.practice_favorites_set(text, boolean) from public, anon;
revoke execute on function public.practice_favorites_merge(text[]) from public, anon;

grant execute on function public.practice_favorites_get() to authenticated;
grant execute on function public.practice_favorites_set(text, boolean) to authenticated;
grant execute on function public.practice_favorites_merge(text[]) to authenticated;
