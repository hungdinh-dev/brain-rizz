# Hướng dẫn asset (2D, âm thanh)

Phong cách: bảng phấn + thẻ nhãn dán, hình phẳng (flat) 2D, mỗi nhóm kỹ năng một màu chủ đạo (đã khai báo trong `apps/web/src/styles/globals.css`), nhân vật chibi SVG và linh vật "Não Rizz" tự vẽ ([ADR 0009](../02-architecture/decisions/0009-chalkboard-style-and-characters.md)). **Không dùng 3D** — phòng chờ và vinh danh đều là React + SVG + hoạt ảnh CSS ([ADR 0010](../02-architecture/decisions/0010-drop-3d-2d-lobby-and-podium.md)).

## Nguồn asset miễn phí

| Nguồn | Có gì | Giấy phép | Dùng cho |
| --- | --- | --- | --- |
| Kenney | Sprite, bộ UI, icon, âm thanh | CC0 | UI, icon, đồ vật trong minigame, hiệu ứng âm thanh |
| lucide (đã cài, `lucide-react`) | Icon nét | ISC | Icon giao diện React |

Luôn đọc file license trong từng gói và **ghi vào `assets/LICENSES.md` trước khi commit**.

Ready Player Me đã đóng cửa ngày 31/1/2026 ([Avatar SDK](https://avatarsdk.com/blog/2026/08/31/avatar-platforms-2026-whos-alive-whos-gone/)) — không dùng dịch vụ avatar bên ngoài.

## Nhân vật

- 6 con vật × 7 biểu cảm vẽ bằng SVG trong code: `apps/web/src/components/characters/` (`specs.tsx` cho hình dạng từng con, `Character.tsx` cho mặt/biểu cảm chung). Hoạt ảnh ở `styles/characters.css`, tự tắt khi bật "giảm chuyển động".
- Người chơi chọn nhân vật (`avatar`) và có màu nền riêng do server cấp (`colorIndex`) để phân biệt khi trùng nhân vật; avatar tròn dùng `components/common/PlayerAvatar.tsx`.
- Bục vinh danh và hình minh hoạ cách chơi cũng vẽ bằng SVG/CSS (`features/results/`, `games/<id>/…HowTo.tsx`), không cần file ảnh.

## Pipeline 2D

1. Vẽ vector (Figma hoặc Inkscape), lưu nguồn ở `assets/source/figma/`.
2. Xuất PNG gấp đôi kích thước hiển thị.
3. Gom thành texture atlas (free-tex-packer) — mỗi minigame một atlas.
4. Đặt vào `apps/web/public/assets/games/<id>/`, nạp trong `preload()` của scene Phaser.
5. Hình học đơn giản (như Kẻ lạc đàn) vẽ bằng `Graphics` của Phaser, không cần ảnh.

Icon giao diện React dùng SVG.

## Âm thanh

- Nguồn: gói CC0 của Kenney; hiệu ứng tự tạo bằng jsfxr (lưu file dự án ở `assets/source/audio/`).
- Xuất `.webm` (Opus) kèm `.mp3` dự phòng cho Safari cũ.
- iOS chỉ phát âm thanh sau lần chạm đầu tiên: mở khoá audio ở nút "Tạo phòng"/"Vào phòng".
