-- Danh sách game quản trị viên tắt (CR-019) cho mọi người đọc, để Luyện tập ẩn game đó như trận party.
--
-- `party_settings` bật RLS, không có policy và đã `revoke all` khỏi anon/authenticated
-- (20261119000000_admin_console.sql): client không đọc thẳng được, còn `admin_get_party_settings`
-- chỉ cho admin và trả cả cấu hình điểm, người sửa cuối. Hàm dưới đây chỉ trả cột `disabled_games`
-- (dữ liệu không nhạy cảm, đằng nào cũng lộ qua state phòng party), không lộ gì khác.
--
-- Ai gọi: web (khoá publishable, có hoặc không có phiên) ở màn Luyện tập. Game server không cần
-- (đọc bảng bằng khoá secret). Web luôn kiểm lại bằng `parsePartyConfig`/`enabledGameIds` (bỏ id lạ,
-- còn < 2 game bật thì hiện cả danh mục).
--
-- Thứ tự triển khai: chạy được bất cứ lúc nào. Web mới gặp DB chưa có hàm thì hiện đủ danh mục như
-- trước (không báo lỗi). Không cần deploy lại game server.
-- Chạy như các file trước: SQL Editor (dán cả file) hoặc `supabase db push`.

-- Game đang bị tắt, theo đúng thứ tự đã lưu. Dòng id 1 bị xoá tay → mảng rỗng (không phải null).
create or replace function public.party_disabled_games()
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.disabled_games from public.party_settings s where s.id = 1),
    '{}'::text[]
  );
$$;

comment on function public.party_disabled_games() is
  'Game quản trị viên tắt (party_settings.disabled_games) cho mọi phiên đọc — Luyện tập ẩn các game này.';

revoke execute on function public.party_disabled_games() from public;
grant execute on function public.party_disabled_games() to anon, authenticated;
