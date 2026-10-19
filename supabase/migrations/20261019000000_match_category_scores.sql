-- CR-010: điểm theo thể loại trong trận party.
--
-- Mỗi dòng `match_results` (một người đã đăng nhập, một trận) ghi thêm:
--   - `category_scores`: tổng điểm vòng cả trận theo thể loại game, vd `{"identify": 1200, "visualize": 0}`.
--     Chỉ thể loại đã chơi trong trận mới có khoá (kể cả 0 điểm) → màn Tài khoản tính điểm trung bình
--     mỗi thể loại chỉ trên các trận có chơi thể loại đó.
--   - `category_titles`: các thể loại người này giành danh hiệu "giỏi nhất" trong trận
--     (`categoryLeaders` ở packages/shared/src/match.ts: điểm cao nhất > 0, hoà thì cùng nhận).
--
-- Dòng cũ nhận giá trị mặc định rỗng (coi như không có dữ liệu thể loại).
-- Quyền: chỉ game server ghi (khoá secret, bỏ qua RLS); người dùng đọc dòng của mình qua policy
-- `match_results_select_own` sẵn có — policy/grant áp cho cả bảng nên phủ luôn hai cột mới.

alter table public.match_results
  add column category_scores jsonb not null default '{}'::jsonb
    check (jsonb_typeof(category_scores) = 'object'),
  add column category_titles text[] not null default '{}'
    check (category_titles <@ array['identify', 'memorize', 'analyze', 'compute', 'visualize']::text[]);

comment on column public.match_results.category_scores is
  'Tổng điểm vòng cả trận theo thể loại (CR-010). Chỉ thể loại đã chơi có khoá, kể cả 0 điểm.';
comment on column public.match_results.category_titles is
  'Thể loại người này giành danh hiệu giỏi nhất trong trận (điểm cao nhất > 0, hoà thì cùng nhận).';
