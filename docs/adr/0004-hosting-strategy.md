# ADR 0004: Hosting — Cloudflare Pages + Fly.io tự tắt, Render Free dự phòng

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-09

## Bối cảnh

Ngân sách gần 0. Người chơi ở Việt Nam, cần ping thấp (server ở Singapore). Game chỉ chơi lúc rảnh, phần lớn thời gian không ai online.

## Quyết định

- **Web:** Cloudflare Pages (miễn phí).
- **Game server:** Fly.io region `sin`, máy shared-cpu-1x 512 MB với `auto_stop_machines` — máy tắt khi không ai chơi, chỉ trả tiền lúc chạy (dưới 1 USD/tháng nếu chơi vài chục giờ, tối đa khoảng 4,7 USD nếu chạy 24/7).
- **Dự phòng 0 đồng:** Render Free region Singapore (ngủ sau 15 phút, khởi động khoảng 1 phút).
- Server đóng gói **Docker** để đổi nhà cung cấp không cần sửa code.

So sánh đầy đủ các lựa chọn và nguồn giá: [04-deployment.md](../04-deployment.md).

## Hệ quả

- Lần đầu mở game sau thời gian dài không ai chơi sẽ chờ máy khởi động (Fly: vài giây; Render: khoảng 1 phút).
- Deploy bản mới làm ngắt phòng đang chơi — deploy lúc vắng người.
- Xem xét lại khi: có > 50 người chơi cùng lúc thường xuyên, hoặc muốn công khai rộng.
