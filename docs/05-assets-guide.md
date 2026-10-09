# Hướng dẫn asset (2D, 3D, âm thanh)

Phong cách: low-poly màu pastel cho 3D, phẳng (flat) cho 2D, mỗi nhóm kỹ năng một màu chủ đạo (đã khai báo trong `apps/web/src/styles.css`), cùng một linh vật "giáo sư" tự thiết kế.

## Nguồn asset miễn phí

| Nguồn | Có gì | Giấy phép | Dùng cho |
| --- | --- | --- | --- |
| Kenney | Model 3D, sprite, bộ UI, âm thanh | CC0 | UI, icon, đồ vật, hiệu ứng âm thanh |
| KayKit | Nhân vật, bộ đồ vật low-poly, có glTF | CC0 | Avatar, trang trí lobby |
| Quaternius | Hàng trăm gói nhân vật, sinh vật có animation | CC0 (gói Ultimate có giấy phép riêng: không cần ghi công nhưng cấm bán lại asset) | Avatar, linh vật |
| Poly Pizza | Hơn 10.600 model low-poly | CC0 hoặc CC BY tùy model | Đồ vật lẻ; ghi công nếu là CC BY |
| Poly Haven | HDRI, texture | CC0 | Ánh sáng môi trường cho lobby |

Thông tin giấy phép tổng hợp từ [Cinevva](https://app.cinevva.com/de/guides/free-rigged-3d-character-models); luôn đọc file license trong từng gói và **ghi vào `assets/LICENSES.md` trước khi commit**.

Ready Player Me đã đóng cửa ngày 31/1/2026 ([Avatar SDK](https://avatarsdk.com/blog/2026/08/31/avatar-platforms-2026-whos-alive-whos-gone/)) — không dùng dịch vụ avatar bên ngoài.

## Hệ avatar

- Một bộ xương chung cho mọi thân hình để dùng lại animation: đứng yên, vẫy tay, mừng, buồn.
- Cấu hình avatar là JSON nhỏ, ví dụ `{ body: 2, colorIndex: 3, hat: "graduation" }`, gửi kèm khi vào phòng.
- Màu đổi bằng texture bảng màu (palette) 1 ảnh nhỏ, không cần nhiều vật liệu.
- Hiện tại `apps/web/src/three/LobbyStage.tsx` dùng khối capsule làm avatar tạm.

## Pipeline 3D

```text
assets/source/blender/*.blend
   │  Blender: gộp mesh, đặt gốc toạ độ, texture ≤ 1024 px, áp dụng transform
   ▼
assets/exports/*.glb                (bản xuất chưa nén)
   │  glTF-Transform: nén Meshopt + WebP
   ▼
apps/web/public/assets/models/*.glb (bản ship) → nạp bằng useGLTF của drei
```

```bash
npx @gltf-transform/cli optimize assets/exports/avatar.glb apps/web/public/assets/models/avatar.glb \
  --compress meshopt --texture-compress webp --texture-size 1024
```

Meshopt giải nén nhanh và hợp nhân vật có animation hơn Draco; KTX2 giảm bộ nhớ GPU cho texture nếu điện thoại bị giật ([Cinevva](https://app.cinevva.com/guides/optimize-glb-for-web)).

### Ngân sách cho điện thoại

| Hạng mục | Giới hạn |
| --- | --- |
| Toàn cảnh lobby | < 3 MB tải về, < 50.000 tam giác |
| Mỗi avatar | < 3.000 tam giác, 1 texture palette |
| Texture | ≤ 1024×1024 |
| Bóng đổ | Không dùng bóng real-time; dùng `ContactShadows` của drei hoặc bóng vẽ sẵn |

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
