# ADR 0011: Tài khoản, lịch sử điểm và bảng xếp hạng trên Supabase; Kiểm tra não chấm trên game server

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-16
- Liên quan: [CR-009](../../00-tracking/change-requests.md#cr-009), [ADR 0002](0002-game-server-colyseus-vs-supabase-realtime.md), UC-13, UC-14, UC-16, UC-19 trong [SRS](../../01-product/srs.md)

## Bối cảnh

CR-009 đưa Luyện tập, Kiểm tra não, Tài khoản và Bảng xếp hạng lên làm trước. Cần:

- Đăng nhập khách ẩn danh + Google, lưu lịch sử điểm lâu dài.
- Bảng xếp hạng có giá trị, tức là điểm phải do **server chấm** (bất biến 2), không phải client tự báo.
- Game vẫn chơi được khi Supabase chưa cấu hình hoặc đang tạm dừng (rủi ro R-10).

ADR 0002 đã chốt Supabase chỉ lo tài khoản và dữ liệu, không làm real-time.

## Quyết định

**Supabase Auth + Postgres** lưu tài khoản, lịch sử và bảng xếp hạng. **Game server Colyseus là nơi duy nhất ghi điểm được xếp hạng** (Kiểm tra não, kết quả trận party) bằng khoá bí mật. Client chỉ ghi được hồ sơ của mình và kỷ lục luyện tập (không lên bảng xếp hạng). Kiểm tra não chạy trong một phòng solo mới `BrainTestRoom` trên Colyseus; Luyện tập chạy hoàn toàn trên máy, không cần server.

## Hợp đồng

### Biến môi trường

| Nơi | Biến | Ghi chú |
| --- | --- | --- |
| web | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Khoá publishable (`sb_publishable_…`, hoặc anon key kiểu cũ), công khai được |
| server | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | Khoá secret (`sb_secret_…`, hoặc service_role kiểu cũ). **Không bao giờ** đưa vào web |

Thiếu biến → tính năng tài khoản **tắt êm**: web ẩn đăng nhập, lịch sử và bảng xếp hạng hiện "Chưa kết nối máy chủ dữ liệu"; server bỏ qua bước ghi. Party, Luyện tập, Kiểm tra não vẫn chơi được.

### Danh tính

- Phiên khách được tạo **lười**: lần đầu người chơi tạo/vào phòng, kết thúc một lượt luyện tập, bắt đầu Kiểm tra não hoặc mở Lịch sử → `signInAnonymously()` nếu chưa có phiên.
- Liên kết Google: `linkIdentity({ provider: "google" })` (giữ nguyên `user_id`, giữ lịch sử). Google đã gắn với tài khoản khác → đề nghị **Đăng nhập bằng Google** (`signInWithOAuth`), chuyển sang tài khoản đó; lịch sử của phiên khách trên máy này không gộp.
- Client gửi `accessToken` (JWT Supabase) trong join options của phòng party và phòng Kiểm tra não. Server xác thực bằng `auth.getClaims(token)` (hoặc `auth.getUser`) để lấy `user_id`; token sai/hết hạn → vẫn cho chơi, chỉ không ghi kết quả. `user_id` giữ trong `Map` riêng của room, **không** đồng bộ xuống client.

### Bảng dữ liệu (`supabase/migrations/`)

| Bảng | Cột chính | Ai ghi | RLS đọc |
| --- | --- | --- | --- |
| `profiles` | `id` (= `auth.users.id`), `display_name` (1–16 ký tự), `avatar`, `updated_at` | Client, chỉ dòng của mình | Chỉ chủ. Tên + nhân vật của người khác chỉ đọc được qua RPC bảng xếp hạng (`security definer`) |
| `brain_tests` | `id`, `user_id`, `brain_score`, `difficulty`, `rules_version` (= `BRAIN_TEST_RULES_VERSION`), `skills` (jsonb 5 nhóm → điểm), `created_at` | Server | Chỉ chủ |
| `brain_test_games` | `id`, `brain_test_id`, `user_id`, `game_id`, `category`, `score`, `correct`, `created_at` | Server | Chỉ chủ |
| `match_results` | `id`, `user_id`, `room_code`, `placement` (0 = nhất), `players`, `match_points`, `total_score`, `rounds`, `games` (text[]), `category_scores` (jsonb), `category_titles` (text[]) — hai cột sau thêm ở CR-010, `bot_count` (số bot trong trận, thêm ở CR-016, [ADR 0014](0014-server-side-bots.md)), `created_at` | Server | Chỉ chủ |
| `practice_bests` | khoá (`user_id`, `game_id`, `difficulty`), `best_score`, `best_correct`, `plays`, `updated_at` | Client qua RPC | Chỉ chủ |

Mọi khoá ngoại tới `auth.users` (và `brain_test_games` → `brain_tests`) đều `on delete cascade`: xoá tài khoản Auth là xoá sạch dữ liệu của người đó. RPC bảng xếp hạng trả `user_id` (định danh giả, không gắn email) để web tô dòng của mình; ngoài ra chỉ lộ tên hiển thị + nhân vật.

### Hàm RPC (Postgres, `security definer`, gọi bằng `supabase.rpc`)

| Hàm | Tham số | Trả về | Ai gọi |
| --- | --- | --- | --- |
| `submit_practice_result` | `p_game_id text, p_difficulty int, p_score int, p_correct int` | dòng `practice_bests` sau khi cập nhật (giữ điểm cao nhất, `plays + 1`) | Client đã có phiên |
| `leaderboard_brain` | `p_period text` (`'week'` \| `'all'`), `p_limit int` (≤ 100) | `rank, user_id, display_name, avatar, score, achieved_at` — điểm cao nhất mỗi người | Ai cũng gọi được (kể cả chưa đăng nhập) |
| `leaderboard_game` | `p_game_id text, p_period text, p_limit int` | như trên, điểm cao nhất của game đó trong các lượt Kiểm tra não | Ai cũng gọi được |
| `my_rank_brain` | `p_period text` | `rank, score` hoặc rỗng | Client đã có phiên |
| `my_rank_game` | `p_game_id text, p_period text` | `rank, score` hoặc rỗng | Client đã có phiên |
| `delete_my_data` | — | — | Client đã có phiên; xoá tài khoản Auth của mình (`auth.users`), 5 bảng xoá theo cascade. Gọi xong client `signOut({ scope: "local" })` |

- Bốn hàm `leaderboard_*` và `my_rank_*` nhận thêm tham số cuối `p_rules_version int` (client truyền `BRAIN_TEST_RULES_VERSION`) và chỉ xếp các lượt cùng phiên bản luật, vì đổi điểm chuẩn thì điểm cũ và mới không so được.
- "Tuần này" bắt đầu thứ Hai 00:00 giờ Việt Nam (`Asia/Ho_Chi_Minh`).
- Xếp hạng bằng `rank()` theo điểm giảm dần: bằng điểm thì cùng hạng.

### Phòng Kiểm tra não (`BrainTestRoom`, tên room `brain-test`)

- Riêng một người (`maxClients = 1`), không có mã phòng, không nối lại sau khi rời (rớt mạng giữ chỗ như party).
- Server chọn 5 game (mỗi nhóm một game) bằng hàm thuần trong `packages/shared/src/brain-test.ts`; độ khó **cố định** cho mọi người (hằng số) để bảng xếp hạng so sánh được.
- Pha: `intro` (game thứ i) → `countdown` → `playing` → `game-result` → … → `finished`. Chấm từng câu **dùng chung** logic chấm của `PartyRoom` (tách ra module dùng chung trên server), cùng luật khoá khi sai, chống spam, dung sai hết giờ.
- Hết game thứ 5: tính Điểm Não và điểm 5 kỹ năng bằng hàm trong `brain-test.ts`, ghi `brain_tests` + `brain_test_games` nếu có `user_id`.
- State đồng bộ có hình dạng `BrainStateView` trong shared, có test so khoá như `PartyStateView`. Tin nhắn mới đều có schema zod trong `protocol.ts`.
- Ở pha `intro` quá `BRAIN_TEST_INTRO_IDLE_MS` (5 phút, `constants.ts`) mà chưa bấm Sẵn sàng → server huỷ lượt (không lưu) và đóng phòng với close code `BRAIN_TEST_IDLE_CLOSE_CODE` (4100), để máy Fly không bị giữ thức.

### Kết quả trận party

Khi trận vào `podium`, `PartyRoom` ghi một dòng `match_results` cho mỗi người chơi đã xác thực. Việc ghi chạy nền, lỗi chỉ log, không chặn trận.

### Ghi dữ liệu trên server

Server truy cập Supabase qua một interface `ResultStore` (`saveBrainTest`, `saveMatchResults`, `verifyToken`): bản thật dùng `@supabase/supabase-js`, bản rỗng khi thiếu biến môi trường, bản giả trong RAM cho test. Test không gọi mạng.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Server Colyseus chấm Kiểm tra não, ghi bằng khoá secret (chọn) | Đúng bất biến "server là trọng tài"; dùng lại code chấm của party | Kiểm tra não cần mạng; thêm một loại phòng |
| Client chơi offline, gửi nhật ký đáp án, server chấm lại | Chơi được khi mạng yếu | Mốc thời gian do client tự báo, giả được; thêm endpoint HTTP |
| Client tự gửi điểm lên Supabase | Nhanh nhất | Mở DevTools là sửa được điểm; bảng xếp hạng mất giá trị |
| Tự làm tài khoản trên game server | Không thêm dịch vụ | Phải tự làm OAuth, lưu trữ, sao lưu; máy Fly tự tắt nên cần DB riêng |

## Hệ quả

- Thêm dịch vụ ngoài (Supabase Free, 0 đồng). Dự án Free tạm dừng sau khoảng 1 tuần không dùng (R-10): app vẫn chơi được, chỉ mất lưu điểm tới khi bật lại.
- Bắt đầu thu thập dữ liệu cá nhân (tên hiển thị, email Google): sửa NFR-PRIV-01, có nút xoá dữ liệu của tôi (xoá luôn tài khoản Auth, dữ liệu xoá theo cascade).
- `profiles` không đọc công khai: người khác chỉ thấy tên + nhân vật qua bảng xếp hạng. `user_id` (UUID ngẫu nhiên, không gắn email) vẫn lộ trong RPC bảng xếp hạng để client nhận ra dòng của mình; chấp nhận vì không suy ra được danh tính.
- Hạn chế đã biết giữ như NFR-SEC-02: client biết seed nên người rành code vẫn có thể viết bot giải câu đố. Chấp nhận ở quy mô hiện tại; xem lại nếu bảng xếp hạng bị lạm dụng.
- Bảng xếp hạng bạn bè chưa làm vì chưa có tính năng kết bạn; khi có (CR mới) thì thêm `leaderboard_friends` cùng kiểu trả về.
- Xem xét lại nếu: vượt hạn mức Supabase Free, hoặc chuyển game server sang Cloudflare Durable Objects (`ResultStore` giữ nguyên, chỉ đổi lớp phòng).
