# Tình trạng dự án

> Trang dành cho "khách hàng": mở ra là biết dự án đang ở đâu trong 1 phút. Cập nhật **mỗi tuần một lần** (gợi ý: tối Chủ nhật) và mỗi khi qua một cổng. Bản cũ không xoá mà chuyển xuống [Lịch sử báo cáo](#lịch-sử-báo-cáo).

## Báo cáo tuần 1 — 2026-10-10

| | |
| --- | --- |
| Giai đoạn | **GĐ 0 · Nền móng (Prototype)** — tuần 1/2 |
| Phiên bản | 0.1.0 (chưa gắn tag) |
| Mốc kế tiếp | Cổng 0 — dự kiến **2026-10-18** (đúng baseline) |
| Minigame | **1/15** (MVP: 1/5) |
| Use case lõi (UC-01 → UC-12) | **7 xong, 5 một phần** (UC-05 tụt về một phần vì yêu cầu mới của CR-005) — xem [Danh sách tính năng](features.md) |
| Chi phí tháng này | 0 USD (chưa deploy) |

### Sức khoẻ dự án

| Mặt | Đánh giá | Ghi chú |
| --- | --- | --- |
| Tiến độ | 🟢 Đúng lịch | GĐ 0 còn 2 việc nhỏ |
| Phạm vi | 🟡 Cần để ý | [CR-005](change-requests.md#cr-005) đã duyệt: luồng trận mới (+10 ngày GĐ 1, bù bằng việc bỏ 3D ở GĐ 2). CR-003 hoãn tới sau 1.0 |
| Chất lượng | 🟢 Tốt | `pnpm check` xanh; test 10.000 seed; còn thiếu test nối lại phòng |
| Chi phí | 🟢 0 USD | |

🟢 ổn · 🟡 cần để ý · 🔴 có vấn đề, cần quyết định

### Đã xong tuần này

- Prototype chơi được trọn trận: tạo/vào phòng, sảnh 3D, minigame Kẻ lạc đàn, chấm điểm, kết quả, chơi lại, nối lại khi rớt mạng.
- Giao diện shadcn/ui, sáng/tối, tiếng Việt + tiếng Anh.
- Phong cách bảng phấn: màn giới thiệu, menu chính, chọn bạn đồng hành, 6 nhân vật.
- Đội 5 AI agent + workflow `/feature`, `/new-minigame`, `/qa-fix`.
- Bộ tài liệu SDLC (tầm nhìn, BRD, SRS, GDD, UI/UX, lộ trình, theo dõi).

### Kế hoạch tuần tới

- [ ] Commit toàn bộ thay đổi, đưa repo lên GitHub, CI chạy xanh.
- [ ] Thử trên điện thoại thật qua Wi-Fi nhà → qua Cổng 0, gắn tag `v0.1.0`.
- [x] Duyệt bản mẫu luồng trận mới (canvas khu 5–11).
- [x] Bắt đầu GĐ 1 bằng CR-005: phòng chờ 2D → chọn game → hướng dẫn & độ khó → cộng điểm, vinh danh. Minigame **Theo dấu ánh đèn** làm sau.

### Cập nhật giữa tuần — 2026-10-12

- **CR-005 đã có trong code**, sớm hơn baseline GĐ 1 (dự kiến bắt đầu 19/10): phòng chờ 2D, chọn game bằng vòng quay hoặc chủ phòng chọn, màn hướng dẫn + độ khó từng người, đếm ngược 5 giây, HUD chơi mới, bảng điểm vòng, cộng điểm trận, vinh danh top 3 bằng 2D. Đã gỡ three.js.
- **Đủ 5/5 minigame MVP** (cùng ngày): Theo dấu ánh đèn, Cân não, Bóng bay số, Xoay hình + Kẻ lạc đàn. Cân bằng điểm [CR-006](change-requests.md#cr-006) đã có cơ chế; con số chốt sau buổi chơi thử.
- Use case lõi: **11 xong, 1 một phần** (UC-04 còn thiếu QR). Test server tăng từ 24 lên 39, gồm cả tải lại trang ở từng pha và một trận 5 vòng đủ 5 game.
- Có thể lấy lại 10 ngày mà CR-005 làm trễ GĐ 1; sẽ dự báo lại khi qua Cổng 0.
- **Chưa chơi thử trên máy thật.** Việc tiếp theo: chủ dự án chơi thử 2–4 máy (một trận đủ 5 game), rồi commit, đưa lên GitHub; sau đó chốt con số CR-006, QR mời bạn, deploy.

### Rủi ro đang theo dõi

Đầy đủ ở [Tầm nhìn › Rủi ro](../01-product/vision.md#10-rủi-ro-risk-register).

| ID | Rủi ro | Mức | Việc đang làm |
| --- | --- | --- | --- |
| R-01 | Ôm quá nhiều việc | Cao | Giữ kỷ luật CR; MVP 5 game trước |
| R-02 | Phình phạm vi từ bản thiết kế | Vừa | CR-003 đã hoãn |
| R-11 | Không đủ 15 giờ/tuần | Vừa | Cần trả lời Q1 để chỉnh lịch |

### Cần chủ dự án quyết định

| # | Việc | Hạn |
| --- | --- | --- |
| Q1 | Thực tế dành được bao nhiêu giờ/tuần? (chỉnh lịch GĐ 1) | Trước 2026-10-19 |
| Q2 | Công khai cho người lạ hay chỉ nhóm bạn? (ảnh hưởng CR-003) | Trước Cổng 3 |

---

## Lịch sử báo cáo

_Chưa có. Khi viết báo cáo tuần mới, chuyển báo cáo hiện tại xuống đây dưới dạng rút gọn: ngày, giai đoạn, 3 ý chính._

## Mẫu báo cáo tuần

```markdown
## Báo cáo tuần N — YYYY-MM-DD

| | |
| --- | --- |
| Giai đoạn | GĐ x · <tên> — tuần a/b |
| Phiên bản | x.y.z |
| Mốc kế tiếp | Cổng x — dự kiến YYYY-MM-DD (đúng / trễ n ngày so với baseline) |
| Minigame | n/15 |
| Use case lõi | n xong, n một phần |
| Chi phí tháng này | x USD |

### Sức khoẻ dự án
(bảng Tiến độ / Phạm vi / Chất lượng / Chi phí)

### Đã xong tuần này
### Kế hoạch tuần tới
### Rủi ro đang theo dõi
### Cần chủ dự án quyết định
```

[← Theo dõi](README.md) · [Mục lục tài liệu](../README.md)
