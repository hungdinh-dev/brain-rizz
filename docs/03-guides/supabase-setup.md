# Cài đặt Supabase (tài khoản, lịch sử, bảng xếp hạng)

Hướng dẫn cho chủ dự án, làm **một lần** cho mỗi project Supabase. Bối cảnh và hợp đồng dữ liệu: [ADR 0011](../02-architecture/decisions/0011-supabase-accounts-and-solo-modes.md), [CR-009](../00-tracking/change-requests.md#cr-009).

Chưa làm các bước này thì app **vẫn chơi được** (party, Luyện tập, Kiểm tra não); chỉ phần đăng nhập, lịch sử và bảng xếp hạng báo "Chưa kết nối máy chủ dữ liệu".

## Tóm tắt

| Bước | Ở đâu | Kết quả |
| --- | --- | --- |
| 1. Tạo project | supabase.com | URL dự án, khoá publishable, khoá secret |
| 2. Chạy migration | SQL Editor hoặc Supabase CLI | 5 bảng, RLS, 6 hàm RPC |
| 3. Bật đăng nhập khách + liên kết thủ công | Authentication → Sign In / Providers | `signInAnonymously()`, `linkIdentity()` chạy được |
| 4. Bật Google | Google Cloud Console + Supabase | Nút "Liên kết Google" chạy được |
| 5. Site URL, Redirect URLs | Authentication → URL Configuration | Đăng nhập Google quay về đúng app |
| 6. Biến môi trường | `apps/*/.env`, Fly secrets, Cloudflare Pages | Web và server nối được Supabase |
| 7. Kiểm tra nhanh | Trình duyệt + SQL Editor | Có dòng trong `brain_tests` sau một lượt Kiểm tra não |
| 8. Trang quản trị | SQL Editor | Admin đầu tiên vào được `/admin` |

## 1. Tạo project

1. Vào [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Tên: `brain-rizz`. Region: **Southeast Asia (Singapore)** (`ap-southeast-1`, gần game server Fly `sin` và người chơi Việt Nam). Gói **Free**.
   - Form mới có thể chỉ cho chọn vùng lớn (Americas / Europe / **Asia-Pacific**): chọn Asia-Pacific, tạo xong xem region thật ở **Project Settings → General**. Không ra Singapore vẫn dùng được (chơi realtime đi qua Fly, Supabase chỉ ghi điểm cuối trận và đọc bảng xếp hạng); region không đổi được sau khi tạo.
3. Đặt mật khẩu database mạnh, lưu vào trình quản lý mật khẩu (chỉ cần khi dùng CLI).
4. Chờ project tạo xong, mở **Project Settings → API Keys** và ghi lại:
   - **Project URL**: `https://<project-ref>.supabase.co` (ở Project Settings → Data API, hoặc nút **Connect**).
   - **Publishable key** (`sb_publishable_…`): dùng cho web, công khai được.
   - **Secret key** (`sb_secret_…`): chỉ dùng cho game server. **Không** dán vào web, chat, issue hay commit.

Project tạo trước khi Supabase có khoá mới thì dùng tab **Legacy API Keys**: `anon` thay cho publishable, `service_role` thay cho secret. Code chạy được với cả hai kiểu.

Gói Free tự tạm dừng sau khoảng 1 tuần không có truy cập (rủi ro R-10). Khi đó app vẫn chơi được, chỉ không lưu điểm; vào dashboard bấm **Restore** để bật lại.

## 2. Chạy migration

Chạy **mọi file** trong [`supabase/migrations/`](../../supabase/migrations/) theo thứ tự tên (hiện có `20261016000000_accounts.sql`, `20261019000000_match_category_scores.sql` của [CR-010](../00-tracking/change-requests.md#cr-010), `20261021000000_match_bot_count.sql` của [CR-016](../00-tracking/change-requests.md#cr-016) và `20261119000000_admin_console.sql` của [CR-019](../00-tracking/change-requests.md#cr-019), file này phải chạy **trước** khi deploy game server mới, xem [mục 8](#8-trang-quản-trị-cr-019)). Chọn **một** trong hai cách, và đã chọn cách nào thì giữ cách đó cho các lần sau.

**Cách A: Supabase CLI với chuỗi kết nối (nên dùng, CLI tự nhớ file nào đã chạy)**

1. Dashboard → nút **Connect** → tab **Connection String** → mục **Session pooler** (chạy trên IPv4; mục *Direct connection* `db.<ref>.supabase.co` chỉ có IPv6, nhiều mạng nhà ở Việt Nam không phân giải được).
2. Tạo `supabase/.env` (bị gitignore) với một dòng, thay `[YOUR-PASSWORD]` bằng mật khẩu database:

   ```bash
   SUPABASE_DB_URL=postgresql://postgres.<project-ref>:<mật-khẩu>@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
   ```

3. Chạy từ thư mục gốc repo (Git Bash):

   ```bash
   set -a; . supabase/.env; set +a
   npx supabase@2.121.0 migration list --db-url "$SUPABASE_DB_URL"        # cột remote trống = chưa chạy
   npx supabase@2.121.0 db push --db-url "$SUPABASE_DB_URL" --dry-run     # xem sẽ chạy file nào
   npx supabase@2.121.0 db push --db-url "$SUPABASE_DB_URL"               # chạy thật
   ```

Quên mật khẩu database: **Project Settings → Database → Reset database password**, rồi sửa `supabase/.env`.

**Cách B: SQL Editor (không cần cài gì)**

1. Dashboard → **SQL Editor** → **New query**.
2. Dán toàn bộ nội dung từng file migration, lần lượt theo thứ tự tên → **Run**.
3. Kết quả "Success. No rows returned" là xong. Chạy lại lần hai sẽ báo lỗi "already exists": bình thường. Cách này không ghi lịch sử cho CLI, nên đừng trộn với cách A (CLI sẽ tưởng chưa chạy và chạy lại).

Thay đổi về sau (thêm cột, sửa hàm) luôn là **file migration mới** trong `supabase/migrations/`, không sửa file đã chạy.

Sau khi chạy, **Table Editor** có 5 bảng `profiles`, `brain_tests`, `brain_test_games`, `match_results`, `practice_bests`, đều có nhãn RLS enabled. **Database → Functions** có `submit_practice_result`, `leaderboard_brain`, `leaderboard_game`, `my_rank_brain`, `my_rank_game`, `delete_my_data` (cùng vài hàm nội bộ không gọi được từ API). File của trang quản trị thêm 4 bảng và 13 hàm, xem [mục 8](#8-trang-quản-trị-cr-019).

## 3. Bật đăng nhập khách và liên kết thủ công

Dashboard → **Authentication → Sign In / Providers** (mục cấu hình chung phía trên danh sách provider):

- Bật **Allow anonymous sign-ins**: người chơi có phiên khách mà không cần đăng ký.
- Bật **Allow manual linking**: cho phép `linkIdentity({ provider: "google" })` gắn Google vào phiên khách, giữ nguyên `user_id` và lịch sử.
- **Confirm email**: không ảnh hưởng (game không dùng đăng nhập email).

Nên bật thêm (không bắt buộc): **Authentication → Attack Protection → CAPTCHA** (Cloudflare Turnstile) để chặn bot tạo phiên khách hàng loạt. Bật thì frontend phải gửi token captcha khi `signInAnonymously`, nên báo frontend-dev trước.

## 4. Bật đăng nhập Google

**Trên Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com)):

1. Tạo (hoặc chọn) một project, ví dụ `brain-rizz`.
2. **APIs & Services → OAuth consent screen** (Google Auth Platform → Branding): App name `Brain Rizz`, email hỗ trợ, logo nếu có. **Audience**: External. Thêm domain production vào **Authorized domains** (ví dụ `brain-rizz.pages.dev`) và `supabase.co`.
3. **Data Access (Scopes)**: chỉ cần `openid`, `.../auth/userinfo.email`, `.../auth/userinfo.profile`.
4. **Clients → Create client** → loại **Web application**:
   - **Authorized JavaScript origins**: `http://localhost:5173` và domain production, ví dụ `https://brain-rizz.pages.dev`.
   - **Authorized redirect URIs**: `https://<project-ref>.supabase.co/auth/v1/callback` (chép đúng từ trang provider Google trong Supabase, mục **Callback URL**).
5. Lưu **Client ID** và **Client secret**.
6. Khi app còn ở chế độ **Testing**, chỉ email trong danh sách **Test users** đăng nhập được. Muốn ai cũng đăng nhập: **Publish app** (scope cơ bản như trên không cần Google duyệt).

**Trên Supabase**: Authentication → Sign In / Providers → **Google** → bật, dán Client ID và Client secret → **Save**.

## 5. Site URL và Redirect URLs

Dashboard → **Authentication → URL Configuration**:

- **Site URL**: domain production, ví dụ `https://brain-rizz.pages.dev`.
- **Redirect URLs** (mỗi dòng một mục):
  - `http://localhost:5173/**`
  - `https://brain-rizz.pages.dev/**` (domain production)
  - `https://*.brain-rizz.pages.dev/**` nếu muốn bản preview của Cloudflare Pages đăng nhập được.
  - Thử trên điện thoại qua IP máy tính (`http://192.168.x.x:5173`): thêm đúng địa chỉ đó. Lưu ý Google không cho origin là IP nội bộ, nên trên điện thoại chỉ thử được phiên khách; liên kết Google thì thử trên máy tính hoặc bản deploy.
  - Chơi qua `pnpm share` (link `https://….trycloudflare.com`, [Phát triển › Chia sẻ](development.md#chia-sẻ-cho-bạn-bè-qua-internet-pnpm-share)): thêm `https://*.trycloudflare.com/**`. **Chỉ thêm lúc cần, share xong thì xoá** (rủi ro [R-13](../01-product/vision.md#10-rủi-ro-risk-register)): mẫu này khớp tunnel của bất kỳ ai, nên kẻ xấu có thể gửi link đăng nhập trỏ về tunnel của họ để lấy phiên của người chơi.

Biến môi trường (mục 6) và Redirect URLs là hai việc riêng: env cho web biết dùng project Supabase nào, còn Redirect URLs là danh sách cho phép trên dashboard. Điền đủ env mà thiếu URL thì đăng nhập Google vẫn chạy nhưng quay về sai trang.

Thiếu URL trong danh sách thì sau khi đăng nhập Google, Supabase đưa người chơi về Site URL thay vì trang đang mở.

## 6. Biến môi trường

| Nơi | Biến | Giá trị |
| --- | --- | --- |
| `apps/web/.env` (dev) | `VITE_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| | `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` |
| `apps/server/.env` (dev) | `SUPABASE_URL` | `https://<project-ref>.supabase.co` |
| | `SUPABASE_SECRET_KEY` | `sb_secret_…` |
| Fly.io (game server) | `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | như trên, đặt bằng `fly secrets` |
| Cloudflare Pages (web) | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | như trên, ở mục Variables |
| `supabase/.env` (chỉ máy chạy migration) | `SUPABASE_DB_URL` | chuỗi Session pooler, xem bước 2 |

URL chỉ là gốc `https://<project-ref>.supabase.co`, **không** kèm `/rest/v1/` (URL ở trang Data API có đuôi này; thư viện tự thêm, để thừa sẽ lỗi 404 `PGRST125`). Giá trị thật chỉ đặt trong `.env`, không bao giờ trong `.env.example` (file mẫu được commit).

Clone repo sang máy khác thì ba file `apps/web/.env`, `apps/server/.env`, `supabase/.env` không đi theo: lưu nội dung chúng trong trình quản lý mật khẩu.

Dev: copy `apps/web/.env.example` → `apps/web/.env` và `apps/server/.env.example` → `apps/server/.env`, điền giá trị. File `.env` đã nằm trong `.gitignore`, không commit.

Fly.io (từ thư mục gốc repo):

```bash
fly secrets set SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_xxx
fly secrets list    # chỉ hiện tên + mã băm, không hiện giá trị
```

`fly secrets set` tự deploy lại máy để nhận biến mới. **Không** đưa hai biến này vào `[env]` của `fly.toml` (file được commit).

Cloudflare Pages: Workers & Pages → project web → **Settings → Variables and Secrets** → thêm `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` cho Production (và Preview nếu cần) → **Retry deployment**. Biến `VITE_*` được gắn vào bản build, nên đổi biến phải build lại.

Khoá secret bị lộ: Project Settings → API Keys → tạo secret key mới, cập nhật Fly secrets, rồi xoá key cũ.

## 7. Kiểm tra nhanh

1. **Server**: chạy `pnpm dev`. Log server **không** còn dòng `[store] Chưa đặt SUPABASE_URL / SUPABASE_SECRET_KEY`.
2. **Bảng xếp hạng không cần đăng nhập**: SQL Editor chạy

   ```sql
   select * from public.leaderboard_brain('week', 10, 1);
   ```

   Trả về rỗng (chưa ai chơi) là đúng; báo lỗi là migration chưa chạy đủ. Tham số cuối là `BRAIN_TEST_RULES_VERSION` trong `packages/shared/src/brain-test.ts`.
3. **Phiên khách**: mở `http://localhost:5173`, làm một lượt **Kiểm tra não**. Authentication → Users có một người dùng "Anonymous"; kết quả cuối lượt ghi "đã lưu".
4. **Dữ liệu**: Table Editor → `brain_tests` có một dòng, `brain_test_games` có 5 dòng cùng `brain_test_id`.
5. **Party**: chơi một trận 2 máy tới màn vinh danh → `match_results` có một dòng cho mỗi người có phiên, `bot_count = 0`. Chơi thêm một trận "Chơi với máy" (1 người + bot) → dòng mới có `bot_count` bằng số bot, `players` gồm cả bot.
6. **Google**: ở màn Tài khoản bấm **Liên kết Google** → quay lại app, trạng thái "Đã liên kết Google"; Users hiện email, `user_id` không đổi.
7. **RLS**: SQL Editor chạy `set role anon; select * from public.brain_tests;` → 0 dòng, và `select * from public.profiles;` → lỗi permission denied (hồ sơ không đọc công khai); chạy `reset role;` sau đó.
8. **Xoá dữ liệu**: ở màn Tài khoản bấm **Xoá dữ liệu của tôi** → người dùng biến mất khỏi Authentication → Users và mọi dòng của họ trong 5 bảng (và `login_events`, `admins`) bị xoá theo. Riêng quản trị viên **duy nhất** bị chặn (lỗi `last-admin`, không xoá gì), xem [mục 8](#8-trang-quản-trị-cr-019).

Có lỗi thì xem **Logs → Auth** (đăng nhập) hoặc **Logs → Postgres** (RPC), và `fly logs` (server ghi kết quả).

## 8. Trang quản trị (CR-019)

Trang `/admin` ([kế hoạch](../01-product/admin-console.md)) cần file `20261119000000_admin_console.sql`. File này thêm:

- 4 bảng `admins`, `party_settings` (một dòng id 1, cấu hình điểm + game bị tắt của trận party), `party_settings_history`, `login_events`. Cả 4 bảng bật RLS nhưng **không có policy**: web không đọc/ghi thẳng được, chỉ đi qua RPC. Mục **Advisors** có thể báo "RLS Enabled No Policy" cho 4 bảng này. Đó là cố ý, không cần sửa.
- Cột `match_results.settings_version` (phiên bản cấu hình trận đã dùng, 0 = mặc định trong code).
- RPC `is_admin`, `log_login` (mọi phiên gọi được) và 11 hàm `admin_*` (tự kiểm người gọi có trong `admins`, không thì lỗi `forbidden`). Email người chơi chỉ lộ qua các hàm `admin_*`.

**Thứ tự triển khai:**

1. Chạy migration (bước 2, giữ đúng cách A hoặc B đã chọn).
2. Sau đó mới deploy game server mới (`fly deploy`). Server mới luôn ghi `settings_version` và đọc `party_settings`, nên nếu DB chưa có cột thì ghi kết quả trận bị lỗi. Ngược lại, server cũ vẫn chạy bình thường trên DB đã chạy migration (cột nhận mặc định 0).
3. Deploy web.

**Thêm admin đầu tiên** (làm một lần, các admin sau thêm ngay trên trang):

1. Mở app, vào màn **Tài khoản**, bấm **Liên kết Google** (hoặc đăng nhập Google) bằng email sẽ làm admin. Phiên khách ẩn danh không làm admin được.
2. SQL Editor (thay email):

   ```sql
   insert into public.admins (user_id, note)
   select id, 'chủ dự án' from auth.users
   where lower(email) = lower('ban@example.com') and not is_anonymous;
   ```

   Kết quả có 1 dòng là xong. Nếu 0 dòng thì email chưa liên kết Google hoặc gõ sai: làm lại bước 1.
3. Kiểm tra:

   ```sql
   select a.user_id, u.email, a.note, a.created_at
   from public.admins a join auth.users u on u.id = a.user_id;
   ```

4. Trên web, đăng nhập Google bằng email đó rồi mở `/admin` (hoặc nút **Trang quản trị** ở màn Tài khoản).

Thêm hoặc gỡ admin khác: dùng mục **Quản trị viên** trên trang. Người được thêm phải đăng nhập Google ít nhất một lần trước. Trang không cho tự gỡ mình và không cho gỡ admin cuối cùng; khi thật sự cần thì gỡ bằng SQL:

```sql
delete from public.admins
where user_id = (select id from auth.users where lower(email) = lower('ban@example.com'));
```

**Admin cuối cùng muốn "Xoá dữ liệu của tôi":** hàm `delete_my_data` chặn quản trị viên duy nhất (lỗi `last-admin`, không xoá gì), vì dòng `admins` xoá theo tài khoản thì không còn ai vào được trang. Muốn xoá thì **thêm admin khác trước** (mục **Quản trị viên** trên trang, hoặc câu SQL ở bước "Thêm admin đầu tiên"), rồi mới bấm xoá. Hai admin cuối cùng xoá cùng lúc thì người sau bị chặn.

**Cấu hình điểm làm trận chạy sai, cần về mặc định ngay:** bình thường dùng nút **Khôi phục mặc định** trên trang (có ghi lịch sử). Nếu trang không vào được thì chạy:

```sql
update public.party_settings
set version = version + 1, scoring = '{}', disabled_games = '{}', updated_at = now(), updated_by = null
where id = 1;
```

Game server nhận cấu hình mới sau tối đa 30 giây (bộ nhớ đệm), áp dụng từ trận bắt đầu sau đó. Trận đang chơi giữ cấu hình cũ.

**Kiểm tra nhanh:**

1. **RLS**: SQL Editor chạy `set role authenticated; select * from public.login_events;` → lỗi permission denied; `set role anon; select public.is_admin();` → lỗi permission denied. Chạy `reset role;` sau đó.
2. **Ghi đăng nhập**: mở app (có phiên) rồi chạy `select event, provider, device, created_at from public.login_events order by created_at desc limit 5;` → có dòng `guest_created` hoặc `session_resumed`. Mở lại app trong vòng 30 phút sẽ không ghi thêm `session_resumed`.
3. **Cấu hình**: lưu thử một thay đổi ở mục **Điểm & hệ số** → `select version, updated_at from public.party_settings;` tăng 1, `party_settings_history` có dòng mới. Trận party chơi sau đó có `match_results.settings_version` bằng version này.

[← Hướng dẫn](README.md) · [Mục lục tài liệu](../README.md)
