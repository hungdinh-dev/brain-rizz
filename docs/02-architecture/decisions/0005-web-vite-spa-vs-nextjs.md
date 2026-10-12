# ADR 0005: Web client là SPA Vite + React, không dùng Next.js

- Trạng thái: Đã chấp nhận
- Ngày: 2026-10-09

## Bối cảnh

Lúc lập kế hoạch chỉ ghi "Vite + React 19 + Tailwind" mà không so sánh với Next.js. ADR này ghi lại lý do để không phải bàn lại. Lưu ý: Next.js cũng là React — câu hỏi thực chất là *React SPA build bằng Vite* hay *React kèm framework có server*.

Đặc điểm của `apps/web`:

- Gần như mọi thứ chạy trong trình duyệt: Phaser và three.js cần `window`/WebGL, không render ở server được.
- Đã có server riêng (Colyseus, [ADR 0002](0002-game-server-colyseus-vs-supabase-realtime.md)) giữ WebSocket lâu dài.
- Hosting web phải miễn phí: file tĩnh trên Cloudflare Pages ([ADR 0004](0004-hosting-strategy.md)).
- Người chơi vào qua link mời `/r/<mã>`, không qua Google; gần như không cần SEO.
- Ngân sách JS ban đầu dưới 300 KB gzip; Phaser, three.js, từng minigame là chunk riêng.

## Quyết định

Giữ `apps/web` là SPA build bằng Vite, deploy dạng file tĩnh; không dùng Next.js cho phần chơi game.

## Các phương án đã cân nhắc

| Phương án | Ưu | Nhược |
| --- | --- | --- |
| **Vite SPA** (chọn) | Ra file tĩnh, host 0 đồng; `import()` động tách chunk rõ ràng; Vitest dùng chung toolchain; đọc thẳng TypeScript của `packages/shared` | Không có SSR/SEO; tự lo routing (hiện chưa cần router) |
| Next.js (App Router) | SSR, RSC, API routes, ảnh OG động, SEO tốt | Hầu hết component phải `"use client"` / `dynamic(..., { ssr: false })` nên RSC gần như vô dụng; API routes không thay được Colyseus (serverless không giữ WebSocket); host trên Cloudflare cần adapter (OpenNext); thêm `transpilePackages` cho shared; thêm một server phải chạy |
| Next.js `output: "export"` | Vẫn ra file tĩnh | Mất hết lợi thế của Next, chỉ còn thêm độ phức tạp |

## Hệ quả

- Dễ: build nhanh, deploy tĩnh miễn phí, kiểm soát bundle, không lỗi hydration với Phaser/three.js.
- Khó: không có trang render sẵn cho SEO; thẻ meta chia sẻ link chỉ là nội dung tĩnh trong `index.html`.
- **Khi nào xem lại:** cần trang công khai muốn lên Google (landing, blog, hướng dẫn từng minigame), trang hồ sơ hay bảng xếp hạng render sẵn, ảnh OG động. Khi đó nên thêm một app riêng `apps/site` (Astro hoặc Next.js) cho phần nội dung, phần chơi game vẫn là Vite SPA.
