# ADR 0015: Trang quản trị — quyền qua bảng `admins` + RPC, cấu hình trận party có phiên bản

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-19
- Bổ sung cho: [ADR 0011](0011-supabase-accounts-and-solo-modes.md) (Supabase, khoá secret chỉ ở server, server chỉ ghi kết quả cho người đã xác thực), [ADR 0002](0002-game-server-colyseus-vs-supabase-realtime.md) (server vẫn là trọng tài)
- Liên quan: [CR-019](../../00-tracking/change-requests.md#cr-019), [Kế hoạch trang quản trị](../../01-product/admin-console.md), [Cài Supabase › Trang quản trị](../../03-guides/supabase-setup.md#8-trang-quản-trị-cr-019)

## Bối cảnh

CR-019 thêm trang `/admin`: quản trị viên chỉnh **công thức điểm + hệ số của trận party**, bật/tắt game, xem lịch sử đăng nhập, người chơi, trận đấu, số liệu tổng quan, phòng đang mở và danh sách quản trị viên.

Ràng buộc:

- Web là SPA tĩnh (ADR 0005), chỉ có khoá publishable của Supabase. Khoá secret chỉ nằm ở game server (ADR 0011). Không có backend riêng cho trang quản trị.
- Trang lộ **email** người chơi (có trẻ em chơi), nên quyền phải kiểm ở phía dữ liệu, không dựa vào việc web ẩn nút.
- Bất biến 2: server quyết định điểm. Cấu hình điểm do admin nhập lại thành **dữ liệu** server dùng để chấm, nên DB không được làm hỏng phòng (số âm, thiếu trường, game lạ).
- Phòng đang mở chỉ có trong RAM của game server, Supabase không biết.
- Trận đang chơi không được đổi luật giữa chừng. Kết quả trận phải biết đã chấm theo bản cấu hình nào.
- Giữ dữ liệu tối thiểu: không ghi IP.

## Quyết định

Quyền admin là **một dòng trong bảng `admins`**, mọi đọc/ghi của trang đi qua **RPC `security definer` kiểm `is_admin()`** (bảng bật RLS, không có policy nào). Phần cần game server (phòng đang mở, nạp lại cấu hình) là **route HTTP `/admin` trên game server**, xác thực bằng **access token Supabase**. Cấu hình điểm là **một dòng `party_settings` có phiên bản**. Server đọc nó qua `parsePartyConfig` (không tin DB), đệm 30 giây, **chụp một bản cho mỗi trận** và đồng bộ bản chụp xuống client qua state. Cấu hình **chỉ áp dụng cho trận party**.

### Cách làm

- **Supabase** (`supabase/migrations/20261119000000_admin_console.sql`):
  - 4 bảng mới `admins`, `party_settings` (đúng một dòng id 1), `party_settings_history`, `login_events` bật RLS và **không có policy**, đồng thời `revoke all` với `anon`/`authenticated`. Client không đọc/ghi thẳng được bảng nào.
  - RPC `admin_*` (`security definer`, `set search_path = ''`) mở đầu bằng `if not public.is_admin() then raise exception 'forbidden'`. Email (`auth.users`) chỉ lộ trong các hàm này. Lỗi có mã cố định để web dịch: `forbidden` (42501), `not-found` (P0002), `self` / `last-admin` (P0001).
  - Không bao giờ hết admin: `admin_remove_admin` không gỡ admin cuối, `delete_my_data` chặn admin duy nhất. Cả hai khoá ghi bảng `admins` trước khi đếm. Admin đầu tiên thêm bằng một câu SQL.
  - `admin_update_party_settings` tăng `version`, ghi lịch sử cùng transaction, chỉ kiểm thô (object, số lượng, độ dài). Kiểm chi tiết ở web (zod `ScoringConfigSchema`) và ở server.
  - `log_login` (mọi phiên) ghi sự kiện đăng nhập của chính người gọi: `provider` lấy từ JWT, `device` chỉ là "trình duyệt · hệ điều hành", **không ghi IP**.
  - `match_results.settings_version` ghi phiên bản cấu hình trận đã dùng (0 = mặc định trong code).
- **Game server** (`apps/server`):
  - `src/admin/routes.ts` gắn ở `/admin`: `Authorization: Bearer <access token>` → `verifyToken` → `isAdmin` (đọc `admins` bằng khoá secret). Thiếu/sai token 401, không phải admin 403, chưa cấu hình Supabase 503. CORS `*`, không dùng cookie. `GET /admin/rooms` chỉ trả số liệu phòng (không có tên người chơi); `POST /admin/config/reload` xoá đệm và nạp lại.
  - `store/party-config-cache.ts`: đệm 30 giây mỗi tiến trình, nhiều phòng hỏi cùng lúc chỉ đọc một lần, chờ DB tối đa 2 giây rồi dùng bản đang có. Đọc lỗi hoặc ra rỗng thì giữ bản cũ, chưa có thì `DEFAULT_PARTY_CONFIG`.
  - Mọi cấu hình đọc từ DB đi qua `parsePartyConfig` (shared): kiểm **từng trường**, sai trường nào về mặc định trường đó, không bao giờ ném lỗi.
  - `PartyRoom` nạp cấu hình lúc tạo phòng và mỗi lần bắt đầu trận (phòng chờ, Chơi lại). Cả trận dùng **một bản chụp** cho điểm câu (người và bot), điểm thứ hạng và game bị tắt. Bản chụp nằm trong state (`disabledGames`, `scoringJson`, `configVersion`) để web hiện đúng hệ số.
- **Phạm vi:** Luyện tập và Kiểm tra não luôn chấm bằng `DEFAULT_SCORING`, để bảng xếp hạng không lệch theo cấu hình.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Bảng `admins` + RPC `security definer` kiểm `is_admin()`, không policy đọc trực tiếp (chọn) | Quyền kiểm ở DB, web chỉ cần khoá publishable; mỗi RPC trả đúng cột cần (email chỉ ở đây); thêm/gỡ admin ngay trên trang | Mỗi màn một RPC viết tay bằng SQL; đổi cột phải sửa migration và hợp đồng |
| Custom claim `role = admin` trong JWT (Auth hook) | Kiểm quyền rẻ, policy RLS đọc thẳng claim | Cần Auth hook; đổi quyền phải chờ token mới; khó liệt kê/gỡ admin trên trang |
| Policy RLS cho admin đọc thẳng bảng | Ít SQL hơn | `auth.users` (email) không đọc được qua API; policy rải nhiều bảng, dễ sót một bảng lộ dữ liệu |
| Toàn bộ API admin trên game server (khoá secret) | Một nơi kiểm quyền bằng TypeScript | Game server tự tắt khi rảnh (ADR 0004), mở trang phải đánh thức máy; thêm bề mặt tấn công cho tiến trình chơi game |
| Cấu hình điểm làm biến môi trường / hằng số, deploy để đổi | Không cần bảng, không cần đệm | Mỗi lần chỉnh phải deploy; không có lịch sử; trận đang chơi không có bản chụp rõ ràng |
| Server đọc DB mỗi câu trả lời (không đệm, không chụp) | Đổi là có hiệu lực ngay | Đổi luật giữa trận; tải DB theo số câu; DB chậm làm treo chấm điểm |

## Hệ quả

- **Dễ hơn:**
  - Chỉnh điểm, hệ số, bật/tắt game không cần deploy. Mỗi lần lưu có lịch sử, và mỗi trận ghi `settings_version`, nên biết trận nào chấm theo bản nào.
  - DB hỏng hay chậm không làm sập hoặc treo phòng: `parsePartyConfig` về mặc định từng trường, đệm giữ bản cũ, chờ tối đa 2 giây.
  - Web hiện đúng hệ số của trận đang chơi từ state, không cần gọi Supabase.
- **Khó hơn / chấp nhận:**
  - Bắt đầu trận thành bất đồng bộ (chờ cấu hình): phòng có thể đổi trong lúc chờ, nên server kiểm lại điều kiện và báo lỗi cho chủ phòng, lệnh mới nhất thắng (`PartyRoom.requestBegin`).
  - Admin lưu xong thì trận **kế tiếp** mới áp dụng, sau tối đa 30 giây (hoặc ngay khi web gọi `/admin/config/reload`). Đệm theo tiến trình: chạy nhiều máy thì mỗi máy tự hết hạn đệm, reload chỉ tới máy nhận yêu cầu.
  - "Số trận" trên trang chỉ tính trận có ít nhất một người chơi có token hợp lệ, vì server chỉ ghi `match_results` cho người đã xác thực (ADR 0011).
  - `GET /admin/rooms` chỉ thấy phòng trên tiến trình nhận yêu cầu.
  - Advisors của Supabase báo "RLS Enabled No Policy" cho 4 bảng mới. Đó là cố ý.
- **Khi nào xem lại:**
  - Chạy nhiều máy game server: cần báo reload tới mọi máy (pub/sub) và gom danh sách phòng (presence/driver dùng chung).
  - Muốn cấu hình cho Luyện tập/Kiểm tra não, hay admin đóng phòng, đuổi người, sửa dữ liệu người chơi (ngoài phạm vi CR-019).
  - Số admin hoặc số màn tăng nhiều, RPC viết tay khó theo kịp: cân nhắc phân quyền nhiều mức (vai trò trong `admins`) hoặc một lớp API riêng.
