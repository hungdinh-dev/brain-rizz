# ADR 0006: Component UI theo shadcn/ui, màu qua token ngữ nghĩa (sáng/tối)

- Trạng thái: Đã chấp nhận — phần nói về 3D (sân khấu sảnh) bị thay thế bởi [ADR 0010](0010-drop-3d-2d-lobby-and-podium.md)
- Ngày: 2026-10-09

## Bối cảnh

Trước đây giao diện React dùng vài `@utility` tự viết (`btn-primary`, `btn-ghost`, `card`, `field`) và màu viết thẳng (`text-white/60`, `bg-white/5`). Vấn đề:

- Đổi kiểu nút bằng chuỗi class viết tay (`d === difficulty ? "btn-primary px-2" : "btn-ghost px-2"`), lặp ở nhiều màn hình.
- Thiếu a11y: nút chọn độ khó/màu không có `aria-pressed`/radiogroup, toast không có `role="status"`.
- Màu cứng theo nền tối nên không làm được giao diện sáng.

## Quyết định

1. **Dùng shadcn/ui** (style `radix-vega`, primitive `radix-ui`): code component được chép vào `apps/web/src/components/ui/` và **chỉnh tự do** cho phong cách party game (nút cao 48px, `rounded-2xl`, nhún khi bấm). Variant viết bằng `cva`, gộp class bằng `cn()` (`clsx` + `tailwind-merge`).
2. **Token ngữ nghĩa kiểu shadcn** trong `src/styles/globals.css`: `--background`, `--foreground`, `--card`, `--primary`, `--muted-foreground`, `--border`… có bản `:root` (sáng) và `.dark` (tối). Màu thương hiệu (`mint`, `pink`, `sun`, `ink`, `paper`…) giữ nguyên cho điểm nhấn.
3. **Sáng/tối**: class `.dark` trên `<html>`, mặc định theo hệ điều hành, lựa chọn lưu `localStorage` (`src/stores/theme.store.ts`); `index.html` có script nhỏ gắn class trước khi React chạy để không nháy màu.
4. **Không cài package `shadcn`** vào dự án. Package này kéo theo `zod@3`, làm pnpm tách đôi `@colyseus/core` (test server lỗi "seat reservation expired"). File CSS cần thiết của nó được chép vào `src/styles/shadcn.css`; thêm component bằng `pnpm dlx shadcn@latest add <tên>` (chạy trong `apps/web`).

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| **shadcn/ui** (chọn) | Code nằm trong repo, sửa thoải mái; Radix lo a11y, focus, bàn phím; hợp Tailwind 4 + React 19 | Mặc định nhìn "dashboard" → phải chỉnh lại; mỗi primitive thêm vài KB |
| Tự viết `Button`/`Input` với `cva` | Nhẹ nhất | Tự làm a11y cho Dialog, Select, Popover… khi cần |
| Thư viện đóng gói (MUI, Mantine, Chakra) | Đủ component | Nặng, khó chỉnh theo phong cách riêng, khoá vào thư viện |
| Giữ `@utility` CSS | Không thêm gì | Không có variant/a11y, không có theme sáng/tối |

## Hệ quả

- Viết UI: dùng component trong `@/components/ui` và class token (`bg-card`, `text-muted-foreground`, `bg-primary`…), **không** dùng `text-white/…`, `bg-ink`… cho nền/chữ thông thường. Inline `style` chỉ cho giá trị tính lúc chạy (vd. màu avatar).
- Bundle đầu tăng từ khoảng 150 KB lên khoảng 200 KB gzip (gồm cả i18n — [ADR 0007](0007-i18n-inline-resources.md)), vẫn dưới ngân sách 300 KB. Nút đổi theme/ngôn ngữ cố ý là nút bấm thay vì `DropdownMenu` (menu thêm ~23 KB gzip).
- Thêm component mới: chạy `pnpm dlx shadcn@latest add <tên>`, sau đó chỉnh `import { cn } from "@/lib/utils"` nếu CLI ghi sai, bỏ `"use client"`, `pnpm format`. Nếu component dùng `next-themes` thì đổi sang `useResolvedTheme()`.
- Canvas Phaser/three.js không đọc được CSS variable: màu phụ thuộc theme lấy qua `useResolvedTheme()` (vd. sàn sân khấu sảnh).
