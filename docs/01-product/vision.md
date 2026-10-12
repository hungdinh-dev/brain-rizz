# Tầm nhìn & phạm vi (Project Charter)

| | |
| --- | --- |
| Giai đoạn SDLC | Khởi tạo / Discovery |
| Phiên bản tài liệu | 1.0 · chốt 2026-10-10 |
| Chủ sở hữu | Chủ dự án (kiêm Product Owner và Developer) |
| Cập nhật khi | Đổi mục tiêu, đối tượng, phạm vi phát hành 1.0 hoặc ngân sách (qua [yêu cầu thay đổi](../00-tracking/change-requests.md)) |

Bản kế hoạch gốc (có bình luận) nằm ở Claude Docs: "Brain Party – Kế hoạch dự án minigame trí tuệ real-time". Khi hai bản khác nhau, **tài liệu trong repo là bản đúng**.

## 1. Tóm tắt một câu

**Brain Rizz** là web party game gồm 15 minigame trí tuệ thuộc 5 nhóm kỹ năng, cho 2–8 người chơi cùng lúc qua mã phòng, chạy ngay trên điện thoại, tablet và máy tính mà không cần cài đặt hay đăng ký.

## 2. Vấn đề & cơ hội

Một nhóm bạn hoặc một gia đình muốn chơi một trò ngắn, có tính trí tuệ, cùng nhau trên điện thoại. Các lựa chọn hiện có đều vướng một điểm:

| Sản phẩm tham khảo | Điểm hay | Điểm vướng với nhóm người chơi của dự án |
| --- | --- | --- |
| Big Brain Academy (Nintendo Switch) | Minigame trí tuệ 5 nhóm kỹ năng, chơi chung vui | Chỉ có trên Switch, mất tiền, chơi cùng nhau phải ngồi chung chỗ |
| Kahoot / Quizizz | Vào bằng mã, chơi trên điện thoại | Là câu hỏi trắc nghiệm, phải có người soạn đề; không phải minigame kỹ năng |
| Jackbox Party Pack | Party game nhiều người qua điện thoại | Mất tiền, cần một màn hình chung chạy game, nặng về chữ tiếng Anh |
| Gartic Phone, skribbl.io | Miễn phí, vào bằng link | Thể loại vẽ/đoán chữ, không rèn kỹ năng tư duy |

**Cơ hội:** một game miễn phí, mở link là chơi, câu đố tự sinh (không ai phải soạn), người lớn và trẻ em chơi chung vẫn công bằng, giao diện tiếng Việt.

## 3. Trụ cột thiết kế (design pillars)

Mọi quyết định về tính năng đều đối chiếu với 4 trụ cột này. Tính năng đi ngược một trụ cột thì phải có lý do rõ ràng trong [yêu cầu thay đổi](../00-tracking/change-requests.md).

1. **Vào là chơi.** Từ lúc bấm link tới lúc vào sảnh dưới 30 giây. Không cài đặt, không tài khoản (tài khoản là tuỳ chọn ở giai đoạn 3).
2. **Công bằng cho mọi lứa tuổi.** Mỗi người tự chọn độ khó, điểm nhân hệ số; trẻ 7 tuổi chơi chung với người lớn vẫn có cơ hội thắng.
3. **Ngắn, gọn, nhiều vòng.** Mỗi vòng 45–60 giây, một trận 3–5 vòng trong khoảng 5 phút.
4. **Nhẹ và rẻ.** Không stream gameplay: server chỉ phát *seed*, mọi máy tự sinh cùng câu đố. Chơi mượt trên 4G và Android tầm trung, chi phí vận hành gần 0.

## 4. Đối tượng

