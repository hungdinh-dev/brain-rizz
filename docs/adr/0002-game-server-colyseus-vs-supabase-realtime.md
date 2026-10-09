# ADR 0002: Dùng game server Colyseus thay vì chỉ Supabase Realtime

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-09

## Bối cảnh

Câu hỏi: "Sao phải cần game server riêng, không dùng luôn server real-time như Supabase?"

Supabase Realtime là **kênh chuyển tin** (Broadcast, Presence, thay đổi Postgres): nó chuyển tin từ máy này sang các máy khác nhưng **không chạy logic game của mình**. Một game nhiều người cần thêm một "trọng tài" làm các việc sau:

| Việc | Colyseus (game server) | Chỉ Supabase Realtime |
| --- | --- | --- |
| Phát seed, bắt đầu vòng cùng lúc | Server làm | Một máy (chủ phòng) phải tự làm |
| Đồng hồ hết giờ có hiệu lực | Server quyết định | Mỗi máy tự đếm, dễ lệch |
| Chấm điểm, chống gian lận | Server chấm lại bằng code shared | Mỗi máy tự báo điểm của mình |
| Giữ chỗ khi điện thoại rớt mạng | Có sẵn (`allowReconnection`) | Phải tự làm |
| Chủ phòng thoát giữa trận | Server chuyển quyền, trận chạy tiếp | Trận vỡ nếu máy chủ phòng là "trọng tài" |
| Mã phòng 4 ký tự | Có sẵn | Tự làm bằng tên channel |

Điểm yếu lớn nhất của kiểu "máy chủ phòng làm trọng tài" là **điện thoại**: khi người chủ phòng chuyển sang Zalo hay khoá màn hình, trình duyệt di động tạm dừng JavaScript của tab nền, nên cả phòng bị treo.

Hạn mức Supabase Realtime gói Free: 200 kết nối đồng thời, 100 tin/giây, 20 tin presence/giây, mỗi tin tối đa 256 KB ([Supabase](https://supabase.com/docs/guides/realtime/limits)). Ngoài ra dự án Free bị tạm dừng sau 7 ngày không hoạt động ([Automation Atlas](https://automationatlas.io/answers/supabase-free-tier-limits-2026/)) — rủi ro với game chỉ chơi lúc rảnh.

## Quyết định

Dùng **Colyseus** làm game server (server làm trọng tài). Supabase chỉ dùng ở giai đoạn 3 cho **tài khoản và lưu lịch sử điểm**, không dùng cho real-time.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Colyseus tự host | Đủ tính năng phòng chơi, 0 đồng phần mềm, chạy được ở mọi nơi có Docker | Phải có nơi chạy tiến trình Node.js (xem ADR 0004) |
| Chỉ Supabase Realtime, máy chủ phòng làm trọng tài | Hoàn toàn miễn phí, không vận hành server | Treo khi máy chủ phòng chạy nền, dễ gian lận, tự viết reconnect/đồng hồ |
| Chỉ Supabase Realtime, mọi máy tin nhau | Đơn giản nhất | Không ai chấm điểm thật, mỗi máy có thể ra kết quả khác |
| PartyServer trên Cloudflare Durable Objects | Có server thật, gói Free | Không chạy được Colyseus, phải tự viết lớp phòng chơi |

## Hệ quả

- Cần một nơi chạy game server; chi phí từ 0 đến vài USD/tháng (ADR 0004).
- Logic game nằm trong `packages/shared` và `PartyRoom` tách biệt khỏi thư viện mạng, nên nếu sau này muốn chuyển sang Durable Objects hay Supabase Realtime thì chỉ phải viết lại lớp mạng, không viết lại minigame.
- Xem xét lại nếu: không muốn trả bất kỳ chi phí nào **và** chấp nhận server ngủ (Render Free) không đủ tốt.
