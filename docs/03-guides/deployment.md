# Triển khai

Web client là file tĩnh (deploy lên CDN miễn phí). Game server là một tiến trình Node.js giữ WebSocket lâu dài, nên cần nơi chạy được tiến trình liên tục — đây là phần duy nhất có thể tốn tiền.

## Phương án khuyến nghị

| Thành phần | Dịch vụ | Chi phí |
| --- | --- | --- |
| Web | Cloudflare Pages | 0 USD |
| Game server | **Render Free**, region Singapore, Docker, cấu hình sẵn ở `render.yaml` ([ADR 0017](../02-architecture/decisions/0017-first-deploy-render-free.md)) | 0 USD |
| Game server (khi cần nhanh hơn) | Fly.io, region Singapore, máy tự tắt khi không ai chơi | Dưới 1 USD/tháng nếu chơi vài chục giờ; tối đa khoảng 4,7 USD nếu chạy 24/7 |

**Thứ tự deploy:** (1) chạy đủ migration Supabase ([Cài đặt Supabase](supabase-setup.md)) → (2) game server trên Render, lấy địa chỉ `https://<tên>.onrender.com` → (3) web trên Cloudflare Pages với `VITE_SERVER_URL` là địa chỉ đó → (4) Supabase: Site URL + Redirect URLs theo domain `*.pages.dev` ([mục 5](supabase-setup.md#5-site-url-và-redirect-urls)) → (5) Google: thêm domain vào Authorized domains / JavaScript origins, Publish app nếu muốn ai cũng đăng nhập Google được ([mục 4](supabase-setup.md)) → (6) kiểm tra ở cuối trang.

Cách tính: shared-cpu-1x 512 MB ở Ashburn khoảng 3,69 USD/tháng nếu chạy liên tục ([Temps](https://temps.sh/blog/fly-io-pricing-2026)), giá Singapore nhân 1,269 ([Fly.io](https://fly.io/pricing.md)) ≈ 4,7 USD. Fly tính tiền theo giây lúc máy chạy; máy đã tắt chỉ tính phí ổ đĩa 0,15 USD/GB/tháng ([Fly.io](https://fly.io/pricing.md)). Fly hiện không còn gói miễn phí cho tài khoản mới.

## So sánh các lựa chọn miễn phí và giá rẻ cho game server

| Lựa chọn | Chi phí | Chạy Colyseus nguyên trạng? | Gần Việt Nam | Điểm trừ chính |
| --- | --- | --- | --- | --- |
| **Fly.io + tự tắt** | Vài cent đến ~4,7 USD/tháng | Có | Singapore | Lần đầu vào phòng sau khi máy tắt phải chờ máy khởi động lại (thường vài giây) |
| **Render Free** (đang dùng, ADR 0017) | 0 USD | Có | Có region Singapore ([Render](https://render.com/docs/regions)) | Tự ngủ sau 15 phút không có truy cập, khởi động lại mất khoảng 1 phút; 750 giờ/tháng; Render nói không dành cho production ([Render](https://render.com/docs/free)) |
| **Oracle Cloud Always Free** (VM ARM) | 0 USD | Có (tự cài Docker) | Có region Singapore | Đăng ký cần thẻ, hay hết máy ở region đông, phải tự vận hành; tài liệu 2026 đã giảm hạn mức ARM miễn phí xuống 2 OCPU/12 GB ([TerminalBytes](https://terminalbytes.com/oracle-cloud-free-tier-changes-2026)) — vẫn dư cho game này |
| **Cloudflare Durable Objects** (PartyServer) | 0 USD trong hạn mức ngày | **Không** — phải viết lại phần phòng chơi | Edge gần người chơi | Gói Free chỉ dùng Durable Objects loại SQLite, có hạn mức theo ngày ([Cloudflare](https://developers.cloudflare.com/durable-objects/platform/pricing)) |
| **Supabase Realtime** (không có game server) | 0 USD | **Không** — đổi mô hình | — | Không có trọng tài/đồng hồ/giữ chỗ; xem [ADR 0002](../02-architecture/decisions/0002-game-server-colyseus-vs-supabase-realtime.md) |
| **Colyseus Cloud** | Từ 15 USD/tháng | Có | Có nhiều region | Đắt nhất, nhưng không phải tự vận hành |

Vì server được đóng gói Docker (`apps/server/Dockerfile`), chuyển giữa Fly, Render và Oracle chỉ là đổi nơi chạy container, không phải sửa code. Thứ tự dự phòng và rủi ro nếu bỏ Colyseus: [Kế hoạch dự phòng game server](../02-architecture/server-fallback.md).

## Deploy web lên Cloudflare Pages

1. Đẩy repo lên GitHub.
2. Cloudflare Dashboard → Workers & Pages → Create → Pages → kết nối repo.
3. Cấu hình build:
   - Build command: `pnpm install --frozen-lockfile && pnpm --filter @brain-rizz/web build`
   - Output directory: `apps/web/dist`
   - Root directory: để trống (thư mục gốc repo). Framework preset: None.
   - Biến môi trường (Production): `VITE_SERVER_URL=https://<tên>.onrender.com` (địa chỉ Render, không có `/` cuối), `NODE_VERSION=22`, `PNPM_VERSION=10.34.6` (khớp `packageManager`; ảnh build v3 mặc định pnpm 10.11), và (nếu dùng tài khoản) `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (khoá publishable, công khai được). Biến `VITE_*` gắn vào lúc build: đổi biến thì phải deploy lại.
4. `apps/web/public/_redirects` (`/* /index.html 200`) trả app cho mọi đường dẫn: link mời `/r/ABCD` và các màn có URL riêng (`/practice/<game>`, `/gacha`, `/admin/<mục>`…) mở đúng khi F5 hoặc gửi link.
5. Mỗi lần push `main`, Pages tự build và deploy web (không ngắt phòng đang chơi vì phòng nằm trên game server).

## Deploy game server lên Fly.io

```bash
# Cài flyctl: https://fly.io/docs/flyctl/install/
fly auth login
fly launch --no-deploy --copy-config   # dùng fly.toml có sẵn ở thư mục gốc, đổi tên app nếu bị trùng
fly deploy --ha=false                  # build apps/server/Dockerfile, deploy đúng 1 máy ở region sin
fly scale count 1                      # chắc chắn chỉ còn 1 máy (nếu lỡ deploy không có --ha=false)
fly logs                               # xem log
```

**Biến bí mật Supabase** (ADR 0011) đặt bằng Fly secrets, không ghi vào `fly.toml`:

```bash
fly secrets set SUPABASE_URL=https://<project-ref>.supabase.co SUPABASE_SECRET_KEY=sb_secret_xxx
fly secrets list   # chỉ hiện tên + mã băm
```

`fly secrets set` tự khởi động lại máy để nhận biến. Không đặt thì server vẫn chạy, chỉ không lưu kết quả (log một dòng lúc khởi động). Cách tạo project và lấy khoá: [Cài đặt Supabase](supabase-setup.md).

`fly.toml` đã bật `auto_stop_machines = "stop"`, `min_machines_running = 0` và health check `/healthz`. Khi có người mở game, Fly tự bật máy.

**Chỉ chạy đúng 1 máy.** Mặc định Fly tạo 2 máy để dự phòng, nhưng Colyseus giữ phòng trong bộ nhớ của từng máy: người tạo phòng ở máy A, người vào sau bị đưa sang máy B sẽ gặp lỗi không tìm thấy phòng. Muốn chạy nhiều máy phải thêm Presence/Redis của Colyseus — chưa cần ở quy mô này.

Nên deploy bằng `flyctl` như trên thay vì nút "Launch an App from GitHub" trên dashboard: form của dashboard điền sẵn region `ams`, cổng `8080` thay vì giá trị trong `fly.toml`.

Lưu ý: khi deploy bản mới, phòng đang chơi sẽ bị ngắt. Hãy deploy lúc không ai chơi (hoặc bật graceful shutdown của Colyseus ở giai đoạn sau).

## Deploy game server lên Render (đang dùng — ADR 0017)

Cấu hình nằm sẵn ở [`render.yaml`](../../render.yaml) (Blueprint): Docker từ `apps/server/Dockerfile` (context thư mục gốc), gói **Free**, region **Singapore**, nhánh `main`, health check `/healthz`.

1. Đăng nhập [Render](https://dashboard.render.com) bằng GitHub, cho Render đọc repo `brain-rizz`.
2. **New → Blueprint** → chọn repo → Render đọc `render.yaml` và hiện service `brain-rizz-server`.
3. Form hỏi hai biến `sync: false`: dán `SUPABASE_URL` (`https://<project-ref>.supabase.co`) và `SUPABASE_SECRET_KEY` (`sb_secret_…`, Supabase → Project Settings → API Keys). Khoá secret chỉ nằm ở đây, không bao giờ đưa vào web hay repo. Bỏ trống thì game vẫn chạy, chỉ không lưu kết quả / phấn.
4. **Apply** → Render build Docker (vài phút) → địa chỉ dạng `https://brain-rizz-server.onrender.com` (có thể kèm hậu tố nếu tên trùng). Mở `<địa chỉ>/healthz` phải thấy `{"ok":true,…}`.
5. Log: service → **Logs**. Có Supabase thì không có dòng `[store] Chưa đặt SUPABASE_URL`.

Tự deploy: mỗi commit lên `main` mà CI xanh (`autoDeployTrigger: checksPass`) và có đổi `apps/server/**`, `packages/shared/**` hoặc dependency (`buildFilter`) thì Render build lại. Sửa web hay tài liệu không deploy lại server. Đổi biến môi trường: service → **Environment** (Render tự khởi động lại).

Hạn chế gói Free: ngủ sau 15 phút không có truy cập, người đầu tiên mở game phải chờ khoảng 30–60 giây (mẹo: mở `<địa chỉ>/healthz` vài phút trước khi rủ bạn chơi); trong trận không ngủ vì tin WebSocket tính là hoạt động; 750 giờ miễn phí mỗi tháng; deploy bản mới làm ngắt phòng đang chơi.

## Biến môi trường

| Biến | Ở đâu | Ý nghĩa |
| --- | --- | --- |
| `PORT` | server | Cổng lắng nghe (mặc định 2567; Fly/Render tự đặt) |
| `NODE_ENV` | server | `production` tắt `/monitor` và `/playground` |
| `VITE_SERVER_URL` | web (lúc build) | Địa chỉ game server, ví dụ `https://brain-rizz-server.fly.dev` |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | web (lúc build) | Supabase cho đăng nhập, lịch sử, bảng xếp hạng; khoá publishable công khai được. Trống → ẩn tài khoản |
| `NODE_VERSION`, `PNPM_VERSION` | Cloudflare Pages (lúc build) | Phiên bản Node (22) và pnpm (khớp `packageManager`, hiện 10.34.6) của ảnh build |
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | server (Render: Environment; Fly: secrets) | Xác thực token người chơi, ghi kết quả Kiểm tra não + trận party. Khoá secret bỏ qua RLS: chỉ đặt trên server. Trống → không lưu |

## Kiểm tra sau khi deploy

- [ ] `https://<server>/healthz` trả `{"ok":true}`.
- [ ] Mở web trên điện thoại 4G (không dùng Wi-Fi), tạo phòng, gửi link cho một người khác vào được.
- [ ] Chơi trọn một trận 3 vòng; khoá màn hình 10 giây giữa trận rồi mở lại vẫn ở trong phòng.
- [ ] Đăng nhập Google từ bản deploy quay về đúng trang (không về localhost); quản trị viên mở được `/admin`; nhận quà phấn mỗi ngày và quay thử máy quay được.
- [ ] Nếu đã cấu hình Supabase: log server (Render → Logs, hoặc `fly logs`) không có dòng `[store] Chưa đặt SUPABASE_URL`; làm một lượt Kiểm tra não thấy "đã lưu" và có dòng mới trong `brain_tests` (xem [mục Kiểm tra nhanh](supabase-setup.md#7-kiểm-tra-nhanh)).
