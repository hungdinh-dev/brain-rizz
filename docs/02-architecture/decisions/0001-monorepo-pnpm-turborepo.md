# ADR 0001: Monorepo pnpm + Turborepo, TypeScript toàn bộ

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-09

## Bối cảnh

Client và server phải chạy **cùng một đoạn code sinh câu đố** (xem ADR 0003). Dự án do một người làm, cần ít công cụ, ít cấu hình.

## Quyết định

Một repo gồm `apps/web`, `apps/server`, `packages/shared`, quản lý bằng **pnpm workspaces** và chạy task bằng **Turborepo**. Toàn bộ viết TypeScript. `packages/shared` xuất thẳng mã nguồn TypeScript (không build riêng): Vite và Vitest đọc trực tiếp, server dùng tsdown gộp vào bundle.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| Hai repo riêng + publish gói shared | Tách bạch | Mỗi lần sửa câu đố phải publish, dễ lệch phiên bản client/server |
| npm/yarn workspaces | Quen thuộc | pnpm nhanh hơn, tiết kiệm đĩa, chặt chẽ hơn về dependency |
| Nx | Nhiều tính năng | Nặng, nhiều khái niệm so với nhu cầu 3 package |
| Biome thay ESLint + Prettier | Một công cụ, rất nhanh | Ít plugin hơn ESLint (chấp nhận được) |

## Hệ quả

- Đổi logic câu đố một chỗ, client và server cùng nhận.
- Kiểu dữ liệu tin nhắn dùng chung, sai lệch bị TypeScript bắt ngay.
- Phải dùng `pnpm`, không dùng `npm install` trong repo.
