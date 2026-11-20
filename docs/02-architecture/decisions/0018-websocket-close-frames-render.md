# ADR 0018: Không dựa vào khung đóng WebSocket khi chạy qua Render

- Trạng thái: Đã chấp nhận
- Ngày: 2026-11-20

## Bối cảnh

Sau lần deploy đầu ([ADR 0017](0017-first-deploy-render-free.md)), người chơi gặp "Mất kết nối, đang nối lại" khi rời phòng và bị kẹt ở phòng chờ (không thêm được bot, không mời được người). Đo bằng script (SDK Colyseus 0.18 trong Node) trên bản deploy và trên cùng bản build chạy máy:

| Tình huống | Trên máy | Trên Render (đứng sau Cloudflare) |
| --- | --- | --- |
| Server đóng kết nối kèm mã (4000, 4002…) | Client nhận ngay (0,04 s) | Client không nhận gì, 20 s sau bị cắt `1006` |
| Client tự đóng | Server biết sau 0,11 s; client xong ngay | Server chỉ biết khi hết hạn ping (~10 s); client xong sau ~0,06 s |
| Tin nhắn thường hai chiều | Bình thường | Bình thường, ping khứ hồi ~75 ms |

Khung đóng (close frame) bị nuốt cả hai chiều. Không tìm thấy tài liệu Render nói về việc này, và không đổi được proxy của Render. Colyseus lại dựa vào mã đóng để phân biệt "tự rời" với "rớt mạng" và để từ chối nối lại. Hệ quả:

- Rời phòng thì treo 20 s rồi bị coi là rớt mạng.
- Phòng không còn (server khởi động lại) thì mỗi lần thử nối lại treo 20 s, tối đa 15 lần.
- Sau đó web đứng yên với trạng thái `offline`.

## Quyết định

Mọi thông tin cần thiết khi đóng kết nối phải đi bằng **tin nhắn thường**, không dựa vào khung đóng, và việc phát hiện rớt mạng dựa vào ping:

- **Rời phòng:** client gửi LEAVE rồi tự đóng (`closeRoom` trong `apps/web/src/net/connection.ts`), về menu ngay.
- **Server chủ động đóng:** gửi `ServerMessage.Closing` (`{ code }`) ngay trước khi đóng. Client nhận thì tự đóng và xử lý theo mã đó.
- **Nối lại bị từ chối:** client đang nối lại mà nhận tin ERROR thì dừng nối lại, tự đóng 4003. Phòng party đóng ngoài ý muốn → về menu kèm thông báo.
- **Phát hiện rớt mạng:** transport `pingInterval` 1500 ms × `pingMaxRetries` 2 (3–4,5 s, thay vì mặc định 3000 ms × 2).

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Tin nhắn thay khung đóng + ping dày (chọn) | Không đổi nơi chạy, sửa được ngay, vẫn đúng khi chạy nơi khác (khung đóng tới thì càng nhanh) | Thêm một loại tin; ping dày hơn tốn chút băng thông, mạng chập chờn > 3 s bị coi là rớt (SDK tự nối lại) |
| Chuyển game server sang Fly.io / VPS | Có thể không bị nuốt khung đóng | Chưa đo; tốn tiền, cần thẻ; không chắc proxy khác xử lý đúng |
| Hỏi Render support và chờ | Không sửa code | Không biết khi nào có trả lời; người chơi vẫn kẹt trong lúc chờ |
| Server tự cắt TCP ngay sau khi gửi khung đóng | Client biết sớm hơn (1006 nhanh) | Vẫn mất mã đóng nên client không biết lý do |

## Hệ quả

- Code mới cần báo lý do đóng phải dùng `ServerMessage.Closing`; client không được chờ `room.leave()` resolve.
- Rớt mạng thật được phát hiện sau 3–4,5 s và nối lại trong khoảng đó. Phòng không còn thì người chơi về menu sau vài giây thay vì nhiều phút.
- Kiểm tra khung đóng có đi qua hay không bằng lệnh một dòng trong [deployment.md](../../03-guides/deployment.md). Nếu một ngày khung đóng đi qua được (Render sửa, hoặc chuyển nơi chạy), các cơ chế trên vẫn đúng, chỉ là thừa; khi đó cân nhắc trả nhịp ping về mặc định.

[← Danh sách ADR](README.md)