Chi tiết chân dung người dùng và hành trình: [Yêu cầu nghiệp vụ](brd.md#2-chân-dung-người-dùng-personas).

- **Chính:** nhóm bạn 18–35 tuổi chơi lúc tụ tập hoặc khi đang gọi Discord/Zalo.
- **Phụ:** gia đình nhiều thế hệ (bố mẹ và con 7–12 tuổi).
- **Sau này (giai đoạn 3):** người chơi một mình muốn luyện não mỗi ngày.

## 5. Mục tiêu & chỉ số thành công

| # | Mục tiêu | Chỉ số đo | Ngưỡng đạt | Đo ở |
| --- | --- | --- | --- | --- |
| G1 | Vào chơi nhanh | Thời gian từ mở link tới vào sảnh | ≤ 30 giây (người mới) | Thử với 3 người chưa từng chơi |
| G2 | Chơi ổn định nhiều người | Trận 3 vòng, 4 người, qua 4G | 0 người bị rớt khỏi phòng | Cổng giai đoạn 1 |
| G3 | Mượt trên máy phổ thông | FPS trong minigame trên Android tầm trung | ≥ 55 FPS ổn định | Cổng giai đoạn 2 |
| G4 | Tải nhanh | Gói JS ban đầu (gzip) / màn đầu tiên trên 4G | ≤ 300 KB / ≤ 2 giây | Mỗi lần phát hành |
| G5 | Chi phí thấp | Tiền hosting mỗi tháng | ≤ 1 USD (tối đa 6 USD nếu chạy 24/7) | Hoá đơn Fly.io |
| G6 | Đủ vui để quay lại | Nhóm bạn thử nghiệm tự rủ chơi lại | ≥ 2 buổi/tháng trong 2 tháng sau 1.0 | Hỏi trực tiếp nhóm thử nghiệm |
| G7 | Được thích | Điểm khảo sát nhanh sau buổi chơi | ≥ 4/5 | Form 3 câu sau mỗi buổi thử |

## 6. Phạm vi

### Trong phạm vi bản 1.0

- Chế độ **Đấu nhóm** qua mã phòng 4 ký tự / link mời, 2–8 người.
- **15 minigame** (mỗi nhóm kỹ năng 3 game), 4 mức độ khó riêng cho từng người.
- Luồng mỗi vòng kiểu party game: chọn game (vòng quay / chủ phòng chọn + bình chọn), hướng dẫn, tự chọn độ khó, đếm ngược, cộng điểm, vinh danh top 3 kiểu Kahoot ([CR-005](../00-tracking/change-requests.md#cr-005)).
- Phòng chờ và vinh danh 2D (không 3D, [ADR 0010](../02-architecture/decisions/0010-drop-3d-2d-lobby-and-podium.md)), âm thanh, cài lên màn hình chính (PWA).
- Chế độ **Kiểm tra não**, **Luyện tập**, **Đấu bóng ma**.
- Tài khoản tuỳ chọn (khách + Google), lịch sử điểm.
- Giao diện tiếng Việt và tiếng Anh, sáng/tối.

### Ngoài phạm vi bản 1.0

- Ghép trận với người lạ, bảng xếp hạng toàn cầu (đang xét ở [CR-003](../00-tracking/change-requests.md#cr-003)).
- Chat thoại/chữ trong game (nhóm đã dùng Discord/Zalo).
- App native trên App Store / Google Play.
- Mua bán trong game, quảng cáo.
- Chống gian lận mức thi đấu (chỉ cần đủ cho chơi với bạn bè).

## 7. Ràng buộc & giả định

| Loại | Nội dung |
| --- | --- |
| Nhân lực | 1 người làm (kèm đội AI agent), khoảng **15 giờ/tuần** (giả định, cần xác nhận) |
| Ngân sách | Càng gần 0 càng tốt; chấp nhận vài USD/tháng cho game server |
| Công nghệ | TypeScript toàn bộ; chi tiết ở [Tech stack](../02-architecture/tech-stack.md) |
| Thiết bị | Điện thoại là chính, ưu tiên màn hình dọc |
| Pháp lý | Lấy cảm hứng thể loại từ Big Brain Academy nhưng tên game, tên minigame, nhân vật, hình ảnh đều tự làm; asset bên ngoài chỉ dùng giấy phép CC0 và ghi vào `assets/LICENSES.md` |

## 8. Các bên liên quan

| Vai trò | Ai | Quan tâm |
| --- | --- | --- |
| Chủ dự án / Product Owner | Bạn | Phạm vi, ưu tiên, chấp nhận tính năng |
| Developer | Bạn + đội AI agent ([Đội AI agent](../03-guides/ai-agents.md)) | Kiến trúc, chất lượng code, tiến độ |
| Người chơi thử | Nhóm bạn bè, gia đình | Vui không, dễ vào không, có giật không |
| Developer tham gia sau | Chưa có | Hiểu nhanh dự án: bắt đầu từ [Tech stack](../02-architecture/tech-stack.md) và [Hướng dẫn phát triển](../03-guides/development.md) |

## 9. Mốc chính

| Mốc | Phiên bản | Dự kiến xong | Tiêu chí |
| --- | --- | --- | --- |
| Prototype (GĐ 0) | 0.1 | 2026-10-18 | 2 máy thật vào cùng phòng thấy cùng câu đố |
| Alpha – MVP (GĐ 1) | 0.5 | 2026-11-22 | 4 người chơi trọn trận 3 vòng qua 4G |
| Beta (GĐ 2) | 0.9 | 2026-12-27 | ≥ 55 FPS trên Android tầm trung, 10 minigame |
| Phát hành 1.0 (GĐ 3) | 1.0 | 2027-02-07 | Đủ 15 game, tài khoản, Kiểm tra não |

Lịch chi tiết và checklist: [Lộ trình](roadmap.md). Tiến độ thực tế: [Tình trạng dự án](../00-tracking/status.md).

## 10. Rủi ro (risk register)

Xác suất (X) và Ảnh hưởng (A) chấm 1–3. Rủi ro đang mở được nêu ở [Tình trạng dự án](../00-tracking/status.md).

| ID | Rủi ro | X | A | Cách xử lý | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| R-01 | Ôm quá nhiều việc (15 game, 3D, tài khoản), bỏ dở giữa chừng | 3 | 3 | Ra MVP 5 game trước, chơi với bạn bè rồi mới mở rộng; mọi tính năng mới qua CR | Mở |
| R-02 | Phình phạm vi do thiết kế giao diện thêm mục mới (Tìm trận, Thử thách hôm nay, Bảng xếp hạng) | 2 | 2 | Gắn nhãn "Sắp có", ghi [CR-003](../00-tracking/change-requests.md#cr-003), chỉ làm sau 1.0 | Mở |
| R-03 | Điện thoại mất kết nối khi chuyển app | 3 | 2 | Giữ chỗ 45 giây, tiến độ lưu trên server, tự nối lại khi tải lại trang | Đã xử lý |
| R-04 | Chạy cả Phaser lẫn three.js cùng lúc gây giật, crash trên iOS | 1 | 3 | Bất biến "mỗi lúc một canvas WebGL"; bỏ hẳn 3D theo ADR 0010 | Đã xử lý |
| R-05 | Bộ sinh câu đố cho kết quả khác nhau giữa các máy | 1 | 3 | Chỉ số nguyên + PRNG có seed; test 10.000 seed; test chéo trình duyệt/Node | Đã xử lý |
| R-06 | Âm thanh không phát trên iOS | 2 | 1 | Mở khoá audio ở lần chạm đầu (GĐ 2) | Mở |
| R-07 | Thư viện mới đổi API (Phaser 4, Colyseus 0.18, TypeScript 7) | 2 | 2 | Khoá phiên bản bằng `pnpm-lock.yaml`, đọc migration guide trước khi nâng | Mở |
| R-08 | Giá hosting thay đổi | 1 | 2 | Server đóng gói Docker, có phương án Render/Oracle miễn phí | Mở |
| R-09 | Trùng tài sản trí tuệ của Nintendo | 1 | 3 | Tên, hình, nhân vật tự làm; chỉ giữ ý tưởng thể loại | Đã xử lý |
| R-10 | Supabase tạm dừng khi ít người chơi | 2 | 1 | Chỉ dùng từ GĐ 3; chế độ khách vẫn chơi khi DB ngủ | Mở |
| R-11 | Không đủ 15 giờ/tuần như giả định | 2 | 2 | Lộ trình tính theo tuần làm việc; trễ thì cắt bớt minigame của GĐ 3, không cắt chất lượng | Mở |

## 11. Câu hỏi mở

Đã trả lời thì chuyển xuống bảng "Đã quyết" kèm ngày.

| # | Câu hỏi | Ảnh hưởng tới |
| --- | --- | --- |
| Q1 | Thực tế dành được bao nhiêu giờ mỗi tuần? | Lịch [Lộ trình](roadmap.md) |
| Q2 | Có công khai cho người lạ chơi, hay chỉ trong nhóm bạn? | [CR-003](../00-tracking/change-requests.md#cr-003), chống gian lận, chi phí |
| Q3 | Có cần chat thoại trong game không? | Phạm vi |
| Q4 | Giữ màn hình dọc hay hỗ trợ cả ngang cho máy tính/tablet? | Thiết kế minigame |

**Đã quyết**

| # | Câu hỏi | Quyết định | Ngày |
| --- | --- | --- | --- |
| Q5 | Chỉ tiếng Việt hay song ngữ từ đầu? | Song ngữ vi/en ngay từ GĐ 0 ([ADR 0007](../02-architecture/decisions/0007-i18n-inline-resources.md)) | 2026-10-09 |
| Q6 | Phong cách màu sắc? | Bảng phấn + nhãn dán + 6 nhân vật SVG ([ADR 0009](../02-architecture/decisions/0009-chalkboard-style-and-characters.md)) | 2026-10-10 |
| Q7 | Giai đoạn đầu cần đăng nhập không? | Không, chỉ chế độ khách; tài khoản tuỳ chọn ở GĐ 3 | 2026-10-09 |

[← Sản phẩm](README.md) · [Mục lục tài liệu](../README.md)
