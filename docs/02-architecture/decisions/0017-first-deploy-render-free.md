# ADR 0017: Deploy đầu tiên — game server trên Render Free bằng Blueprint

- Trạng thái: Đã chấp nhận (thay phần "game server chính" của [ADR 0004](0004-hosting-strategy.md))
- Ngày: 2026-11-20

## Bối cảnh

Dự án chưa deploy lần nào. [ADR 0004](0004-hosting-strategy.md) chọn Fly.io (máy tự tắt, dưới 1 USD/tháng) làm game server chính và Render Free làm dự phòng. Fly không còn gói miễn phí cho tài khoản mới và cần thẻ. Chủ dự án muốn bản đầu tiên không tốn tiền, không mua server. Phiên 2026-11-16 đã xét thêm Vercel: Vercel Functions có WebSocket nhưng cắt kết nối sau tối đa 300 giây (gói Hobby), không đảm bảo hai người chơi vào cùng một tiến trình, và đồng hồ vòng chơi trong RAM mất khi function tắt — không hợp với Colyseus.

## Quyết định

Game server deploy lên **Render Free, region Singapore, Docker**, cấu hình bằng Blueprint `render.yaml` ở thư mục gốc. Web vẫn trên Cloudflare Pages, dữ liệu trên Supabase như ADR 0004 / 0011.

- `autoDeployTrigger: checksPass`: chỉ deploy khi CI của commit trên `main` xanh.
- `buildFilter`: chỉ build lại khi `apps/server`, `packages/shared` hoặc dependency đổi — sửa web/tài liệu không deploy lại server, không ngắt phòng đang chơi.
- Khoá Supabase là biến `sync: false`: nhập ở form Render lúc tạo Blueprint, không nằm trong repo.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Render Free (chọn) | 0 USD, chạy Colyseus nguyên trạng, có Singapore, Blueprint trong repo | Ngủ sau 15 phút không ai vào, người đầu tiên chờ ~30–60 giây; 750 giờ/tháng; Render nói không dành cho production |
| Fly.io tự tắt | Khởi động vài giây, ổn định hơn | Cần thẻ, tốn tiền (dưới 1 đến ~4,7 USD/tháng) |
| Vercel Functions | Web và server chung một chỗ | Kết nối WebSocket tối đa 300 giây, phòng không dùng chung giữa các instance, phải viết lại phần phòng + thêm Redis |
| Oracle Cloud Always Free | 0 USD, chạy liên tục | Cần thẻ, tự vận hành máy ảo |

## Hệ quả

- Không tốn tiền; người chơi phải chờ server thức dậy ở lần mở đầu tiên sau 15 phút vắng. Trong trận thì không ngủ (tin WebSocket tính là hoạt động).
- Deploy bản server mới làm ngắt phòng đang chơi; `buildFilter` giảm số lần deploy không cần thiết.
- `fly.toml` giữ lại để chuyển sang Fly khi cần: Docker giống nhau, không sửa code.
- Xem xét lại khi: thời gian chờ thức dậy làm phiền người chơi, chơi thường xuyên quá 750 giờ/tháng, hoặc muốn công khai rộng.
