# ADR 0010: Bỏ 3D — phòng chờ và vinh danh bằng 2D

- Trạng thái: Đã chấp nhận · đã làm trong code 2026-10-12 (theo [CR-005](../../00-tracking/change-requests.md#cr-005))
- Ngày: 2026-10-10

## Bối cảnh

Kế hoạch ban đầu dùng three.js + React Three Fiber cho ba chỗ: sân khấu sảnh chờ, tuỳ biến avatar low-poly và bục trao giải 3 bậc. Hiện mới có sân khấu sảnh với avatar là khối viên nhộng tạm (`features/lobby/components/LobbyStage.tsx`).

Khi chốt luồng trận mới (CR-005), chủ dự án muốn phòng chờ giống Goose Goose Duck: thấy rõ ai đã vào, ai đã sẵn sàng, đổi nhân vật ngay tại chỗ. Màn vinh danh cuối trận kiểu Kahoot (hiện lần lượt hạng 3, 2, 1). Cả hai đều không cần 3D. Nhân vật đã có bản SVG 2D với 7 biểu cảm ([ADR 0009](0009-chalkboard-style-and-characters.md)), đủ sinh động.

Ràng buộc: một người làm, ưu tiên điện thoại tầm trung, gói tải ban đầu ≤ 300 KB gzip.

## Quyết định

Gỡ toàn bộ 3D khỏi sản phẩm: phòng chờ và vinh danh chung cuộc làm bằng React + nhân vật SVG + hoạt ảnh CSS; xoá các gói `three`, `@react-three/fiber`, `@react-three/drei`, `@types/three`.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Giữ 3D như kế hoạch (sảnh, avatar .glb, bục 3D) | Ấn tượng | Chunk three.js nặng (hàng trăm KB), tốn pin, phải làm/tối ưu model, khó đọc thông tin người chơi trên sân khấu 3D |
| Chỉ giữ bục trao giải 3D | Khoảnh khắc chiến thắng "xịn" hơn | Vẫn kéo cả three.js vào chỉ cho một màn; nhân vật 3D không khớp với nhân vật SVG |
| **Toàn bộ 2D (SVG + CSS)** | Nhẹ, đồng bộ phong cách bảng phấn, nhân vật dùng lại được ở mọi màn, ít việc hơn | Không có hiệu ứng chiều sâu |

## Hệ quả

- Gói tải nhẹ hơn, sảnh mở nhanh hơn trên 4G; hết rủi ro chạy hai canvas WebGL cùng lúc. Bất biến số 4 trong `AGENTS.md` ("mỗi lúc chỉ một canvas WebGL") vẫn giữ: lúc này chỉ còn Phaser dùng WebGL.
- Lộ trình GĐ 2 bỏ 2 việc (avatar .glb, bục 3D) → bù cho phần việc thêm của CR-005 ở GĐ 1.
- Khi làm phải cập nhật: [Tech stack](../tech-stack.md), [Cây thư mục](../folder-structure.md), [Tổng quan kiến trúc](../overview.md), mục 3D trong [Asset](../../03-guides/assets.md) và `AGENTS.md` (bất biến số 4 nhắc tới `LobbyStage.tsx`).
- Xem xét lại nếu sau 1.0 muốn một chế độ có không gian 3D thật (vd. bàn cờ kiểu Pummel Party) — khi đó viết ADR mới thay thế ADR này.
