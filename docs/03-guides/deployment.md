# Triển khai

Web client là file tĩnh (deploy lên CDN miễn phí). Game server là một tiến trình Node.js giữ WebSocket lâu dài, nên cần nơi chạy được tiến trình liên tục — đây là phần duy nhất có thể tốn tiền.

## Phương án khuyến nghị

| Thành phần | Dịch vụ | Chi phí |
| --- | --- | --- |
| Web | Cloudflare Pages | 0 USD |
| Game server | Fly.io, region Singapore, máy tự tắt khi không ai chơi | Dưới 1 USD/tháng nếu chơi vài chục giờ; tối đa khoảng 4,7 USD nếu chạy 24/7 |

Cách tính: shared-cpu-1x 512 MB ở Ashburn khoảng 3,69 USD/tháng nếu chạy liên tục ([Temps](https://temps.sh/blog/fly-io-pricing-2026)), giá Singapore nhân 1,269 ([Fly.io](https://fly.io/pricing.md)) ≈ 4,7 USD. Fly tính tiền theo giây lúc máy chạy; máy đã tắt chỉ tính phí ổ đĩa 0,15 USD/GB/tháng ([Fly.io](https://fly.io/pricing.md)). Fly hiện không còn gói miễn phí cho tài khoản mới.

## So sánh các lựa chọn miễn phí và giá rẻ cho game server

| Lựa chọn | Chi phí | Chạy Colyseus nguyên trạng? | Gần Việt Nam | Điểm trừ chính |
| --- | --- | --- | --- | --- |
| **Fly.io + tự tắt** (đang dùng) | Vài cent đến ~4,7 USD/tháng | Có | Singapore | Lần đầu vào phòng sau khi máy tắt phải chờ máy khởi động lại (thường vài giây) |
| **Render Free** | 0 USD | Có | Có region Singapore ([Render](https://render.com/docs/regions)) | Tự ngủ sau 15 phút không có truy cập, khởi động lại mất khoảng 1 phút; 750 giờ/tháng; Render nói không dành cho production ([Render](https://render.com/docs/free)) |
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
   - Biến môi trường: `VITE_SERVER_URL=https://<tên-app>.fly.dev`, `NODE_VERSION=22`
4. `apps/web/public/_redirects` đã cấu hình để link `/r/ABCD` mở đúng app.

## Deploy game server lên Fly.io

```bash
# Cài flyctl: https://fly.io/docs/flyctl/install/
fly auth login
fly launch --no-deploy --copy-config   # dùng fly.toml có sẵn ở thư mục gốc, đổi tên app nếu bị trùng
fly deploy --ha=false                  # build apps/server/Dockerfile, deploy đúng 1 máy ở region sin
fly scale count 1                      # chắc chắn chỉ còn 1 máy (nếu lỡ deploy không có --ha=false)
fly logs                               # xem log
```

`fly.toml` đã bật `auto_stop_machines = "stop"`, `min_machines_running = 0` và health check `/healthz`. Khi có người mở game, Fly tự bật máy.

**Chỉ chạy đúng 1 máy.** Mặc định Fly tạo 2 máy để dự phòng, nhưng Colyseus giữ phòng trong bộ nhớ của từng máy: người tạo phòng ở máy A, người vào sau bị đưa sang máy B sẽ gặp lỗi không tìm thấy phòng. Muốn chạy nhiều máy phải thêm Presence/Redis của Colyseus — chưa cần ở quy mô này.

Nên deploy bằng `flyctl` như trên thay vì nút "Launch an App from GitHub" trên dashboard: form của dashboard điền sẵn region `ams`, cổng `8080` thay vì giá trị trong `fly.toml`.

Lưu ý: khi deploy bản mới, phòng đang chơi sẽ bị ngắt. Hãy deploy lúc không ai chơi (hoặc bật graceful shutdown của Colyseus ở giai đoạn sau).

## Deploy game server lên Render (phương án 0 đồng)

1. Render Dashboard → New → Web Service → kết nối repo, chọn **Docker**.
2. Dockerfile path: `apps/server/Dockerfile`, Docker context: thư mục gốc.
3. Region: **Singapore**, Instance type: **Free**.
4. Health check path: `/healthz`.

Người đầu tiên mở game sau khi server ngủ sẽ phải chờ khoảng 1 phút — báo trước cho cả nhóm, hoặc mở game trước vài phút.

## Biến môi trường

| Biến | Ở đâu | Ý nghĩa |
| --- | --- | --- |
| `PORT` | server | Cổng lắng nghe (mặc định 2567; Fly/Render tự đặt) |
| `NODE_ENV` | server | `production` tắt `/monitor` và `/playground` |
| `VITE_SERVER_URL` | web (lúc build) | Địa chỉ game server, ví dụ `https://brain-rizz-server.fly.dev` |

## Kiểm tra sau khi deploy

- [ ] `https://<server>/healthz` trả `{"ok":true}`.
- [ ] Mở web trên điện thoại 4G (không dùng Wi-Fi), tạo phòng, gửi link cho một người khác vào được.
- [ ] Chơi trọn một trận 3 vòng; khoá màn hình 10 giây giữa trận rồi mở lại vẫn ở trong phòng.
