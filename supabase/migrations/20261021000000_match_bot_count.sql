-- CR-016: chơi với bot (ADR 0014).
--
-- Mỗi dòng `match_results` (một người đã đăng nhập, một trận) ghi thêm `bot_count`: số bot trong
-- phòng lúc vào vinh danh. Cột `players` vẫn là tổng số ghế (người thật + bot); bot không có tài
-- khoản nên không có dòng riêng. Màn Tài khoản gắn nhãn "Đấu với máy" cho trận có `bot_count > 0`.
-- Bảng xếp hạng không đọc `match_results`, nên trận có bot không ảnh hưởng xếp hạng.
--
-- Dòng cũ nhận 0 (trận chỉ có người thật).
-- Quyền: chỉ game server ghi (khoá secret, bỏ qua RLS); người dùng đọc dòng của mình qua policy
-- `match_results_select_own` sẵn có — policy/grant áp cho cả bảng nên phủ luôn cột mới.

alter table public.match_results
  add column bot_count smallint not null default 0
    check (bot_count >= 0);

comment on column public.match_results.bot_count is
  'Số bot trong trận lúc vào vinh danh (CR-016). 0 = chỉ có người thật; players đã gồm cả bot.';
