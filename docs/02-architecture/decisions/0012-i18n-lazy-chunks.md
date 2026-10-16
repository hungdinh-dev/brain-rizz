# ADR 0012: Tải lười chữ của màn một mình và minigame

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-16
- Bổ sung cho: [ADR 0007](0007-i18n-inline-resources.md) (bản dịch vẫn viết trong code; chỉ đổi thời điểm tải)

## Bối cảnh

Sau CR-009 (4 màn mới + supabase-js), JS tải ban đầu lên 296,4 KB gzip, sát mức 300 KB của NFR-PERF-01. ADR 0007 để mọi chữ, kể cả namespace `games`, nằm trong gói đầu.

## Quyết định

Gói đầu chỉ chứa namespace `common` của các màn luôn cần (giới thiệu, menu, hồ sơ, khung chung). Chữ của 4 màn một mình (`i18n/locales/solo/{vi,en}.ts`) và chữ minigame (`games/<id>/locales.ts`) là chunk `import()`, gộp vào i18next khi chunk của màn được tải (`i18n/solo.ts`, `i18n/games.ts`). Các màn trong phòng party cùng registry minigame tải lười qua `app/party-screens.tsx` và được tải trước khi trình duyệt rảnh ở menu.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Tải lười chữ theo chunk màn hình (chọn) | Gói đầu 243 KB gzip, còn chỗ cho các game mới; vẫn là TS, `en` vẫn bị ép đủ khoá qua kiểu gộp | Lần đầu vào phòng trên mạng chậm có thể thấy "Đang tải…" thoáng qua |
| Giữ nguyên ADR 0007 | Đơn giản | Vượt 300 KB ngay khi thêm 1–2 game |
| Tải JSON bản dịch qua HTTP | Chuẩn i18next | Mất kiểm tra kiểu khoá, thêm request |

## Hệ quả

- Chữ mới của màn một mình thêm vào `locales/solo/`, chữ màn luôn cần vẫn ở `locales/vi.ts`/`en.ts`.
- Còn chỗ giảm tiếp: zod (~80 KB chưa nén) đang nằm trong gói đầu dù web không validate; xem lại khi gói đầu lại gần mức trần.
