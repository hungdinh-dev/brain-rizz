# ADR 0007: Đa ngôn ngữ bằng i18next, bản dịch viết trong code

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-09

## Bối cảnh

Giao diện cần hỗ trợ tiếng Việt và tiếng Anh. Chữ hiển thị trước đây nằm rải rác: trong JSX và trong `packages/shared` (`DIFFICULTY_LABELS`, `CATEGORY_LABELS`, `title`/`howTo` của từng minigame) — tức là gói logic dùng chung cho server lại chứa chữ giao diện tiếng Việt.

## Quyết định

- Dùng **i18next + react-i18next**. Bản dịch là **object TypeScript viết thẳng trong code**, đóng gói cùng bundle (không tải JSON qua mạng), khởi tạo đồng bộ (`initAsync: false`) nên không cần Suspense.
- `src/i18n/locales/vi.ts` là nguồn chuẩn; `en.ts` khai báo kiểu `LocaleMessages` nên thiếu/thừa khoá là TypeScript báo lỗi. Khoá dịch có kiểu (`src/i18n/i18next.d.ts`): gõ sai `t("lobby.strat")` cũng báo lỗi.
- Tên và cách chơi của **từng minigame nằm cạnh game đó**: `src/games/<id>/locales.ts`, gom vào namespace `games` (hook `useGameText(id)`).
- `packages/shared` **không còn chữ giao diện**: bỏ `DIFFICULTY_LABELS`, `CATEGORY_LABELS`, `title`, `howTo`; web dịch theo mã (`difficulty.<n>`, `category.<nhóm>`). Lỗi từ server dịch theo `ErrorPayload.code` (`errors.<code>`), `message` của server chỉ là dự phòng.
- Ngôn ngữ lần đầu: đã chọn trước đó (`localStorage`) → ngôn ngữ trình duyệt → tiếng Việt. `<html lang>` cập nhật theo.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| **i18next, bản dịch trong code** (chọn) | Chuẩn phổ biến (nội suy, số nhiều, namespace); khoá có kiểu; không request thêm | ~15 KB gzip; mọi ngôn ngữ nằm trong bundle đầu |
| i18next + tải JSON theo ngôn ngữ (`i18next-http-backend`) | Bundle đầu nhẹ khi có nhiều ngôn ngữ | Thêm request, cần Suspense/loading; thừa với 2 ngôn ngữ |
| Tự viết hàm `t()` + object | Nhẹ nhất | Tự làm nội suy, số nhiều, đổi ngôn ngữ, kiểu khoá |
| Lingui / FormatJS | Trích xuất chuỗi tự động, ICU | Cần bước build/trích xuất, nặng quy trình cho dự án nhỏ |

## Hệ quả

- Mọi chữ hiển thị mới **phải** đi qua `t()`; thêm khoá vào `vi.ts` trước, TypeScript sẽ chỉ ra `en.ts` thiếu gì.
- Minigame mới tự mang bản dịch riêng (`pnpm new-game` tạo sẵn `locales.ts`).
- **Khi nào xem lại:** từ khoảng 4 ngôn ngữ trở lên hoặc bản dịch lớn → tách mỗi ngôn ngữ thành chunk `import()` riêng; cần người dịch không biết code → chuyển sang file JSON + công cụ dịch.
