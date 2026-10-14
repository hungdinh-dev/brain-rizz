# Báo cáo ngày YYYY-MM-DD (Thứ …)

| | |
| --- | --- |
| Mã báo cáo | DR-YYYYMMDD |
| Giai đoạn | GĐ x · Tên giai đoạn ([Lộ trình](../../01-product/roadmap.md)) |
| Nhánh | `ten-nhanh` |
| Phiên làm việc | HH:MM–HH:MM (giờ Việt Nam, UTC+7) · n phiên |
| Chủ dự án | HungDev |
| Thực hiện | Claude Code (điều phối) + agent: … |
| Tình trạng | 🟢 Đúng kế hoạch / 🟡 Cần để ý / 🔴 Có vấn đề |

## 1. Tóm tắt

3–5 gạch đầu dòng: hôm nay xong gì, quan trọng nhất là gì, còn vướng gì. Người đọc chỉ đọc mục này cũng phải nắm được ngày hôm đó.

## 2. Kết quả bàn giao

| # | Hạng mục | Kết quả | Tham chiếu | Trạng thái |
| --- | --- | --- | --- | --- |
| 1 | … | … | [file](../../../duong/dan.ts), CR/UC/FR | ✅ Xong / 🔄 Đang làm / ⏸ Hoãn |

## 3. Nhật ký công việc

Theo thứ tự thời gian. "Ai": **Chủ dự án**, **Điều phối** (phiên Claude chính) hoặc tên agent (`qa-tester`, `frontend-dev`…).

| Giờ | Ai | Việc | Kết quả / file thay đổi |
| --- | --- | --- | --- |
| 09:00 | Chủ dự án | Yêu cầu … | — |
| 09:05 | `qa-tester` | Soát diff … | PASS, 2 lỗi minor → mục 4; thêm test ở [x.test.ts](../../../duong/x.test.ts) |

## 4. Lỗi và sự cố

| # | Mức | Mô tả | Nguyên nhân | Xử lý | Ai sửa | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | blocker / major / minor | … ([file:dòng](../../../duong/dan.ts#L10)) | … | … | `frontend-dev` | ✅ Đã sửa / ⏳ Tồn |

Không có thì ghi "Không phát sinh".

## 5. Quyết định

| # | Quyết định | Lý do | Ghi tại |
| --- | --- | --- | --- |
| 1 | … | … | [ADR 00xx](../../02-architecture/decisions/…), [CR-00x](../change-requests.md#cr-00x) |

## 6. Kiểm thử và chất lượng

- `pnpm check`: xanh/đỏ — shared x/x, server x/x, web x/x test.
- Kiểm tra thủ công / chụp màn hình: …
- Chưa kiểm được: …

## 7. Tài liệu đã cập nhật

- [Tên tài liệu](../../duong/dan.md) — thay đổi gì.

## 8. Rủi ro và vướng mắc

| Rủi ro / vướng mắc | Ảnh hưởng | Hướng xử lý |
| --- | --- | --- |

## 9. Việc tồn và kế hoạch tiếp theo

- [ ] …

## 10. Commit trong ngày

| Commit | Nội dung |
| --- | --- |
| `abc1234` | … |

Chưa commit thì ghi rõ "Chưa commit — thay đổi nằm trong working tree".

---

[← Danh sách báo cáo](README.md) · [Ngày trước](YYYY-MM-DD.md) · [Ngày sau](YYYY-MM-DD.md)
