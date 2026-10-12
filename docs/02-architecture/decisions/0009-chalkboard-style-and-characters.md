# ADR 0009: Phong cách bảng phấn, thẻ nhãn dán và nhân vật SVG

- Trạng thái: Đã chấp nhận — phần nói về 3D (sân khấu sảnh) bị thay thế bởi [ADR 0010](0010-drop-3d-2d-lobby-and-podium.md)
- Ngày: 2026-10-10

## Bối cảnh

Giao diện ban đầu (ADR 0006) là nền kem/tím than với thẻ shadcn mặc định, chạy được nhưng thô và thiếu cá tính cho một party game. Bản thiết kế mới (canvas "Brain Rizz — Màn chờ & Menu": <https://claude.ai/artifact/GJZbipfsLC2TNo7TPws7CZ>) chốt phong cách "bảng phấn lớp học" lấy cảm hứng từ Big Brain Academy nhưng không dùng lại hình ảnh nào của Nintendo, cùng bộ nhân vật chibi vẽ mới (Khói lấy theo mèo thật của tác giả, Bơ theo chó thật). Avatar trước đây chỉ là chấm màu (`colorIndex`), không đủ để người chơi nhận ra nhau và không biểu cảm được.

## Quyết định

Toàn bộ màn hình ngoài minigame đặt trên mặt bảng phấn trong khung gỗ. Nội dung nằm trên thẻ "giấy dán" viền mực có bóng đổ. Người chơi chọn một nhân vật SVG (`avatar`, đồng bộ qua server) có 7 biểu cảm hoạt ảnh.

## Chi tiết

- **Token** (`apps/web/src/styles/globals.css`): `--background` là màu bảng (xanh lá khi sáng, tím than khi tối). Chữ viết thẳng lên bảng dùng `text-chalk` / `text-chalk-muted`; `text-muted-foreground` chỉ dùng **bên trong thẻ**. Các token `--sticker`, `shadow-sticker` dùng cho viền và bóng đổ của thẻ, nút. Màu nhấn chính `--primary` là vàng sun.
- **Font**: Baloo 2 (`font-display`) cho tiêu đề, nút, logo; Be Vietnam Pro cho chữ thường. Cả hai đủ dấu tiếng Việt.
- **Nhân vật** (`apps/web/src/components/characters/`): một thân tròn dùng chung, mỗi con vật khai báo tai, đuôi, mảng lông, kiểu mắt trong `specs.tsx`. Biểu cảm (mắt, miệng, tay, hiệu ứng) ghép chung trong `Character.tsx`, nên con vật mới tự có đủ 7 biểu cảm. Hoạt ảnh bằng CSS (`styles/characters.css`) và tự tắt khi người dùng bật `prefers-reduced-motion`.
- **Giao thức**: thêm `avatar: CharacterId` vào `JoinOptions`, `SetProfile` và `PlayerView`. Màu (`colorIndex`) vẫn giữ để phân biệt người chơi trùng nhân vật và cho sân khấu 3D. Nhân vật được phép trùng nhau.
- **Chế độ chưa làm** (Tìm trận, Luyện tập, Thử thách hằng ngày, Bảng xếp hạng): vẫn hiện trong menu với nhãn "Sắp có", bấm vào thì báo sắp ra mắt, không hiện số liệu giả.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Giữ nền kem + chấm màu, chỉ chỉnh chi tiết | Ít việc | Không có cá tính, avatar không biểu cảm |
| Nhân vật bằng ảnh PNG/sprite sheet | Vẽ tự do hơn | Nặng bundle, khó đổi màu/biểu cảm, mỗi biểu cảm một file |
| Nhân vật bằng Spine/Rive | Hoạt ảnh mượt nhất | Thêm runtime, cần công cụ trả phí/học thêm |
| **SVG ghép phần + hoạt ảnh CSS** | Nhẹ (chỉ là code), sắc nét mọi kích thước, thêm biểu cảm/nhân vật bằng code | Hình phức tạp vẽ tay bằng toạ độ khá tốn công |

## Hệ quả

- Nền bảng luôn tối ở cả hai chế độ: chữ phụ đặt trực tiếp trên bảng phải dùng `text-chalk-muted`, không dùng `text-muted-foreground`. QA cần soát điểm này.
- Minigame Phaser vẫn vẽ trên vùng `bg-muted` (giấy) nên màu trong scene không đổi.
- Muốn chuyển sang Rive/Spine thì chỉ cần thay bên trong `Character`, giữ nguyên props `id` / `mood` cho nơi gọi.
- Sân khấu 3D ở sảnh (`LobbyStage`) vẫn là hình viên nhộng theo màu, chưa dùng nhân vật; nên làm khi tới giai đoạn 3D.
